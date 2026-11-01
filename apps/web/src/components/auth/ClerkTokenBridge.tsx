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
  const { getToken, isLoaded, isSignedIn, orgId, sessionId, signOut, userId } = useAuth();
  const {
    isLoaded: organizationListLoaded,
    setActive,
    userMemberships
  } = useOrganizationList({ userMemberships: { pageSize: 2 } });
  const activationRef = useRef<{
    organizationId: string;
    promise: Promise<void>;
    sessionGeneration: number;
    sessionId: string;
    userId: string;
  } | null>(null);
  const sessionGenerationRef = useRef(0);
  const authContextRef = useRef({ isSignedIn, orgId, sessionId, userId });

  useLayoutEffect(() => {
    sessionGenerationRef.current += 1;
  }, [isSignedIn, sessionId, userId]);

  useLayoutEffect(() => {
    authContextRef.current = { isSignedIn, orgId, sessionId, userId };
  }, [isSignedIn, orgId, sessionId, userId]);

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

    const sessionGeneration = sessionGenerationRef.current;
    const expectedSessionId = sessionId;
    const expectedUserId = userId;
    const assertCurrentSession = (expectedOrganizationId: string, requireExpectedOrganization: boolean): void => {
      const current = authContextRef.current;
      if (
        sessionGenerationRef.current !== sessionGeneration ||
        !current.isSignedIn ||
        current.sessionId !== expectedSessionId ||
        current.userId !== expectedUserId ||
        (requireExpectedOrganization
          ? current.orgId !== expectedOrganizationId
          : current.orgId !== null && current.orgId !== undefined && current.orgId !== expectedOrganizationId)
      ) {
        throw new Error("Clerk session changed while resolving an organization-scoped token");
      }
    };

    if (orgId) {
      activationRef.current = null;
      registerClerkTokenGetter(async () => {
        const token = await getToken();
        assertCurrentSession(orgId, true);
        if (!token) {
          throw new Error("Clerk did not issue an organization-scoped session token");
        }
        return token;
      });
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
    registerClerkTokenGetter(async () => {
      let activation = activationRef.current;
      if (
        activation?.organizationId !== organizationId ||
        activation.sessionGeneration !== sessionGeneration ||
        activation.sessionId !== expectedSessionId ||
        activation.userId !== expectedUserId
      ) {
        activation = {
          organizationId,
          promise: setActive({ organization: organizationId }).then(() => undefined),
          sessionGeneration,
          sessionId: expectedSessionId,
          userId: expectedUserId
        };
        activationRef.current = activation;
      }

      try {
        await activation.promise;
      } catch (error) {
        if (activationRef.current === activation) {
          activationRef.current = null;
        }
        throw error;
      }

      assertCurrentSession(organizationId, false);
      const token = await getToken({ skipCache: true });
      assertCurrentSession(organizationId, true);
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
    sessionId,
    setActive,
    signOut,
    userId,
    userMemberships.data,
    userMemberships.hasNextPage,
    userMemberships.isLoading
  ]);

  return null;
}
