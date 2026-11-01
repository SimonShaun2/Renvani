"use client";

import { useAuth } from "@clerk/nextjs";
import { useLayoutEffect } from "react";

import {
  prepareClerkTokenBridge,
  registerClerkSignOut,
  registerClerkTokenGetter,
  resetClerkTokenBridge
} from "@/src/lib/clerk/token-bridge";

export function ClerkTokenBridge() {
  const { getToken, isLoaded, isSignedIn, signOut } = useAuth();

  useLayoutEffect(() => {
    prepareClerkTokenBridge();
    return () => {
      resetClerkTokenBridge();
      registerClerkSignOut(null);
    };
  }, []);

  useLayoutEffect(() => {
    // Register sign-out immediately. A user can request logout while Clerk is still hydrating,
    // and redirecting without ending that provider session would bounce straight back into the app.
    registerClerkSignOut((redirectUrl) => signOut({ redirectUrl }));
    if (isLoaded) {
      registerClerkTokenGetter(isSignedIn ? () => getToken() : null);
    }
  }, [getToken, isLoaded, isSignedIn, signOut]);

  return null;
}
