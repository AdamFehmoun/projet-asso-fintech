# CLAUDE.md — Contexte projet Fahm.io

## Stack
- Next.js 16 (App Router, Turbopack en dev)
- Supabase (Auth, DB, RLS, Storage)
- Stripe, OpenAI, Upstash Redis
- Tailwind CSS + shadcn/ui
- pnpm (jamais npm ou yarn)

## Règles absolues
- Zéro @ts-ignore — toujours typer explicitement
- Zod v4 : utiliser .issues[0].message (pas .errors)
- pnpm uniquement — jamais npm install (casse le lockfile Vercel)
- Pas de process.env! dans les composants — utiliser src/lib/env.ts ou supabase-browser.ts
- amount en DB = centimes entiers (×100 avant insert, ÷100 pour afficher)

## Architecture
- src/proxy.ts = middleware Next.js 16 (export nommé "proxy", pas "middleware")
- Routes publiques : /e/[org_slug]/* bypass auth via pathname.startsWith('/e/')
- Client Supabase browser : src/lib/supabase-browser.ts
- Client Supabase server : src/lib/supabase-server.ts
- Validation env vars : src/lib/env.ts (Zod, fail fast au boot)

## Pièges connus
- Next.js 16 : export doit s'appeler "proxy" dans src/proxy.ts
- Zod v4 : .issues pas .errors
- @react-pdf/renderer : renderToBuffer attend ReactElement<DocumentProps> — caster si besoin
- Buffer n'est pas BodyInit dans Next.js — utiliser new Uint8Array(buffer)
- createClient Supabase ne pas initialiser au niveau module (timestamp négatif Turbopack)
- papaparse : installer avec pnpm, pas npm
- Groupes de routes (dashboard) et segments racine [org_slug] ne peuvent pas coexister

## Structure routes
- (auth) : /login, /signup
- (dashboard)/[org_slug] : toutes les routes protégées
- e/[org_slug]/events : page publique sans auth
- /auth/callback : handler OAuth Google

## Commandes utiles
- pnpm run build : vérifier avant push (hook pre-push configuré)
- pnpm exec tsc --noEmit : vérification types rapide
