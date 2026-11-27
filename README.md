# AgriNexus — AI-Powered Post-Harvest Decision Intelligence Platform

<p align="center">
  <strong>Reducing Post-Harvest Losses Through Intelligent, Data-Driven Decisions</strong>
</p>

<p align="center">
  <a href="https://agrinexusdemo.netlify.app/">Live Website</a> •
  <a href="https://github.com/Vedantvijayvargiya-06/AGRINEXUS">GitHub Repository</a>
</p>

---

## Overview

**AgriNexus** is a full-stack post-harvest decision intelligence platform designed for Indian farmers, Farmer Producer Organizations (FPOs), procurement buyers, and system administrators.

The platform combines $Q_{10}$ biological spoilage modelling, four-pathway economic optimization, collaborative FPO freight cluster pooling, mandi market price tracking, bilingual (English / Hindi) grounded assistance, and system health diagnostics in a single SQLite-backed web application.

---

## Major Application Modules

1. **Farmer Dashboard & Harvest Batch Lifecycle (`FarmerDashboard.jsx`, `AddBatchModal.jsx`, `/api/batches`)**
   - Register, track, and complete harvest batches across eight supported crop profiles (`Tomato`, `Onion`, `Potato`, `Banana`, `Mango`, `Spinach`, `Cauliflower`, `Guava`).
   - Supports offline action queueing (`OfflineSyncContext`) for batch creation when connectivity is intermittent.
2. **Continuous $Q_{10}$ Digital Twin (`DigitalTwinModal.jsx`, `DecayEngine`)**
   - Models temperature-accelerated quality degradation, remaining safe shelf-life, and spoilage risk percentages based on crop constants and ambient storage temperature.
3. **Four-Pathway Decision Optimizer & What-If Simulator (`DecisionBreakdownModal.jsx`, `WhatIfSimulator.jsx`, `DecisionEngine`, `/api/decisions`)**
   - Compares net realization across four pathways: **Sell Now (Local Mandi)**, **Cold Storage Holding**, **Secondary Processing**, and **Redirect to Terminal Hub**.
   - Interactive What-If Simulator lets users adjust lot weight, quality, local/terminal prices, transport delay, ambient temperature, storage duration, price surge, and freight pooling in real time.
4. **FPO Freight Cluster Pooling (`ClusterPoolingView.jsx`, `ClusterOptimizer`, `/api/clusters`)**
   - Groups unclustered, low-risk active batches by crop into candidate dispatch clusters, selects appropriate transport vehicles, calculates per-kg pooled vs. solo freight savings, and supports FPO/Admin dispatch confirmation.
5. **Mandi Market Intelligence (`MarketIntelligenceView.jsx`, `MarketService`, `/api/market`)**
   - Displays mandi modal/min/max prices, arrivals, distance, and price trends with search and multi-criteria sorting.
   - Clearly tags seeded rates as **`Demo Feed`** and authorized overrides as **`FPO Override`**.
6. **Bilingual Grounded Assistant (`AgriNexusAssistModal.jsx`, `AgriNexusAssist`, `/api/assist`)**
   - Provides English and Hindi answers grounded in batch telemetry, market feeds, and post-harvest guidelines, with out-of-scope escalation guardrails and optional browser Web Speech API voice input/output.
7. **FPO Reports & Notifications (`ReportsAnalyticsView.jsx`, `NotificationDrawer.jsx`, `ReportingService`, `/api/reports`, `/api/notifications`)**
   - Aggregates batch volumes, realized/avoided spoilage impact, and weighted freight savings (`avg_solo_cost_per_kg` vs. `avg_pooled_cost_per_kg`) with CSV export (`GET /api/reports/export/csv`) for FPO Admins and System Admins.
   - Delivers in-app spoilage alerts, price update alerts, and cluster dispatch notifications.
8. **Admin Console & System Health Diagnostics (`AdminConsoleView.jsx`, `SystemDiagnosticsView.jsx`, `diagnosticsService.js`, `/api/admin`)**
   - **Admin Console**: Manage crop kinetic/economic constants, approve or suspend users, and inspect live SQLite & runtime health (`/api/admin/system-health`).
   - **System Health & Diagnostics (`role === 'admin'` only)**: Inspect runtime telemetry, SQLite `quick_check` integrity and latency, security posture, integration readiness, sanitized server/UI error logs, and non-destructive `:memory:` diagnostic suite runs (`/api/admin/diagnostics/*`).

