# Fahm.io — Budget Management SaaS for Student Associations

Multi-tenant budget and treasury platform for French student associations: AI-powered receipt scanning, per-event budget tracking, Stripe payments, and auditable PDF closures.

<!-- TODO: add dashboard screenshot -->

## Why this exists

French student associations (BDE, BDS, junior-entreprises, clubs) juggle dozens of events per year with shared treasuries, rotating boards, and zero accounting tooling. Excel files get lost between mandates, receipts pile up unsorted, and end-of-year closures take weeks of manual work. Fahm.io centralizes the event-level budget, automates expense entry through receipt OCR, enforces role-based access (`membre` / `trésorier` / `président`) at the database level, and produces a signed PDF closure that can be handed straight to the next board.

## Key features

- **Receipt OCR** — Upload a photo, [GPT-4o Vision](https://platform.openai.com/docs/guides/vision) extracts amount, date, vendor, and category in one call
- **Multi-tenant by design** — Every table's reads and writes are gated by an org-membership check in Postgres Row-Level Security, not just in application code, so tenant isolation does not depend on the client or API layer being correct
- **Per-event budget tree** — Hierarchical categories with drag-and-drop reordering ([dnd-kit](https://dndkit.com/)), live cashflow and runway computation
- **Stripe payments** — One-time Checkout (`mode: payment`) for event income, with signed webhook handling and idempotent event processing (unique `event.id` + duplicate-key fallback); incoming payments land as `pending` for manual treasurer validation
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
│   └── sync-vectors.ts            # Category embeddings (built, not yet wired — see Status)
├── components/                    # shadcn/ui + dashboard widgets
├── types/budget.ts                # Shared domain types
└── proxy.ts                       # Next.js 16 middleware (named export `proxy`)

supabase/
└── migrations/                    # SQL migrations (RLS policies, indexes, schema)
```

## Engineering highlights

- **Fail-fast typed env** — `src/lib/env.ts` parses `process.env` with Zod at module load. Missing or malformed secrets crash the server at boot with a precise error, never silently at request time
- **RLS as the source of truth** — Server actions check roles, but the real isolation lives in Postgres policies (`supabase/migrations/20260226_security_rls_fix.sql`). The audit log table previously had `GRANT ALL TO anon` with RLS disabled; the fix enables RLS and gates every policy on `has_org_role(org_id, ...)`
- **Money stored as integer cents** — `amount`/`price` columns are `integer` cents; the UI multiplies/divides by 100 at the edge. Eliminates a class of float-rounding bugs at the cost of one convention to remember (and a ~€21M-per-row ceiling from the 32-bit `integer` type)
- **Stripe webhook signature verification** — `app/api/webhooks/stripe/route.ts` validates `Stripe-Signature` against `STRIPE_WEBHOOK_SECRET` before any DB write, with idempotent handling keyed on `event.id`
- **OCR pipeline with hard guardrails** — `scan-receipt.ts` enforces MIME allowlist, 5 MB size cap, per-user rate limit, and a 60-second signed URL passed to GPT-4o (the file is never made public)
- **Strict TypeScript** — `"strict": true` and zero `@ts-ignore`; `pnpm exec tsc --noEmit` passes (run it manually before pushing — there is no automated hook). A handful of `any` usages remain in older components

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

## What's built vs. roadmap

Honest scope, so nothing here overstates the code.

**Working end-to-end:**
- Multi-tenant auth, org onboarding, and RBAC (owner / admin / trésorier / membre) enforced at the database via Row-Level Security
- Per-event hierarchical budget tree with drag-and-drop reordering; balance, burn-rate, and runway computed from the transaction ledger
- Receipt OCR (GPT-4o Vision, JSON mode) pre-filling the transaction form, rate-limited to 10 scans/hour/user
- Transaction auto-categorization cascade: **exact category-name match → substring rules → GPT-4o** (`temperature: 0`), with prompt-injection sanitization on both the description and DB-sourced category names; LLM suggestions are marked `ai_suggested` and require human validation
- CSV bank-statement import with accent-insensitive column mapping and per-row validation
- Monthly bank reconciliation and server-rendered PDF closure reports (`@react-pdf/renderer`)
- One-time Stripe Checkout with signed, idempotent webhook ingestion
- Public read-only event pages

**Built but NOT wired in (do not treat as active):**
- **pgvector semantic categorization.** The `budget_categories.embedding vector(1536)` column, the ivfflat cosine index, the `match_categories` RPC, and the admin "sync embeddings" button all exist and the embedding sync runs — but `findCategoryVectorial()` is **not called** by the classification pipeline, which goes straight from rules to the LLM. The `ai_vector` classification method and the `confidence_score` column are therefore never populated. Wiring this in (and calibrating the 0.5 similarity threshold against a labeled set) is the main open item.

**Not implemented / roadmap:**
- Recurring subscriptions (current Stripe integration is one-time `mode: payment` only)
- Role editing / member removal UI (approval and invite exist; changing an existing member's role does not)
- Automated tests and CI (there are none today)

## Status

Personal/association project; **not currently deployed to public users** — a working pre-launch prototype used as the reference implementation. The codebase applies production-grade patterns (RLS, signed idempotent webhooks, rate limiting, fail-fast typed env), with the caveats listed above. Source is public for transparency and portfolio purposes; **not open source**: no license is granted, no contributions accepted.
