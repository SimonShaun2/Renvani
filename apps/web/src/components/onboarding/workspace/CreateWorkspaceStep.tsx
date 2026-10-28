"use client";

import { useAuth, useOrganizationList } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";

import { publicEnv } from "@fsm/config";

import { waitForWorkspace } from "./wait-for-workspace";
import {
  WORKSPACE_COPY,
  WORKSPACE_NAME_MAX_LENGTH,
  WORKSPACE_READY_ENDPOINT,
  WORKSPACE_SETUP_NEXT_ROUTE
} from "./workspace-setup.config";

type Status = "default" | "progress" | "error";
type ErrorKind = "create" | "company" | "role";

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
  company: WORKSPACE_COPY.detailCompany,
  role: WORKSPACE_COPY.detailRole
};

export function CreateWorkspaceStep() {
  const router = useRouter();
  const { getToken, orgId } = useAuth();
  const { isLoaded, createOrganization, setActive } = useOrganizationList();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("default");
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [orgReady, setOrgReady] = useState(Boolean(orgId));

  const poll = useCallback(async () => {
    setStatus("progress");
    setErrorKind(null);
    const result = await waitForWorkspace({ getFreshToken: () => getToken({ skipCache: true }), checkCompany });
    if (result.ok) {
      router.replace(WORKSPACE_SETUP_NEXT_ROUTE);
      router.refresh();
      return;
    }
    setErrorKind(result.reason);
    setStatus("error");
  }, [getToken, router]);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed || !isLoaded || !createOrganization || !setActive) return;
    setStatus("progress");
    setErrorKind(null);
    try {
      const organization = await createOrganization({ name: trimmed });
      await setActive({ organization: organization.id });
      setOrgReady(true);
    } catch {
      setErrorKind("create");
      setStatus("error");
      return;
    }
    await poll();
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (orgReady ? poll() : create());
  };

  const busy = status === "progress";
  const buttonLabel = status === "error" ? WORKSPACE_COPY.retry : orgReady && status === "default" ? WORKSPACE_COPY.continue : WORKSPACE_COPY.submit;

  return (
    <form className="ws-card" onSubmit={onSubmit} aria-busy={busy}>
      <p className="ws-eyebrow">{WORKSPACE_COPY.eyebrow}</p>
      <h1 className="ws-title">{WORKSPACE_COPY.title}</h1>
      <p className="ws-sub">{WORKSPACE_COPY.intro}</p>

      {orgReady ? null : (
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
          <button type="submit" className="ws-button" disabled={!isLoaded || (!orgReady && !name.trim())}>
            {buttonLabel}
          </button>
        </>
      )}
    </form>
  );
}
