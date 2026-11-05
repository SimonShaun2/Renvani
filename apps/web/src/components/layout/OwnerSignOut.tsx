"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { completeClientLogout } from "@/src/lib/client-logout";
import { useAuthStore } from "@/src/stores/auth.store";

/** Same logout flow as Header; no session/token implementation is replaced. */
export function OwnerSignOut() {
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function signOut() {
    setPending(true); setFailed(false);
    try { await completeClientLogout({ clearAuth, redirect: (path) => router.replace(path) }); }
    catch { setFailed(true); }
    finally { setPending(false); }
  }
  return <div className="ml-auto">
    <button type="button" aria-label="Sign out" title="Sign out" disabled={pending} onClick={() => { void signOut(); }} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[#c3c8da] hover:bg-[#18204a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f6b400] disabled:opacity-50">
      <LogOut className="h-4 w-4" aria-hidden="true" />
    </button>
    {failed ? <p role="alert" className="max-w-[120px] text-xs text-white">Sign out failed. Try again.</p> : null}
  </div>;
}
