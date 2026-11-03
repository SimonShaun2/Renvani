import type { ProductVisualContent } from "@/src/content/marketing-content";

import { ProductVisual } from "./ProductVisual";

export function VisualSection({ content, as: Heading = "h2" }: { content: ProductVisualContent; as?: "h1" | "h2" }) {
  return (
    <section id={content.slug} className="py-12 md:py-20" aria-labelledby={`${content.slug}-heading`}>
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-mkt-muted)" }}>
          {content.eyebrow}
        </p>
        <Heading id={`${content.slug}-heading`} className="mt-2 text-3xl font-semibold md:text-5xl" style={{ color: "var(--color-mkt-ink)" }}>
          {content.heading}
        </Heading>
        <p className="mt-4 max-w-2xl text-base md:text-lg" style={{ color: "var(--color-mkt-muted)" }}>
          {content.body}
        </p>
        <div className="mt-8">
          <ProductVisual content={content} />
        </div>
      </div>
    </section>
  );
}
