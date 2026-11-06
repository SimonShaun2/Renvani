import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/(marketing)/demo/actions", () => ({ submitDemoRequest: vi.fn() }));
vi.mock("@/app/(marketing)/growth-check/actions", () => ({ submitGrowthCheck: vi.fn() }));
vi.mock("./fonts", () => ({ geist: { variable: "g" }, inter: { variable: "i", className: "inter" }, newsreader: { variable: "n" } }));
import { DemoPage } from "./DemoPage";
import { GrowthCheckPage } from "./GrowthCheckPage";
afterEach(cleanup);

describe("public lead form native reset guard", () => {
  it.each(["demo", "growth"])("%s cancels reset events without dropping selected trade or team size", kind => {
    const view = render(kind === "demo" ? <DemoPage action={vi.fn()} /> : <GrowthCheckPage action={vi.fn()} />);
    const form = view.container.querySelector("form")!;
    fireEvent.change(screen.getByLabelText("First Name"), { target: { value: "Renvani" } });
    fireEvent.change(screen.getByLabelText("Trade"), { target: { value: "hvac" } });
    fireEvent.change(screen.getByLabelText("Team Size"), { target: { value: "2–5" } });
    // The browser resets only if this cancelable event is not prevented.
    // happy-dom's .reset() incorrectly mutates controls before dispatching, so test the event contract.
    expect(fireEvent.reset(form)).toBe(false);
    expect(new FormData(form).get("firstName")).toBe("Renvani");
    expect(new FormData(form).get("trade")).toBe("hvac");
    expect(new FormData(form).get("teamSize")).toBe("2–5");
    expect(new FormData(form).get("hp")).toBe("");
  });
});
