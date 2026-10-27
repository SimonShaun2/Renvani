import { z } from "zod";

import { withZodValidation } from "../shared/validation.js";

const tokenPairResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["accessToken", "refreshToken", "expiresIn"],
  properties: {
    accessToken: { type: "string" },
    refreshToken: { type: "string" },
    expiresIn: { type: "integer" }
  }
} as const;

const registeredUserResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "email", "firstName", "lastName", "role"],
  properties: {
    id: { type: "string" },
    email: { type: "string" },
    firstName: { type: "string" },
    lastName: { type: "string" },
    role: { type: "string" }
  }
} as const;

const registeredCompanyResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "slug"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    slug: { type: "string" }
  }
} as const;

const loginCompanyResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name"],
  properties: {
    id: { type: "string" },
    name: { type: "string" }
  }
} as const;

const successMessageResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["message"],
  properties: {
    message: { type: "string" }
  }
} as const;

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

export const RegisterSchema = z
  .object({
    companyName: z.string().trim().min(2).max(255),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().email(),
    password: z.string().min(8).max(72),
    phone: z.string().trim().min(1).optional(),
    timezone: z.string().trim().min(1).default("America/Chicago")
  })
  .strict();

export const LoginSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(1)
  })
  .strict();

export const RefreshSchema = z
  .object({
    refreshToken: z.string().min(1)
  })
  .strict();

export const LogoutSchema = z
  .object({
    refreshToken: z.string().min(1)
  })
  .strict();

export const ForgotPasswordSchema = z
  .object({
    email: z.string().trim().email()
  })
  .strict();

export const ResetPasswordSchema = z
  .object({
    resetToken: z.string().min(1),
    newPassword: z.string().min(8).max(72)
  })
  .strict();

export const VerifyEmailSchema = z
  .object({
    token: z.string().trim().min(1).max(512)
  })
  .strict();

export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
export const verifyEmailValidation = withZodValidation({ body: VerifyEmailSchema });

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshInput = z.infer<typeof RefreshSchema>;
export type LogoutInput = z.infer<typeof LogoutSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const registerValidation = withZodValidation({ body: RegisterSchema });
export const loginValidation = withZodValidation({ body: LoginSchema });
export const refreshValidation = withZodValidation({ body: RefreshSchema });
export const logoutValidation = withZodValidation({ body: LogoutSchema });
export const forgotPasswordValidation = withZodValidation({ body: ForgotPasswordSchema });
export const resetPasswordValidation = withZodValidation({ body: ResetPasswordSchema });

export const registerRouteSchema = {
  tags: ["auth"],
  response: {
    202: {
      type: "object",
      additionalProperties: false,
      required: ["message"],
      properties: {
        message: { type: "string" }
      }
    },
    400: errorResponseSchema,
    429: errorResponseSchema
  }
} as const;

export const loginRouteSchema = {
  tags: ["auth"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["user", "company", "tokens"],
      properties: {
        user: registeredUserResponseSchema,
        company: loginCompanyResponseSchema,
        tokens: tokenPairResponseSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema
  }
} as const;

export const refreshRouteSchema = {
  tags: ["auth"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["tokens"],
      properties: {
        tokens: tokenPairResponseSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema
  }
} as const;

export const logoutRouteSchema = {
  tags: ["auth"],
  response: {
    400: errorResponseSchema,
    401: errorResponseSchema
  }
} as const;

export const forgotPasswordRouteSchema = {
  tags: ["auth"],
  response: {
    200: successMessageResponseSchema,
    400: errorResponseSchema
  }
} as const;

export const resetPasswordRouteSchema = {
  tags: ["auth"],
  response: {
    200: successMessageResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema
  }
} as const;

export const verifyEmailRouteSchema = {
  tags: ["auth"],
  response: {
    200: loginRouteSchema.response[200],
    400: errorResponseSchema,
    401: errorResponseSchema,
    429: errorResponseSchema
  }
} as const;
