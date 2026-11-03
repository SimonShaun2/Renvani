import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

const neonCiUrl = process.env.NEON_CI_DATABASE_URL?.trim();

describe.runIf(Boolean(neonCiUrl))("FS-235 Clerk workspace worker (Postgres)", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = neonCiUrl;
  });

  it("authorizes exactly one provider create across concurrent workers", async () => {
    const { clerkWorkspaceIntents, db } = await import("@fsm/db");
    const { databaseClerkWorkspaceIntentRepository } = await import("./clerk-workspace.processor.js");
    const intentId = randomUUID();
    const clerkUserId = `user_fs235_${randomUUID()}`;
    await db.insert(clerkWorkspaceIntents).values({
      id: intentId,
      clerkUserId,
      requestedName: "FS-235 concurrency",
      status: "pending"
    });

    const claims = await Promise.all(
      Array.from(
        { length: 8 },
        () => databaseClerkWorkspaceIntentRepository.claim(intentId, clerkUserId)
      )
    );
    expect(claims.filter((claim) => claim !== null)).toHaveLength(1);
    expect(claims.filter((claim) => claim === null)).toHaveLength(7);
    expect(claims.find((claim) => claim !== null)?.status).toBe("claimed");

    await db.update(clerkWorkspaceIntents)
      .set({ deletedAt: new Date() })
      .where(eq(clerkWorkspaceIntents.id, intentId));
    let duplicateError: unknown;
    try {
      await db.insert(clerkWorkspaceIntents).values({
        id: randomUUID(),
        clerkUserId,
        requestedName: "FS-235 duplicate after archived intent",
        status: "pending"
      });
    } catch (error) {
      duplicateError = error;
    }
    // Drizzle may wrap the Postgres error in a query error; inspect the cause chain.
    let current = duplicateError;
    let uniqueViolation = false;
    for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
      if ((current as { code?: unknown }).code === "23505") {
        uniqueViolation = true;
        break;
      }
      current = (current as { cause?: unknown }).cause;
    }
    expect(uniqueViolation).toBe(true);
  });
});
