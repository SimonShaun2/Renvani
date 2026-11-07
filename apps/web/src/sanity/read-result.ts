/** A configured CMS outage is not an empty collection or a missing article. */
export class CmsReadError extends Error {
  readonly code = "CMS_READ_UNAVAILABLE";

  constructor() {
    // Deliberately omit the provider error/cause, which can contain credentials or URLs.
    super("Published content is temporarily unavailable.");
    this.name = "CmsReadError";
  }
}

/** Preserve successful null/empty results; propagate failures without leaking provider details. */
export async function readCmsResult<T>(
  read: () => Promise<T | null | undefined>,
  emptyValue: T
): Promise<T> {
  try {
    return (await read()) ?? emptyValue;
  } catch {
    throw new CmsReadError();
  }
}
