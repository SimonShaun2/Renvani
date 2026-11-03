import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

const neonCiUrl = process.env.NEON_CI_DATABASE_URL?.trim();

async function inPhase<T>(phase: "db_import" | "processor_import" | "intent_insert" | "claims" | "archive", work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch {
    // The CI log reports this fixed label only, never raw database errors or connection details.
    throw new Error(`FS235_PG_PHASE_${phase}`);
  }
}

describe.runIf(Boolean(neonCiUrl))("FS-235 Clerk workspace worker (Postgres)", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = neonCiUrl;
  });

  it("authorizes exactly one provider create across concurrent workers", async () => {
    const { clerkWorkspaceIntents, db } = await inPhase("db_import", () => import("@fsm/db"));
    const { databaseClerkWorkspaceIntentRepository } = await inPhase("processor_import", () => import("./clerk-workspace.processor.js"));
    const intentId = randomUUID();
    const clerkUserId = `user_fs235_${randomUUID()}`;
    await inPhase("intent_insert", async () => db.insert(clerkWorkspaceIntents).values({
      id: intentId,
      clerkUserId,
      requestedName: "FS-235 concurrency",
      status: "pending"
    }));

    const claims = await inPhase("claims", () => Promise.all(
      Array.from(
        { length: 8 },
        () => databaseClerkWorkspaceIntentRepository.claim(intentId, clerkUserId)
      )
    ));
    expect(claims.filter((claim) => claim !== null)).toHaveLength(1);
    expect(claims.filter((claim) => claim === null)).toHaveLength(7);
    expect(claims.find((claim) => claim !== null)?.status).toBe("claimed");

    const [archived] = await inPhase("archive", async () => db.update(clerkWorkspaceIntents)
      .set({ deletedAt: new Date() })
      .where(eq(clerkWorkspaceIntents.id, intentId))
      .returning({ id: clerkWorkspaceIntents.id, deletedAt: clerkWorkspaceIntents.deletedAt }));
    expect(archived?.id).toBe(intentId);
    expect(archived?.deletedAt).toBeInstanceOf(Date);
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
