# TrustLedger

**Public donation transparency and resource accountability system.**

TrustLedger follows every contribution — money or materials — from receipt to allocation,
expenditure and final delivery to a beneficiary. The accounting rules that keep the record honest
are enforced by the database itself (foreign keys, CHECK constraints, triggers), not only by the
UI, and every significant operation is written to an append-only audit trail.

Built as a full-stack, database-driven application: React + TypeScript on the front end,
Cloudflare Workers + D1 (SQLite) on the back end, with a normalized relational schema, SQL views,
aggregate analytics, transaction batches and trigger-enforced business rules.

---

## What you can do

### Public (no account needed)
- Browse a directory of campaigns with live funding progress, category filters and search.
- Open any campaign to see its complete money trail: raised, allocated, spent, remaining,
  expenditure by category, monthly funding, individual donations, and beneficiary deliveries.
- Read the **public audit trail** — every donation, allocation, voucher and delivery, newest first,
  with the actor and record reference. Entries cannot be edited or deleted.

### Organization staff
- Record monetary and in-kind donations (new or existing donors) and issue a receipt number.
- Create campaigns and manage their status (`draft`, `active`, `paused`, `completed`).
- Register beneficiaries and verify them.
- Commit funds or goods to a beneficiary, with a purpose and a reference.
- Record deliveries against an allocation, with evidence references.
- Record programme expenses (vouchers, vendors, receipt references).
- Export donors, expenses and allocations as CSV.
- Scoped to their own organization only.

### Administrator
- Everything staff can do, across all organizations.
- Create accounts, change roles, enable/disable access (sessions are revoked immediately).
- Full audit trail access and platform-wide reporting.

### Auditor
- Read-only access to every record across all organizations.
- Full audit trail with filters and structured metadata inspection.
- Write endpoints reject the role at the API layer and the UI hides all write controls.

### Donor
- A private giving history with receipts, campaign progress and the public transparency pages.

---

## Demo accounts

All demo accounts use the password **`demo1234`**.

| Role | Email | Scope |
| --- | --- | --- |
| Administrator | `admin@trustledger.org` | Platform-wide |
| Staff (Aarogya Foundation) | `staff@aarogya.org` | Own organization |
| Staff (Vidya Setu Trust) | `staff@vidyasetu.org` | Own organization |
| Auditor | `auditor@trustledger.org` | Read-only, all data |
| Donor | `donor@example.com` | Own contributions |

The seeding routine creates 3 organizations, 8 campaigns, 30 donors, 18 beneficiaries,
~165 donations, ~30 allocations, ~35 vouchers, ~62 deliveries and ~300 audit entries spread over
eight months. It runs automatically the first time the app starts against an empty database.

---

## Architecture

```
Browser (React 19 + Vite + Tailwind v4)
   │  fetch /api/*
   ▼
Cloudflare Worker (Hono)
   ├─ bootstrap / schema / seed        db/schema.sql
   ├─ PBKDF2 auth + cookie sessions
   ├─ role + organization scoping
   ├─ writes wrapped in D1 batch() transactions
   ▼
Cloudflare D1 (SQLite)
   ├─ 11 tables, 9 views, 10 triggers
   ├─ foreign keys, CHECK constraints, indexes
   └─ append-only audit_logs
```

Bootstrapping is self-contained: on the first API request the Worker checks for the `users` table,
applies `db/schema.sql` as a single transaction batch, and seeds the demo dataset if the database is
empty. No manual migration step is needed locally or in a deployed environment.

---

## Data model

| Table | Purpose | Notable integrity rules |
| --- | --- | --- |
| `organizations` | Registered NGOs | Unique registration number, verified flag |
| `users` | Login accounts | Role CHECK, optional organization/donor link |
| `donors` | Individuals, corporates, trusts | Unique email, donor type CHECK |
| `campaigns` | Fundraising campaigns | Goal > 0, status CHECK, end date ≥ start date |
| `donations` | Receipt-based contribution ledger | Monetary requires amount; material requires item + quantity; immutable |
| `beneficiaries` | Families, schools, shelters, patients | Household size > 0, organization-scoped |
| `allocations` | Funds/goods committed to a beneficiary | Unique reference; amount or quantity required by type |
| `expenses` | Vouchers against campaign budgets | Unique voucher, amount > 0, receipt reference |
| `distributions` | Delivery of an allocation | Unique reference; amount or quantity > 0 |
| `audit_logs` | Append-only audit trail | No updates or deletes permitted |
| `sessions` | Server-side sessions | Expiry enforced on every request |

### Analytical views

`v_campaign_finance` (raised, allocated, spent, donor and beneficiary counts per campaign) ·
`v_platform_stats` · `v_allocation_detail` · `v_donor_totals` · `v_beneficiary_support` ·
`v_expense_breakdown` · `v_monthly_donations` · `v_organization_summary`.

### Business rules enforced by triggers

| Trigger | Rule |
| --- | --- |
| `trg_alloc_fund_guard` | A fund allocation can never exceed the money a campaign actually received. |
| `trg_alloc_material_guard` | Material allocations cannot exceed the donated quantity of that item. |
| `trg_alloc_org_guard` | A campaign can only allocate to beneficiaries of its own organization. |
| `trg_expense_budget_guard` | Expenditure can never exceed the funds allocated for the campaign. |
| `trg_distribution_guard` | Deliveries cannot exceed an allocation's amount or quantity. |
| `trg_distribution_status` | Allocation status follows the delivery ledger automatically. |
| `trg_donation_campaign_active` | Only active campaigns accept donations. |
| `trg_donations_immutable_update` / `_delete` | Financial fields of a donation can never be rewritten or deleted. |
| `trg_audit_immutable_update` / `_delete` | The audit log is append-only. |
| `trg_campaign_goal_reached` | Stamps the moment a campaign reaches its funding goal. |

