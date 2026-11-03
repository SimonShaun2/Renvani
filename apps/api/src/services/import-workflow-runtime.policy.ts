import { AppError, ErrorCode, IMPORT_POLICY_V1 } from "@fsm/types";

export { IMPORT_POLICY_V1 };

export function assertImportPolicyVersion(policyVersion: string): void {
  if (policyVersion !== IMPORT_POLICY_V1) {
    throw new AppError(ErrorCode.POLICY_DENIED, "Unsupported import workflow policy version");
  }
}
