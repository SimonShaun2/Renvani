import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PRODUCT_PAGE_BY_SLUG } from "./flagship-registry";
import styles from "./detail-pages.module.css";

/** Actual app frames exported from the canonical Figma file, not workflow placeholder graphics. */
export const INDUSTRY_PRODUCT_SCREENS: Record<string, { node: string; width: number; height: number; label: string }> = {
  "scheduling-dispatch": { node: "399:4534", width: 1440, height: 960, label: "Dispatch board" },
  "customers-properties-assets": { node: "399:6454", width: 1440, height: 960, label: "Customer and property profile" },
  "estimates-approvals": { node: "399:5150", width: 1440, height: 960, label: "Estimate builder" },
  "jobs-work-orders": { node: "399:5031", width: 1440, height: 960, label: "Job and work order detail" },
  "technician-app": { node: "643:87", width: 1112, height: 834, label: "Technician job brief · Tablet" },
  "inquiry-response-follow-up": { node: "399:9026", width: 1440, height: 960, label: "Inquiry inbox" },
  "online-booking": { node: "399:11992", width: 390, height: 844, label: "Customer service booking" },
  "service-agreements": { node: "399:6245", width: 1440, height: 960, label: "Recurring service plans" },
  "reminders-win-backs": { node: "399:6591", width: 1440, height: 960, label: "Marketing follow-up" },
  "time-tracking-job-photos": { node: "399:13183", width: 390, height: 844, label: "Technician job photos" },
  "price-book-service-catalog": { node: "399:8688", width: 1440, height: 960, label: "Service price book" }
};

export function IndustryProductScreen({ tool }: { tool: string }) {
  const screen = INDUSTRY_PRODUCT_SCREENS[tool];
  const product = PRODUCT_PAGE_BY_SLUG[tool];
  if (!screen || !product) throw new Error(`No product screen for ${tool}`);
  const src = `/marketing/product-screens/${tool}.avif`;
  return <figure className={styles.visualStage} data-tone={2} data-trade-scene="history" data-product-screen={tool} data-figma-node={screen.node}>
    <a href={src} target="_blank" rel="noopener noreferrer" aria-label={`View full-size ${product.name} screen`} style={{ display: "block", width: "100%" }}>
      <Image src={src} alt={`Renvani ${screen.label}, exported from the product design with illustrative data`} width={screen.width} height={screen.height} sizes="(min-width: 960px) 650px, 90vw" unoptimized style={{ display: "block", width: "100%", height: "auto", maxHeight: screen.width < screen.height ? 520 : undefined, objectFit: "contain", borderRadius: 14 }} />
    </a>
    <figcaption>{screen.label} · Product design preview · Example data</figcaption>
    <Link href={`/product/${tool}`} className={styles.textLink}>{product.name}<ArrowUpRight size={16} aria-hidden="true" /></Link>
  </figure>;
}
