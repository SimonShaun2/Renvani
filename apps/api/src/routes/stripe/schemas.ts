const errorResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["error", "message", "requestId"],
  properties: {
    error: { type: "string" },
    message: { type: "string" },
    requestId: { type: "string" },
    fields: {
      anyOf: [
        {
          type: "object",
          additionalProperties: { type: "string" }
        },
        { type: "null" }
      ]
    }
  }
} as const;

const stripeConnectStatusSchema = {
  type: "object",
  additionalProperties: false,
  required: ["connected"],
  properties: {
    connected: { type: "boolean" },
    chargesEnabled: { type: "boolean" },
    payoutsEnabled: { type: "boolean" },
    detailsSubmitted: { type: "boolean" },
    stripeAccountId: { type: "string" },
    accountName: {
      anyOf: [{ type: "string" }, { type: "null" }]
    },
    payoutSchedule: {
      anyOf: [{ type: "string" }, { type: "null" }]
    },
    lastPayoutAmount: {
      anyOf: [{ type: "string" }, { type: "null" }]
    },
    lastPayoutAt: {
      anyOf: [{ type: "string", format: "date-time" }, { type: "null" }]
    },
    platformFeePercent: { type: "number" },
    serviceFeePercent: { type: "number" }
  }
} as const;

const stripeUrlSchema = {
  type: "object",
  additionalProperties: false,
  required: ["url"],
  properties: {
    url: { type: "string", format: "uri" }
  }
} as const;

export const stripeConnectOnboardSchema = {
  tags: ["stripe"],
  response: {
    200: stripeUrlSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const stripeConnectReturnSchema = {
  tags: ["stripe"],
  response: {
    200: stripeConnectStatusSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const stripeConnectStatusRouteSchema = {
  tags: ["stripe"],
  response: {
    200: stripeConnectStatusSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const stripeDashboardLinkSchema = {
  tags: ["stripe"],
  response: {
    200: stripeUrlSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;

const connectComponentEnum = ["account_onboarding", "payments", "payouts"] as const;

export type ConnectAccountSessionBody = {
  components: (typeof connectComponentEnum)[number][];
};

export const stripeConnectAccountSessionSchema = {
  tags: ["stripe"],
  body: {
    type: "object",
    additionalProperties: false,
    required: ["components"],
    properties: {
      components: {
        type: "array",
        minItems: 1,
        items: { type: "string", enum: connectComponentEnum }
      }
    }
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["clientSecret"],
      properties: {
        clientSecret: { type: "string" }
      }
    },
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;

export const stripeConnectTestProvisionSchema = {
  tags: ["stripe"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["stripeAccountId", "status"],
      properties: {
        stripeAccountId: { type: "string" },
        status: { type: "string", enum: ["active", "pending"] }
      }
    },
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;
