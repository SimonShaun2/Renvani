import { describe, expect, it } from "vitest";
import { formatFrameDuration, formatFrameRange, formatFrameTime } from "./dispatch.utils";

const at = (h: number, m = 0) => new Date(2026, 9, 27, h, m);

describe("Figma 10:552 / 10:555 time formats", () => {
  it("formats compact ranges", () => {
    expect(formatFrameRange(at(13), at(16))).toBe("1–4 p.m.");
    expect(formatFrameRange(at(11), at(13))).toBe("11 a.m.–1 p.m.");
    expect(formatFrameRange(at(9, 30), at(11))).toBe("9:30–11 a.m.");
  });
  it("formats start time and duration", () => {
    expect(formatFrameTime(at(13))).toBe("1:00 p.m.");
    expect(formatFrameDuration(at(13), at(16))).toBe("3 h");
    expect(formatFrameDuration(at(13), at(14, 30))).toBe("1.5 h");
  });
});
