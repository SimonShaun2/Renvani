"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  VERIFY_EMAIL_INVALID_MESSAGE,
  stripTokenFromUrl,
  verifyEmailAndSignIn,
} from "@/src/lib/verify-email";
import { useAuthStore } from "@/src/stores/auth.store";

export function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [status, setStatus] = useState<"ready" | "verifying" | "invalid">("ready");
  // Token lives only in this ref after load; it is stripped from the URL right away.
  const tokenRef = useRef<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (tokenRef.current === null) tokenRef.current = searchParams.get("token");
    stripTokenFromUrl();
  }, [searchParams]);

  // No auto-verify on load: link scanners would burn the single-use token.
  // The POST fires only when the user clicks "Confirm email".
  const confirm = () => {
    if (started.current) return;
    started.current = true;
    setStatus("verifying");
    void verifyEmailAndSignIn(tokenRef.current, {
      setAuth,
      redirect: (path) => router.replace(path),
    }).then((result) => {
      if (result.status === "invalid") setStatus("invalid");
    });
  };

  if (status === "invalid") {
    return (
      <div className="space-y-6">
        <div
          role="alert"
          className="rounded-2xl border border-error/15 bg-error-light px-4 py-3 text-sm text-error"
        >
          {VERIFY_EMAIL_INVALID_MESSAGE}
        </div>
        <Link
          href="/login"
          className="font-semibold text-brand-accent hover:text-brand-primary"
        >
          Go to sign in →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-base text-neutral-500">
        Click below to confirm your email and sign in.
      </p>
      <button
        type="button"
        onClick={confirm}
        disabled={status === "verifying"}
        className="min-h-[44px] w-full rounded-full bg-brand-primary px-5 font-semibold text-white disabled:opacity-60"
      >
        {status === "verifying" ? "Confirming…" : "Confirm email"}
      </button>
    </div>
  );
}
