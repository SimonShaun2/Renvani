import Link from "next/link";

import { COMPETITORS, hasCopyPlaceholder, type PageSection } from "@/src/content/page-sections";

export function TodoText({ text }: { text: string }) {
  if (!hasCopyPlaceholder(text)) return <>{text}</>;
  return (
    <span data-todo="copy" className="rounded bg-yellow-200 px-1 outline outline-2 outline-dashed outline-red-500">
      <strong className="mr-1 text-red-600">TODO</strong>
      {text}
    </span>
  );
}

type Faq = { faq?: [string, string][] };
type Table = { columns?: string[]; rows?: [string, string][] };
type Compare = { planPlusAddOns?: string[]; renvani?: string[] };

function Extra({ section }: { section: PageSection }) {
  const d = (section.data ?? {}) as Faq & Table & Compare;
  if (d.faq) {
    return (
      <dl className="mt-6 space-y-4">
        {d.faq
          .filter(([q, a]) => !COMPETITORS.test(q) && !COMPETITORS.test(a))
          .map(([q, a]) => (
            <div key={q}>
              <dt className="font-semibold">{q}</dt>
              <dd style={{ color: "var(--color-mkt-muted)" }}>{a}</dd>
            </div>
          ))}
      </dl>
    );
  }
  if (d.rows) {
    return (
      <table className="mt-6 w-full text-left text-sm">
        <tbody>
          {d.rows.map(([k, v]) => (
            <tr key={k} className="border-b" style={{ borderColor: "var(--color-mkt-line)" }}>
              <th className="py-2 pr-4 font-semibold">{k}</th>
              <td className="py-2">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (d.renvani) {
    return (
      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {d.renvani.map((t) => (
          <li key={t}>✓ {t}</li>
        ))}
      </ul>
    );
  }
  return null;
}

/** Renders one CMS section. `review-notes` never reaches this component. */
export function SectionBlock({ section, as: Heading = "h2" }: { section: PageSection; as?: "h1" | "h2" }) {
  // Only structured "Title — detail" lines render; raw mock-UI text dumps are skipped.
  const listItems = section.items.filter((line) => line.includes(" — ") || hasCopyPlaceholder(line));
  return (
    <section data-section={`${section.page}:${section.sectionKey}`} className="py-12 md:py-16">
      <div className="mx-auto max-w-6xl px-4">
        {section.eyebrow ? (
          <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-mkt-muted)" }}>
            <TodoText text={section.eyebrow} />
          </p>
        ) : null}
        {section.headline ? (
          <Heading className="mt-2 text-3xl font-semibold md:text-4xl" style={{ color: "var(--color-mkt-ink)" }}>
            <TodoText text={section.headline} />
          </Heading>
        ) : null}
        {section.subhead ? (
          <p className="mt-4 max-w-2xl text-base md:text-lg" style={{ color: "var(--color-mkt-muted)" }}>
            <TodoText text={section.subhead} />
          </p>
        ) : null}
        {section.callout ? (
          <p className="mt-4 font-semibold" style={{ color: "var(--color-mkt-ink)" }}>
            <TodoText text={section.callout} />
          </p>
        ) : null}
        {listItems.length ? (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {listItems.map((line, i) => (
              <li key={`${i}-${line}`} className="rounded-xl border bg-white p-4 text-sm" style={{ borderColor: "var(--color-mkt-line)" }}>
                <TodoText text={line} />
              </li>
            ))}
          </ul>
        ) : null}
        <Extra section={section} />
        {section.ctaLabel && section.ctaHref ? (
          <Link
            href={section.ctaHref}
            className="mt-6 inline-flex min-h-[44px] items-center rounded-full px-5 text-[15px] font-medium"
            style={{ background: "var(--color-mkt-amber)", color: "var(--color-mkt-ink)" }}
          >
            {section.ctaLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
