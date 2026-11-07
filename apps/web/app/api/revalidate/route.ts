import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { CMS_TYPES, cmsTag, type CmsType } from "@/src/sanity/env";
import { SANITY_SIGNATURE_HEADER, verifySanitySignature } from "@/src/sanity/webhook-signature";

export const runtime = "nodejs";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 96;

function readType(body: unknown): CmsType | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const type = (body as Record<string, unknown>)._type;
  return typeof type === "string" && Object.prototype.hasOwnProperty.call(CMS_TYPES, type) ? (type as CmsType) : null;
}

function readSlug(body: Record<string, unknown>): string | null | false {
  const raw = body.slug;
  if (raw === undefined || raw === null) return null;
  const value = typeof raw === "string" ? raw : typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>).current : undefined;
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > MAX_SLUG_LENGTH || !SLUG_PATTERN.test(value)) return false;
  return value;
}

/** Sanity publish webhook. Verifies the raw-body HMAC (constant time) before parsing JSON, then revalidates by tag and path. */
export async function POST(req: NextRequest) {
  const secret = process.env.SANITY_REVALIDATE_SECRET?.trim();
  const rawBody = await req.text();
  const check = verifySanitySignature(rawBody, req.headers.get(SANITY_SIGNATURE_HEADER), secret);
  if (check !== "valid") return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const cmsType = readType(body);
  if (!cmsType) return NextResponse.json({ ok: false, error: "unsupported type" }, { status: 400 });
  const slug = readSlug(body as Record<string, unknown>);
  if (slug === false) return NextResponse.json({ ok: false, error: "invalid slug" }, { status: 400 });

  const tags = [cmsTag(cmsType), ...(slug ? [cmsTag(cmsType, slug)] : [])];
  for (const tag of tags) revalidateTag(tag);
  if (cmsType === "post") revalidatePath("/blog");
  if (slug) revalidatePath(`${CMS_TYPES[cmsType]}/${encodeURIComponent(slug)}`);
  return NextResponse.json({ ok: true, revalidated: tags });
}
