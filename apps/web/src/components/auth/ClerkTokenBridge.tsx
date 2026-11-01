"use client";

import { useAuth, useOrganizationList } from "@clerk/nextjs";
import { useLayoutEffect, useRef } from "react";

import {
  prepareClerkTokenBridge,
  registerClerkSignOut,
  registerClerkTokenGetter,
  resetClerkTokenBridge
} from "@/src/lib/clerk/token-bridge";

export function ClerkTokenBridge() {
  const { getToken, isLoaded, isSignedIn, orgId, signOut } = useAuth();
  const {
    isLoaded: organizationListLoaded,
    setActive,
    userMemberships
  } = useOrganizationList({ userMemberships: { pageSize: 2 } });
  const activationRef = useRef<{ organizationId: string; promise: Promise<void> } | null>(null);

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
    if (!isLoaded) return;

    if (!isSignedIn) {
      activationRef.current = null;
      registerClerkTokenGetter(null);
      return;
    }

    if (orgId) {
      activationRef.current = null;
      registerClerkTokenGetter(() => getToken());
      return;
    }

    if (!organizationListLoaded || userMemberships.isLoading || !setActive) return;

    const memberships = userMemberships.data ?? [];
    const soleMembership = memberships.length === 1 && !userMemberships.hasNextPage ? memberships[0] : null;

    if (!soleMembership) {
      activationRef.current = null;
      registerClerkTokenGetter(async () => {
        throw new Error(
          memberships.length === 0
            ? "Clerk session has no organization membership"
            : "Clerk session has no active organization and cannot choose between multiple memberships"
        );
      });
      return;
    }

    const organizationId = soleMembership.organization.id;
    if (activationRef.current?.organizationId !== organizationId) {
      activationRef.current = {
        organizationId,
        promise: setActive({ organization: organizationId }).then(() => undefined)
      };
    }

    const activation = activationRef.current.promise;
    registerClerkTokenGetter(async () => {
      await activation;
      const token = await getToken({ skipCache: true });
      if (!token) {
        throw new Error("Clerk did not issue an organization-scoped session token");
      }
      return token;
    });
  }, [
    getToken,
    isLoaded,
    isSignedIn,
    orgId,
    organizationListLoaded,
    setActive,
    signOut,
    userMemberships.data,
    userMemberships.hasNextPage,
    userMemberships.isLoading
  ]);

  return null;
}
