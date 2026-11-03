/** Holds the Clerk session-token getter and signOut so the plain fetch API client can use them. */
type TokenGetter = () => Promise<string | null>;
type SignOut = (redirectUrl: string) => Promise<void>;

const CLERK_BRIDGE_READY_TIMEOUT_MS = 10_000;

let clerkTokenGetter: TokenGetter | null = null;
let clerkSignOut: SignOut | null = null;
let clerkBridgeState: "unavailable" | "loading" | "signed-out" | "signed-in" = "unavailable";
const clerkBridgeWaiters = new Set<{
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}>();

function resolveClerkBridgeWaiters(): void {
  for (const waiter of clerkBridgeWaiters) {
    clearTimeout(waiter.timeout);
    waiter.resolve();
  }
  clerkBridgeWaiters.clear();
}

function rejectClerkBridgeWaiters(error: Error): void {
  for (const waiter of clerkBridgeWaiters) {
    clearTimeout(waiter.timeout);
    waiter.reject(error);
  }
  clerkBridgeWaiters.clear();
}

async function waitForClerkBridge(): Promise<void> {
  if (clerkBridgeState !== "loading" || typeof window === "undefined") return;

  await new Promise<void>((resolve, reject) => {
    const waiter = {
      resolve,
      reject,
      timeout: setTimeout(() => {
        clerkBridgeWaiters.delete(waiter);
        reject(new Error("Clerk authentication did not initialize in time"));
      }, CLERK_BRIDGE_READY_TIMEOUT_MS)
    };
    clerkBridgeWaiters.add(waiter);
  });
}

/** Called only by the mounted Clerk provider bridge; legacy-only builds stay unavailable. */
export function prepareClerkTokenBridge(): void {
  if (clerkBridgeState === "unavailable") {
    clerkBridgeState = "loading";
  }
}

export function registerClerkTokenGetter(getter: TokenGetter | null): void {
  clerkTokenGetter = getter;
  clerkBridgeState = getter ? "signed-in" : "signed-out";
  resolveClerkBridgeWaiters();
}

/** Marks the provider as loading again without treating that state as signed out. */
export function resetClerkTokenBridge(): void {
  clerkTokenGetter = null;
  clerkBridgeState = "unavailable";
  rejectClerkBridgeWaiters(new Error("Clerk authentication bridge was removed"));
}

export function registerClerkSignOut(signOut: SignOut | null): void {
  clerkSignOut = signOut;
}

export async function getClerkSessionToken(): Promise<string | null> {
  // Once the bridge is ready, capture its getter synchronously. Unconditionally awaiting here
  // would let an already-authenticated request switch to a replacement session before the
  // getter is selected.
  if (clerkBridgeState === "loading") {
    await waitForClerkBridge();
  }

  const tokenGetter = clerkTokenGetter;
  if (!tokenGetter) {
    return null;
  }

  // A provider failure must not be converted into an unauthenticated API request. Doing so would
  // turn a transient Clerk failure into a 401 + sign-out redirect loop.
  return tokenGetter();
}

/** True when a Clerk session is registered (signed in with Clerk in this browser). */
export function hasClerkSession(): boolean {
  return clerkBridgeState === "loading" || clerkBridgeState === "signed-in";
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
