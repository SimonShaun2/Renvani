"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";

import { registerClerkSignOut, registerClerkTokenGetter } from "@/src/lib/clerk/token-bridge";

export function ClerkTokenBridge() {
  const { getToken, isSignedIn, signOut } = useAuth();

  useEffect(() => {
    registerClerkTokenGetter(isSignedIn ? () => getToken() : null);
    registerClerkSignOut(isSignedIn ? (redirectUrl) => signOut({ redirectUrl }) : null);
    return () => {
      registerClerkTokenGetter(null);
      registerClerkSignOut(null);
    };
  }, [getToken, isSignedIn, signOut]);

  return null;
}
