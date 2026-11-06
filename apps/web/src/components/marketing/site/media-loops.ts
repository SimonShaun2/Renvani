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

export const MEDIA = {
  why: {
    src: "/media/why-renvani/rafael-v4.mp4",
    poster: "/media/why-renvani/rafael-v4-poster.jpg",
    captions: "/media/why-renvani/rafael-v4.vtt"
  },
  hero: {
    webm: "/media/loops/hero-hvac-tech-loop.webm",
    mp4: "/media/loops/hero-hvac-tech-loop.mp4",
    poster: "/media/loops/hero-hvac-tech-poster.jpg",
    width: 960,
    height: 720
  },
  operationsTechnician: {
    webm: "/media/loops/operations-technician-loop.webm",
    mp4: "/media/loops/operations-technician-loop.mp4",
    poster: "/media/loops/operations-technician-poster.jpg",
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
    poster: `/media/loops/${key}-poster.jpg`,
    width: 960,
    height: 720
  };
}

export function workLoop(id: string) {
  return {
    webm: `/media/loops/work-${id}-loop.webm`,
    mp4: `/media/loops/work-${id}-loop.mp4`,
    poster: `/media/loops/work-${id}-poster.png`,
    width: 1728,
    height: 1276
  };
}

export function productScreenLoop(slug: string) {
  const key = PRODUCT_SCREEN_LOOP_KEYS[slug as keyof typeof PRODUCT_SCREEN_LOOP_KEYS];
  if (!key) return null;
  return {
    webm: `/media/loops/${key}-loop.webm`,
    mp4: `/media/loops/${key}-loop.mp4`,
    poster: `/media/loops/${key}-poster.png`,
    width: 1440,
    height: 960
  };
}
