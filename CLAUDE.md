# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint

npx prisma migrate dev   # Run DB migrations (dev)
npx prisma db push       # Push schema changes without migration
npx prisma studio        # Open DB GUI
npx prisma generate      # Regenerate Prisma client after schema changes
```

## Architecture

### Two Distinct Apps in One Repo

This project contains two separate UI systems that share the same Next.js instance:

1. **Main Dashboard** (`src/app/page.js`) — A single large client component (~3800 lines) at `/`. It owns a 10-tab layout (Overview, Ads Analysis, Create Ad, Approval, Campaign Setup, Running Campaign, Reports, Social-Dash, Newsletter, Outreach). All tab state lives in flat React `useState` hooks inside this one file. Newsletter and Outreach tabs render inline child components (no iframes).

2. **Dashboard App** (`src/app/dashboard/`) — A separate Next.js App Router section for workflow management (campaigns, scraper, cleanup, analytics). Uses server components + Prisma for data fetching. Has its own dark sidebar (`components/dashboard/sidebar.tsx`).

3. **Newsletter App** (`src/app/newsletter/`) — Another separate section with its own layout, four context providers, and sub-pages (generate, campaign, history, services).

### Styling System

The project uses **two parallel styling approaches** that must not be mixed:

- **Main dashboard** (`page.js`, `CampaignSetup.js`, `SocialDash.js`): Uses **inline styles only** with CSS custom properties defined in `globals.css` (e.g. `var(--primary)`, `var(--card-bg)`, `var(--radius-lg)`). Shared UI primitives live in `src/app/components.js` (`Card`, `Badge`, `MetricCard`, `SectionTitle`, `Spinner`, etc.).
- **Dashboard/Newsletter apps**: Uses **Tailwind CSS classes** with Radix UI components from `src/components/ui/`.

Never use Tailwind classes in `page.js` inline-style sections and vice versa.

### Data Flow

```
Frontend (page.js)
  → /api/trigger-n8n  (CORS proxy)
  → n8n cloud webhooks (srv881198.hstgr.cloud)
  → n8n POSTs results back via Supabase realtime

