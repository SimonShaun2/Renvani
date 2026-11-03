# Renvani — Official Operational Stack

Website getrenvani.com; MVP-first, cost-disciplined; Discover→Book→Serve→Repeat.

1 Infrastructure: Vercel, Render, Neon PostgreSQL, Render Key Value (Redis-compatible) — frontend, APIs, DB, workers, queues, env separation.

2 Security & Auth: Clerk, PostgreSQL RLS, automated security testing — auth, org mgmt, RBAC, tenant isolation, cross-tenant protection.

3 Operational Foundation: Cloudflare R2, Sentry, PostHog, queue monitoring, internal admin.

4 Revenue & Comms: Stripe Billing, Stripe Connect, Resend, Twilio — subscriptions, customer payments, merchant payouts, email, SMS, booking confirmations, recurring service. MVP policy: test/sandbox until production approval.

5 Intelligent Execution: AI model APIs, Langfuse, BullMQ, internal agent control system — orchestration, evals, approvals, audit trails, perf monitoring, outcome measurement.

6 Engineering: GitHub, Cursor Ultra, Figma. Core tech: TypeScript, Next.js, Node.js, Fastify, Drizzle ORM, PostgreSQL, Redis/BullMQ.

7 Company Ops: Notion, ChatGPT Pro, Google Workspace.

8 Sales/Marketing/Support: HubSpot CRM, Google Workspace, support inbox, PostHog.

MVP Operating Policy: no new paid service/subscription/infra upgrade without demonstrated MVP dependency, documented business justification, founder-approved budget. Rules: 1 existing tools & free tiers first; 2 no redundant subs/infra; 3 separate dev/staging/prod; 4 authn/authz/tenant isolation from day one; 5 founder approval for new spend, production releases, live payments; 6 monitor AI usage, infra costs, subscriptions; 7 scale opex only when justified. North Star: Build the full foundation. Prove the product. Scale deliberately. Status: approved direction; each integration/paid activation subject to verification and founder authorization.
