import type { MetadataRoute } from "next";

const asList = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Rule pattern → RegExp (Google robots semantics: `*` any run of characters, trailing `$` anchors the end). */
function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/**
 * Google-style evaluation for user-agent `*`: the longest matching rule wins; Allow wins a tie; no match = allowed.
 * Rule length is the pattern's character count (as Google measures it).
 */
export function isCrawlable(robots: MetadataRoute.Robots, path: string, userAgent = "*"): boolean {
  const rules = (Array.isArray(robots.rules) ? robots.rules : [robots.rules]).filter((r) => asList(r.userAgent).includes(userAgent));
  let best: { length: number; allow: boolean } | null = null;
  for (const rule of rules) {
    for (const [patterns, allow] of [[asList(rule.allow), true], [asList(rule.disallow), false]] as const) {
      for (const p of patterns) {
        if (!p || !patternToRegExp(p).test(path)) continue;
        if (!best || p.length > best.length || (p.length === best.length && allow && !best.allow)) best = { length: p.length, allow };
      }
    }
  }
  return best ? best.allow : true;
}
