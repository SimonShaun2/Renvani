/** GET /api/v1/estimates enforces z.number().int().min(1).max(100).
 * Keep this list below the server cap; do not silently turn validation errors into empty records.
 */
export const ESTIMATE_LIST_LIMIT = 100 as const;

export function estimateListIsPartial(response: { total: number; data: readonly unknown[] } | undefined): boolean {
  return Boolean(response && response.total > response.data.length);
}
