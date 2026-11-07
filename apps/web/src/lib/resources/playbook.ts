/** Public editorial toolkit. Draft blog collections are never imported into this registry. */
export type ResourceKind = "template" | "article";
export type ResourceCard = { title: string; description: string; href: string; kind: ResourceKind; topic: string };
export type TemplateSection = { title: string; text: string };
export type PlaybookTemplate = {
  slug: string; title: string; description: string; topic: string;
  introduction: string; sections: readonly TemplateSection[];
  product: { label: string; href: string };
};
export const PLAYBOOK_COPY = {
  title: "The Renvani Playbook | Home Service Business Resources",
  description: "Practical guides, tools, and templates to win more jobs, run profitable work, and bring customers back.",
  name: "The Renvani Playbook",
  headline: "Build a better service business."
} as const;

export const PLAYBOOK_TEMPLATES: readonly PlaybookTemplate[] = [
  {
    slug: "estimate-follow-up-kit", title: "Estimate follow-up message kit", topic: "Close more estimates",
    description: "Three useful messages, a next-action record, and clear stopping points for your office team.",
    introduction: "Replace every bracketed field with verified details. Follow the customer's agreed timing and contact preferences. These are message drafts for your team to review, not an automated sending sequence.",
    sections: [
      { title: "1. Confirm delivery", text: "Subject: Your [service] estimate from [business]\n\nHi [first name],\n\nI sent estimate [number / revision] for [agreed work]. Were you able to open it? I can resend it or walk through any section that is unclear.\n\n[Name]\n[Business contact details]" },
      { title: "2. Help with the decision", text: "Hi [first name],\n\nWhen we spoke, you mentioned [customer's actual priority]. Is there anything about the scope, timing, or options that we can help clarify?\n\nWe agreed to check back on [date]. Let me know whether that still works for you.\n\n[Name]" },
      { title: "3. Close the active follow-up", text: "Hi [first name],\n\nWould you like us to move ahead with estimate [number / revision], revisit it on a date you choose, or close it for now? If your plans have changed, let us know and we will update our records.\n\n[Name]" },
      { title: "Office record and stop rules", text: "Customer / property: [ ]\nEstimate number / revision: [ ]\nFollow-up owner: [ ]\nAgreed channel and next contact date: [ ]\nCustomer question: [ ]\nNext action and owner: [ ]\nOutcome: [approved / declined / revisit / unresolved]\n\nStop the generic sequence when the customer replies, declines, opts out, or asks for no more contact. Route questions to a named team member. Confirm current scope and pricing before reviving an old estimate. Do not invent urgency or apply an unapproved discount." }
    ],
    product: { label: "Explore estimates and approvals", href: "/product/estimates-approvals" }
  },
  {
    slug: "daily-dispatch-checklist", title: "Daily dispatch checklist", topic: "Run better jobs",
    description: "A practical morning check, technician handoff, and end-of-day review for a clearer schedule.",
    introduction: "Use this as an office planning aid. Your dispatcher and qualified technicians still make the job-specific decisions about skills, safety, travel, and timing.",
    sections: [
      { title: "Before the day starts", text: "Date / dispatcher: [ ]\n\n[ ] Confirm technician availability, relevant qualifications, and working hours.\n[ ] Check the approved scope and estimate revision for each job.\n[ ] Confirm the customer, service address, access details, and contact preferences.\n[ ] Confirm required equipment, parts, and any unresolved prerequisites.\n[ ] Allow realistic job duration, travel, and breaks.\n[ ] Flag conflicts and jobs that need owner or customer decisions.\n[ ] Confirm appointment windows without promising an unverified arrival time." },
      { title: "Technician handoff", text: "Job / customer: [ ]\nAssigned technician: [ ]\nAppointment window: [ ]\nApproved scope / revision: [ ]\nEquipment and materials: [ ]\nAccess notes: [ ]\nPhotos and relevant history: [ ]\nOpen question / decision owner: [ ]\n\n[ ] Technician can access the current job record.\n[ ] Customer-facing changes have a named communication owner.\n[ ] Material scope changes require approval before additional work." },
      { title: "When plans change", text: "[ ] Record the reason for the change.\n[ ] Check effects on the remaining jobs and technician workload.\n[ ] Confirm the revised plan with the responsible dispatcher.\n[ ] Notify affected customers using their agreed contact channel.\n[ ] Keep the latest appointment details in the shared job record." },
      { title: "End-of-day review", text: "[ ] Reconcile completed, unfinished, and rescheduled work.\n[ ] Assign an owner and next action to every unfinished job.\n[ ] Confirm tomorrow's parts, prerequisites, and customer commitments.\n[ ] Review schedule exceptions without treating unverified job statuses as completed work.\n\nTomorrow's most important action: [ ]\nOwner / deadline: [ ]" }
    ],
    product: { label: "Explore scheduling and dispatch", href: "/product/scheduling-dispatch" }
  },
  {
    slug: "job-closeout-checklist", title: "Job closeout and next-visit checklist", topic: "Keep customers coming back",
    description: "Connect completion notes, customer questions, invoice status, and the next appropriate follow-up.",
    introduction: "Use this checklist after the qualified technician has completed the agreed work. It organizes the handoff; it does not replace technical completion checks or authorize extra work.",
    sections: [
      { title: "Confirm the work record", text: "Job / customer: [ ]\nTechnician / completion date: [ ]\n\n[ ] Match completed work to the approved scope and any approved changes.\n[ ] Record findings, work performed, and relevant equipment details.\n[ ] Attach relevant job photos and completion documentation.\n[ ] Record unresolved items with an owner and next-action date.\n[ ] Complete the customer walkthrough and record questions." },
      { title: "Check the invoice and payment record", text: "[ ] Check invoice line items against the agreed work.\n[ ] Confirm any approved additions are clearly recorded.\n[ ] Record the actual invoice and payment status; do not mark an unpaid invoice paid.\n[ ] Provide the appropriate invoice or receipt.\n[ ] Assign any payment question or discrepancy to a named office owner.\n\nInvoice reference / status: [ ]\nPayment reference / status: [ ]\nOpen question / owner: [ ]" },
      { title: "Agree on the next step", text: "[ ] Record relevant care instructions and the customer's questions.\n[ ] Discuss a future service visit only when relevant to the work.\n[ ] Record any agreed follow-up date and contact preference.\n[ ] Respect requests not to receive follow-up.\n[ ] Ask for honest feedback without conditioning the request on a positive experience.\n\nNext visit or follow-up: [ ]\nAgreed channel / date: [ ]\nResponsible person: [ ]" },
      { title: "Customer follow-up draft", text: "Hi [first name],\n\nThank you for choosing [business] for [completed work]. Your [invoice / receipt] is [where to find it].\n\nAs discussed, [verified care note or agreed next step]. Please contact [person / channel] with any questions about the work.\n\n[Name]" }
    ],
    product: { label: "Explore customer retention", href: "/product/retention" }
  }
];

