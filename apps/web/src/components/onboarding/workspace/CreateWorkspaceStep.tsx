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
  WORKSPACE_SETUP_NEXT_ROUTE,
  WORKSPACE_STEPS,
  type WorkspaceStepKey
} from "./workspace-setup.config";

type Phase = { step: WorkspaceStepKey; error: string | null; busy: boolean };

async function checkCompany(token: string): Promise<number> {
  const response = await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}${WORKSPACE_READY_ENDPOINT}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
    cache: "no-store"
  });
  return response.status;
}

export function CreateWorkspaceStep() {
  const router = useRouter();
  const { getToken, orgId } = useAuth();
  const { isLoaded, createOrganization, setActive } = useOrganizationList();
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<Phase>({ step: orgId ? "provision" : "name", error: null, busy: false });

  const poll = useCallback(async () => {
    setPhase({ step: "provision", error: null, busy: true });
    const result = await waitForWorkspace({
      getFreshToken: () => getToken({ skipCache: true }),
      checkCompany
    });
    if (result.ok) {
      router.replace(WORKSPACE_SETUP_NEXT_ROUTE);
      router.refresh();
      return;
    }
    setPhase({
      step: result.reason === "role" ? "role" : "provision",
      busy: false,
      error: result.reason === "role" ? WORKSPACE_COPY.timeoutRole : WORKSPACE_COPY.timeoutCompany
    });
  }, [getToken, router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !isLoaded || !createOrganization || !setActive) return;
    setPhase({ step: "create", error: null, busy: true });
    try {
      const organization = await createOrganization({ name: trimmed });
      await setActive({ organization: organization.id });
    } catch {
      setPhase({ step: "name", error: WORKSPACE_COPY.createFailed, busy: false });
      return;
    }
    await poll();
  };

  const hasOrg = Boolean(orgId) || (phase.step !== "name" && phase.step !== "create");
  const activeIndex = WORKSPACE_STEPS.findIndex((step) => step.key === phase.step);

  return (
    <div className="workspace-step w-full max-w-sm">
      <h1 className="text-xl font-semibold">{WORKSPACE_COPY.title}</h1>
      <p className="mt-2 text-sm text-gray-600">{WORKSPACE_COPY.intro}</p>

      <ol className="mt-4 space-y-1 text-sm" aria-label="Setup progress">
        {WORKSPACE_STEPS.map((step, index) => (
          <li
            key={step.key}
            aria-current={index === activeIndex ? "step" : undefined}
            className={index < activeIndex ? "text-gray-500" : index === activeIndex ? "font-medium" : "text-gray-400"}
          >
            {index === activeIndex && phase.busy ? <span className="workspace-step__pulse" aria-hidden="true" /> : null}
            {step.label}
          </li>
        ))}
      </ol>

      {hasOrg ? null : (
        <form className="mt-6 space-y-3" onSubmit={onSubmit}>
          <label className="block text-sm font-medium" htmlFor="workspace-name">
            {WORKSPACE_COPY.nameLabel}
          </label>
          <input
            id="workspace-name"
            name="companyName"
            required
            maxLength={WORKSPACE_NAME_MAX_LENGTH}
            autoComplete="organization"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3"
            disabled={phase.busy}
          />
          <button
            type="submit"
            className="min-h-[44px] w-full rounded-full bg-black px-5 text-white disabled:opacity-50"
            disabled={phase.busy || !isLoaded || !name.trim()}
          >
            {WORKSPACE_COPY.submit}
          </button>
        </form>
      )}

      {phase.error ? (
        <div role="alert" className="mt-4 text-sm text-red-700">
          <p>{phase.error}</p>
          {hasOrg ? (
            <button type="button" onClick={() => void poll()} className="mt-3 min-h-[44px] rounded-full border border-gray-300 px-5">
              {WORKSPACE_COPY.retry}
            </button>
          ) : null}
        </div>
      ) : null}

      {hasOrg && !phase.error && !phase.busy ? (
        <button type="button" onClick={() => void poll()} className="mt-6 min-h-[44px] w-full rounded-full bg-black px-5 text-white">
          Continue
        </button>
      ) : null}
    </div>
  );
}
