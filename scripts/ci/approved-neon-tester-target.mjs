/** Approved isolated Neon tester endpoint. Check the exact hostname before connecting. */
const APPROVED_TESTER_ENDPOINT_HOST = "ep-floral-forest-b5kvzc7b-pooler.c-7.us-east-2.aws.neon.tech";

export function isApprovedNeonTesterTarget(parsedUrl) {
  return parsedUrl?.hostname.toLowerCase() === APPROVED_TESTER_ENDPOINT_HOST;
}
