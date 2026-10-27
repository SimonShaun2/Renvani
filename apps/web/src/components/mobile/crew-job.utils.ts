import type { JobStatus } from "@fsm/types";

/** Status pill copy for frames 1:13 ("On site") and 1:23 ("On the way"). */
export function getCrewStatusLabel(status: JobStatus): string {
  switch (status) {
    case "in_progress":
      return "On site";
    case "dispatched":
      return "On the way";
    case "scheduled":
      return "Scheduled";
    case "on_hold":
      return "On hold";
    case "completed":
    case "invoiced":
    case "paid":
      return "Done";
    default:
      return status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  }
}

export function getCrewStatusTone(status: JobStatus): string {
  if (status === "in_progress" || status === "completed" || status === "invoiced" || status === "paid") {
    return "bg-[#e5f4ea] text-[#1f6b3a]";
  }
  if (status === "dispatched") return "bg-[#e3e9ff] text-[#2d4bd8]";
  if (status === "on_hold") return "bg-[#fff4d6] text-[#7a5600]";
  return "bg-[#efe9df] text-[#5e6684]";
}

/** "Arriving ~10:40a" from an OTW send time plus ETA minutes (frame 1:23). */
export function formatArrival(sentAt: string, etaMinutes: number): string {
  const at = new Date(new Date(sentAt).getTime() + etaMinutes * 60_000);
  const h = at.getHours();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `~${hour12}:${String(at.getMinutes()).padStart(2, "0")}${h < 12 ? "a" : "p"}`;
}
