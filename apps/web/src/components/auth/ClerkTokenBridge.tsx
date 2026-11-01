"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";

import {
  registerClerkSignOut,
  registerClerkTokenGetter,
  resetClerkTokenBridge
} from "@/src/lib/clerk/token-bridge";

export function ClerkTokenBridge() {
  const { getToken, isLoaded, isSignedIn, signOut } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    registerClerkTokenGetter(isSignedIn ? () => getToken() : null);
    registerClerkSignOut(isSignedIn ? (redirectUrl) => signOut({ redirectUrl }) : null);
    return () => {
      resetClerkTokenBridge();
      registerClerkSignOut(null);
    };
  }, [getToken, isLoaded, isSignedIn, signOut]);

  return null;
}
