import pino from "pino";

import { resolveSmsChannel, sendSmsDisabled } from "@fsm/comms";
import { featureFlags } from "@fsm/config/feature-flags";

const logger = pino({
  name: "sms"
});

/** Provider slot the registry looks up; a Twilio adapter registers under this id once keys exist (FS-191). */
export const OUTBOUND_SMS_PROVIDER_ID = "twilio";

function resolveOutboundSms() {
  // FEATURE FLAG: outbound-sms-enabled
  return resolveSmsChannel({
    providerId: OUTBOUND_SMS_PROVIDER_ID,
    outboundSmsEnabled: featureFlags.outboundSmsEnabled
  });
}

/** True only when a live SMS provider is registered and the flag is on (false on dev: disabled stub). */
export function isOutboundSmsLive(): boolean {
  return resolveOutboundSms().live;
}

/**
 * Outbound SMS — disabled for MVP (no Twilio/Bird spend). Returns a stub provider id for message_logs.
 */
export async function sendSms(to: string, body: string): Promise<string> {
  // FEATURE FLAG: outbound-sms-enabled
  if (!featureFlags.outboundSmsEnabled) {
    const providerMessageId = await sendSmsDisabled({ to, body });
    logger.debug({ providerMessageId, toLength: to.length }, "SMS skipped (policy stub)");
    return providerMessageId;
  }

  const resolved = resolveOutboundSms();
  if (!resolved.live) {
    throw new Error("OUTBOUND_SMS_DISABLED_BY_POLICY");
  }

  const result = await resolved.channel.sendSms({ to, body });
  return result.providerMessageId;
}
