"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";

import { registerClerkTokenGetter } from "@/src/lib/clerk/token-bridge";

export function ClerkTokenBridge() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    registerClerkTokenGetter(isSignedIn ? () => getToken() : null);
    return () => registerClerkTokenGetter(null);
  }, [getToken, isSignedIn]);

  return null;
}