---

## Demo Access Credentials

> **Important:** All accounts listed below are **DEMO ACCOUNTS** automatically seeded by `server/store.js` when initializing a new SQLite database. Do **not** use demo credentials or `DEMO_MODE=true` in live production deployments with sensitive data.

| Role | Name | Phone | Email | Extra Access |
|---|---|---|---|---|
| **Farmer** | Ramesh Kumar | `9876543210` | `ramesh.farmer@agrinexus.org` | Farmer Dashboard & Batches |
| **Farmer** | Suresh Patel | `9876543211` | `suresh.farmer@agrinexus.org` | Farmer Dashboard |
| **Farmer** | Anita Devi | `9876543212` | `anita.farmer@agrinexus.org` | Farmer Dashboard |
| **FPO Admin** | Rajesh Sharma | `9876543299` | `admin@kisankalyan.org` | FPO Reports |
| **Buyer** | AgroFresh Foods Procurement | `9876543300` | `procurement@agrofresh.in` | Buyer Profile |
| **System Admin** | System Administrator | `9876543399` | `superadmin@agrinexus.gov.in` | Admin Console |

### How Demo & Authentication Flows Work
- **Phone-Based OTP Login (Primary Demo Flow)**: The seeded demo accounts above are created without static default passwords (`password_hash: null` unless configured). Sign in using the **Kisan OTP** tab with a user's **10-digit phone number** (`POST /api/auth/request-otp` followed by `POST /api/auth/login-otp`).
- **No Fixed OTP or Hardcoded Password**: AgriNexus generates a cryptographically random 6-digit OTP (`crypto.randomInt`) hashed with SHA-256 on each request. Never rely on a static OTP or published default password.
- **Configuration-Dependent OTP Delivery & Verification**:
  - When `DEMO_MODE=true` in a non-production environment (`NODE_ENV !== 'production'`), the server logs the generated OTP to stdout and includes it in the response `demo_note` so developers can sign in locally without an SMS provider.
  - When `DEMO_MODE=false` (enforced in production), `demo_note` is always `null`; OTP delivery requires configuring an SMS gateway adapter (`SMS_PROVIDER_API_KEY` is currently not integrated in `server/security.js`), and unconfigured environments return an informational message directing users to email/password login or configuration.
  - All OTP requests enforce cooldown (`OTP_RESEND_COOLDOWN_SECONDS=60`), expiry (`OTP_EXPIRY_SECONDS=300`), max incorrect attempts (`OTP_MAX_ATTEMPTS=5`), account approval checks, and temporary account lockout after repeated failures.
- **Email & Password / First-Run System Admin Setup**:
  - **Public Sign Up (`POST /api/auth/signup`)** permits creating `farmer` or `buyer` accounts with email/phone and a user-chosen password (minimum 8 characters); `admin` and `fpo_admin` signup attempts are rejected (`403`).
  - **System Administrator (`superadmin@agrinexus.gov.in`)** uses `ADMIN_BOOTSTRAP_PASSWORD` if provided at initial database seed time, or can be claimed **once** on first run via the UI / `POST /api/auth/admin-setup` when `password_hash` is still unset.
  - Signed-in users can set or update a password via `POST /api/auth/set-password`, or reset via OTP (`POST /api/auth/setup-password-with-otp`).

---

## Market Data: Demo Feed vs. Live Mandi Feeds vs. FPO Override

AgriNexus strictly separates illustrative baseline data from operational market updates:

| Source Label | `source_type` in SQLite | Meaning |
|---|---|---|
| **`Demo Feed`** | `demo_seed` | Baseline mandi prices seeded from `INITIAL_MANDI_FEED` (`server/services/marketService.js`). Illustrative only — **not** live Agmarknet/eNAM API prices. |
| **`FPO Override`** | `admin_override` | Authoritative modal rates submitted by an authenticated **FPO Admin** or **System Admin** (`POST /api/market/override-price`). Persists in SQLite, updates `min`/`max` bounds, recalculates active batch recommendations for that crop, and broadcasts farmer notifications. |
| **External Live Feeds** | *Not configured* | Live Agmarknet (`DATA_GOV_API_KEY`), SMS gateway (`SMS_PROVIDER_API_KEY`), external LLM (`GEMINI_API_KEY`), and weather telemetry (`Open-Meteo`) are not wired to active external API calls in this codebase. Their status is reported transparently in **System Health & Diagnostics**. |

