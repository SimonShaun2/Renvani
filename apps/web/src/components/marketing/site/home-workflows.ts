/** Illustrative marketing sequences; these never invoke product APIs or change business records. */
export type HomeWorkflowId = "growth" | "revenue" | "operations" | "retention" | "command-center";

export type HomeWorkflow = {
  id: HomeWorkflowId;
  name: string;
  headline: string;
  description: string;
  href: string;
  steps: readonly { label: string; title: string; description: string }[];
};

export const HOME_WORKFLOWS: readonly HomeWorkflow[] = [
  {
    id: "growth",
    name: "Growth",
    headline: "Get found. Get booked.",
    description: "Start with the business you want to grow. Give the next customer a clear path from finding you to requesting work.",
    href: "/product/growth",
    steps: [
      { label: "Set your goal", title: "Choose more bookings", description: "Your business profile sets the services, service area and goal for the mission." },
      { label: "Get found", title: "Show up for the right work", description: "A local discovery example connects your services with a customer looking for help." },
      { label: "Get a request", title: "Make the next step easy", description: "The customer chooses a service and sends a work request through your website." },
      { label: "Keep it moving", title: "Keep the request connected", description: "The inquiry carries its source and service details into the estimate workflow." }
    ]
  },
  {
    id: "revenue",
    name: "Revenue",
    headline: "A clearer path to yes.",
    description: "Give every request a next step. Prepare the right estimate, review the follow-up and carry approved work forward.",
    href: "/product/revenue",
    steps: [
      { label: "New request", title: "Start with the customer’s need", description: "A new work request arrives with the details collected by Growth." },
      { label: "Build an estimate", title: "Email or visit first", description: "Prepare an email estimate or schedule an onsite estimate, depending on the work." },
      { label: "Review follow-up", title: "Keep the owner in the decision", description: "Review the message and customer context before a follow-up is sent." },
      { label: "Get approval", title: "Carry approved scope forward", description: "The customer’s approval stays attached to the estimate for the service handoff." }
    ]
  },
  {
    id: "operations",
    name: "Operations",
    headline: "From the schedule to paid.",
    description: "Connect the office and the field. Keep the plan, approved work, job details and payment with the same visit.",
    href: "/product/operations",
    steps: [
      { label: "Schedule", title: "Give the visit a clear plan", description: "Schedule the visit and dispatch the right technician with the customer’s details." },
      { label: "Arrive", title: "Bring the context to the job", description: "The technician opens the visit and reviews the request onsite." },
      { label: "Confirm work", title: "Confirm the estimate", description: "The technician confirms the approved estimate and converts it to a work order." },
      { label: "Do the job", title: "Document the work", description: "Use the field app to track the job, check products, complete tasks and save photos." },
      { label: "Take payment", title: "Finish the visit", description: "A mobile payment example completes the visit and hands the customer into Retention." }
    ]
  },
  {
    id: "retention",
    name: "Retention",
    headline: "Give good customers a reason to return.",
    description: "Keep the relationship going after the job. Connect reviews, maintenance and the next visit to the work you already know.",
    href: "/product/retention",
    steps: [
      { label: "Job complete", title: "Start with the finished work", description: "The completed visit and payment become the context for the next customer touchpoint." },
      { label: "Request a review", title: "Ask at the right moment", description: "Prepare a review invitation using the customer’s consent and communication preferences." },
      { label: "Plan maintenance", title: "Offer the next useful service", description: "Review an appropriate membership or maintenance plan with the customer." },
      { label: "Welcome back", title: "Make the next visit easier", description: "A repeat visit brings the service history and agreed work back to the team." }
    ]
  },
  {
    id: "command-center",
    name: "Command Center",
    headline: "Your business. Your next move.",
    description: "Set the direction, review the decisions that need you and see how the work is progressing in one place.",
    href: "/product/command-center",
    steps: [
      { label: "Set your profile", title: "Start with your business", description: "Your service area, capacity and approval rules establish the operating context." },
      { label: "Choose a mission", title: "Choose the outcome", description: "Select Get more bookings as an example mission for new external demand." },
      { label: "Review the plan", title: "See the suggested next move", description: "Review a proposed local outreach action and the reason it fits the mission." },
      { label: "Approve", title: "Keep the decision with you", description: "The owner reviews the message, audience and scope before approving the action." },
      { label: "See progress", title: "Follow the handoff", description: "An illustrative new request appears with its source and next service step." }
    ]
  }
];
