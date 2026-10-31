import { useRef } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { EditAgentActionParametersInput, OperatorInboxItem } from "@fsm/types";

import { ApiError, api } from "@/src/lib/api";

const operatorInboxKeys = {
  all: ["operator-inbox"] as const,
  list: (state?: string) => [...operatorInboxKeys.all, "list", state ?? "all"] as const,
  detail: (id: string) => [...operatorInboxKeys.all, "detail", id] as const
};

/** The fields a guarded write needs: the id and the `version` the operator saw. */
export type GuardedInboxItem = Pick<OperatorInboxItem, "id" | "version">;

export const STALE_ITEM_MESSAGE = "This item changed, review the latest version.";
export const IDEMPOTENCY_CONFLICT_MESSAGE = "This action was already sent with different details. Review the latest version.";

/** 409 from a reused Idempotency-Key with a different request (API message names the header). */
export function isIdempotencyConflict(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409 && /idempotency-key/i.test(err.message);
}

/** Any other 409 on an agent action is treated as stale (expectedVersion mismatch or state moved on). */
export function isStaleConflict(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409 && !isIdempotencyConflict(err);
}

/** Short operator-facing text for an approve / execute / edit failure. */
export function agentActionErrorMessage(err: unknown): string {
  if (isIdempotencyConflict(err)) return IDEMPOTENCY_CONFLICT_MESSAGE;
  if (isStaleConflict(err)) return STALE_ITEM_MESSAGE;
  return err instanceof ApiError ? err.message : "Action failed";
}

function newIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * One Idempotency-Key per user action. A retry of the same action (same item version, after a network
 * error or 5xx) reuses the key; success, a 4xx answer, or a new version starts a new action and a new key.
 */
function useActionKey() {
  const ref = useRef<{ version: number | undefined; key: string } | null>(null);
  return {
    take(version: number | undefined): string {
      if (!ref.current || ref.current.version !== version) ref.current = { version, key: newIdempotencyKey() };
      return ref.current.key;
    },
    settle(err?: unknown) {
      const retryable = err !== undefined && !(err instanceof ApiError && err.status < 500);
      if (!retryable) ref.current = null;
    }
  };
}

export function useOperatorInbox(state?: string) {
  const queryString = state ? `?state=${encodeURIComponent(state)}` : "";

  return useQuery({
    queryKey: operatorInboxKeys.list(state),
    queryFn: () => api.get<{ items: OperatorInboxItem[] }>(`/api/v1/operator/inbox${queryString}`)
  });
}

export function useOperatorInboxItem(id: string | null) {
  return useQuery({
    queryKey: id ? operatorInboxKeys.detail(id) : operatorInboxKeys.detail("pending"),
    queryFn: () => api.get<OperatorInboxItem>(`/api/v1/operator/inbox/${id}`),
    enabled: Boolean(id)
  });
}

/** PATCH /operator/inbox/:id with `expectedVersion` (stale → 409, then the list and item are refetched). */
export function useEditOperatorInboxItem(item: GuardedInboxItem) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: EditAgentActionParametersInput) =>
      api.patch<OperatorInboxItem>(`/api/v1/operator/inbox/${item.id}`, { ...input, expectedVersion: item.version }),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: operatorInboxKeys.all });
    }
  });
}

/** Approve / execute: body `{ expectedVersion }` (required by the API) plus an `Idempotency-Key` header. */
function useGuardedAgentAction(item: GuardedInboxItem, op: "approve" | "execute") {
  const queryClient = useQueryClient();
  const actionKey = useActionKey();

  return useMutation({
    mutationFn: () =>
      api.post<OperatorInboxItem & { replayed?: boolean }>(
        `/api/v1/agent-actions/${item.id}/${op}`,
        { expectedVersion: item.version },
        { headers: { "Idempotency-Key": actionKey.take(item.version) } }
      ),
    onSuccess: async () => {
      actionKey.settle();
      await queryClient.invalidateQueries({ queryKey: operatorInboxKeys.all });
    },
    onError: async (err) => {
      actionKey.settle(err);
      if (err instanceof ApiError && err.status === 409) {
        await queryClient.invalidateQueries({ queryKey: operatorInboxKeys.all });
      }
    }
  });
}

export function useApproveAgentAction(item: GuardedInboxItem) {
  return useGuardedAgentAction(item, "approve");
}

export function useRejectAgentAction(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<OperatorInboxItem>(`/api/v1/agent-actions/${id}/reject`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: operatorInboxKeys.all });
    }
  });
}

export function useExecuteAgentAction(item: GuardedInboxItem) {
  return useGuardedAgentAction(item, "execute");
}
