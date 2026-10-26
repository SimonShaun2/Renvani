import { randomUUID } from "node:crypto";

import type { ImportFileLinkProposal } from "@fsm/types";

export interface FileLinkMatchTarget {
  entityType: "customer" | "job" | "asset";
  sourceId: string;
  label: string;
  tokens: string[];
}

export interface FileLinkObjectInput {
  vendorFileId: string;
  relativePath: string;
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/iu, "")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function tokenize(value: string): string[] {
  const normalized = normalizeToken(value);
  return normalized.length > 0 ? normalized.split(/\s+/u) : [];
}

function basename(relativePath: string): string {
  const segments = relativePath.split(/[/\\]+/u).filter(Boolean);
  return segments.at(-1) ?? relativePath;
}

function scoreTokenOverlap(pathTokens: string[], targetTokens: string[]): number {
  if (pathTokens.length === 0 || targetTokens.length === 0) {
    return 0;
  }

  const targetSet = new Set(targetTokens);
  let hits = 0;

  for (const token of pathTokens) {
    if (token.length < 2) {
      continue;
    }

    if (targetSet.has(token)) {
      hits += 1;
    }
  }

  return hits / Math.max(targetTokens.length, 1);
}

function findBestTarget(
  relativePath: string,
  targets: FileLinkMatchTarget[]
): { target: FileLinkMatchTarget; confidence: number; matchMethod: "folder_heuristic" | "filename_heuristic" } | null {
  const pathTokens = tokenize(relativePath);
  const fileTokens = tokenize(basename(relativePath));

  let best: { target: FileLinkMatchTarget; confidence: number; matchMethod: "folder_heuristic" | "filename_heuristic" } | null =
    null;

  for (const target of targets) {
    const folderScore = scoreTokenOverlap(pathTokens, target.tokens);
    const fileScore = scoreTokenOverlap(fileTokens, target.tokens);
    const sourceIdToken = normalizeToken(target.sourceId);
    const sourceIdHit = sourceIdToken.length > 0 && pathTokens.includes(sourceIdToken) ? 0.95 : 0;
    const score = Math.max(folderScore, fileScore, sourceIdHit);

    if (score < 0.35) {
      continue;
    }

    const matchMethod = sourceIdHit > 0 || folderScore >= fileScore ? "folder_heuristic" : "filename_heuristic";

    if (!best || score > best.confidence) {
      best = { target, confidence: Math.min(1, score), matchMethod };
    }
  }

  return best;
}

export function buildFileLinkTargetsFromPreviewRows(input: {
  customers: Array<{ sourceId: string; displayName: string }>;
  jobs: Array<{ sourceId: string; label: string }>;
  assets: Array<{ sourceId: string; label: string }>;
}): FileLinkMatchTarget[] {
  const targets: FileLinkMatchTarget[] = [];

  for (const customer of input.customers) {
    targets.push({
      entityType: "customer",
      sourceId: customer.sourceId,
      label: customer.displayName,
      tokens: [...tokenize(customer.displayName), ...tokenize(customer.sourceId)]
    });
  }

  for (const job of input.jobs) {
    targets.push({
      entityType: "job",
      sourceId: job.sourceId,
      label: job.label,
      tokens: [...tokenize(job.label), ...tokenize(job.sourceId)]
    });
  }

  for (const asset of input.assets) {
    targets.push({
      entityType: "asset",
      sourceId: asset.sourceId,
      label: asset.label,
      tokens: [...tokenize(asset.label), ...tokenize(asset.sourceId)]
    });
  }

  return targets;
}

export function proposeImportFileLinksFromPaths(
  objects: FileLinkObjectInput[],
  targets: FileLinkMatchTarget[]
): ImportFileLinkProposal[] {
  return objects.map((object) => {
    const match = findBestTarget(object.relativePath, targets);
    const fileName = basename(object.relativePath);

    if (!match) {
      return {
        proposalId: randomUUID(),
        relativePath: object.relativePath,
        fileName,
        suggestedEntityType: "unlinked",
        suggestedSourceId: null,
        suggestedLabel: fileName,
        confidence: 0,
        matchMethod: "unresolved",
        operatorStatus: "pending"
      };
    }

    return {
      proposalId: randomUUID(),
      relativePath: object.relativePath,
      fileName,
      suggestedEntityType: match.target.entityType,
      suggestedSourceId: match.target.sourceId,
      suggestedLabel: match.target.label,
      confidence: match.confidence,
      matchMethod: match.matchMethod,
      operatorStatus: "pending"
    };
  });
}
