"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, MessageSquareText, Star } from "lucide-react";

import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import {
  useCompleteReview,
  usePublicReview,
  type PublicReviewRecord
} from "@/src/hooks/review-requests.hooks";
import { ApiError } from "@/src/lib/api";
import { cn } from "@/src/lib/utils";
import { showToast } from "@/src/stores/toast.store";

function getPreferredReviewUrl(review: PublicReviewRecord) {
  return review.reviewUrl ?? review.settings.google.url ?? review.settings.yelp.url ?? review.settings.facebook.url;
}

function PlatformButton({
  label,
  href
}: {
  label: string;
  href: string | null;
}) {
  return (
    <a
      href={href ?? "#"}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition",
        href
          ? "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50"
          : "pointer-events-none bg-neutral-100 text-neutral-300"
      )}
    >
      <ExternalLink className="h-4 w-4" />
      {label}
    </a>
  );
}

export function PublicReviewClient({ token }: { token: string }) {
  const reviewQuery = usePublicReview(token);
  const completeReview = useCompleteReview(token);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const review = reviewQuery.data?.review;
  const preferredReviewUrl = useMemo(
    () => (review ? getPreferredReviewUrl(review) : null),
    [review]
  );

  async function handleSubmit() {
    if (!review) {
      return;
    }

    try {
      await completeReview.mutateAsync({
        rating,
        ...(reviewText.trim() ? { reviewText: reviewText.trim() } : {})
      });
      setSubmitted(true);

      if (preferredReviewUrl) {
        window.open(preferredReviewUrl, "_blank", "noopener,noreferrer");
      }

      showToast({
        tone: "success",
        title: "Thanks for the feedback",
        description: preferredReviewUrl
          ? "Your review was captured. The public review link opened in a new tab."
          : "Your review was captured successfully."
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "The review could not be submitted.";
      showToast({
        tone: "error",
        title: "Review could not be submitted",
        description: message
      });
    }
  }

  if (reviewQuery.isLoading) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-12">
        <SkeletonCard className="h-[420px]" />
      </div>
    );
  }

  if (reviewQuery.isError || !review) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-12">
        <div className="rounded-[32px] border border-neutral-200 bg-white px-6 py-10 shadow-[0_24px_80px_rgba(16,33,99,0.10)]">
          <EmptyState
            icon={MessageSquareText}
            title="This review link has expired"
            subtitle="It may already be completed or is no longer available. If you still want to leave feedback, contact the office directly."
          />
        </div>
      </div>
    );
  }

  const alreadyCompleted = review.status === "completed" || submitted;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(37,122,250,0.14),_transparent_40%),linear-gradient(180deg,_#f8fbff_0%,_#ffffff_60%)] px-4 py-10">
      <div className="mx-auto max-w-[640px] space-y-6">
        <section className="overflow-hidden rounded-[36px] border border-brand-accent/10 bg-white shadow-[0_24px_90px_rgba(16,33,99,0.12)]">
          <div className="border-b border-neutral-100 bg-brand-primary px-6 py-6 text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">Renvani Feedback</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{review.companyName}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/72">
              Tell us how your visit went. Your rating helps the team improve, and we can direct you to your preferred review platform after submission.
            </p>
          </div>

          <div className="px-6 py-6">
            {alreadyCompleted ? (
              <div className="space-y-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-light text-success">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Thanks for your review</h2>
                  <p className="mt-2 text-sm leading-6 text-neutral-500">
                    We saved your rating and opened your public review destination if one was configured.
                  </p>
                </div>

                <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                  <p className="text-sm font-semibold text-neutral-900">Need to leave it publicly too?</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <PlatformButton label="Google" href={review.settings.google.url} />
                    <PlatformButton label="Yelp" href={review.settings.yelp.url} />
                    <PlatformButton label="Facebook" href={review.settings.facebook.url} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                  <p className="text-sm font-semibold text-neutral-900">
                    Technician: {review.technicianName ?? "Your service team"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-neutral-500">
                    Rate your visit from 1 to 5 stars. After you submit, we&apos;ll open your preferred public review page in a new tab when available.
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-400">Your Rating</p>
                  <div className="mt-4 flex items-center gap-3">
                    {Array.from({ length: 5 }, (_, index) => {
                      const starValue = index + 1;
                      const isFilled = starValue <= rating;

                      return (
                        <button
                          key={starValue}
                          type="button"
                          onClick={() => setRating(starValue)}
                          className={cn(
                            "flex h-14 w-14 items-center justify-center rounded-2xl border transition",
                            isFilled
                              ? "border-warning/20 bg-warning-light text-warning"
                              : "border-neutral-200 bg-white text-neutral-300 hover:border-brand-accent/30 hover:text-brand-accent"
                          )}
                          aria-label={`Rate ${starValue} stars`}
                        >
                          <Star className={cn("h-6 w-6", isFilled && "fill-current")} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="review-feedback" className="text-sm font-semibold text-neutral-900">
                    Tell us more
                  </label>
                  <textarea
                    id="review-feedback"
                    value={reviewText}
                    onChange={(event) => setReviewText(event.target.value)}
                    rows={5}
                    placeholder="What stood out about the visit?"
                    className="mt-3 w-full rounded-[24px] border border-neutral-200 px-4 py-4 text-sm text-neutral-700 outline-none transition focus:border-brand-accent"
                  />
                </div>

                <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                  <p className="text-sm font-semibold text-neutral-900">Public review destinations</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <PlatformButton label="Google" href={review.settings.google.url} />
                    <PlatformButton label="Yelp" href={review.settings.yelp.url} />
                    <PlatformButton label="Facebook" href={review.settings.facebook.url} />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void handleSubmit();
                  }}
                  disabled={completeReview.isPending}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[22px] bg-brand-accent px-5 text-sm font-semibold text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {completeReview.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting review...
                    </>
                  ) : (
                    "Submit Review"
                  )}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
