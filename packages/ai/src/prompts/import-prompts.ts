import pino from "pino";

import { env } from "@fsm/config";
import { assertOpenAiConfigured } from "./openai-config.js";

export interface ColumnMapping {
  [csvColumn: string]: string | null;
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

const logger = pino({
  name: "import-prompts"
});

function buildEmptyMapping(headers: string[]): ColumnMapping {
  return Object.fromEntries(headers.map((header) => [header, null]));
}

function extractResponseText(responseBody: OpenAiResponseBody): string {
  if (typeof responseBody.output_text === "string" && responseBody.output_text.trim().length > 0) {
    return responseBody.output_text;
  }

  for (const outputItem of responseBody.output ?? []) {
    for (const contentItem of outputItem.content ?? []) {
      if (contentItem.type === "output_text" && typeof contentItem.text === "string") {
        const trimmedText = contentItem.text.trim();

        if (trimmedText.length > 0) {
          return trimmedText;
        }
      }
    }
  }

  throw new Error("OpenAI response did not include any output text");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMapping(value: unknown, headers: string[]): ColumnMapping {
  if (!isPlainObject(value)) {
    return buildEmptyMapping(headers);
  }

  const mapping: ColumnMapping = buildEmptyMapping(headers);

  for (const header of headers) {
    const mappedValue = value[header];

    if (typeof mappedValue === "string" || mappedValue === null) {
      mapping[header] = mappedValue;
    }
  }

  return mapping;
}

export async function mapCsvColumns(
  headers: string[],
  sampleRows: Record<string, string>[],
  entityType: string
): Promise<ColumnMapping> {
  assertOpenAiConfigured();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: [
        "You are a data mapping assistant. Given CSV column headers and sample data, map each CSV column to the correct database field name.",
        `Entity type: ${entityType}`,
        "Available fields for customers:",
        "- firstName, lastName, displayName, email, phone, altPhone, addressLine1, city, state, zip, notes, tags",
        "Available fields for jobs:",
        "- title, description, type, scheduledStart, completionNotes",
        `CSV headers: ${JSON.stringify(headers)}`,
        `Sample data (first 3 rows): ${JSON.stringify(sampleRows.slice(0, 3))}`,
        "Return a JSON object where keys are CSV column names and values are the matching field name, or null if no match.",
        "Return ONLY valid JSON, no explanation.",
        "Example: {\"First Name\": \"firstName\", \"Email Address\": \"email\", \"Notes\": \"notes\"}"
      ].join("\n"),
      max_output_tokens: 300,
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
      totalTokens: responseBody.usage?.total_tokens
    },
    "OpenAI token usage"
  );

  if (!response.ok) {
    throw new Error(responseBody.error?.message ?? `OpenAI request failed with status ${response.status}`);
  }

  try {
    const parsedResponse = JSON.parse(extractResponseText(responseBody)) as unknown;
    return normalizeMapping(parsedResponse, headers);
  } catch {
    return buildEmptyMapping(headers);
  }
}
