"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { BrandMark } from "@/src/components/layout/BrandMark";
import { api, ApiError } from "@/src/lib/api";
import { getLoginRedirectPath, setBrowserAuthSession, type AuthResponse } from "@/src/lib/auth";
import { useAuthStore } from "@/src/stores/auth.store";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required")
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LegacyLoginForm() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema)
  });

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);

    try {
      const response = await api.post<AuthResponse>("/api/v1/auth/login", values);
      const session = setBrowserAuthSession(response);
      setAuth(session.user, session.company, response.tokens.accessToken);
      router.replace(getLoginRedirectPath(session.role));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setFormError("Incorrect email or password. Try again.");
        return;
      }

      setFormError("We could not sign you in right now. Please try again.");
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[0.96fr_1.04fr]">
      <section className="grid-background relative overflow-hidden bg-brand-primary px-6 py-8 text-white sm:px-10 lg:px-14 lg:py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(122,55,242,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(37,122,250,0.22),transparent_28%)]" />
        <div className="relative flex h-full flex-col">
          <BrandMark light />

          <div className="mt-14 max-w-xl space-y-6 lg:mt-24">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-accent-light">
              Renvani
            </p>
            <div className="space-y-4">
              <h1 className="max-w-md text-5xl font-semibold leading-[1.04] tracking-tight text-white sm:text-6xl">
                Grow your shop. Renvani runs the rest.
              </h1>
            </div>
            <p className="max-w-lg text-lg leading-8 text-neutral-300">
              AI that books, follows up and brings customers back. Dispatch, invoicing and QuickBooks sync run behind it.
            </p>
          </div>

        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-14">
        <div className="w-full max-w-md">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-accent">Welcome back</p>
            <h2 className="text-4xl font-semibold tracking-tight text-neutral-900">Sign in to Renvani</h2>
            <p className="text-base text-neutral-500">Access your jobs, dispatch board, and field tools.</p>
          </div>

          <form className="mt-10 space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-neutral-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="maria@acmehvac.com"
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-100 px-4 py-3 text-base text-neutral-900 outline-none transition focus:border-brand-accent focus:bg-white focus:ring-4 focus:ring-brand-accent/10"
                {...register("email")}
              />
              {errors.email ? <p className="text-sm text-error">{errors.email.message}</p> : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="password" className="text-sm font-medium text-neutral-700">
                  Password
                </label>
                <span className="text-sm font-medium text-brand-accent">Forgot password?</span>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-100 px-4 py-3 text-base text-neutral-900 outline-none transition focus:border-brand-accent focus:bg-white focus:ring-4 focus:ring-brand-accent/10"
                {...register("password")}
              />
              {errors.password ? <p className="text-sm text-error">{errors.password.message}</p> : null}
            </div>

            {formError ? (
              <div className="rounded-2xl border border-error/15 bg-error-light px-4 py-3 text-sm text-error">
                {formError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-2xl bg-brand-accent px-4 py-3 text-base font-semibold text-white shadow-lg shadow-brand-accent/25 transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-8 flex items-center gap-4 text-sm text-neutral-400">
            <span className="h-px flex-1 bg-neutral-200" />
            <span>or</span>
            <span className="h-px flex-1 bg-neutral-200" />
          </div>

          <div className="mt-6 space-y-2 text-sm text-neutral-500">
            <p>
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-semibold text-brand-accent hover:text-brand-primary">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
