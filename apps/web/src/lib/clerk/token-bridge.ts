/** Holds the Clerk session-token getter and signOut so the plain fetch API client can use them. */
type TokenGetter = () => Promise<string | null>;
type SignOut = (redirectUrl: string) => Promise<void>;

let clerkTokenGetter: TokenGetter | null = null;
let clerkSignOut: SignOut | null = null;

export function registerClerkTokenGetter(getter: TokenGetter | null): void {
  clerkTokenGetter = getter;
}

export function registerClerkSignOut(signOut: SignOut | null): void {
  clerkSignOut = signOut;
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

/** True when a Clerk session is registered (signed in with Clerk in this browser). */
export function hasClerkSession(): boolean {
  return clerkTokenGetter !== null;
}

/** Ends the Clerk session (if any). Returns true when Clerk handled the sign-out and redirect. */
export async function signOutClerkSession(redirectUrl: string): Promise<boolean> {
  if (!clerkSignOut) return false;
  try {
    await clerkSignOut(redirectUrl);
    return true;
  } catch {
    return false;
  }
}
