# HotZone — Waterfall Project Plan

> Sequential phases: finish one phase (requirements → design → build → verify) before the next starts.

## Phase 0 — Requirements (done)

**Goals**
1. Professional, cohesive product UI (public + admin).
2. Feature-complete hotspot admin: vouchers, generate, discounts, multi-router, live control, analytics, export, audit.
3. Trustworthy guest flow: plans → pay → success → splash redeem.

**Non-goals (this pass)**
- Real bKash/Nagad API (stays demo).
- Native mobile apps.
- Multi-tenant SaaS.

## Phase 1 — Design

| Deliverable | Status |
|---|---|
| Design tokens (`globals.css`) | Done |
| Shared primitives (`Button`, `Card`, `Badge`, `EmptyState`, `Stat`, `Field`, `Spinner`) | Done |
| Root layout: fonts, metadata, skip-link | Done |
| Public pages restyled (`/`, `/pay`, `/success`, `/splash`) | Done |
| Admin shell: tabs, cards, tables | Done |

**Visual language**
- Ink navy surfaces, cyan primary (signal/connectivity), amber for BDT money.
- One geometric UI font + mono for codes/IDs.
- Dense admin, airy guest pages. No gratuitous gradients.

## Phase 2 — Features

| Feature | Notes | Status |
|---|---|---|
| Voucher search/filter/status chips | Admin list | Done |
| CSV export (all/filtered vouchers) | `GET /api/admin/export/vouchers` | Done |
| Copy code / copy batch | Generate tab "Copy all" | Done |
| Analytics page | `/analytics` — redemption, plan mix, revenue | Done |
| Audit log | `audit_logs` + Audit tab + writes on admin mutations | Done |
| Live refresh affordances | Refresh buttons + last-updated | Done |

## Phase 3 — Hardening & polish

| Item | Notes | Status |
|---|---|---|
| Loading/empty/error states | Skeletons, EmptyState, Alert | Done |
| Accessibility | Focus rings, labels, contrast, skip-link | Done |
| Responsive | Admin usable on tablet/phone | Done |
| Success/share | Clear next steps for guest | Done |

## Phase 4 — Verification

```bash
cd webapp && npx tsc --noEmit && npm run lint
```

Status (2026-09-23): **pass** (tsc clean, eslint clean).

Update `PROJECT_OVERVIEW.md` after every change.

## Traceability

| Requirement | Phase | Primary files |
|---|---|---|
| Professional UI | 1 | `globals.css`, `layout.tsx`, `src/components/ui.tsx` |
| Guest flow polish | 1 | `page.tsx`, `pay`, `success`, `splash` |
| Admin UX | 1–2 | `admin/page.tsx` |
| Export / analytics / audit | 2 | `api/admin/*`, `lib/db.ts` |
| Verify | 4 | tsc, eslint |
