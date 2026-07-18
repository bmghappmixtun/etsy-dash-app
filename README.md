# Etsy Order Tracking Dashboard

A single-user, production-ready dashboard that syncs your Etsy orders and tracks shipments via AfterShip.

> **Status**: Production-ready scaffold. Build passes, all routes generated, type-safe, ready to deploy.

## Stack

- **Next.js 16** (App Router, Turbopack, RSC)
- **TypeScript** (strict mode)
- **TailwindCSS v4** + **shadcn/ui** (Linear-inspired theme)
- **PostgreSQL** (Neon recommended) + **Prisma 6**
- **Recharts** (charts) + **TanStack Table v8** (tables)
- **Zod** (env + input validation)
- **next-themes** (dark/light mode)
- **sonner** (toasts)
- **AES-256-GCM** (token encryption)
- **Vercel Cron** (background jobs)

## Features

- ✅ Etsy OAuth2 flow (authorization code, confidential client)
- ✅ Encrypted token storage (AES-256-GCM with unique IV per token)
- ✅ Auto-refresh of OAuth tokens (every 50 min)
- ✅ Receipts sync with pagination (every 30 min)
- ✅ Idempotent upserts (no duplicates)
- ✅ AfterShip integration for shipment tracking
- ✅ Status mapping (AfterShip tags → app statuses)
- ✅ Pre-computed daily metrics (for fast charts)
- ✅ Dashboard with KPIs, charts, recent orders
- ✅ Orders list with filters (date, country, status, carrier) + search + pagination
- ✅ Order detail page with tracking timeline
- ✅ Analytics page with deeper insights
- ✅ Settings page with manual sync + connection status
- ✅ API Status page with health checks
- ✅ Dark mode + responsive
- ✅ Cron jobs (4: sync orders, refresh tracking, refresh tokens, daily metrics)

## Quick Start

### 1. Install dependencies

```bash
cd etsy-dashboard
npm install
```

### 2. Set up the database (Neon)

