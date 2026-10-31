import { NextResponse } from "next/server";

import { clientKey, createFixedWindowLimiter, HONEYPOT_FIELD } from "@/src/lib/inquiry-rate-limit";

/** 5 inquiries / 10 min per IP + shop, per instance (see inquiry-rate-limit.ts). */
const limiter = createFixedWindowLimiter(5, 10 * 60 * 1000);

/**
 * Pre-submit gate for public inquiries: honeypot + rate limit. Bots that fill the honeypot get a fake success
 * (`accepted: false`) so they learn nothing. The real submit still goes to the API, which keeps its own IP limit.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (typeof body[HONEYPOT_FIELD] === "string" && body[HONEYPOT_FIELD].trim() !== "") {
    return NextResponse.json({ ok: true, accepted: false });
  }

  const result = limiter.check(`${slug}:${clientKey(request.headers)}`);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: "Too many requests. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } }
    );
  }

  return NextResponse.json({ ok: true, accepted: true });
}
