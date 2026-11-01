import type { FastifyError } from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";

import { AppError, ErrorCode, getHttpStatusForErrorCode } from "@fsm/types";

import { abortImportUploadRequest } from "../routes/imports/upload-guards.js";
import {
  CSV_IMPORT_FILE_TOO_LARGE_MESSAGE,
  CSV_IMPORT_TOO_MANY_FILES_MESSAGE
} from "../routes/imports/upload-limits.js";

function mapZodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".") || "root";
    if (!(key in fields)) {
      fields[key] = issue.message;
    }
  }

  return fields;
}

const errorHandlerPlugin = fp(async (fastify) => {
  fastify.setErrorHandler((error: FastifyError | Error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(getHttpStatusForErrorCode(error.code)).send({
        error: error.code,
        message: error.message,
        requestId: request.id,
        fields: error.fields
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: ErrorCode.VALIDATION_ERROR,
        message: "Request validation failed",
        requestId: request.id,
        fields: mapZodFields(error)
      });
    }

    const fastifyError = error as FastifyError;

    if (fastifyError.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      return reply.status(413).send({
        error: ErrorCode.VALIDATION_ERROR,
        message: "Request body is too large",
        requestId: request.id
      });
    }

    if (fastifyError.code === "FST_REQ_FILE_TOO_LARGE") {
      const isImportUpload = request.url.includes("/imports") && request.method === "POST";
      abortImportUploadRequest(request);
      return reply.status(413).send({
        error: ErrorCode.VALIDATION_ERROR,
        message: isImportUpload ? CSV_IMPORT_FILE_TOO_LARGE_MESSAGE : "Uploaded file is too large",
        requestId: request.id
      });
    }

    if (fastifyError.code === "FST_FILES_LIMIT") {
      const isImportUpload = request.url.includes("/imports") && request.method === "POST";
      return reply.status(400).send({
        error: ErrorCode.VALIDATION_ERROR,
        message: isImportUpload ? CSV_IMPORT_TOO_MANY_FILES_MESSAGE : "Too many files uploaded",
        requestId: request.id
      });
    }

    request.log.error(
      {
        err: error,
        requestId: request.id,
        companyId: request.company?.id ?? null,
        userId: request.user?.id ?? null
      },
      "Unhandled request error"
    );

    return reply.status(500).send({
      error: ErrorCode.INTERNAL_ERROR,
      message: "Internal server error",
      requestId: request.id
    });
  });
});

export default errorHandlerPlugin;
