"use client";

import { Suspense } from "react";

import { VerifyEmailContent } from "@/src/components/auth/VerifyEmailContent";
import { BrandMark } from "@/src/components/layout/BrandMark";

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
                Loading…
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
