// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZipCheckCard } from "./ZipCheckCard";
import { EmergencyBadge, EmergencyToggle } from "./EmergencyToggle";
import { emergencyAvailable, emergencySubmitFields, emergencyWasDowngraded, normalizeUsZip } from "./booking-growth.utils";

afterEach(cleanup);

function setup(checkZip: (zip: string) => Promise<{ served: boolean }>, zip = "78704") {
  const props = {
    companyName: "Summit Heating & Air",
    zip,
    onZipChange: vi.fn(),
    checkZip: vi.fn(checkZip),
    onContinue: vi.fn(),
    captureEmail: vi.fn(async () => ({ success: true }))
  };
  render(<ZipCheckCard {...props} />);
  return props;
}
const state = () => screen.getByTestId("zip-check").getAttribute("data-state");
const click = async (name: string) => { await act(async () => { fireEvent.click(screen.getByRole("button", { name })); }); };

describe("ZipCheckCard", () => {
  it("in area (310:122/186): posts the normalized ZIP and continues with it", async () => {
    const p = setup(async () => ({ served: true }), "78704-1234");
    expect(screen.getByText("Enter your ZIP code to see if Summit Heating & Air can book a visit.")).toBeTruthy();
    await click("Check ZIP");
    expect(p.checkZip).toHaveBeenCalledWith("78704");
    expect(state()).toBe("in_area");
    expect(screen.getByText("✓ Yes, we serve 78704")).toBeTruthy();
    await click("Continue to booking");
    expect(p.onContinue).toHaveBeenCalledWith("78704");
  });

  it("out of area (310:143/207): email only, no phone or texting; captures {zip, email}", async () => {
    const p = setup(async () => ({ served: false }));
    await click("Check ZIP");
    expect(state()).toBe("out_of_area");
    expect(screen.getByText("We don't serve 78704 yet")).toBeTruthy();
    const card = screen.getByTestId("zip-check").textContent ?? "";
    expect(card).not.toMatch(/phone|call|text/i);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " dana@example.com " } });
    await click("Email me when you do");
    expect(p.captureEmail).toHaveBeenCalledWith({ zip: "78704", email: "dana@example.com" });
    expect(screen.getByRole("status").textContent).toMatch(/email you/);
  });

  it("error (310:166/230): banner + Retry re-runs the check", async () => {
    let n = 0;
    const p = setup(async () => { n += 1; if (n === 1) throw new Error("down"); return { served: true }; });
    await click("Check ZIP");
    expect(state()).toBe("error");
    expect(screen.getByRole("alert").textContent).toBe("We couldn't check that ZIP. Try again.");
    expect(screen.getByLabelText("ZIP code").getAttribute("aria-invalid")).toBe("true");
    await click("Retry");
    expect(p.checkZip).toHaveBeenCalledTimes(2);
    expect(state()).toBe("in_area");
  });

  it("editing the ZIP after a check resets the old result", async () => {
    setup(async () => ({ served: true }));
    await click("Check ZIP");
    expect(state()).toBe("in_area");
    fireEvent.change(screen.getByLabelText("ZIP code"), { target: { value: "7873" } });
    expect(state()).toBe("idle");
    expect(screen.queryByText("✓ Yes, we serve 78704")).toBeNull();
  });

  it("invalid ZIP never calls the API", async () => {
    const p = setup(async () => ({ served: true }), "7870x");
    await click("Check ZIP");
    expect(p.checkZip).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a 5-digit ZIP code.")).toBeTruthy();
  });
});

describe("Emergency toggle + badge", () => {
  it("off (310:251) and on (310:275) copy and switch state", () => {
    const onChange = vi.fn();
    const { rerender } = render(<EmergencyToggle on={false} onChange={onChange} />);
    const sw = screen.getByRole("switch");
    expect(sw.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("Turn this on if you need help right away.")).toBeTruthy();
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(<EmergencyToggle on onChange={onChange} />);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Emergency requests are flagged and shown first to the team.")).toBeTruthy();
  });

  it("summary badge (310:299)", () => {
    render(<EmergencyBadge />);
    expect(screen.getByTestId("emergency-badge").textContent).toBe("EMERGENCY");
  });
});

describe("payload + helpers", () => {
  it("emergency submit fields", () => {
    expect(emergencySubmitFields(true, "this_week")).toEqual({ urgency: "emergency", emergency: true });
    expect(emergencySubmitFields(false, "emergency")).toEqual({ urgency: "this_week" });
    expect(emergencySubmitFields(false, "flexible")).toEqual({ urgency: "flexible" });
  });
  it("toggle availability, downgrade, ZIP normalize", () => {
    expect(emergencyAvailable({ emergencyService: { enabled: true } })).toBe(true);
    expect(emergencyAvailable({})).toBe(false);
    expect(emergencyAvailable(undefined)).toBe(false);
    expect(emergencyWasDowngraded({ emergency: { requested: true, accepted: false, downgraded: true } })).toBe(true);
    expect(emergencyWasDowngraded({})).toBe(false);
    expect(normalizeUsZip("787041234")).toBe("78704");
    expect(normalizeUsZip("1234")).toBeNull();
  });
});
