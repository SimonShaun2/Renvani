import pino from "pino";

import { env } from "@fsm/config";
import { assertOpenAiConfigured } from "./openai-config.js";

const logger = pino({
  name: "revenue-prompts"
});

interface GenerateAgingAssetMessageContext {
  customerFirstName: string;
  assetType: string;
  assetAge: number;
  brand: string | null;
  companyName: string;
}

interface GenerateEstimateFollowUpMessageContext {
  customerFirstName: string;
  estimateNumber: string;
  estimateTotal: string;
  companyName: string;
}

interface GenerateInvoiceRecoveryMessageContext {
  customerFirstName: string;
  invoiceNumber: string;
  balanceDue: string;
  daysOverdue: number;
  paymentLinkUrl: string;
  companyName: string;
}

interface GenerateReactivationMessageContext {
  customerFirstName: string;
  daysSinceLastService: number;
  companyName: string;
  serviceType?: string;
}

interface OpenAiResponseUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

interface OpenAiResponseContent {
  type: string;
  text?: string;
}

interface OpenAiResponseOutputItem {
  type: string;
  content?: OpenAiResponseContent[];
}

interface OpenAiResponseBody {
  error?: {
    message?: string;
  };
  model?: string;
  output?: OpenAiResponseOutputItem[];
  output_text?: string;
  usage?: OpenAiResponseUsage;
}

function normalizeFirstName(value: string): string {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : "there";
}

function stripWrappingQuotes(value: string): string {
  const trimmedValue = value.trim();

  if (
    (trimmedValue.startsWith("\"") && trimmedValue.endsWith("\"")) ||
    (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
  ) {
    return trimmedValue.slice(1, -1).trim();
  }

  return trimmedValue;
}

function truncateAtWordBoundary(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const maxContentLength = Math.max(maxLength - 3, 1);
  const candidate = value.slice(0, maxContentLength);
  const boundaryIndex = candidate.lastIndexOf(" ");
  const truncatedValue = boundaryIndex >= 40 ? candidate.slice(0, boundaryIndex) : candidate;
  return `${truncatedValue.trimEnd()}...`;
}

function normalizeGeneratedMessage(value: string): string {
  const compactValue = stripWrappingQuotes(value).replace(/\s+/g, " ").trim();
  return truncateAtWordBoundary(compactValue, 160);
}

function extractResponseText(responseBody: OpenAiResponseBody): string {
  if (typeof responseBody.output_text === "string" && responseBody.output_text.trim().length > 0) {
    return responseBody.output_text;
  }

  for (const outputItem of responseBody.output ?? []) {
    for (const contentItem of outputItem.content ?? []) {
      if (contentItem.type === "output_text" && typeof contentItem.text === "string") {
        const trimmedValue = contentItem.text.trim();

        if (trimmedValue.length > 0) {
          return trimmedValue;
        }
      }
    }
  }

  throw new Error("OpenAI response did not include any output text");
}

async function generateSms(prompt: string, jobType: string): Promise<string> {
  assertOpenAiConfigured();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: prompt,
      temperature: 0.7,
      max_output_tokens: 200,
      text: {
        format: {
          type: "text"
        }
      }
    })
  });

  const responseBody = (await response.json()) as OpenAiResponseBody;

  logger.debug(
    {
      model: responseBody.model ?? "gpt-4o-mini",
      promptTokens: responseBody.usage?.input_tokens,
      completionTokens: responseBody.usage?.output_tokens,
      totalTokens: responseBody.usage?.total_tokens,
      jobType
    },
    "OpenAI token usage"
  );

  if (!response.ok) {
    throw new Error(responseBody.error?.message ?? `OpenAI request failed with status ${response.status}`);
  }

  return normalizeGeneratedMessage(extractResponseText(responseBody));
}

export async function generateAgingAssetMessage(
  ctx: GenerateAgingAssetMessageContext
): Promise<string> {
  const brandClause = ctx.brand ? ` from ${ctx.brand}` : "";

  return generateSms(
    [
      "Generate a friendly, professional SMS message from a service company to a customer about their aging equipment.",
      `Customer first name: ${normalizeFirstName(ctx.customerFirstName)}.`,
      `Company name: ${ctx.companyName}.`,
      `Asset type: ${ctx.assetType}${brandClause}.`,
      `Asset age: ${ctx.assetAge} years old.`,
      "Mention the asset type and age.",
      "Suggest scheduling an inspection or replacement quote.",
      "Max 160 characters.",
      "No emojis.",
      "Use first name only."
    ].join(" "),
    "generate-aging-asset-message"
  );
}

export async function generateEstimateFollowUpMessage(
  ctx: GenerateEstimateFollowUpMessageContext
): Promise<string> {
  return generateSms(
    [
      "Generate a friendly follow-up SMS for an unanswered estimate.",
      `Customer first name: ${normalizeFirstName(ctx.customerFirstName)}.`,
      `Company name: ${ctx.companyName}.`,
      `Estimate number: ${ctx.estimateNumber}.`,
      `Estimate total: $${ctx.estimateTotal}.`,
      "Mention the estimate number and total.",
      "Create mild urgency without pressure.",
      "Max 160 characters.",
      "No emojis."
    ].join(" "),
    "generate-estimate-follow-up-message"
  );
}

export async function generateInvoiceRecoveryMessage(
  ctx: GenerateInvoiceRecoveryMessageContext
): Promise<string> {
  return generateSms(
    [
      "Generate a friendly payment reminder SMS.",
      `Customer first name: ${normalizeFirstName(ctx.customerFirstName)}.`,
      `Company name: ${ctx.companyName}.`,
      `Invoice number: ${ctx.invoiceNumber}.`,
      `Balance due: $${ctx.balanceDue}.`,
      `Days overdue: ${ctx.daysOverdue}.`,
      `Payment link: ${ctx.paymentLinkUrl}.`,
      "Mention the amount due and include the payment link.",
      "Tone should be friendly for 1-7 days overdue, firm for 8-14 days overdue, urgent for 15+ days overdue.",
      "Max 160 characters.",
      "No emojis."
    ].join(" "),
    "generate-invoice-recovery-message"
  );
}

export async function generateReactivationMessage(
  ctx: GenerateReactivationMessageContext
): Promise<string> {
  const serviceTypeClause = ctx.serviceType ? ` Service type: ${ctx.serviceType}.` : "";

  return generateSms(
    [
      "Generate a friendly reactivation SMS for a dormant customer.",
      `Customer first name: ${normalizeFirstName(ctx.customerFirstName)}.`,
      `Company name: ${ctx.companyName}.`,
      `Days since last service: ${ctx.daysSinceLastService}.`,
      `${serviceTypeClause}`,
      "Use seasonal awareness if it feels natural.",
      "Offer to schedule service.",
      "Max 160 characters.",
      "No emojis."
    ].join(" "),
    "generate-reactivation-message"
  );
}
