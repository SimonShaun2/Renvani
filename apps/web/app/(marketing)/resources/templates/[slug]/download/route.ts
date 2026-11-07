import { findTemplate, templateText } from "@/src/lib/resources/playbook";

/** Whitelisted public copy only. No filesystem paths, CMS drafts, or submitted customer data. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const template = findTemplate((await params).slug);
  if (!template) return new Response("Template not found.", { status: 404, headers: { "X-Robots-Tag": "noindex", "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(templateText(template), { headers: {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Disposition": `attachment; filename="${template.slug}.txt"`,
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex",
    "Cache-Control": "public, max-age=3600"
  } });
}