---

## Technology Stack

| Layer | Verified Technologies |
|---|---|
| **Frontend** | React `^18.3.1`, Vite `^6.0.3` (`@vitejs/plugin-react`), Tailwind CSS `^3.4.16`, `lucide-react` `^0.468.0`, `clsx`, `tailwind-merge` |
| **Voice Interface** | Browser Web Speech API (Speech Recognition & Speech Synthesis in `AgriNexusAssistModal.jsx`) |
| **Backend** | Node.js **22+** (ESM), Express `^4.21.2`, `dotenv` `^16.4.7` |
| **Database** | Built-in `node:sqlite` (`DatabaseSync`) with Write-Ahead Logging (`WAL`), `PRAGMA foreign_keys = ON`, `busy_timeout = 5000` |
| **Auth & Security** | `jsonwebtoken` `^9.0.2` (HS256), Node `crypto` (`PBKDF2-HMAC-SHA256`, 100,000 iterations + `timingSafeEqual`), in-memory rate limiting |
| **Testing** | Node built-in test runner (`node --test`), Playwright `^1.65.1` (headless Chromium E2E) |
| **Hosting** | Netlify (Frontend SPA + `/api/*` proxy via `netlify.toml`), Render (Node.js web service + Persistent Disk) |

---

## Architecture Overview

```text
+-------------------------------------------------------------------+
|                     Browser (React 18 + Vite SPA)                 |
|  - Memory-only JWT (AuthContext)                                  |
|  - Offline queue (OfflineSyncContext) & EN/HI i18n                |
|  - Lazy-loaded Views, Modals, & ErrorBoundary                     |
+---------------------------------+---------------------------------+
                                  | HTTPS (/api/* proxy on Netlify)
                                  v
+-------------------------------------------------------------------+
|                   Express 4 API Server (server.js)                |
|  - CORS origin allowlist, security headers, IP rate limiter       |
|  - Sanitized API error logger & RBAC middleware (requireRole)     |
+--------+-----------------------------------------+----------------+
         |                                         |
         v                                         v
+--------------------------+        +-------------------------------+
|  Route Handlers          |        |  Domain & Diagnostic Engines  |
|  server/routes/*         | -----> |  - DecayEngine (Q10)          |
|  auth, batches, market,  |        |  - DecisionEngine (4-pathway) |
|  decisions, clusters,    |        |  - ClusterOptimizer           |
|  assist, reports,        |        |  - ReportingService           |
|  notifications, admin    |        |  - AgriNexusAssist (EN/HI)    |
+--------------------------+        |  - diagnosticsService         |
         |                          +-------------------------------+
         v
+-------------------------------------------------------------------+
|             SQLite Persistence Layer (server/store.js)            |
|  node:sqlite (WAL mode, FK ON) — users, batches, recommendations, |
|  outcomes, clusters, market_prices, crop_constants, otp_codes,    |
|  notifications, error_logs, diagnostic_runs                       |
+-------------------------------------------------------------------+
```

---

## Project Structure

