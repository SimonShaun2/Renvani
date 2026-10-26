/**
 * Staged items (drafts included) only on Vercel preview deployments;
 * everywhere else the live endpoint, which returns published items only.
 */
export function webflowItemsUrl(collectionId: string, env: { VERCEL_ENV?: string | undefined }): string {
  const base = `https://api.webflow.com/v2/collections/${encodeURIComponent(collectionId)}/items`;
  return `${env.VERCEL_ENV === "preview" ? base : `${base}/live`}?limit=100`;
}
