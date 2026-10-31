import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/** Renders a link only when the destination page exists; otherwise plain text (no dead or redirecting links). */
export function MaybeLink({ href, className, style, children }: { href: string | null; className?: string; style?: CSSProperties; children: ReactNode }) {
  if (!href) {
    return (
      <span className={className} style={style} data-pending-route="">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={className} style={style}>
      {children}
    </Link>
  );
}
