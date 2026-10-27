import Link from "next/link";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Link href="/" className="text-lg font-semibold" style={{ color: "var(--color-mkt-ink)" }}>
          Renvani
        </Link>
        <nav className="flex gap-5 text-sm" style={{ color: "var(--color-mkt-muted)" }}>
          <Link href="/product-tour">Product</Link>
          <Link href="/product/growth">Growth</Link>
          <Link href="/industries/hvac">HVAC</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