```text
AGRINEXUS/
├── server.js                      # Express app factory, middleware, error handler, Vite/static SPA serving
├── server/
│   ├── config.js                  # Env config, production JWT secret & DEMO_MODE guards
│   ├── security.js                # PBKDF2 hashing, JWT sign/verify, SQLite OTPs, rate limits, RBAC
│   ├── store.js                   # SQLite schema, WAL setup, idempotent demo seeding, data access
│   ├── routes/
│   │   ├── admin.js               # Crop constants, user approval, system health, admin diagnostics
│   │   ├── assist.js              # Grounded EN/HI query handler
│   │   ├── auth.js                # Admin setup, OTP request/verify, password login, signup, user list
│   │   ├── batches.js             # Farmer batch CRUD, digital twin snapshot, outcome recording
│   │   ├── clusters.js            # Freight cluster listing, candidate optimization, confirmation
│   │   ├── decisions.js           # Batch decision breakdown & live What-If simulation
│   │   ├── market.js              # Mandi feed retrieval & FPO/Admin price override + recalculation
│   │   ├── notifications.js       # User notifications & read state updates
│   │   └── reports.js             # FPO summary metrics & CSV report export
│   ├── services/
│   │   ├── agrinexusAssist.js     # Bilingual grounded advisory & out-of-scope escalation rules
│   │   ├── clusterOptimizer.js    # Vehicle sizing & pooled freight savings math
│   │   ├── decayEngine.js         # Q10 temperature-adjusted shelf-life & quality decay model
│   │   ├── decisionEngine.js      # 4-pathway net realization optimizer
│   │   ├── diagnosticsService.js  # Secret redaction, readiness audit, isolated :memory: checks
│   │   ├── marketService.js       # Baseline Demo Feed & best alternate market lookup
│   │   └── reportingService.js    # FPO summary aggregation & RFC-escaped CSV formatter
│   └── tests/
│       └── agrinexus.test.js      # Unit, security, RBAC, persistence & diagnostics test suite
├── frontend/
│   ├── index.html                 # Entry HTML & OpenGraph metadata
│   ├── vite.config.js             # Vite build & React plugin configuration
│   ├── tailwind.config.js         # Tailwind CSS configuration
│   ├── postcss.config.js          # PostCSS pipeline
│   ├── e2e_test.cjs               # Headless Playwright browser & responsive overflow E2E suite
│   └── src/
│       ├── App.jsx                # Root router, lazy module loading, ErrorBoundary wrapper
│       ├── main.jsx               # React DOM mount
│       ├── index.css              # Tailwind CSS entry & utility styles
│       ├── components/            # Dashboards, modals, simulator, pooling, market, reports, admin, diagnostics
│       ├── context/               # AuthContext.jsx, LanguageContext.jsx, OfflineSyncContext.jsx
│       ├── i18n/                  # translations.js (English & Hindi UI strings)
│       └── utils/                 # api.js (memory token & authorized fetch helper)
├── netlify.toml                   # Netlify SPA build & Render /api/* proxy config
├── package.json                   # Scripts & dependencies
├── package-lock.json              # npm lockfile
└── .env.example                   # Environment variable template
```

---

## Local Setup & Installation

### Prerequisites
- **Node.js `22+`** (required for built-in `node:sqlite` and `node:test`)
- **npm**
- **Git**

Verify your environment:

```bash
node --version
npm --version
```

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Vedantvijayvargiya-06/AGRINEXUS.git
cd AGRINEXUS
npm ci
```

### 2. Configure Environment Variables

**Linux / macOS:**

```bash
cp .env.example .env
```

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

Key environment variables defined in `.env.example` and `server/config.js`:

| Variable | Default / Notes |
|---|---|
| `NODE_ENV` | `development` (`production` enforces 32+ char `JWT_SECRET_KEY` and disables `DEMO_MODE`) |
| `PORT` | `3000` |
| `DATABASE_PATH` | `./data/agrinexus.db` (override to persistent disk path on Render, e.g., `/var/data/agrinexus.db`) |
| `JWT_SECRET_KEY` | Random ephemeral secret in dev if omitted; **required** (>= 32 chars) in production |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `60` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` (comma-separated browser origins) |
| `ADMIN_BOOTSTRAP_PASSWORD` | Optional initial password for `superadmin@agrinexus.gov.in`; leave blank to claim once via UI |
| `DEMO_MODE` | `false` by default (set `true` locally only if you want `demo_note` OTP output & `/demo-switch`) |
| `OTP_EXPIRY_SECONDS` | `300` |
| `OTP_MAX_ATTEMPTS` | `5` |
| `OTP_RESEND_COOLDOWN_SECONDS` | `60` |
| `RATE_LIMIT_API_PER_MINUTE` | `60` |
| `RATE_LIMIT_AUTH_PER_MINUTE` | `10` |

### 3. Build & Start Locally

```bash
# Build frontend production bundle (frontend/dist)
npm run build

# Start development server (Express + Vite middleware on port 3000)
npm run dev
```

Or run in production mode serving `frontend/dist` directly:

```bash
npm start
```

Open **`http://localhost:3000`** in your browser.

