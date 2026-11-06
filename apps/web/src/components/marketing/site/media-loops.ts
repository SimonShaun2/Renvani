/** Marketing media loop registry. Paths under apps/web/public. */

export const TRADE_LOOP_KEYS = {
  hvac: "trade-hvac",
  plumbing: "trade-plumbing",
  electrical: "trade-electrical",
  "appliance-repair": "trade-appliance",
  "pest-control": "trade-pest",
  "tree-care": "trade-tree"
} as const;

export type TradeLoopSlug = keyof typeof TRADE_LOOP_KEYS;

export const PRODUCT_SCREEN_LOOP_KEYS = {
  "scheduling-dispatch": "dispatch",
  dispatch: "dispatch",
  "technician-app": "technician-app",
  "estimates-approvals": "estimates-approvals",
  "online-booking": "online-booking",
  "inquiry-response-follow-up": "inquiry-response-follow-up"
} as const;

export type PosterSet = {
  /** JPEG fallback (no webp/avif). */
  src: string;
  webpSrcSet: string;
  avifSrcSet: string;
};

/** Build responsive poster paths from a stem like `/media/loops/hero-hvac-tech-poster`. */
export function posterSet(stem: string, widths: readonly number[]): PosterSet {
  return {
    src: `${stem}-fallback.jpg`,
    webpSrcSet: widths.map((w) => `${stem}-w${w}.webp ${w}w`).join(", "),
    avifSrcSet: widths.map((w) => `${stem}-w${w}.avif ${w}w`).join(", ")
  };
}

const W_HERO = [390, 768, 960] as const;
const W_STD = [390, 768] as const;
const W_WIDE = [390, 768, 1440] as const;

export const MEDIA = {
  why: {
    src: "/media/why-renvani/rafael-v4.mp4",
    poster: posterSet("/media/why-renvani/rafael-v4-poster", W_WIDE),
    captions: "/media/why-renvani/rafael-v4.vtt"
  },
  hero: {
    webm: "/media/loops/hero-hvac-tech-loop.webm",
    mp4: "/media/loops/hero-hvac-tech-loop.mp4",
    poster: posterSet("/media/loops/hero-hvac-tech-poster", W_HERO),
    width: 960,
    height: 720
  },
  operationsTechnician: {
    webm: "/media/loops/operations-technician-loop.webm",
    mp4: "/media/loops/operations-technician-loop.mp4",
    poster: posterSet("/media/loops/operations-technician-poster", W_HERO),
    width: 960,
    height: 720
  }
} as const;

export function tradeLoop(slug: string) {
  const key = TRADE_LOOP_KEYS[slug as TradeLoopSlug];
  if (!key) return null;
  return {
    webm: `/media/loops/${key}-loop.webm`,
    mp4: `/media/loops/${key}-loop.mp4`,
    poster: posterSet(`/media/loops/${key}-poster`, W_STD),
    width: 960,
    height: 720
  };
}

export function workLoop(id: string) {
  return {
    webm: `/media/loops/work-${id}-loop.webm`,
    mp4: `/media/loops/work-${id}-loop.mp4`,
    poster: posterSet(`/media/loops/work-${id}-poster`, W_WIDE),
    width: 1728,
    height: 1276
  };
}

export function productScreenLoop(slug: string) {
  const key = PRODUCT_SCREEN_LOOP_KEYS[slug as keyof typeof PRODUCT_SCREEN_LOOP_KEYS];
  if (!key) return null;
  // Some product posters only have 390/768 on disk (online-booking, technician-app).
  const wide = key === "dispatch" || key === "estimates-approvals" || key === "inquiry-response-follow-up";
  return {
    webm: `/media/loops/${key}-loop.webm`,
    mp4: `/media/loops/${key}-loop.mp4`,
    poster: posterSet(`/media/loops/${key}-poster`, wide ? W_WIDE : W_STD),
    width: 1440,
    height: 960
  };
}
