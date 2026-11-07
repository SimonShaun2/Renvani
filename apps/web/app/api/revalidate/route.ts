import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { parseBody } from "next-sanity/webhook";

import { CMS_TYPES, cmsTag, type CmsType } from "@/src/sanity/env";

type WebhookPayload = { _type?: string; slug?: string | { current?: string } | null };

/** Sanity publish webhook: verifies the signature with SANITY_REVALIDATE_SECRET, then revalidates by tag and path. */
export async function POST(req: NextRequest) {
  const secret = process.env.SANITY_REVALIDATE_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false, error: "not configured" }, { status: 401 });
  try {
    const { isValidSignature, body } = await parseBody<WebhookPayload>(req, secret, true);
    if (!isValidSignature) return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
    const type = body?._type;
    if (!type || !(type in CMS_TYPES)) return NextResponse.json({ ok: false, error: "unsupported type" }, { status: 400 });
    const cmsType = type as CmsType;
    const raw = body?.slug;
    const slug = typeof raw === "string" ? raw : raw?.current;
    const tags = [cmsTag(cmsType), ...(slug ? [cmsTag(cmsType, slug)] : [])];
    for (const tag of tags) revalidateTag(tag);
    const prefix = CMS_TYPES[cmsType];
    if (cmsType === "post") revalidatePath("/blog");
    if (slug) revalidatePath(`${prefix}/${encodeURIComponent(slug)}`);
    return NextResponse.json({ ok: true, revalidated: tags });
  } catch (error) {
    console.error("[revalidate] failed", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }
}
