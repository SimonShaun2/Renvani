import type { FastifyRequest } from "fastify";
import fp from "fastify-plugin";

import { type TransactionCallback } from "@fsm/db";
import { AppError, ErrorCode } from "@fsm/types";

import { runTenantAwareTransaction } from "../lib/company-scoped-transaction.js";

declare module "fastify" {
  interface FastifyRequest {
    /**
     * Runs a tenant-aware DB transaction using `request.company.id` (requires authenticate).
     */
    runCompanyScopedTransaction<T>(callback: TransactionCallback<T>): Promise<T>;
  }
}

function resolveCompanyId(request: FastifyRequest): string {
  const companyId = request.company?.id;
  if (!companyId) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Company context is required for scoped writes");
  }
  return companyId;
}

const companyScopedWritePlugin = fp(async (fastify) => {
  fastify.decorateRequest(
    "runCompanyScopedTransaction",
    function runCompanyScopedTransactionOnRequest<T>(
      this: FastifyRequest,
      callback: TransactionCallback<T>
    ): Promise<T> {
      const companyId = resolveCompanyId(this);
      return runTenantAwareTransaction(companyId, callback);
    }
  );
});

export default companyScopedWritePlugin;
