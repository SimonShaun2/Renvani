import type { OutboundSmsChannel } from "./channels.js";
import { createDisabledSmsChannel } from "./sms-disabled.stub.js";

/**
 * SMS provider registry (FS-191 plan, #241). Default is the inert disabled stub. A live provider
 * (e.g. Twilio) activates only when it has been registered (its keys exist) AND outbound SMS is
 * enabled by flag. No provider is registered on dev, so nothing here can reach the network.
 */
export const DISABLED_SMS_PROVIDER_ID = "disabled";

export type SmsProviderFactory = () => OutboundSmsChannel;

const providers = new Map<string, SmsProviderFactory>();

export function registerSmsProvider(id: string, factory: SmsProviderFactory): void {
  if (id === DISABLED_SMS_PROVIDER_ID) {
    throw new Error("The disabled SMS provider is built in");
  }
  providers.set(id, factory);
}

export function unregisterSmsProviderForTests(id: string): void {
  providers.delete(id);
}

export type ResolvedSmsChannel = { providerId: string; live: boolean; channel: OutboundSmsChannel };

export function resolveSmsChannel(options: { providerId?: string | null; outboundSmsEnabled: boolean }): ResolvedSmsChannel {
  const providerId = options.providerId?.trim() || null;
  const factory = providerId ? providers.get(providerId) : undefined;
  if (!options.outboundSmsEnabled || !providerId || !factory) {
    return { providerId: DISABLED_SMS_PROVIDER_ID, live: false, channel: createDisabledSmsChannel() };
  }
  return { providerId, live: true, channel: factory() };
}
