"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { BrandMark } from "@/src/components/layout/BrandMark";
import { api } from "@/src/lib/api";
import type { AuthResponse } from "@/src/lib/auth";
import {
  VERIFY_EMAIL_INVALID_MESSAGE,
  verifyEmailAndSignIn,
} from "@/src/lib/verify-email";
import { useAuthStore } from "@/src/stores/auth.store";

function VerifyEmailContent() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const setAuth = useAuthStore((state) => state.setAuth);
  const [status, setStatus] = useState<"verifying" | "invalid">("verifying");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void verifyEmailAndSignIn(token, {
      post: (path, body) => api.post<AuthResponse>(path, body),
      setAuth,
      redirect: (path) => router.replace(path),
    }).then((result) => {
      if (result.status === "invalid") setStatus("invalid");
    });
  }, [token, setAuth, router]);

  return status === "invalid" ? (
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
  ) : (
    <p role="status" className="text-base text-neutral-500">
      Verifying your email…
    </p>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[0.96fr_1.04fr]">
      <section className="grid-background relative overflow-hidden bg-brand-primary px-6 py-8 text-white sm:px-10 lg:px-14 lg:py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(122,55,242,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(37,122,250,0.22),transparent_28%)]" />
        <div className="relative flex h-full flex-col">
          <BrandMark light />
          <div className="mt-14 max-w-xl space-y-6 lg:mt-24">
            <h1 className="max-w-md text-5xl font-semibold leading-[1.04] tracking-tight text-white sm:text-6xl">
              Welcome to Renvani.
            </h1>
            <p className="max-w-lg text-lg leading-8 text-neutral-300">
              Grow revenue from the customers you already have.
            </p>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-14">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-accent">
              Verify email
            </p>
            <h2 className="text-4xl font-semibold tracking-tight text-neutral-900">
              Confirming your Renvani account
            </h2>
          </div>
          <Suspense
            fallback={
              <p className="text-base text-neutral-500">
                Verifying your email…
              </p>
            }
          >
            <VerifyEmailContent />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