export const templatePath = (slug: string): string => `/resources/templates/${slug}`;
export const PLAYBOOK_PATHS = ["/resources", ...PLAYBOOK_TEMPLATES.map(t => templatePath(t.slug))];
export function findTemplate(slug: string): PlaybookTemplate | undefined {
  return PLAYBOOK_TEMPLATES.find(template => template.slug === slug);
}
export function templateText(template: PlaybookTemplate): string {
  return [PLAYBOOK_COPY.name, template.title, "", template.introduction, ...template.sections.flatMap(section => ["", section.title, "", section.text]), "", `Source: https://getrenvani.com${templatePath(template.slug)}`, ""].join("\n");
}
export function templateCards(): ResourceCard[] {
  return PLAYBOOK_TEMPLATES.map(t => ({ title: t.title, description: t.description, href: templatePath(t.slug), topic: t.topic, kind: "template" }));
}
/** Input is ONLY the server's published CMS list, never a draft export or Studio query. */
export function articleCards(posts: readonly { title: string; slug: string; excerpt?: string | null; metaDescription?: string | null }[]): ResourceCard[] {
  const seen = new Set<string>();
  return posts.flatMap(post => {
    if (typeof post.title !== "string" || !post.title.trim() || typeof post.slug !== "string" || post.slug.length > 96 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug) || seen.has(post.slug)) return [];
    seen.add(post.slug);
    return [{ title: post.title, description: post.excerpt || post.metaDescription || "Practical guidance for home-service business owners.", href: `/blog/${post.slug}`, kind: "article" as const, topic: "Articles & guides" }];
  });
}
export function filterResources(resources: readonly ResourceCard[], query: string, kind: ResourceKind | "all" = "all"): ResourceCard[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return resources.filter(resource => (kind === "all" || resource.kind === kind) && terms.every(term => `${resource.title} ${resource.description} ${resource.topic}`.toLocaleLowerCase().includes(term)));
}
