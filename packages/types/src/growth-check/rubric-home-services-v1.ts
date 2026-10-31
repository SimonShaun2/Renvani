import type { GrowthCheckRubricDefinition } from "./types.js";

/**
 * Trade-neutral Growth Check rubric for field/home services (HVAC, plumbing, electrical).
 * Same public signals as v1 checks, worded for service trades. Extend by adding areas/checks
 * or a new rubric entry in GROWTH_CHECK_RUBRIC_REGISTRY; never by enum.
 */
export const HOME_SERVICES_RUBRIC_V1: GrowthCheckRubricDefinition = {
  id: "home-services",
  version: "1.0.0",
  trade: "home_services",
  areas: [
    {
      id: "web_presence",
      label: "Website basics",
      checks: [
        {
          id: "homepage_reachable",
          label: "Homepage responds over HTTPS",
          visibility: "public",
          method: "http_fetch",
          path: "/",
          signalId: "https_reachable"
        },
        {
          id: "title_present",
          label: "Page title names the trade and service area",
          visibility: "public",
          method: "http_fetch",
          path: "/",
          signalId: "html_title_present"
        }
      ]
    },
    {
      id: "local_discovery",
      label: "Local discovery signals",
      checks: [
        {
          id: "contact_signals",
          label: "Phone number or contact path visible for service calls",
          visibility: "public",
          method: "http_fetch",
          path: "/",
          signalId: "contact_pattern_present"
        }
      ]
    },
    {
      id: "booking_intake",
      label: "Service request intake",
      checks: [
        {
          id: "booking_cta",
          label: "Book a service visit or request an estimate call-to-action",
          visibility: "public",
          method: "http_fetch",
          path: "/",
          signalId: "booking_cta_present"
        }
      ]
    },
    {
      id: "private_operations",
      label: "Back-office operations",
      checks: [
        {
          id: "dispatch_coverage",
          label: "Dispatch and on-call coverage model",
          visibility: "private_ops",
          method: "static"
        },
        {
          id: "quality_assurance",
          label: "Callback and warranty-return workflow",
          visibility: "private_ops",
          method: "static"
        }
      ]
    }
  ]
};

/** Trades the home-services rubric is written for. Extend by appending. */
export const HOME_SERVICES_RUBRIC_TRADES: readonly string[] = ["hvac", "plumbing", "electrical"];
