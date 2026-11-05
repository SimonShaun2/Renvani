import { BellRing, Brush, Bug, DoorOpen, Droplets, Flame, KeyRound, Snowflake, Sparkles, SprayCan, TreePine, WashingMachine, Wind, Zap } from "lucide-react";
import type { IndustrySlug } from "./industry-registry";
const icons = { hvac: Snowflake, plumbing: Droplets, electrical: Zap, "appliance-repair": WashingMachine, "garage-doors": DoorOpen, locksmith: KeyRound, cleaning: Sparkles, "pest-control": Bug, chimney: Flame, "pressure-washing": SprayCan, "tree-care": TreePine, alarm: BellRing, "air-duct": Wind, "carpet-cleaning": Brush };
export function IndustryIcon({ slug, size = 22 }: { slug: IndustrySlug; size?: number }) { const Icon = icons[slug]; return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />; }