Violations surface as friendly `409` responses (for example `ALLOCATION_EXCEEDS_FUNDS`) rather than
silent data corruption.

### Transaction processing

Every write that touches the ledger is executed with `db.batch([...])`, which D1 runs atomically:
the record and its audit entry either both commit or neither does. For example, recording a donation
inserts the `donations` row and an `audit_logs` row that resolves the new record id inside the same
transaction.

---

## Running locally

Requirements: Node 20+ and npm.

```bash
npm install

# terminal 1 — API + local D1 (port 8787)
npm run worker:dev

# terminal 2 — Vite dev server with HMR (port 3000, proxies /api → 8787)
npm run dev
```

Open <http://localhost:3000>. The first API request creates the schema and seeds the demo data into
the local D1 database (`.wrangler/state`).

Other commands:

```bash
npm run typecheck     # TypeScript for both the app and the Worker
npm run build         # production build of the SPA into dist/
npm run db:reset      # delete the local D1 database; the next request re-seeds it
```

To inspect the database directly:

```bash
npx wrangler d1 execute trustledger --local \
  --command "SELECT campaign_id, title, raised, allocated, spent FROM v_campaign_finance"
```

### Production build

```bash
npm run build
npx wrangler deploy --dry-run --outdir=deploy       # bundles the Worker
```

`wrangler.jsonc` binds the D1 database as `DB` and the SPA output as `ASSETS`, with
`run_worker_first: ["/api/*"]` and SPA fallback for client routes. The committed
`database_id` is a zeroed placeholder so the repo runs locally out of the box; before
deploying to your own Cloudflare account, run `npx wrangler d1 create trustledger` and paste
the returned id into `wrangler.jsonc`.

### Hosted deployment (Cloudflare Workers + D1)

A live preview is deployed at
<https://site-470d388abb6748abaa2cf33f3b2cc2c9.freebuff.page> on the Freebuff Sites runtime.
The deployment manifest lists the bundled Worker module and the built `dist/` directory as static
assets with `spa: true`, and the D1 database is attached as the `DB` binding. The database
initialises and seeds itself on the first request, so no remote migration step is required.

```bash
npm run build && npx wrangler deploy --dry-run --outdir=deploy
# deploy deploy/index.js + deploy/public with the platform's Sites deployer
```

---

## API surface

| Method | Endpoint | Access |
| --- | --- | --- |
| `GET` | `/api/public/stats`, `/api/public/campaigns`, `/api/public/campaigns/:id`, `/api/public/ledger` | Public |
| `POST` | `/api/auth/login`, `/api/auth/logout` | Public / session |
| `GET` | `/api/auth/me`, `/api/meta`, `/api/dashboard` | Authenticated |
| `GET` | `/api/donations`, `/api/campaigns`, `/api/beneficiaries`, `/api/allocations`, `/api/expenses`, `/api/distributions` | Authenticated, scoped |
| `POST` | `/api/donations`, `/api/campaigns`, `/api/beneficiaries`, `/api/allocations`, `/api/distributions`, `/api/expenses` | Admin, staff |
| `PATCH` | `/api/campaigns/:id`, `/api/users/:id` | Admin, staff (status) / admin (users) |
| `GET` | `/api/reports`, `/api/export?type=donations\|expenses\|allocations` | Admin, staff, auditor |
| `GET` | `/api/audit` | Admin, auditor |
| `GET`/`POST` | `/api/users` | Admin |

All responses are JSON except CSV exports. Errors use `{ "error": { "code", "message" } }`.

---

## Security notes

- Passwords are hashed with PBKDF2-SHA256 (100,000 iterations, per-user salt) using WebCrypto.
- Sessions are opaque 256-bit tokens in an `HttpOnly`, `SameSite=Lax`, `Secure` (on HTTPS) cookie;
  they expire after seven days and are deleted when an account is disabled.
- Every API handler re-checks the session and role; staff queries are filtered by organization and
  donor queries by donor id. No client-supplied user id is trusted.
- All SQL uses bound parameters.
- The public pages expose aggregate financials and donation receipts, but never beneficiary contact
  details, donor emails or user records.

---

## Project structure

```
db/schema.sql          normalized schema, views, indexes, triggers
scripts/generate-schema.mjs  embeds the schema into the Worker bundle
worker/schema.generated.ts   generated SQL string (do not edit)
worker/index.ts        Worker entry, bootstrap, auth routes, error mapping
worker/lib.ts          validation, error translation, audit helper
worker/sql.ts          statement splitter for DDL batches
worker/seed.ts         deterministic demo dataset
worker/auth.ts         PBKDF2 hashing and cookie sessions
worker/routes/         public, ledger, directory and insights APIs
src/pages/             landing, campaign pages, public ledger, workspace pages
src/components/        UI kit, charts, layouts, campaign card
src/lib/               API client, auth context, formatting, types
```

---

## Notes

- Currency is Indian rupees (INR); amounts are formatted with `en-IN` grouping.
- "Programme spend" (expenses) and "delivered to beneficiaries" (distributions) are separate
  measures: expenses record utilisation of allocated funds, deliveries record what reached the
  beneficiary. They are not summed together.
- The demo dataset is generated deterministically and is intended for evaluation, not production.
  In a real deployment the seeded accounts and the automatic seeding step would be removed.