Frontend (dashboard/ outreach)
  → /api/campaigns, /api/scraper, /api/cleanup, /api/cold-email/*  (native Next.js API routes)
  → src/lib/cold-email/*  (business logic)
  → Prisma → PostgreSQL (Supabase)
  → Apify, Million Verifier, OpenAI, Instantly.ai (per-company API keys)
```

The main `page.js` reads live data from Supabase:
- Main: `NEXT_PUBLIC_SUPABASE_URL` — used for reports, ad data (`src/lib/supabase.js`)

### Social Channels (Creator Studio) — native pipeline

Social Channels no longer uses n8n webhooks. Creator Studio runs natively via `/api/social-studio/*`:

```
Frontend (SocialDash.tsx / SocialOverview.tsx)
  → /api/social-studio/config        (per-company brand + posting settings)
  → /api/social-studio/image/*       (image prompt → kie.ai → social copy → post)
  → /api/social-studio/video/*       (story → scenes → kie.ai images/clips → FFmpeg stitch → post)
  → /api/social-studio/job           (per-company job status + previews)
  → Prisma SocialStudioConfig / SocialStudioJob
  → OpenAI, kie.ai, ElevenLabs, AssemblyAI, Upload Post (per-company API keys)
```

- **Overview** (`SocialOverview.tsx`): company enters brand About/mission/services/audience, tone, Upload Post user, platform IDs, enabled platforms. This data is injected into centralized prompts in `src/lib/social-studio/prompts.ts`.
- **Creator Studio** (`SocialDash.tsx`): image and video generation UI; polls job status instead of shared Supabase `n8n`/`Images`/`videos` row id=1.
- **Prompts**: server-side only in `src/lib/social-studio/prompts.ts` — companies never edit prompt templates.
- **Legacy** `/api/social/workflow` returns HTTP 410 (n8n workflow editor retired).

### Newsletter — native pipeline

Newsletter no longer uses n8n webhooks. It runs natively via `/api/newsletter/*`:

```
Frontend (newsletter/* components)
  → /api/newsletter/config        (per-company identity + schedule)
  → /api/newsletter/generate      (OpenAI content → structured sections)
  → /api/newsletter/regenerate    (revision with retry prompt)
  → /api/newsletter/template      (OpenAI HTML → store NewsletterTemplate)
  → /api/newsletter/campaigns     (create/list campaigns)
  → /api/newsletter/campaigns/run (manual batch send)
  → /api/newsletter/cron/send     (daily scheduled batch send)
  → /api/newsletter/subscribers   (per-company subscriber CRUD)
  → Prisma NewsletterConfig / NewsletterTemplate / NewsletterSubscriber / NewsletterCampaign / NewsletterSend
  → OpenAI + Resend (per-company API keys from API key management)
```

- **Settings** (`NewsletterOverview.tsx`): company from-email, logo, website, unsubscribe URL, send schedule.
- **Prompts**: server-side only in `src/lib/newsletter/prompts.ts` — brand context from `CompanyBrandConfig` + `NewsletterConfig`.
- **Subscribers**: per-company `NewsletterSubscriber` model (not shared Supabase tables).

### Cold Email (Outreach) — native pipeline

Cold Email no longer uses n8n webhooks. It runs natively via `/api/campaigns`, `/api/scraper`, `/api/cleanup`, and `/api/cold-email/*`:

```
Frontend (dashboard/* / outreach/*)
  → /api/cold-email/config        (Instantly campaign ID, send limits, cleanup settings)
  → /api/cold-email/lists         (per-company lead list CRUD)
  → /api/scraper                  (Apify leads-finder → Million Verifier → save leads)
  → /api/campaigns                (OpenAI email generation → pending approval)
  → /api/campaigns/approve        (push verified leads to Instantly.ai)
  → /api/cleanup/trigger          (bulk delete from Instantly + reset lead status)
  → /api/cold-email/cron/cleanup  (scheduled cleanup via CRON_SECRET)
  → Prisma OutreachConfig / OutreachLeadList / OutreachLead / Campaign / ScraperJob / CleanupLog
  → OpenAI, Apify, Million Verifier, Instantly.ai (per-company API keys from API key management)
```

- **Settings** (`ColdEmailSettings.tsx`): Instantly campaign ID, sender name, CTA link, cleanup interval, daily send limit, lead list management.
- **Prompts**: server-side only in `src/lib/cold-email/prompts.ts` — brand context from `CompanyBrandConfig.icpOutreach` + `OutreachConfig`.
- **Leads**: per-company `OutreachLead` in named `OutreachLeadList` records (replaces legacy Supabase table1–table6).

### Auth

NextAuth JWT strategy at `/api/auth/[...nextauth]`. Credentials (email + bcrypt password) stored in Prisma `User` table. The dashboard layout has the login wall **commented out** — all routes are currently unprotected. Fallback userId `"cmo8ubhgi0000difwp4jsua3t"` is hardcoded in several API routes for dev.

### n8n Integration

Two separate n8n instances are used for **blog automation only** (and legacy Meta ads via Supabase realtime):
- `n8n.srv881198.hstgr.cloud` — legacy Meta ads data (frontend CORS proxy)

Social Channels, Create Ad, Newsletter, and Cold Email are **native** (see above).

The `/api/trigger-n8n/route.js` acts as a CORS proxy; it intentionally wraps non-ok responses as 200 so the frontend can read the error body.

n8n response data from competitor analysis uses these exact field names (do not rename):
`executive_summary`, `competitor_analysis`, `gap_opportunities`, `ready_ad_scripts`, `action_plan`, `hook_analysis`, `market_insights`, `budget_recommendation`. Always access with optional chaining and `|| []` fallbacks.

### Key Path Alias

`@/*` resolves to `src/*` (configured in `tsconfig.json`). Use this in all TS/TSX files. Plain `.js` files in `src/app/` use relative imports.

### Context Providers (Newsletter)

The four newsletter contexts (`ServicesContext`, `CampaignContext`, `NewsletterContext`, `NewsletterHistoryContext`) must all be present in the tree for newsletter components to work. They are stacked in `NewsletterTab.js` and `src/app/newsletter/layout.tsx`. Services persist to localStorage via `src/lib/services-store.ts`; campaign and newsletter history also use localStorage.

### Database

PostgreSQL via Supabase. Two connection strings required: `DATABASE_URL` (pooled, for runtime) and `DIRECT_URL` (direct, for migrations). Schema: `WorkflowExecution` is the parent record; `Campaign`, `ScraperJob`, and `CleanupLog` each have a one-to-one relation to it via `executionId`.
