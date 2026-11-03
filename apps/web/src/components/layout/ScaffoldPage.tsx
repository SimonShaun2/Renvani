import { PageLayout } from "./PageLayout";

interface ScaffoldPageProps {
  title: string;
  subtitle: string;
  ticket: string;
}

export function ScaffoldPage({ title, subtitle, ticket }: ScaffoldPageProps) {
  return (
    <PageLayout title={title} subtitle={subtitle}>
      <div className="surface-card p-8">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-accent">{title}</p>
          <h3 className="text-3xl font-semibold tracking-tight text-neutral-900">This surface is queued next.</h3>
          <p className="text-base leading-7 text-neutral-600">
            TODO: TICKET-{ticket}. The shell, tokens, auth, and routing are now in place, so this page can be
            implemented on top of the shared Renvani foundation.
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
