#!/usr/bin/env node
/** Read-only editorial preflight. Never connects to Sanity or changes a document. */
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const TYPES = new Map([["post", "/blog"], ["comparisonPage", "/compare"]]);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_BYTES = 20 * 1024 * 1024;
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const text = value => typeof value === "string" && value.trim().length > 0;

export function parseExport(input) {
  if (Buffer.byteLength(input, "utf8") > MAX_BYTES) throw new Error("Export exceeds 20 MiB; use a bounded editorial export.");
  const source = input.trim();
  if (!source) return [];
  if (source.startsWith("[")) {
    const parsed = JSON.parse(source);
    if (!Array.isArray(parsed)) throw new Error("Expected a JSON array or NDJSON documents.");
    return parsed;
  }
  return source.split(/\r?\n/).filter(line => line.trim()).map((line, index) => {
    try { return JSON.parse(line); }
    catch { throw new Error(`Invalid NDJSON at line ${index + 1}.`); }
  });
}

function safeLink(href) {
  if (!text(href) || /[\u0000-\u0020\\]/.test(href)) return false;
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  try { const url = new URL(href); return url.protocol === "https:" && !url.username && !url.password; }
  catch { return false; }
}

/** Report identifiers and issue codes only; never echo article bodies, URLs or provider credentials. */
export function auditDocuments(documents, now = new Date()) {
  if (!Array.isArray(documents) || !Number.isFinite(now.getTime())) throw new Error("Invalid audit input.");
  const records = [], groups = new Map();
  let ignored = 0;
  for (const [index, doc] of documents.entries()) {
    if (!object(doc) || !TYPES.has(doc._type)) { ignored++; continue; }
    const issues = [];
    const add = (code, severity = "error") => issues.push({ code, severity });
    const id = typeof doc._id === "string" ? doc._id : "";
    const version = id.startsWith("drafts.") ? "draft" : id.startsWith("versions.") ? "release-version" : "published-or-exported";
    const logicalId = id.startsWith("drafts.") ? id.slice(7) : id || `row:${index + 1}`;
    const slug = typeof doc.slug === "string" ? doc.slug : object(doc.slug) ? doc.slug.current : undefined;
    const validSlug = typeof slug === "string" && slug.length <= 96 && SLUG.test(slug);
    if (!validSlug) add("invalid_slug");
    if (!text(doc.title)) add("missing_title");
    if (!text(doc.metaTitle)) add("missing_meta_title", "warning");
    if (!text(doc.metaDescription) && !text(doc.excerpt)) add("missing_description");
    if (!Array.isArray(doc.body) || !doc.body.some(block => object(block) && block._type === "block" && Array.isArray(block.children) && block.children.some(span => object(span) && text(span.text)))) add("missing_readable_body");
    if (doc._type === "post" && !text(doc.author)) add("missing_author", "warning");
    if (!text(doc.publishedAt)) add("missing_publication_date", "warning");
    else {
      const published = new Date(doc.publishedAt);
      if (!Number.isFinite(published.getTime())) add("invalid_publication_date");
      else if (published > now) add("future_publication_date", "warning");
    }
    const image = doc._type === "post" ? doc.featuredImage : doc.ogImage;
    if (image && !text(image.alt)) add("missing_featured_image_alt");
    if (doc.cta && (!text(doc.cta.label) || !safeLink(doc.cta.href))) add("invalid_cta");
    for (const block of Array.isArray(doc.body) ? doc.body : []) {
      if (!object(block)) continue;
      if (block._type === "inlineImage" && !text(block.alt)) add("missing_inline_image_alt");
      for (const mark of Array.isArray(block.markDefs) ? block.markDefs : []) {
        if (object(mark) && mark._type === "link" && !safeLink(mark.href)) add("unsafe_body_link");
      }
    }
    const record = { row: index + 1, type: doc._type, version, path: validSlug ? `${TYPES.get(doc._type)}/${slug}` : null, issues };
    records.push(record);
    // A published document and its own draft share a slug legitimately. Release versions are not live inventory.
    if (validSlug && version !== "release-version") {
      const key = `${doc._type}:${slug}`, group = groups.get(key) ?? [];
      group.push({ record, logicalId }); groups.set(key, group);
    }
  }
  for (const group of groups.values()) {
    if (new Set(group.map(item => item.logicalId)).size > 1) {
      for (const { record } of group) record.issues.push({ code: "duplicate_route_slug", severity: "error" });
    }
  }
  return {
    generatedAt: now.toISOString(), scope: "supplied-export-only", totalInput: documents.length, ignored,
    checked: records.length,
    blockers: records.reduce((sum, row) => sum + row.issues.filter(issue => issue.severity === "error").length, 0),
    warnings: records.reduce((sum, row) => sum + row.issues.filter(issue => issue.severity === "warning").length, 0),
    records,
    limitations: "Not editorial approval, publication status verification, link availability testing, or evidence of Google indexing. A future date alone does not schedule publication."
  };
}

async function main(args) {
  if (args.length !== 1) throw new Error("Usage: node scripts/seo/content-preflight.mjs <export.json-or-ndjson>");
  const result = auditDocuments(parseExport(await readFile(args[0], "utf8")));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.blockers ? 1 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => {
    // Parsing messages might contain source excerpts. Do not print untrusted parser messages or input paths.
    console.error(error instanceof SyntaxError ? "Invalid JSON export." : error.code ? "Unable to read the supplied export." : error.message);
    process.exitCode = 2;
  });
}
