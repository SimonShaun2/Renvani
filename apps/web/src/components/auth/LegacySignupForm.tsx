"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { BrandMark } from "@/src/components/layout/BrandMark";
import { api } from "@/src/lib/api";
import {
  SIGNUP_CHECK_EMAIL_MESSAGE,
  submitSignup,
} from "@/src/lib/signup-submit";

const signupSchema = z.object({
  companyName: z.string().trim().min(2, "Enter your business name"),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(72, "Use 72 characters or fewer"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

const inputClass =
  "w-full rounded-2xl border border-neutral-200 bg-neutral-100 px-4 py-3 text-base text-neutral-900 outline-none transition focus:border-brand-accent focus:bg-white focus:ring-4 focus:ring-brand-accent/10";

const fields: Array<{
  name: keyof SignupFormValues;
  label: string;
  type: string;
  autoComplete: string;
}> = [
  {
    name: "companyName",
    label: "Business name",
    type: "text",
    autoComplete: "organization",
  },
  {
    name: "firstName",
    label: "First name",
    type: "text",
    autoComplete: "given-name",
  },
  {
    name: "lastName",
    label: "Last name",
    type: "text",
    autoComplete: "family-name",
  },
  {
    name: "email",
    label: "Email address",
    type: "email",
    autoComplete: "email",
  },
  {
    name: "password",
    label: "Password",
    type: "password",
    autoComplete: "new-password",
  },
];

export function LegacySignupForm() {
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values: SignupFormValues) {
    setFormError(null);

    const timezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago";
    // Register returns 202 with no tokens: no session is stored here.
    const outcome = await submitSignup(api.post, { ...values, timezone });

    if (outcome.status === "check-email") {
      setSubmitted(true);
      return;
    }

    setFormError(outcome.message);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10">
      <div className="w-full max-w-md">
        <BrandMark />
        <div className="mt-10 space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">
            Create your Renvani account
          </h1>
          <p className="text-base text-neutral-500">
            Grow your shop. Renvani runs the rest.
          </p>
        </div>

        {submitted ? (
          <div
            className="mt-10 space-y-4 rounded-2xl border border-neutral-200 bg-neutral-100 px-5 py-6"
            role="status"
          >
            <p className="text-base font-semibold text-neutral-900">
              {SIGNUP_CHECK_EMAIL_MESSAGE}
            </p>
            <Link
              href="/login"
              className="inline-flex font-semibold text-brand-accent hover:text-brand-primary"
            >
              Go to sign in →
            </Link>
          </div>
        ) : (
          <form className="mt-10 space-y-5" onSubmit={handleSubmit(onSubmit)}>
            {fields.map((field) => (
              <div key={field.name} className="space-y-2">
                <label
                  htmlFor={field.name}
                  className="text-sm font-medium text-neutral-700"
                >
                  {field.label}
                </label>
                <input
                  id={field.name}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  className={inputClass}
                  {...register(field.name)}
                />
                {errors[field.name] ? (
                  <p className="text-sm text-error">
                    {errors[field.name]?.message}
                  </p>
                ) : null}
              </div>
            ))}

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
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>
          </form>
        )}

        <p className="mt-8 text-sm text-neutral-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-brand-accent hover:text-brand-primary"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
