import pino from "pino";

import { env } from "@fsm/config";
import { assertOpenAiConfigured } from "./openai-config.js";

const logger = pino({
  name: "campaign-prompts"
});

export interface CampaignMessageContext {
  customerFirstName: string;
  recommendationType: string;
  companyName: string;
  daysSinceLastService?: number;
  assetType?: string;
  assetAge?: number;
  estimateNumber?: string;
  estimateTotal?: string;
  season?: string;
}

interface OpenAiResponseUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

interface OpenAiResponseContent {
  type: string;
  text?: string;
}

interface OpenAiResponseOutputItem {
  type: string;
  content?: OpenAiResponseContent[];
}

interface OpenAiResponseBody {
  error?: {
    message?: string;
  };
  model?: string;
  output?: OpenAiResponseOutputItem[];
  output_text?: string;
  usage?: OpenAiResponseUsage;
}

function normalizeFirstName(value: string): string {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : "there";
}

function stripWrappingQuotes(value: string): string {
  const trimmedValue = value.trim();

  if (
    (trimmedValue.startsWith("\"") && trimmedValue.endsWith("\"")) ||
    (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
  ) {
    return trimmedValue.slice(1, -1).trim();
  }

  return trimmedValue;
}

function truncateAtWordBoundary(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const maxContentLength = Math.max(maxLength - 3, 1);
  const candidate = value.slice(0, maxContentLength);
  const boundaryIndex = candidate.lastIndexOf(" ");
  const truncatedValue = boundaryIndex >= 40 ? candidate.slice(0, boundaryIndex) : candidate;
  return `${truncatedValue.trimEnd()}...`;
}

function normalizeGeneratedMessage(value: string): string {
  const compactValue = stripWrappingQuotes(value).replace(/\s+/g, " ").trim();
  return truncateAtWordBoundary(compactValue, 160);
}

function extractResponseText(responseBody: OpenAiResponseBody): string {
  if (typeof responseBody.output_text === "string" && responseBody.output_text.trim().length > 0) {
    return responseBody.output_text;
  }

  for (const outputItem of responseBody.output ?? []) {
    for (const contentItem of outputItem.content ?? []) {
      if (contentItem.type === "output_text" && typeof contentItem.text === "string") {
        const trimmedValue = contentItem.text.trim();

        if (trimmedValue.length > 0) {
          return trimmedValue;
        }
      }
    }
  }

  throw new Error("OpenAI response did not include any output text");
}

function buildAdditionalContext(ctx: CampaignMessageContext): string {
  const parts: string[] = [];

  if (ctx.daysSinceLastService !== undefined) {
    parts.push(`Days since last service: ${ctx.daysSinceLastService}`);
  }

  if (ctx.assetType) {
    parts.push(`Asset type: ${ctx.assetType}`);
  }

  if (ctx.assetAge !== undefined) {
    parts.push(`Asset age: ${ctx.assetAge} years`);
  }

  if (ctx.estimateNumber) {
    parts.push(`Estimate number: ${ctx.estimateNumber}`);
  }

  if (ctx.estimateTotal) {
    parts.push(`Estimate total: $${ctx.estimateTotal}`);
  }

  if (ctx.season) {
    parts.push(`Season: ${ctx.season}`);
  }

  return parts.length > 0 ? parts.join("; ") : "None";
}

export async function generateCampaignMessage(ctx: CampaignMessageContext): Promise<string> {
  const prompt = [
    "You are writing a personalized SMS message for a field service company.",
    "Write a friendly, professional message based on the context below.",
    "",
    `Company: ${ctx.companyName}`,
    `Customer first name: ${normalizeFirstName(ctx.customerFirstName)}`,
    `Reason for outreach: ${ctx.recommendationType}`,
    `Additional context: ${buildAdditionalContext(ctx)}`,
    "",
    "Rules:",
    "- Maximum 160 characters",
    "- Use first name only",
    "- No emojis",
    "- Sound human, not automated",
    "- Include a clear call to action",
    "- Do not include URLs (those are added separately)",
    "",
    "Return ONLY the message text, nothing else."
  ].join("\n");

  assertOpenAiConfigured();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: prompt,
      temperature: 0.8,
      max_output_tokens: 100,
      text: {
        format: {
          type: "text"
        }
      }
    })
  });

  const responseBody = (await response.json()) as OpenAiResponseBody;

  logger.debug(
    {
      model: responseBody.model ?? "gpt-4o-mini",
      promptTokens: responseBody.usage?.input_tokens,
      completionTokens: responseBody.usage?.output_tokens,
      totalTokens: responseBody.usage?.total_tokens,
      recommendationType: ctx.recommendationType
    },
    "OpenAI token usage"
  );

  if (!response.ok) {
    throw new Error(responseBody.error?.message ?? `OpenAI request failed with status ${response.status}`);
  }

  return normalizeGeneratedMessage(extractResponseText(responseBody));
}
