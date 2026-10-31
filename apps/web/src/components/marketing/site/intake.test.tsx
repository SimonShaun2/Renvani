import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

vi.mock("@/app/(marketing)/demo/actions", () => ({ submitDemoRequest: vi.fn() }));
vi.mock("@/app/(marketing)/growth-check/actions", () => ({ submitGrowthCheck: vi.fn() }));

import { isPublicRoute } from "@/src/lib/route-access";
import { MARKETING_SITEMAP_PATHS } from "@/src/lib/seo/public-sitemap";
import { postMarketingIntake, runIntake, type IntakeResult } from "@/src/lib/marketing-intake";

import { DemoPage } from "./DemoPage";
import { GrowthCheckPage } from "./GrowthCheckPage";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

function demoForm(over: Record<string, string> = {}) {
  const fd = new FormData();
  const v = { name: "Alex Rivera", email: "alex@example.com", company: "Rivera Heating", trade: "hvac", teamSize: "2–5", hp: "", ...over };
  for (const [k, val] of Object.entries(v)) fd.set(k, val);
  return fd;
}
function growthForm(over: Record<string, string> = {}) {
  const fd = new FormData();
  const v = { websiteUrl: "riveraheating.com", trade: "plumbing", location: "74103", email: "alex@example.com", hp: "", ...over };
  for (const [k, val] of Object.entries(v)) fd.set(k, val);
  return fd;
}

describe("marketing intake (server-side POST)", () => {
  it("posts the contract body to the API and returns the confirmation", async () => {
    const f = vi.fn(async () => json(201, { ok: true, confirmationId: "c_123" }));
    const r = await runIntake("demo-requests", demoForm(), f as unknown as typeof fetch);
    expect(r).toEqual({ status: "success", confirmationId: "c_123" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/public\/marketing\/demo-requests$/);
    expect(JSON.parse(String(init.body))).toEqual({ name: "Alex Rivera", email: "alex@example.com", company: "Rivera Heating", trade: "hvac", message: "Team size: 2–5", hp: "" });
  });

  it("builds the growth-check body (https added, ZIP split from city)", async () => {
    const f = vi.fn(async () => json(201, { ok: true, confirmationId: "g_1" }));
    await runIntake("growth-checks", growthForm(), f as unknown as typeof fetch);
    expect(JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ websiteUrl: "https://riveraheating.com", trade: "plumbing", zip: "74103", email: "alex@example.com", hp: "" });
    await runIntake("growth-checks", growthForm({ location: "Tulsa" }), f as unknown as typeof fetch);
    expect(JSON.parse(String((f.mock.calls[1] as unknown as [string, RequestInit])[1].body))).toMatchObject({ city: "Tulsa" });
  });

  it("validates before calling the API", async () => {
    const f = vi.fn();
    const r = await runIntake("growth-checks", growthForm({ websiteUrl: "", location: "", email: "nope", trade: "" }), f as unknown as typeof fetch);
    expect(f).not.toHaveBeenCalled();
    expect(r.status).toBe("invalid");
    expect(Object.keys((r as Extract<IntakeResult, { status: "invalid" }>).fields).sort()).toEqual(["email", "location", "trade", "websiteUrl"]);
  });

  it("maps 400 VALIDATION_ERROR fields to inline errors", async () => {
    const f = async () => json(400, { error: { code: "VALIDATION_ERROR", fields: { email: ["Email is invalid"], zip: "Bad ZIP" } } });
    const r = await postMarketingIntake("growth-checks", { websiteUrl: "https://a.com", trade: "hvac", zip: "74103", email: "a@b.co", hp: "" }, f as unknown as typeof fetch, "http://api");
    expect(r).toEqual({ status: "invalid", fields: { email: "Email is invalid", location: "Bad ZIP" }, message: expect.any(String) });
  });

  it("forwards Retry-After on 429", async () => {
    const f = async () => json(429, { error: { code: "RATE_LIMITED" } }, { "Retry-After": "42" });
    const r = await postMarketingIntake("demo-requests", { name: "a", email: "a@b.co", company: "c", trade: "hvac", hp: "" }, f as unknown as typeof fetch, "http://api");
    expect(r).toMatchObject({ status: "rate-limited", retryAfterSeconds: 42 });
  });

  it("returns a friendly error on 413, 500 and network failure, without logging PII", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const body = { name: "Alex Rivera", email: "alex@example.com", company: "c", trade: "hvac" as const, hp: "" };
    expect((await postMarketingIntake("demo-requests", body, (async () => json(413, {})) as unknown as typeof fetch, "http://api")).status).toBe("error");
    expect((await postMarketingIntake("demo-requests", body, (async () => json(500, { error: { code: "INTERNAL_ERROR" } })) as unknown as typeof fetch, "http://api")).status).toBe("error");
    expect((await postMarketingIntake("demo-requests", body, (async () => { throw new Error("down"); }) as unknown as typeof fetch, "http://api")).status).toBe("error");
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/alex|Rivera/i);
    spy.mockRestore();
  });

  it("drops honeypot submissions without calling the API", async () => {
    const f = vi.fn();
    expect(await runIntake("demo-requests", demoForm({ hp: "spam" }), f as unknown as typeof fetch)).toEqual({ status: "success", confirmationId: "" });
    expect(f).not.toHaveBeenCalled();
  });
});