1. Sign up at [neon.tech](https://neon.tech) (free tier)
2. Create a new project
3. Copy the connection string (with `?sslmode=require`)
4. Push the schema:
   ```bash
   npm run db:push
   ```

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:

```bash
DATABASE_URL="postgresql://..."          # from Neon
ETSY_API_KEY="..."                      # from developers.etsy.com
ETSY_SHARED_SECRET="..."                # from developers.etsy.com
ETSY_REDIRECT_URI="http://localhost:3000/api/auth/etsy/callback"
AFTERSHIP_API_KEY="..."                 # from aftership.com
ENCRYPTION_KEY="..."                    # generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
SESSION_SECRET="..."                    # generate: openssl rand -base64 32
CRON_SECRET="..."                       # generate: openssl rand -base64 32
SEED_DATA="true"                        # optional, auto-seeds on first run
```

### 4. Generate Prisma client + run

```bash
npm run db:generate
npm run db:seed          # optional: creates 200 fake orders for testing
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

If `SEED_DATA=true` and you ran `db:seed`, you'll see a "Sign in as seed user (dev only)" button on the login page.

## Getting API Keys

### Etsy (free, 5 minutes)

1. Go to [developers.etsy.com](https://developers.etsy.com)
2. Sign in with your Etsy account
3. Click "Create a New App"
4. Fill in:
   - **App name**: anything (e.g. "My Dashboard")
   - **App description**: anything
   - **What type of app**: choose "Internal app" (or "Public" if you want)
   - **OAuth redirect URI**: `http://localhost:3000/api/auth/etsy/callback` (and your prod URL)
   - **Scopes**: `transactions_r` (read transactions/receipts) — also add `listings_r`, `profile_r`
5. Submit → you'll see your **API Key (keystring)** and **Shared Secret**

### AfterShip (free, 100 trackings/month)

1. Sign up at [aftership.com](https://www.aftership.com)
2. Go to Settings → API
3. Generate an API key
4. Free plan = 100 trackings/month, 10 req/s

## Architecture

```
app/
├── (auth)/login/              # Public login page
├── (dashboard)/               # Protected (session required)
│   ├── dashboard/             # KPIs, charts, recent orders
│   ├── orders/                # List + detail
│   ├── analytics/             # Deep dive
│   ├── settings/              # Connection + sync controls
│   └── api-status/            # Health checks
└── api/
    ├── auth/                  # OAuth flow
    ├── orders/                # CRUD + sync
    ├── analytics/             # Aggregations
    ├── tracking/refresh/      # Manual refresh
    ├── health/                # Health endpoint
    └── jobs/                  # Cron endpoints (4)

lib/
├── etsy/                      # Etsy API client + types
├── aftership/                 # AfterShip client + status mapper
├── repositories/              # Data access (Prisma)
├── services/                  # Business logic
├── jobs/                      # Background job runners
├── env.ts                     # Zod env validation
├── crypto.ts                  # AES-256-GCM + HMAC
├── session.ts                 # Signed cookies
├── rate-limit.ts              # Token bucket
└── retry.ts                   # Exponential backoff

components/
├── ui/                        # shadcn primitives (15+)
├── dashboard/                 # KPI cards, charts, table, badges
├── filters/                   # Date / country / status / carrier
└── layout/                    # Sidebar + topbar

prisma/
├── schema.prisma              # 6 tables + 3 enums
└── seed.ts                    # 200 fake orders, 90 days metrics
```

## Deployment to Vercel

1. Push to GitHub
2. Import in [vercel.com/new](https://vercel.com/new)
3. Add environment variables (copy from `.env.local`)
4. Update `ETSY_REDIRECT_URI` to your prod URL
5. Update Etsy app's allowed redirect URIs
6. Deploy

Vercel Cron will pick up `vercel.json` automatically.

**Note**: Vercel Cron on the free Hobby plan is limited. For reliable 30-min intervals, upgrade to Pro ($20/mo).

## Security

- OAuth tokens encrypted with **AES-256-GCM** before storage
- IV unique per encryption
- Auth tag verified on decryption
- Session cookies: httpOnly, secure, sameSite=lax
- CSRF protection on OAuth (state parameter)
- Cron endpoints protected with bearer token
- All secrets in env vars, never exposed to client
- Security headers (CSP, X-Frame-Options, etc.)
- SQL injection: Prisma param binding (no raw SQL user input)

## Project Status

### ✅ Done (MVP)

- Full Next.js 16 + TS strict + Tailwind 4 + shadcn/ui setup
- 6 Prisma tables with proper indexes and relations
- OAuth Etsy flow (init, callback, refresh)
- Token encryption (AES-256-GCM)
- AfterShip client + status mapper
- Order sync with pagination + idempotency
- Tracking refresh job
- 4 cron jobs (orders, tracking, tokens, metrics)
- Dashboard with KPIs + 3 charts + recent orders + "needs attention"
- Orders list with filters + search + pagination
- Order detail with tracking timeline
- Analytics page
- Settings page
- API Status page
- Dark mode + responsive
- Seed script with 200 fake orders

### 🚫 Not in MVP (roadmap)

- Multi-shop / multi-user
- Subscription / billing
- Email notifications
- Webhooks (Etsy push, AfterShip push)
- ML / predictions
- Inventory sync
- Refunds / returns management
- Customer-facing pages
- i18n (en only for now)

## Scripts

```bash
npm run dev         # Dev server (Turbopack)
npm run build       # Production build
npm run start       # Production server
npm run lint        # ESLint
npm run typecheck   # TypeScript check
npm run db:generate # Generate Prisma client
npm run db:push     # Push schema to DB (dev)
npm run db:migrate  # Run migrations
npm run db:studio   # Open Prisma Studio
npm run db:seed     # Seed fake data
```

## License

MIT
