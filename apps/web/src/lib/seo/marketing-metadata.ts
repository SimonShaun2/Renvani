import type { Metadata } from "next";
import { publicSiteUrl } from "./public-site-origin";

/** Route-local canonical URLs; never inherit the home canonical on every marketing page. */
export function withMarketingSeo(path: string, metadata: Metadata, env: NodeJS.ProcessEnv = process.env): Metadata {
  const base = publicSiteUrl(env);
  const safePath = path.startsWith("/") && !path.startsWith("//") && !/[?#\\]/.test(path);
  if (!base || !safePath) return { ...metadata, alternates: null, robots: { index: false, follow: false } };
  const canonical = new URL(path, base).href;
  return {
    ...metadata,
    alternates: { ...metadata.alternates, canonical },
    robots: { index: true, follow: true },
    openGraph: { ...metadata.openGraph, url: canonical, siteName: "Renvani", type: "website" }
  };
}

/** No customer counts, ratings, certifications or invented offers are included. */
export function marketingStructuredData(env: NodeJS.ProcessEnv = process.env) {
  const base = publicSiteUrl(env);
  if (!base) return null;
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": base + "/#organization", name: "Renvani", url: base,
        logo: base + "/brand/logo-horizontal.svg" },
      { "@type": "SoftwareApplication", "@id": base + "/#software", name: "Renvani", url: base,
        applicationCategory: "BusinessApplication", operatingSystem: "Web",
        description: "One connected platform for home and field service businesses to win work, run jobs and bring customers back.",
        publisher: { "@id": base + "/#organization" } }
    ]
  };
}

/** Escape markup delimiters before embedding JSON in a script element. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
