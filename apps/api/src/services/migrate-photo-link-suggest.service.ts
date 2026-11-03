import { and, eq, isNull } from "drizzle-orm";

import { assets, customers, db, jobs } from "@fsm/db";
import type { MigratePhotoLinkSuggestion, MigratePhotoUploadObject } from "@fsm/types";

function tokenizePath(relativePath: string): string[] {
  return relativePath
    .replaceAll("\\", "/")
    .toLowerCase()
    .split(/[/_.\-\s]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function scoreContains(haystack: string, needle: string): number {
  if (needle.length < 2) {
    return 0;
  }
  return haystack.includes(needle) ? 0.35 : 0;
}

export async function buildMigratePhotoLinkSuggestions(
  companyId: string,
  objects: MigratePhotoUploadObject[]
): Promise<MigratePhotoLinkSuggestion[]> {
  const [customerRows, jobRows, assetRows] = await Promise.all([
    db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        displayName: customers.displayName,
        email: customers.email
      })
      .from(customers)
      .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt))),
    db
      .select({
        id: jobs.id,
        jobNumber: jobs.jobNumber,
        title: jobs.title,
        customerId: jobs.customerId
      })
      .from(jobs)
      .where(and(eq(jobs.companyId, companyId), isNull(jobs.deletedAt))),
    db
      .select({
        id: assets.id,
        name: assets.name,
        serialNumber: assets.serialNumber,
        customerId: assets.customerId
      })
      .from(assets)
      .where(and(eq(assets.companyId, companyId), isNull(assets.deletedAt)))
  ]);

  return objects.map((object) => {
    const pathLower = object.relativePath.toLowerCase();
    const tokens = tokenizePath(object.relativePath);

    let bestCustomer: { id: string; label: string; score: number; reason: string } | null = null;
    for (const customer of customerRows) {
      const label =
        customer.displayName?.trim() ||
        `${customer.firstName} ${customer.lastName}`.trim();
      const labelLower = label.toLowerCase();
      let score = scoreContains(pathLower, labelLower.replaceAll(" ", "-"));
      score += scoreContains(pathLower, labelLower.replaceAll(" ", ""));
      if (customer.email) {
        score += scoreContains(pathLower, customer.email.toLowerCase());
      }
      for (const token of tokens) {
        score += scoreContains(labelLower, token);
      }
      if (!bestCustomer || score > bestCustomer.score) {
        bestCustomer = {
          id: customer.id,
          label,
          score,
          reason: score > 0 ? "path matched customer name or email" : "no customer match"
        };
      }
    }

    let bestJob: { id: string; label: string; score: number; reason: string } | null = null;
    for (const job of jobRows) {
      const jobNumberLower = job.jobNumber.toLowerCase();
      let score = scoreContains(pathLower, jobNumberLower);
      score += scoreContains(pathLower, job.title.toLowerCase());
      if (!bestJob || score > bestJob.score) {
        bestJob = {
          id: job.id,
          label: `${job.jobNumber} — ${job.title}`,
          score,
          reason: score > 0 ? "path matched job number or title" : "no job match"
        };
      }
    }

    let bestAsset: { id: string; label: string; score: number; reason: string } | null = null;
    for (const asset of assetRows) {
      let score = scoreContains(pathLower, asset.name.toLowerCase());
      if (asset.serialNumber) {
        score += scoreContains(pathLower, asset.serialNumber.toLowerCase());
      }
      if (!bestAsset || score > bestAsset.score) {
        bestAsset = {
          id: asset.id,
          label: asset.serialNumber ? `${asset.name} (${asset.serialNumber})` : asset.name,
          score,
          reason: score > 0 ? "path matched asset name or serial" : "no asset match"
        };
      }
    }

    const confidence = Math.min(
      1,
      Math.max(bestCustomer?.score ?? 0, bestJob?.score ?? 0, bestAsset?.score ?? 0, 0.05)
    );

    const reasons = [bestCustomer?.reason, bestJob?.reason, bestAsset?.reason].filter(
      (reason): reason is string => Boolean(reason && reason !== "no customer match" && reason !== "no job match" && reason !== "no asset match")
    );

    return {
      vendorFileId: object.vendorFileId,
      relativePath: object.relativePath,
      r2Key: object.r2Key,
      mimeType: object.mimeType,
      confidence,
      suggestedCustomerId: bestCustomer && bestCustomer.score > 0 ? bestCustomer.id : null,
      suggestedCustomerLabel: bestCustomer && bestCustomer.score > 0 ? bestCustomer.label : null,
      suggestedJobId: bestJob && bestJob.score > 0 ? bestJob.id : null,
      suggestedJobLabel: bestJob && bestJob.score > 0 ? bestJob.label : null,
      suggestedAssetId: bestAsset && bestAsset.score > 0 ? bestAsset.id : null,
      suggestedAssetLabel: bestAsset && bestAsset.score > 0 ? bestAsset.label : null,
      matchReason: reasons.length > 0 ? reasons.join("; ") : "no heuristic match — confirm manually"
    };
  });
}
