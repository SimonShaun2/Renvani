import { ErrorCode } from "@fsm/types";
import { describe, expect, it } from "vitest";

import { ApiError } from "@/src/lib/api";

import {
  canAddOption,
  canManageOptionSets,
  canRemoveOption,
  describeOptionSetError,
  sortOptions,
  suggestedTierLabel
} from "./estimate-option-sets.utils";

const opt = (id: string, label: string | null, rank: number) => ({ estimateId: id, estimateNumber: `EST-${id}`, tierLabel: label, rank }) as never;
const conflict = (reason: string) => new ApiError(409, { error: ErrorCode.CONFLICT, message: "x", fields: { reason } } as never);

describe("estimate option set utils", () => {
  it("role gating matches the API (owner/admin/dispatcher)", () => {
    expect(["owner", "admin", "dispatcher"].every(canManageOptionSets)).toBe(true);
    expect(canManageOptionSets("office")).toBe(false);
    expect(canManageOptionSets("technician")).toBe(false);
    expect(canManageOptionSets(null)).toBe(false);
  });

  it("add/remove respect the 2–3 bounds and draft-only", () => {
    const two = { status: "draft", options: [1, 2] } as never;
    const three = { status: "draft", options: [1, 2, 3] } as never;
    expect(canAddOption(two)).toBe(true);
    expect(canAddOption(three)).toBe(false);
    expect(canRemoveOption(two)).toBe(false);
    expect(canRemoveOption(three)).toBe(true);
    expect(canRemoveOption({ status: "sent", options: [1, 2, 3] } as never)).toBe(false);
  });

  it("orders Good → Better → Best with custom labels last", () => {
    const sorted = sortOptions([opt("c", "Premium", 99), opt("b", "Best", 3), opt("a", "Good", 1)]);
    expect(sorted.map((o) => o.tierLabel)).toEqual(["Good", "Best", "Premium"]);
  });

  it("suggests the first unused registry label", () => {
    expect(suggestedTierLabel([{ tierLabel: "Good" }, { tierLabel: "best" }])).toBe("Better");
    expect(suggestedTierLabel([{ tierLabel: "Good" }, { tierLabel: "Better" }, { tierLabel: "Best" }])).toBe("");
  });

  it("maps 409 reasons; stale/not_draft/idempotency offer Reload", () => {
    expect(describeOptionSetError(conflict("stale_version"))).toMatchObject({ kind: "stale_version", reload: true });
    expect(describeOptionSetError(conflict("not_draft"))).toMatchObject({ kind: "not_draft", reload: true });
    expect(describeOptionSetError(conflict("idempotency_conflict"))).toMatchObject({ reload: true });
    expect(describeOptionSetError(conflict("option_limit"))).toMatchObject({ kind: "option_limit", reload: false });
    expect(describeOptionSetError(conflict("option_minimum")).message).toMatch(/at least 2/);
    expect(describeOptionSetError(new Error("x")).kind).toBe("unknown");
  });
});
