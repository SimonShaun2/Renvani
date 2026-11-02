/** Approved isolated Neon tester branch: Renvani/tester, br-lingering-sky-b5rsxb4e. */
const APPROVED_TESTER_ENDPOINT_HOST = "ep-floral-forest-b5kvzc7b-pooler.c-7.us-east-2.aws.neon.tech";

/** This exact-host check must run before constructing a SQL client. */
export function isApprovedFs235NeonTarget(parsedUrl) {
  return parsedUrl?.hostname.toLowerCase() === APPROVED_TESTER_ENDPOINT_HOST;
}
