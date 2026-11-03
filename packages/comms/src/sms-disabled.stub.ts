import type { OutboundSmsChannel, OutboundSmsPayload } from "./channels.js";

const DISABLED_PREFIX = "sms_disabled_stub";

/**
 * Twilio/Bird deferred — no live SMS, no provider spend (Circle S 2026-10-22).
 */
export function createDisabledSmsChannel(): OutboundSmsChannel {
  return {
    async sendSms(payload: OutboundSmsPayload): Promise<{ providerMessageId: string }> {
      const digest = Buffer.from(`${payload.to}:${payload.body.length}`).toString("base64url").slice(0, 16);
      return { providerMessageId: `${DISABLED_PREFIX}_${digest}` };
    }
  };
}

/** @deprecated Use createDisabledSmsChannel — kept for api/lib/sms.ts import ergonomics */
export async function sendSmsDisabled(payload: OutboundSmsPayload): Promise<string> {
  const result = await createDisabledSmsChannel().sendSms(payload);
  return result.providerMessageId;
}
