export type {
  OutboundChannelKind,
  OutboundEmailChannel,
  OutboundEmailPayload,
  OutboundMessageTemplateRef,
  OutboundSmsChannel,
  OutboundSmsPayload
} from "./channels.js";
export { createResendEmailChannel, type ResendEmailAdapterConfig } from "./resend-email.adapter.js";
export { createDisabledSmsChannel, sendSmsDisabled } from "./sms-disabled.stub.js";
export {
  DISABLED_SMS_PROVIDER_ID,
  registerSmsProvider,
  resolveSmsChannel,
  unregisterSmsProviderForTests,
  type ResolvedSmsChannel,
  type SmsProviderFactory
} from "./sms-provider.registry.js";
export {
  EMAIL_TEMPLATE_IDS,
  renderTransactionalEmail,
  type EmailTemplateId,
  type RenderedTransactionalEmail
} from "./email-templates.js";
export {
  isMvpResendTransactionalTemplate,
  MVP_RESEND_TRANSACTIONAL_TEMPLATE_IDS,
  resendTagsForTransactionalTemplate,
  type MvpResendTransactionalTemplateId
} from "./transactional-template-catalog.js";
export { escapeHtml, htmlToText, renderRenvaniLayout, RENVANI_EMAIL_BRAND, type RenvaniLayoutInput } from "./email-layout.js";
export {
  DEFAULT_TRANSACTIONAL_EMAIL_FROM,
  resolveTransactionalEmailFromAddress,
  selectTransactionalEmailProvider,
  type TransactionalEmailFromConfig,
  type TransactionalEmailProvider,
  type TransactionalEmailProviderConfig
} from "./email-provider.js";
export { isReceiptEmailAllowed, type ReceiptRecipient } from "./receipt-consent.js";
