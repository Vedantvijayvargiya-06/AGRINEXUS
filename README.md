# AgriNexus — AI-Powered Post-Harvest Decision Intelligence Platform

AgriNexus is a post-harvest decision intelligence web platform designed to reduce agricultural spoilage and improve farmer realization. It combines a continuous $Q_{10}$ digital twin degradation model, transparent four-pathway economic optimization, FPO freight cluster pooling, mandi market feeds, and bilingual (English / Hindi) grounded assistance.

---

## Tech Stack

- **Backend**: Node.js (ESM), Express 4, SQLite (`node:sqlite` with WAL persistence), `jsonwebtoken` (HS256), salted PBKDF2-SHA256 password hashing
- **Frontend**: React 18, Vite 6, Tailwind CSS 3, Lucide Icons, Web Speech API (STT/TTS)
- **Automated Testing**: Node built-in test runner (`node --test`) + Playwright headless Chromium E2E (`frontend/e2e_test.cjs`)

---

## Project Structure

```
server.js                      # Express entrypoint, security headers, CORS allowlist, static SPA hosting
server/
  config.js                    # Environment config & production JWT/DEMO_MODE enforcement
  store.js                     # Persistent SQLite schema, WAL setup, idempotent initial seeding
  security.js                  # PBKDF2 passwords, JWT signing/verification, SQLite OTP & rate limits
  routes/                      # REST endpoints (auth, batches, decisions, clusters, market, admin, assist, reports, notifications)
  services/                    # Q10 decay engine, decision optimizer, cluster optimizer, market feed, reporting, grounded AI assist
  tests/agrinexus.test.js      # Unit, security, RBAC, and database restart persistence tests
frontend/
  src/                         # React SPA components, contexts, i18n, memory-held auth client
  e2e_test.cjs                 # End-to-end Playwright browser & mobile viewport test suite
netlify.toml                   # Netlify SPA build & Render API proxy rules
```

---

## Local Setup & Development

### Prerequisites
- Node.js **22+** (required for built-in `node:sqlite`)
- npm

### 1. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Key environment variables:
- `PORT`: Express server port (default `3000`)
- `DATABASE_PATH`: SQLite database file path (default `./data/agrinexus.db`)
- `JWT_SECRET_KEY`: Strong random secret (`>= 32` characters). **Mandatory** when `NODE_ENV=production`
- `CORS_ALLOWED_ORIGINS`: Comma-separated allowed origins (e.g. `https://your-site.netlify.app`)
- `DEMO_MODE`: Keep `false` in production. Setting `DEMO_MODE=true` in local development displays demo OTP notes and enables non-admin test account switching
- `ADMIN_BOOTSTRAP_PASSWORD`: Optional initial password for `admin@agrinexus.in` when seeding an empty database. If omitted, the first-run UI prompts an administrator to claim the initial password once

### 2. Install Dependencies & Build Frontend
```bash
npm ci
npm run build
```

### 3. Run the Application
```bash
npm run dev
```
Open **`http://localhost:3000`**.

---

## Demo Data vs. Live Inputs

- Seeded mandi prices in Market Intelligence are labeled **`Demo Feed`** to distinguish illustrative baseline rates from live FPO updates.
- Authenticated **FPO Administrators** and **System Administrators** can submit **`FPO Override`** modal rates, which persist in SQLite, automatically recalculate active batch recommendations, and notify affected farmers.
- Farmer batches, outcomes, cluster confirmations, user accounts, crop kinetic constants, and notifications all persist in SQLite across server restarts.

---

## Automated Testing

```bash
# Syntax & lint verification
npm run lint

# Backend unit, security, RBAC, and SQLite restart persistence tests
npm test

# Production frontend bundle
npm run build

# Headless Playwright browser E2E & mobile overflow suite (requires server running on E2E_BASE_URL or port 3000)
E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```

---

## Deployment

### Render (Backend + Full-Stack Node.js Web Service)
1. Create a **Web Service** on Render connected to this repository.
2. Set **Build Command**: `npm ci && npm run build`
3. Set **Start Command**: `npm start`
4. Attach a **Persistent Disk** mounted at `/var/data` (so SQLite survives redeploys).
5. Configure **Environment Variables** on Render:
   - `NODE_ENV=production`
   - `DEMO_MODE=false`
   - `DATABASE_PATH=/var/data/agrinexus.db`
   - `JWT_SECRET_KEY=<64-char-random-hex-secret>`
   - `CORS_ALLOWED_ORIGINS=https://agrinexus-ine4.onrender.com,https://<your-site>.netlify.app`
   - `ADMIN_BOOTSTRAP_PASSWORD=<strong-initial-admin-password>` (optional; otherwise claim once on first login)

### Netlify (Frontend Static SPA + API Proxy)
1. `netlify.toml` builds `frontend/dist` via `npm install --include=dev && npm run build` and proxies `/api/*` requests to `https://agrinexus-ine4.onrender.com/api/:splat`.
2. Update the `to = "..."` URL in `netlify.toml` if your Render service URL changes, and add your Netlify URL to `CORS_ALLOWED_ORIGINS` on Render.
