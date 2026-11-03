import { cn } from "@/src/lib/utils";

interface BrandMarkProps {
  compact?: boolean;
  light?: boolean;
}

export function BrandMark({ compact = false, light = false }: BrandMarkProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-accent font-semibold tracking-tight text-white shadow-lg shadow-brand-accent/30",
          compact && "h-9 w-9 rounded-xl text-sm"
        )}
      >
        R
      </div>
      <div className="space-y-0.5">
        <p className={cn("text-lg font-semibold tracking-tight", light ? "text-white" : "text-neutral-900")}>
          Renvani
        </p>
        <p className={cn("text-xs", light ? "text-neutral-400" : "text-neutral-500")}>
          Grow your shop. Renvani runs the rest.
        </p>
      </div>
    </div>
  );
}
