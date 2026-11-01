/**
 * Growth — public marketing-site intake (demo requests + Growth Check). Platform-level: no tenant data read or returned.
 * Honeypot hits get the normal success shape and persist nothing. Notification is best-effort and never fails the request.
 */
import { createHmac, randomUUID } from "node:crypto";

import pino from "pino";

import { env } from "@fsm/config";
import type { MarketingDemoRequestInput, MarketingGrowthCheckInput, MarketingIntakeResponse } from "@fsm/types";

import { getEmailChannel } from "../lib/outbound-email.js";
import { insertMarketingDemoRequest, insertMarketingGrowthCheck } from "./marketing-intake.repository.js";

const logger = pino({ name: "marketing-intake" });

type WithHoneypot = { hp?: string | undefined };

function isHoneypotHit(body: WithHoneypot): boolean {
  return typeof body.hp === "string" && body.hp.trim().length > 0;
}

/** HMAC-SHA256(salt, ip) hex; null when no salt is configured (raw IPs are never stored). */
export function hashMarketingIp(ip: string | undefined): string | null {
  const salt = env.MARKETING_IP_HASH_SALT ?? "";
  if (!salt || !ip) return null;
  return createHmac("sha256", salt).update(ip).digest("hex");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Single-line, control-char-free text (safe for subject lines and plain text). */
function oneLine(value: string, max = 200): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max);
}

async function notify(kind: "demo_request" | "growth_check", subject: string, lines: Array<[string, string | null | undefined]>): Promise<void> {
  const to = (env.MARKETING_NOTIFY_EMAIL ?? "").trim();
  if (!to) return;
  try {
    const channel = getEmailChannel();
    if (!channel) return;
    const present = lines.filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0);
    const text = present.map(([k, v]) => `${k}: ${v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ")}`).join("\n");
    const html = `<h2>${escapeHtml(subject)}</h2><table>${present
      .map(([k, v]) => `<tr><th align="left">${escapeHtml(k)}</th><td>${escapeHtml(v).replace(/\n/g, "<br>")}</td></tr>`)
      .join("")}</table>`;
    await channel.sendTransactionalEmail({ to, subject: oneLine(subject), html, text, tags: [`marketing_${kind}`] });
  } catch (error) {
    // No PII: only the kind and the error class/name.
    logger.warn({ kind, errorName: error instanceof Error ? error.name : "unknown" }, "marketing intake notification failed");
  }
}

export async function submitMarketingDemoRequest(
  body: MarketingDemoRequestInput & WithHoneypot,
  ip: string | undefined
): Promise<MarketingIntakeResponse> {
  if (isHoneypotHit(body)) return { ok: true, confirmationId: randomUUID() };
  const id = await insertMarketingDemoRequest({
    name: body.name,
    email: body.email,
    phone: body.phone ?? null,
    company: body.company,
    trade: body.trade,
    message: body.message ? body.message : null,
    ipHash: hashMarketingIp(ip)
  });
  await notify("demo_request", `New demo request: ${oneLine(body.company, 80)}`, [
    ["Confirmation", id],
    ["Name", body.name],
    ["Email", body.email],
    ["Phone", body.phone],
    ["Company", body.company],
    ["Trade", body.trade],
    ["Message", body.message]
  ]);
  return { ok: true, confirmationId: id };
}

export async function submitMarketingGrowthCheck(
  body: MarketingGrowthCheckInput & WithHoneypot,
  ip: string | undefined
): Promise<MarketingIntakeResponse> {
  if (isHoneypotHit(body)) return { ok: true, confirmationId: randomUUID() };
  const id = await insertMarketingGrowthCheck({
    websiteUrl: body.websiteUrl,
    trade: body.trade,
    zip: body.zip ?? null,
    city: body.city ?? null,
    email: body.email,
    ipHash: hashMarketingIp(ip)
  });
  await notify("growth_check", "New Growth Check request", [
    ["Confirmation", id],
    ["Website", body.websiteUrl],
    ["Trade", body.trade],
    ["ZIP", body.zip],
    ["City", body.city],
    ["Email", body.email]
  ]);
  return { ok: true, confirmationId: id };
}
