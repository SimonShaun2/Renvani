const storageKey = (slug: string) => `fsm:idempotency:${slug}`;

export function getOrCreateBookingIdempotencyKey(slug: string): string {
  if (typeof window === "undefined") {
    return crypto.randomUUID();
  }

  const existing = sessionStorage.getItem(storageKey(slug));
  if (existing) {
    return existing;
  }

  const idempotencyKey = crypto.randomUUID();
  sessionStorage.setItem(storageKey(slug), idempotencyKey);
  return idempotencyKey;
}

export function clearBookingIdempotencyKey(slug: string): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(storageKey(slug));
}
