import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, ChevronDown, ClipboardList, Library } from "lucide-react";
import { HeaderDisclosure } from "../site/HeaderDisclosure";
import { MenuFooter } from "../site/MenuFooter";
import styles from "../site/products-menu.module.css";

const links = [
  { title: "The Renvani Playbook", description: "Build a better service business.", href: "/resources", Icon: Library },
  { title: "Articles & guides", description: "Practical ideas for the work ahead.", href: "/blog", Icon: BookOpen },
  { title: "Templates & checklists", description: "Ready to adapt. Free to use.", href: "/resources#library", Icon: ClipboardList }
];
/** Uses the established menu component and styles. Semantic ID, not a claimed Figma node. */
export function ResourcesMenu() {
  return <HeaderDisclosure nodeId="playbook-resources-menu" className="group/resources w-[90px] shrink-0" summary={<>Resources<ChevronDown size={12} aria-hidden="true" className="transition-transform group-open/resources:rotate-180 motion-reduce:transition-none" /></>} summaryClassName="flex items-center gap-1.5 hover:underline" panelClassName="absolute inset-x-8 top-[96px] z-30 mx-auto max-h-[calc(100dvh-112px)] max-w-[1184px] overflow-y-auto rounded-[24px] shadow-[0_20px_70px_rgba(15,21,48,0.16)]">
    <div className={styles.panel}>
      <div className={styles.content}>
        <div className={styles.heading}><p className={styles.headingLabel}>Ideas for your next good job.</p><Link href="/resources" className={styles.allProducts}>All resources<ArrowRight size={15} aria-hidden="true" /></Link></div>
        <nav aria-label="Renvani resources" className={styles.productCards} style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          {links.map(({ title, description, href, Icon }, index) => <Link key={href} href={href} className={`${styles.productCard} ${index === 0 ? styles.commandCard : ""}`}>
            <span className={styles.productIcon}><Icon size={20} strokeWidth={1.7} aria-hidden="true" /></span><span className={styles.productCopy}><span className={styles.productName}>{title}</span><span className={styles.productDescription}>{description}</span></span><ArrowUpRight size={16} aria-hidden="true" className={styles.productArrow} />
          </Link>)}
        </nav>
      </div>
      <MenuFooter mobile={false} />
    </div>
  </HeaderDisclosure>;
}
