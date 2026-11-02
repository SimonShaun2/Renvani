/**
 * Workflow tour ("Watch a job from start to finish"), Figma jiGHTNUJNltWbHA4Il3hk7 page "11 Current" (171:2).
 * One page per step: each step has its own desktop + mobile frame (no tablet frame exists). Step 1 lives at /tour.
 */
export type TourStep = { slug: string; name: string; frames: { desktop: string; mobile: string }; description: string };

export const TOUR_STEPS: TourStep[] = [
  { slug: "book-direct", name: "Book direct", frames: { desktop: "217:6308", mobile: "217:6333" }, description: "A homeowner books an AC visit straight from your website." },
  { slug: "approve-the-work", name: "Approve the work", frames: { desktop: "204:9861", mobile: "204:9866" }, description: "The estimate goes out with price-book pricing and the customer approves it." },
  { slug: "plan-the-day", name: "Plan the day", frames: { desktop: "204:9862", mobile: "204:9867" }, description: "The approved job lands on the schedule with the right technician." },
  { slug: "complete-the-visit", name: "Complete the visit", frames: { desktop: "204:9863", mobile: "204:9868" }, description: "The technician works the checklist, adds photos and completes the visit." },
  { slug: "get-paid", name: "Get paid", frames: { desktop: "204:9864", mobile: "204:9869" }, description: "The invoice goes out with a payment link and the receipt is emailed." },
  { slug: "bring-them-back", name: "Bring them back", frames: { desktop: "204:9865", mobile: "204:9870" }, description: "A service agreement schedules the next visit and the reminder." }
];

export const TOUR_BASE = "/tour";
export const tourPath = (slug: string) => (slug === TOUR_STEPS[0]!.slug ? TOUR_BASE : `${TOUR_BASE}/${slug}`);
export const TOUR_STEP_BY_SLUG: Record<string, TourStep> = Object.fromEntries(TOUR_STEPS.map((s) => [s.slug, s]));
export const tourMeta = (s: TourStep) => ({ title: `Product tour: ${s.name} · Renvani`, description: s.description });
