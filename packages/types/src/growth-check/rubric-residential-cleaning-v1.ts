import type { GrowthCheckRubricDefinition } from "./types.js";

/**
 * Versioned, extensible rubric data for FS-55 Growth Check (residential cleaning).
 * No numeric grades, revenue-lift estimates, or third-party marketing copy.
 */
export const RESIDENTIAL_CLEANING_RUBRIC_V1: GrowthCheckRubricDefinition = {
  id: "residential-cleaning",
  version: "1.0.0",
  trade: "residential_cleaning",
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
          label: "Page has a title element",
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
          label: "Contact or phone pattern on homepage",
          visibility: "public",
          method: "http_fetch",
          path: "/",
          signalId: "contact_pattern_present"
        }
      ]
    },
    {
      id: "booking_intake",
      label: "Booking intake",
      checks: [
        {
          id: "booking_cta",
          label: "Booking or schedule call-to-action on homepage",
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
          label: "Dispatch coverage model",
          visibility: "private_ops",
          method: "static"
        },
        {
          id: "quality_assurance",
          label: "Quality assurance workflow",
          visibility: "private_ops",
          method: "static"
        }
      ]
    }
  ]
};