---

## Automated Testing

All commands are defined in `package.json`:

```bash
# 1. Backend syntax check across server.js, routes, services, and tests
npm run lint

# 2. Backend unit, RBAC security, engine invariants, diagnostics & SQLite restart tests
npm test

# 3. Frontend Vite production build
npm run build
```

### Playwright Browser E2E Suite
Start the server in one terminal (`npm run dev`), then run the E2E suite in another terminal (`frontend/e2e_test.cjs` requires `frontend/dist` to be built via `npm run build` for the isolated Admin Diagnostics check):

**Linux / macOS:**

```bash
E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```

**Windows PowerShell:**

```powershell
$env:E2E_BASE_URL="http://127.0.0.1:3000"
npm run test:e2e
```

The E2E suite verifies farmer signup, memory-only JWT storage, harvest batch creation & persistence across reload, Digital Twin & Decision modals, What-If Simulator price inputs, Market Intelligence sorting & RBAC hiding, Cluster Pooling RBAC hiding, zero horizontal overflow across `320px–1440px`, Admin `Diagnostics` suite execution, error detail resolution, and zero navbar button overlap.

---

## Deployment

### Backend Deployment — Render
1. Create a **Web Service** on Render connected to `Vedantvijayvargiya-06/AGRINEXUS`.
2. **Build Command**: `npm ci && npm run build`
3. **Start Command**: `npm start`
4. Attach a **Persistent Disk** mounted at `/var/data` so the SQLite database survives redeploys.
5. Configure environment variables on Render:
   - `NODE_ENV=production`
   - `DEMO_MODE=false`
   - `DATABASE_PATH=/var/data/agrinexus.db`
   - `JWT_SECRET_KEY=<strong-random-secret-at-least-32-chars>`
   - `CORS_ALLOWED_ORIGINS=https://agrinexusdemo.netlify.app,https://agrinexus-ine4.onrender.com`
   - `ADMIN_BOOTSTRAP_PASSWORD=<strong-initial-admin-password>` *(optional; otherwise claim once on first boot)*

### Frontend Deployment — Netlify
Configured in `netlify.toml`:
1. **Build Command**: `npm install --include=dev && npm run build`
2. **Publish Directory**: `frontend/dist`
3. **API Proxy & SPA Routing**: `netlify.toml` proxies `/api/*` requests to `https://agrinexus-ine4.onrender.com/api/:splat` (`status = 200`, `force = true`) and falls back `/*` to `/index.html`. If your backend URL changes, update `to` in `netlify.toml` and `CORS_ALLOWED_ORIGINS` on Render.

---

## Security & Data Persistence

- **In-Memory JWT Session Storage**: Browser client holds Bearer tokens strictly in React memory (`frontend/src/utils/api.js` / `AuthContext.jsx`) rather than `localStorage` or `sessionStorage`.
- **Password & OTP Security**: Uses 100,000-iteration salted `PBKDF2-HMAC-SHA256` with `crypto.timingSafeEqual`, SHA-256 OTP hashes persisted in SQLite (`otp_codes`), IP & phone rate limiting, and temporary lockouts after 5 consecutive failures.
- **Role-Based Access Control (RBAC)**: Server middleware (`requireAuth`, `requireRole`) protects every data, override, cluster confirmation, reporting, and admin diagnostics route. Public registration is restricted to `farmer` and `buyer`.
- **Strict CORS & Headers**: Express configures `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), geolocation=()`, and origin-checked CORS headers (`CORS_ALLOWED_ORIGINS`).
- **Sanitized Error Monitoring**: `diagnosticsService.js` redacts Bearer tokens, JWTs, credentials, and internal filesystem paths before persisting backend or frontend errors in `error_logs`.
- **SQLite Persistence**: Data persists across restarts when `DATABASE_PATH` points to writable durable storage (`WAL` mode + `PRAGMA foreign_keys = ON`).

---

## Project Links

| Resource | URL |
|---|---|
| **Live Application** | https://agrinexusdemo.netlify.app/ |
| **GitHub Repository** | https://github.com/Vedantvijayvargiya-06/AGRINEXUS |

---

## License

No open-source license file is currently present in this repository. Add a `LICENSE` file if you plan to distribute the codebase under specific terms.
