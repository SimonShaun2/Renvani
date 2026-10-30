import { describe, expect, it } from "vitest";

import { completionHint, ISSUE_CATEGORIES } from "./CrewFinishJob";
import { isTaskDone } from "./CrewChecklist";
import { formatArrival, getCrewStatusLabel } from "./crew-job.utils";

describe("crew job frames", () => {
  it("maps statuses to frame pills", () => {
    expect(getCrewStatusLabel("in_progress")).toBe("On site");
    expect(getCrewStatusLabel("dispatched")).toBe("On the way");
    expect(getCrewStatusLabel("completed")).toBe("Done");
  });

  it("formats arrival like ~10:40a", () => {
    const sent = new Date(2026, 9, 27, 10, 28).toISOString();
    expect(formatArrival(sent, 12)).toBe("~10:40a");
    expect(formatArrival(new Date(2026, 9, 27, 12, 50).toISOString(), 15)).toBe("~1:05p");
  });

  it("treats completed and skipped tasks as done", () => {
    expect(isTaskDone({ status: "completed" })).toBe(true);
    expect(isTaskDone({ status: "skipped" })).toBe(true);
    expect(isTaskDone({ status: "pending" })).toBe(false);
  });

  it("gates Mark complete on status and required items", () => {
    expect(completionHint("scheduled", false)).toMatch(/in progress/);
    expect(completionHint("in_progress", true)).toMatch(/required/);
    expect(completionHint("in_progress", false)).toMatch(/completed/);
  });

  it("lists the frame's issue categories", () => {
    expect(ISSUE_CATEGORIES).toEqual(["Damage", "Access", "Safety", "Customer dispute", "Ran long"]);
  });
});
