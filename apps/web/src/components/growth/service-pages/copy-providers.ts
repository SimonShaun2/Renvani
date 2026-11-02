/**
 * Copy generation behind a provider interface. `template` is the deterministic default (fixture-quality copy).
 * `openai` is a disabled adapter: it only runs when OPENAI_API_KEY is set AND SERVICE_PAGE_AI_COPY_APPROVED="true"
 * (no human-approval API exists yet, so AI copy is never auto-published by default). Output is plain text only.
 */
export interface ServiceCopyInput {
  companyName: string;
  service: string;
  area: string;
  priceHint: string | null;
}

export interface ServiceCopy {
  headline: string;
  intro: string;
  bullets: string[];
  provider: string;
}

export interface ServiceCopyProvider {
  key: string;
  enabled(env: NodeJS.ProcessEnv): boolean;
  generate(input: ServiceCopyInput, env: NodeJS.ProcessEnv): Promise<ServiceCopy | null>;
}

const MAX_TEXT = 400;

/** Strips markup/control characters; copy is rendered as React text, never HTML. */
export function toPlainText(value: unknown, max = MAX_TEXT): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, "")
    // eslint-disable-next-line no-control-regex -- strip control chars from generated copy
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export const templateCopyProvider: ServiceCopyProvider = {
  key: "template",
  enabled: () => true,
  async generate({ companyName, service, area, priceHint }) {
    return {
      provider: "template",
      headline: `${service} in ${area}`,
      // Figma 155:79 body copy. "licensed tech" is the frame's wording for every trade.
      intro: `Need ${service.toLowerCase()} in ${area}? ${companyName} sends a licensed tech to homes across ${area} with clear, upfront pricing. Pick a time online and get your confirmation by email.`,
      bullets: priceHint && priceHint !== "Request a quote" ? [`Pricing: ${priceHint}`] : []
    };
  }
};

export const openAiCopyProvider: ServiceCopyProvider = {
  key: "openai",
  enabled: (env) => Boolean(env.OPENAI_API_KEY) && env.SERVICE_PAGE_AI_COPY_APPROVED === "true",
  async generate(input, env) {
    if (!openAiCopyProvider.enabled(env)) return null;
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: env.SERVICE_PAGE_AI_MODEL ?? "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                'Write short local service page copy as JSON {"headline","intro","bullets":[3 strings]}. Plain text, no HTML, no prices unless given, no competitor names, no invented claims.'
            },
            { role: "user", content: JSON.stringify(input) }
          ]
        }),
        next: { revalidate: 86400 }
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}") as Record<string, unknown>;
      const bullets = Array.isArray(parsed.bullets) ? parsed.bullets.map((b) => toPlainText(b, 160)).filter(Boolean).slice(0, 3) : [];
      const headline = toPlainText(parsed.headline, 120);
      const intro = toPlainText(parsed.intro);
      return headline && intro ? { provider: "openai", headline, intro, bullets } : null;
    } catch {
      return null;
    }
  }
};

/** Registry, highest preference first; the template provider is always the fallback. */
export const SERVICE_COPY_PROVIDERS: ServiceCopyProvider[] = [openAiCopyProvider, templateCopyProvider];

export async function generateServiceCopy(
  input: ServiceCopyInput,
  env: NodeJS.ProcessEnv = process.env,
  providers: ServiceCopyProvider[] = SERVICE_COPY_PROVIDERS
): Promise<ServiceCopy> {
  for (const provider of providers) {
    if (!provider.enabled(env)) continue;
    const copy = await provider.generate(input, env);
    if (copy) return copy;
  }
  return (await templateCopyProvider.generate(input, env))!;
}
