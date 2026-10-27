import Fastify from "fastify";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";

import requestLoggerPlugin from "./request-logger.js";

describe("request-logger plugin", () => {
  it("'Request completed' log path never contains a booking manage token", async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _enc, cb) {
        lines.push(chunk.toString());
        cb();
      }
    });
    const app = Fastify({ logger: { level: "info", stream }, disableRequestLogging: true });
    await app.register(requestLoggerPlugin);
    app.get("/api/v1/public/booking/manage/:token", async () => ({ ok: true }));
    const token = "eyJhbGciOiJIUzI1NiJ9.secret-manage-token.sig";
    await app.inject({ method: "GET", url: `/api/v1/public/booking/manage/${token}?x=1` });
    await app.inject({ method: "GET", url: `/api/v1/public/booking/manage/${token}` });
    await app.close();

    const completed = lines.map((l) => JSON.parse(l)).filter((l) => l.msg === "Request completed");
    expect(completed).toHaveLength(2);
    for (const entry of completed) {
      expect(entry.path).toBe("/api/v1/public/booking/manage/[REDACTED]");
    }
    expect(JSON.stringify(completed)).not.toContain("secret-manage-token");
  });
});
