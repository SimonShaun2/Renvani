import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

export type SmokeMode = "loading" | "error" | "empty" | "data";
export type RouteTable = Record<string, { empty: unknown; data: unknown }>;

/** Resolve a mocked GET for `path` in `mode` using longest-prefix match against `routes`. */
export function resolveMock(routes: RouteTable, mode: SmokeMode, path: string): Promise<unknown> {
  if (mode === "loading") return new Promise(() => undefined);
  if (mode === "error") {
    return Promise.reject(Object.assign(new Error("Mock server error"), { status: 500, payload: { error: "INTERNAL", message: "Mock server error" } }));
  }
  const clean = path.split("?")[0] ?? path;
  const key = Object.keys(routes)
    .filter((prefix) => clean.startsWith(prefix))
    .sort((a, b) => b.length - a.length)[0];
  if (!key) return Promise.resolve({ data: [], items: [], total: 0, page: 1, limit: 100, totalPages: 1 });
  return Promise.resolve(routes[key]![mode]);
}

export function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
