import { describe, expect, it } from "vitest";

import { POST } from "./route";

const call = (body: unknown, ip = "9.9.9.9") =>
  POST(new Request("http://x/api/site/summit/inquiry-gate", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": ip } }), {
    params: Promise.resolve({ slug: "summit" })
  });

describe("inquiry gate route", () => {
  it("silently drops honeypot submissions", async () => {
    const res = await call({ website: "http://spam" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, accepted: false });
  });

  it("accepts 5 then returns 429", async () => {
    for (let i = 0; i < 5; i += 1) expect((await call({}, "1.1.1.1")).status).toBe(200);
    const blocked = await call({}, "1.1.1.1");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
  });
});