describe("demo and growth-check pages", () => {
  it("renders the demo form with contract fields and an off-screen honeypot", () => {
    const { container } = render(<DemoPage action={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Your business.");
    for (const l of ["Your name", "Work email", "Business name", "Trade", "Team size"]) expect(screen.getByLabelText(l)).toBeTruthy();
    const hp = container.querySelector('input[name="hp"]') as HTMLInputElement;
    expect(hp.type).toBe("text");
    expect(hp.tabIndex).toBe(-1);
    expect(hp.autocomplete).toBe("off");
    expect(hp.value).toBe("");
  });

  it("shows inline errors, then the success state", async () => {
    const action = vi.fn<(p: IntakeResult | null, fd: FormData) => Promise<IntakeResult>>()
      .mockResolvedValueOnce({ status: "invalid", fields: { email: "Enter a valid email." }, message: "Check the highlighted fields." })
      .mockResolvedValueOnce({ status: "success", confirmationId: "c_9" });
    render(<DemoPage action={action} />);
    await act(async () => fireEvent.submit(screen.getByRole("button", { name: "Request my demo" }).closest("form")!));
    expect(screen.getByText("Enter a valid email.")).toBeTruthy();
    expect(screen.getByLabelText("Work email").getAttribute("aria-invalid")).toBe("true");
    await act(async () => fireEvent.submit(screen.getByRole("button", { name: "Request my demo" }).closest("form")!));
    expect(screen.getByRole("status").textContent).toContain("c_9");
  });

  it("shows Retry-After and a retry button on 429", async () => {
    const action = vi.fn(async () => ({ status: "rate-limited", retryAfterSeconds: 30, message: "Too many requests." }) as IntakeResult);
    render(<GrowthCheckPage website="riveraheating.com" action={action} />);
    expect((screen.getByLabelText("Business website") as HTMLInputElement).value).toBe("riveraheating.com");
    await act(async () => fireEvent.submit(screen.getByRole("button", { name: "Send my report" }).closest("form")!));
    expect(screen.getByRole("alert").textContent).toContain("30 seconds");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("is public, in the sitemap, and no marketing CTA still points a demo at /signup", () => {
    for (const p of ["/demo", "/growth-check"]) {
      expect(isPublicRoute(p)).toBe(true);
      expect(MARKETING_SITEMAP_PATHS.some((s) => s.path === p)).toBe(true);
    }
    for (const f of readdirSync(__dirname).filter((n) => /\.tsx?$/.test(n) && !n.includes(".test."))) {
      expect(readFileSync(join(__dirname, f), "utf8")).not.toMatch(/Get a free demo"[\s\S]{0,400}?\/signup"/);
    }
  });
});

describe("marketing intake types (#328)", () => {
  it("uses the shared @fsm/types contract the API validates with", async () => {
    const shared = await import("@fsm/types");
    const lib = await import("@/src/lib/marketing-intake");
    expect(lib.MarketingDemoRequestBodySchema).toBe(shared.MarketingDemoRequestBodySchema);
    expect(lib.MarketingGrowthCheckBodySchema).toBe(shared.MarketingGrowthCheckBodySchema);
    expect(lib.MARKETING_HONEYPOT_FIELD).toBe(shared.MARKETING_HONEYPOT_FIELD);
    expect(lib.HOME_SERVICE_TRADES).toBe(shared.HOME_SERVICE_TRADES);
  });
});

describe("demo Team size errors", () => {
  it("maps the API `message` error to the teamSize field on /demo only", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ error: "VALIDATION_ERROR", fields: { message: "Too long" } }), { status: 400 }));
    const demo = await postMarketingIntake("demo-requests", { name: "A", email: "a@b.co", company: "C", trade: "hvac", hp: "" }, f as unknown as typeof fetch, "http://api");
    expect(demo).toMatchObject({ status: "invalid", fields: { teamSize: "Too long" } });
    const gc = await postMarketingIntake("growth-checks", { websiteUrl: "https://a.co", trade: "hvac", zip: "74103", email: "a@b.co", hp: "" }, f as unknown as typeof fetch, "http://api");
    expect(gc).toMatchObject({ status: "invalid", fields: { message: "Too long" } });
  });

  it("shows a Team size error under its own select", async () => {
    const action = vi.fn(async () => ({ status: "invalid", fields: { teamSize: "Choose team size." }, message: "Check the highlighted fields." }) as IntakeResult);
    const { container } = render(<DemoPage action={action} />);
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(container.querySelector("#demo-team")!.getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector("#demo-team-error")!.textContent).toBe("Choose team size.");
  });
});
