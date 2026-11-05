/** Illustrative trade photography shared by the industry gallery and featured cards. */
export const INDUSTRY_PHOTOS = {
  hvac: {
    src: "/marketing/industries/illustrative-hvac-field-work-f1266660.jpg",
    alt: "HVAC technician servicing an outdoor condenser",
    objectPosition: "50% 50%"
  },
  plumbing: {
    src: "/marketing/industries/illustrative-plumbing-field-work-5d7f94f5.jpg",
    alt: "Plumber inspecting pipes beneath a kitchen sink",
    objectPosition: "50% 50%"
  },
  electrical: {
    src: "/marketing/industry-gallery/electrical-v1.webp",
    alt: "Electrical technician inspecting a residential breaker panel",
    objectPosition: "50% 50%"
  },
  "appliance-repair": {
    src: "/marketing/industry-gallery/appliance-repair-v1.webp",
    alt: "Appliance technician checking a front-loading washing machine",
    objectPosition: "50% 50%"
  },
  "pest-control": {
    src: "/marketing/industry-gallery/pest-control-v1.webp",
    alt: "Pest control technician inspecting an exterior bait station",
    objectPosition: "50% 50%"
  },
  "tree-care": {
    src: "/marketing/industry-gallery/tree-care-v1.webp",
    alt: "Tree care professional pruning a branch beside a mature tree",
    objectPosition: "50% 50%"
  }
} as const;

export type IndustryPhotoSlug = keyof typeof INDUSTRY_PHOTOS;
