import { createHmac, timingSafeEqual } from "node:crypto";

import type { FastifyReply, FastifyRequest } from "fastify";

import { env, isTwilioConfigured } from "@fsm/config";

function toTwilioParams(body: Buffer): Record<string, string> {
  const params = new URLSearchParams(body.toString("utf8"));
  const entries = Array.from(params.entries()).sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries);
}

function buildSignaturePayload(url: string, params: Record<string, string>): string {
  return Object.entries(params).reduce((payload, [key, value]) => `${payload}${key}${value}`, url);
}

function isValidTwilioSignature(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function twilioVerify(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Twilio is optional; without a configured auth token no signature can be trusted (an empty HMAC key is forgeable).
  if (!isTwilioConfigured()) {
    reply.code(503).send({
      error: "TWILIO_NOT_CONFIGURED",
      message: "Twilio webhooks are disabled"
    });
    return;
  }

  const signature = request.headers["x-twilio-signature"];

  if (typeof signature !== "string") {
    reply.code(403).send({
      error: "INVALID_TWILIO_SIGNATURE",
      message: "Missing Twilio signature"
    });
    return;
  }

  const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.from("");
  const url = `${request.protocol}://${request.headers.host ?? "localhost"}${request.url}`;
  const params = toTwilioParams(rawBody);
  const payload = buildSignaturePayload(url, params);
  const expectedSignature = createHmac("sha1", env.TWILIO_AUTH_TOKEN).update(payload).digest("base64");

  if (!isValidTwilioSignature(expectedSignature, signature)) {
    reply.code(403).send({
      error: "INVALID_TWILIO_SIGNATURE",
      message: "Invalid Twilio signature"
    });
    return;
  }

  request.twilioParams = params;
}
