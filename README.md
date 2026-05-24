# Fahm.io — Budget Management SaaS for Student Associations

Multi-tenant budget and treasury platform for French student associations: AI-powered receipt scanning, per-event budget tracking, Stripe payments, and auditable PDF closures.

<!-- TODO: add dashboard screenshot -->

## Why this exists

French student associations (BDE, BDS, junior-entreprises, clubs) juggle dozens of events per year with shared treasuries, rotating boards, and zero accounting tooling. Excel files get lost between mandates, receipts pile up unsorted, and end-of-year closures take weeks of manual work. Fahm.io centralizes the event-level budget, automates expense entry through receipt OCR, enforces role-based access (`membre` / `trésorier` / `président`) at the database level, and produces a signed PDF closure that can be handed straight to the next board.

## Key features

- **Receipt OCR** — Upload a photo, [GPT-4o Vision](https://platform.openai.com/docs/guides/vision) extracts amount, date, vendor, and category in one call
- **Multi-tenant by design** — Every table enforces org isolation via Postgres Row-Level Security; a treasurer from org A cannot read a single row from org B, even if the API leaks
- **Per-event budget tree** — Hierarchical categories with drag-and-drop reordering ([dnd-kit](https://dndkit.com/)), live cashflow and runway computation
- **Stripe billing** — Subscription tiers with signed webhook handling and idempotent event processing
- **PDF closures** — Server-side rendered audit reports via [@react-pdf/renderer](https://react-pdf.org/), downloadable by the board
- **Public event pages** — `/e/[org_slug]/events` routes bypass auth so associations can share read-only event listings with their members
- **Rate-limited AI calls** — 10 OCR scans / hour / user via [Upstash Redis](https://upstash.com/) to bound OpenAI spend

## Tech stack

| Layer        | Choice                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| Frontend     | [Next.js 16](https://nextjs.org/) (App Router, Turbopack), React 19, [Tailwind CSS 4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) |
| Backend      | Next.js Server Actions + Route Handlers                                                                 |
| Database     | [Supabase Postgres](https://supabase.com/) with Row-Level Security, SQL migrations                      |
| Auth         | Supabase Auth (Google OAuth + email)                                                                    |
| Payments     | [Stripe](https://stripe.com/) Checkout + webhooks                                                       |
| AI           | [OpenAI](https://platform.openai.com/) GPT-4o Vision (receipt OCR) + embeddings (category sync)         |
| Rate limit   | [Upstash Redis](https://upstash.com/) via `@upstash/ratelimit`                                          |
| Validation   | [Zod 4](https://zod.dev/) (env + form schemas)                                                          |
| Hosting      | [Vercel](https://vercel.com/) + Supabase managed Postgres                                               |
| Package mgr  | pnpm                                                                                                    |

## Architecture

```
src/
├── app/
│   ├── (auth)/login/              # Public auth pages
│   ├── (marketing)/               # Public landing
│   ├── (dashboard)/[org_slug]/    # Tenant-scoped dashboard
│   │   ├── budget/                # Budget tree + analytics
│   │   ├── closures/              # PDF report generation
│   │   ├── members/               # Role management
│   │   ├── audit/                 # Transaction audit log
│   │   └── settings/              # Org config + AI category sync
│   ├── e/[org_slug]/events/       # Public event listing (bypasses auth)
│   ├── api/webhooks/stripe/       # Signed Stripe webhook handler
│   └── actions/                   # Top-level server actions (OCR, receipt URLs)
├── lib/
│   ├── env.ts                     # Zod-validated env vars (fails fast at boot)
│   ├── supabase-{server,browser,middleware}.ts
│   ├── stripe.ts                  # Stripe client + helpers
│   ├── ai.ts                      # OpenAI client + prompt templates
│   ├── ratelimit.ts               # Upstash rate-limit buckets
│   └── sync-vectors.ts            # Category embeddings for auto-classification
├── components/                    # shadcn/ui + dashboard widgets
├── types/budget.ts                # Shared domain types
└── proxy.ts                       # Next.js 16 middleware (named export `proxy`)

supabase/
└── migrations/                    # SQL migrations (RLS policies, indexes, schema)
```

## Engineering highlights

- **Fail-fast typed env** — `src/lib/env.ts` parses `process.env` with Zod at module load. Missing or malformed secrets crash the server at boot with a precise error, never silently at request time
- **RLS as the source of truth** — Server actions check roles, but the real isolation lives in Postgres policies (`supabase/migrations/20260226_security_rls_fix.sql`). The audit log table previously had `GRANT ALL TO anon` with RLS disabled; the fix enables RLS and gates every policy on `has_org_role(org_id, ...)`
- **Money stored as integer cents** — All `amount` columns are bigints in cents; UI multiplies/divides at the edge. Eliminates an entire class of float-rounding bugs at the cost of one convention to remember
- **Stripe webhook signature verification** — `app/api/webhooks/stripe/route.ts` validates `Stripe-Signature` against `STRIPE_WEBHOOK_SECRET` before any DB write, with idempotent handling keyed on `event.id`
- **OCR pipeline with hard guardrails** — `scan-receipt.ts` enforces MIME allowlist, 5 MB size cap, per-user rate limit, and a 60-second signed URL passed to GPT-4o (the file is never made public)
- **Strict TypeScript** — Zero `@ts-ignore` in the codebase; `pnpm exec tsc --noEmit` is a pre-push hook

## Getting started

```bash
git clone https://github.com/AdamFehmoun/projet-asso-fintech.git
cd projet-asso-fintech
pnpm install

# Fill in your own Supabase / Stripe / OpenAI / Upstash keys
cp .env.example .env.local

pnpm dev
```

App runs on [http://localhost:3000](http://localhost:3000). For the Supabase backend, see [`supabase/config.toml`](supabase/config.toml) and run migrations with `supabase db push`.

## Status

Personal/association project, actively developed. Codebase is production-grade (RLS, signed webhooks, rate limiting, typed env) but not currently deployed to public users — used as the reference implementation while the association onboards. Source is public for transparency and portfolio purposes; **not open source**: no license is granted, no contributions accepted.
