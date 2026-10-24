/** Holds the Clerk session-token getter so the plain fetch API client can send it as Bearer. */
type TokenGetter = () => Promise<string | null>;

let clerkTokenGetter: TokenGetter | null = null;

export function registerClerkTokenGetter(getter: TokenGetter | null): void {
  clerkTokenGetter = getter;
}

export async function getClerkSessionToken(): Promise<string | null> {
  if (!clerkTokenGetter) {
    return null;
  }

  try {
    return await clerkTokenGetter();
  } catch {
    return null;
  }
}
