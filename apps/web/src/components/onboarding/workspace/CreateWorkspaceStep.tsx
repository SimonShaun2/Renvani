"use client";

import { useAuth, useOrganizationList, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { publicEnv } from "@fsm/config";

import { waitForWorkspace } from "./wait-for-workspace";
import {
  WORKSPACE_COPY,
  WORKSPACE_NAME_MAX_LENGTH,
  WORKSPACE_READY_ENDPOINT,
  WORKSPACE_SETUP_NEXT_ROUTE
} from "./workspace-setup.config";

type Status = "default" | "progress" | "error";
type ErrorKind = "create" | "activate" | "lookup" | "reconcile" | "company" | "role";
const PENDING_ORG_KEY = "renvani:onboarding:pending-org:";

function pendingOrgStorageKey(userId: string): string {
  return `${PENDING_ORG_KEY}${userId}`;
}

async function checkCompany(token: string): Promise<number> {
  const response = await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}${WORKSPACE_READY_ENDPOINT}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
    cache: "no-store"
  });
  return response.status;
}

const ERROR_DETAIL: Record<ErrorKind, string> = {
  create: WORKSPACE_COPY.detailCreate,
  activate: WORKSPACE_COPY.detailActivate,
  lookup: WORKSPACE_COPY.detailLookup,
  reconcile: WORKSPACE_COPY.detailReconcile,
  company: WORKSPACE_COPY.detailCompany,
  role: WORKSPACE_COPY.detailRole
};

export function CreateWorkspaceStep() {
  const router = useRouter();
  const { getToken, orgId, userId } = useAuth();
  const { user } = useUser();
  const { isLoaded, createOrganization, setActive } = useOrganizationList();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("default");
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [orgReady, setOrgReady] = useState(Boolean(orgId));
  const [pendingOrgId, setPendingOrgId] = useState<string | null>(null);
  const inFlight = useRef(false);
  const currentUserId = useRef(userId);
  currentUserId.current = userId;
  const previousUserId = useRef(userId);

  useEffect(() => {
    if (previousUserId.current !== userId) {
      previousUserId.current = userId;
      inFlight.current = false;
      setName("");
      setStatus("default");
      setErrorKind(null);
      setOrgReady(Boolean(orgId));
      setPendingOrgId(null);
    }
    if (userId && !orgId) {
      setPendingOrgId(sessionStorage.getItem(pendingOrgStorageKey(userId)));
    }
  }, [orgId, userId]);

  const poll = useCallback(async () => {
    setStatus("progress");
    setErrorKind(null);
    const result = await waitForWorkspace({ getFreshToken: () => getToken({ skipCache: true }), checkCompany });
    if (result.ok) {
      if (userId) sessionStorage.removeItem(pendingOrgStorageKey(userId));
      router.replace(WORKSPACE_SETUP_NEXT_ROUTE);
      router.refresh();
      return;
    }
    setErrorKind(result.reason);
    setStatus("error");
  }, [getToken, router, userId]);

  const create = async () => {
    const trimmed = name.trim();
    if ((!trimmed && !pendingOrgId) || !isLoaded || !user || !createOrganization || !setActive || inFlight.current) return;
    const requestUserId = userId;
    inFlight.current = true;
    setStatus("progress");
    setErrorKind(null);
    let activationPending = false;
    let lookupPending = false;
    try {
      let organizationId = pendingOrgId;
      if (!organizationId) {
        lookupPending = true;
        const matches: string[] = [];
        let pageNumber = 1;
        do {
          const page = await user.getOrganizationMemberships({ pageSize: 100, initialPage: pageNumber });
          if (currentUserId.current !== requestUserId) return;
          matches.push(...page.data.filter((membership) => membership.organization.name.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase()).map((membership) => membership.organization.id));
          if (pageNumber * 100 >= page.total_count || page.data.length === 0) break;
          pageNumber += 1;
        } while (true);
        lookupPending = false;
        if (matches.length > 1) {
          setErrorKind("reconcile");
          setStatus("error");
          return;
        }
        organizationId = matches[0] ?? null;
        if (!organizationId) {
          if (currentUserId.current !== requestUserId) return;
          const organization = await createOrganization({ name: trimmed });
          organizationId = organization.id;
        }
        if (requestUserId) sessionStorage.setItem(pendingOrgStorageKey(requestUserId), organizationId);
        if (currentUserId.current !== requestUserId) return;
        setPendingOrgId(organizationId);
      }
      activationPending = true;
      await setActive({ organization: organizationId });
      if (currentUserId.current !== requestUserId) return;
      setOrgReady(true);
      await poll();
    } catch {
      if (currentUserId.current !== requestUserId) return;
      setErrorKind(activationPending ? "activate" : lookupPending ? "lookup" : "create");
      setStatus("error");
      return;
    } finally {
      if (currentUserId.current === requestUserId) inFlight.current = false;
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    void (orgReady ? poll() : create());
  };

  const busy = status === "progress";
  const buttonLabel = status === "error" ? WORKSPACE_COPY.retry : orgReady && status === "default" ? WORKSPACE_COPY.continue : WORKSPACE_COPY.submit;

  return (
    <form className="ws-card" onSubmit={onSubmit} aria-busy={busy}>
      <p className="ws-eyebrow">{WORKSPACE_COPY.eyebrow}</p>
      <h1 className="ws-title">{WORKSPACE_COPY.title}</h1>
      <p className="ws-sub">{WORKSPACE_COPY.intro}</p>

      {orgReady || pendingOrgId ? null : (
        <div className="ws-field">
          <label className="ws-label" htmlFor="workspace-name">
            {WORKSPACE_COPY.nameLabel}
          </label>
          <input
            id="workspace-name"
            name="companyName"
            className="ws-input"
            required
            maxLength={WORKSPACE_NAME_MAX_LENGTH}
            autoComplete="organization"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={busy}
          />
        </div>
      )}

      {busy ? (
        <>
          <div className="ws-progress" role="progressbar" aria-label={WORKSPACE_COPY.progress}>
            <div className="ws-progress__fill" />
          </div>
          <button type="button" className="ws-button ws-button--disabled" disabled>
            <img src="/onboarding/workspace-spinner.svg" width={16} height={16} alt="" className="ws-spinner" />
            {WORKSPACE_COPY.progress}
          </button>
        </>
      ) : (
        <>
          {status === "error" && errorKind ? (
            <div role="alert" className="ws-error">
              <p className="ws-error__title">{WORKSPACE_COPY.error}</p>
              <p className="ws-error__detail">{ERROR_DETAIL[errorKind]}</p>
            </div>
          ) : null}
          <button type="submit" className="ws-button" disabled={!isLoaded || (!orgReady && !user) || (!orgReady && !pendingOrgId && !name.trim())}>
            {buttonLabel}
          </button>
        </>
      )}
    </form>
  );
}
