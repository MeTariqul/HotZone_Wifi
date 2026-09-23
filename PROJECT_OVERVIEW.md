# HotZone / Tarif Hotspot — Project Overview

> Living document. **Update this file after every meaningful code, config, doc, or deploy change.**
> Last updated: 2026-09-23 (`a6cbfc0` + docs `5e80f71` pushed; Vercel live — `/analytics` 200).

---

## What it is

Voucher-based WiFi captive portal for a Bangladesh hotspot (**Tarif Hotspot** / **HotZone**). Guests pick a plan, pay (demo bKash/Nagad), get a code, redeem it on the captive splash; an OpenWrt router enforces time/bandwidth via NoDogSplash + tc.

| | |
|---|---|
| **Repo** | `MeTariqul/HotZone_Wifi` · branch `main` |
| **Root** | `/run/media/tariqul/T@rif/Project/HotZone` |
| **App** | Next.js 16.3.5 (App Router, `proxy.ts` middleware), React 19.2.8, TypeScript 5 strict, Tailwind 4 |
| **DB** | Neon serverless Postgres (`@neondatabase/serverless`) — schema in `initDb()` |
| **Host** | Vercel → `https://hotzone-delta.vercel.app` |
| **Router** | OpenWrt + NoDogSplash 5.0.2 + busybox ash daemon/CGI (`webapp/openwrt/`) |
| **Money** | Prices in BDT (৳); checkout is demo mode, not a live gateway |

---

## Layout

```
HotZone/
├── README.md              # stub ("# HotZone_Wifi")
├── PROJECT_OVERVIEW.md    # this file — keep in sync
├── AGENTS.md              # agent rules (incl. auto-update this overview)
├── WATERFALL.md           # UI/feature overhaul plan (phases 0–4)
└── webapp/                # entire application
    ├── src/
    │   ├── proxy.ts       # Next 16 middleware (API auth)
    │   ├── app/           # pages + API routes
    │   ├── components/    # ui.tsx design-system primitives
    │   └── lib/           # db, auth, router client
    ├── openwrt/           # router scripts, LuCI, NDS helper, install docs
    ├── data/              # legacy SQLite (gitignored, unused)
    └── package.json
```

No `docs/`, tests, CI, or LICENSE yet. `webapp/scripts/` is empty.

---

## Architecture (inverted control plane)

Router never needs inbound reachability from the internet.

```
Guest ──► NDS splash ──► /splash (Vercel) ──► /api/vouchers/verify
                │                                      │
                │ success                              │ fail / queue
                ▼                                      ▼
        direct CGI authorize              POST /api/vouchers/authorize
        (router LAN only)                 → router_commands queue

hotspot-sync-daemon (router, every ~15s)
  POST /api/router/sync  +x-api-key
  body: router_id, label, location, status, clients, active, acks
  ← commands[]: kick | block | unblock | authorize | qos

Admin /admin ──► reads router_snapshots + queues commands (no LAN path)
```

**Staleness:** `STALE_SECONDS = 90`, `ROUTER_ONLINE_SECONDS = 90` (`webapp/src/lib/db.ts`).

---

## Routes

### Pages

| Path | File | Notes |
|------|------|--------|
| `/` | `src/app/page.tsx` | Public plan catalog (Admin link **removed** 2026-09-23); design-system restyle |
| `/pay` | `src/app/pay/page.tsx` | Checkout; demo bKash/Nagad |
| `/success` | `src/app/success/page.tsx` | Shows issued voucher; copy/print |
| `/splash` | `src/app/splash/page.tsx` | Captive portal redeem (dark design system) |
| `/admin` | `src/app/admin/page.tsx` | Password login; tabs: vouchers, generate, discounts, routers, live, audit |
| `/analytics` | `src/app/analytics/page.tsx` | Server analytics: redemption, plan mix, revenue |

### API

**Public** (allowlist in `src/proxy.ts`):  
`/api/plans`, `/api/payments`, `/api/vouchers/verify|sync|generate|authorize`, `/api/auth/login|logout|check`, `/api/discount-codes/validate`, `/api/router/sync`.

**Session-protected** (`PROTECTED_PREFIXES = /api/vouchers, /api/router, /api/admin`):  
`/api/vouchers` (list), `/api/router` (snapshot read + enqueue), `/api/admin/*` (vouchers, discount-codes, routers, **export/vouchers CSV**, **audit**).

**Auth layers**

1. `ADMIN_PASSWORD` → HMAC session cookie (`admin_session`, 24h) — `src/lib/auth.ts`
2. `SYNC_API_KEY` → `x-api-key` on router sync — fail closed, no hardcoded fallback
3. `ROUTER_SECRET` → Bearer to local CGI (`/etc/hotspot.secret`) — fail closed

---

## Database (Neon)

Schema created/migrated lazily in `initDb()` (`webapp/src/lib/db.ts`). Tables:

| Table | Role |
|-------|------|
| `plans` | Seeded: trial (free 30m), hourly ৳20, daily ৳50, weekly ৳200, monthly ৳500 |
| `vouchers` | `T-XXXX-XXXX`; `source`, `note`; used flags |
| `payments` | uuid; `discount_code`, `original_amount_bdt` |
| `discount_codes` | percent/fixed/free |
| `routers` | id (UUID), label, location, registered_at, last_seen_at |
| `router_snapshots` | PK `(router_id, kind)` — kinds `status`\|`clients`\|`active` |
| `router_commands` | queue; 60s stale reclaim; `router_id` nullable (legacy `''`) |
| `audit_logs` | Admin mutations: generate, discount, router meta, device commands |

Legacy SQLite at `webapp/data/hotspot.db` is **unused**.

**Multi-router:** daemon self-registers UUID → `uci get hotspot.main.router_id`.  
`resolveRouterId()`: explicit → sole/most-recent registered → `''` sentinel.  
CGI clients format: `mac|ip|hostname|connected_at|dl_kbps|ul_kbps` (comma-separated).

---

## OpenWrt / router

| Repo file | Deploy to | Purpose |
|-----------|-----------|---------|
| `openwrt/hotspot-sync-daemon` | `/usr/bin/hotspot-sync-daemon` | Poll sync + push status + run commands |
| `openwrt/hotspot-sync.init` | `/etc/init.d/hotspot-sync` | procd, respawn, `START=99` |
| `openwrt/www-cgi/hotspot` (755) | `/www/cgi-bin/hotspot` | status/clients/active/kick/block/unblock/authorize/qos |
| `openwrt/hotspot-voucher.sh` | `/usr/bin/hotspot-voucher` | verify/apply/sync/cleanup + QoS |
| `openwrt/hotspot.config` | `/etc/config/hotspot` | UCI: api_base, api_key, intervals, router_id |
| `openwrt/hotspot.lua` + `luci/template/...` | LuCI | Local splash/login |
| `openwrt/setup-walled-garden.sh` | run as root on router | NDS preauth + IPv6 block + fw4 cleanup |

**Live router (as of last session):** `root@192.168.1.1`  
- `router_id` = `fe94cb2c-b777-41f6-999f-9f4e9a44c840`  
- Label/location set from admin: **Main AP** / **Lobby**  
- CGI status/clients/active verified with Bearer secret  
- Daemon enabled via `S99hotspot-sync`  
- Deploy pattern: `cat file | ssh root@… 'cat > dest && chmod …'` (busybox, no scp)

**Voucher log** (`/tmp/voucher_active.log`):  
`code mac ip started duration download upload` — IP is field **3**.

**Walled garden:** DNS 53 + Vercel edge `64.29.17.{3,67,131,195}`, `216.198.79.{3,67,131,195}`, `76.76.21.112` × 80/443. Do **not** open LAN→WAN 443/53 via fw4 (bypasses portal).

---

## Environment (`webapp/.env.example`)

| Var | Use |
|-----|-----|
| `DATABASE_URL` | Neon Postgres |
| `ADMIN_PASSWORD` | `/admin` login |
| `SYNC_API_KEY` | Router `x-api-key` (matches UCI `hotspot.main.api_key`) |
| `ROUTER_URL` | Optional direct LAN calls (empty on Vercel) |
| `ROUTER_SECRET` | Bearer splash↔CGI / daemon↔CGI |

Never commit real `.env`. Rotate Neon token / admin password / sync key if leaked.

---

## Commands

```bash
# App (from webapp/)
npm run dev          # Next dev
npm run build
npm run lint         # eslint
npx tsc --noEmit     # typecheck

# Router
ssh root@192.168.1.1
/etc/init.d/hotspot-sync restart
tail -f /var/log/hotspot.log
REQUEST_METHOD=GET QUERY_STRING=status HTTP_AUTHORIZATION="Bearer $SEC" sh /www/cgi-bin/hotspot
```

**Verification before claiming a change works:** `npx tsc --noEmit` && `npm run lint` (from `webapp/`).

---

## Git / history

- Style: Conventional Commits — `feat:`, `fix:`, `docs:`, `chore:` (optional scope e.g. `fix(cgi): …`)
- Recent: design system + admin features (`a6cbfc0`), docs (`5e80f71`), multi-router + per-device speed (`d069c39`), CGI ARP/status fixes (`e735fb0`, `3d3bc31`), walled-garden docs (`8bfd430`)
- Do not commit unless explicitly asked; never commit secrets

---

## Current state (2026-09-23)

| Item | Status |
|------|--------|
| Multi-router + Routers tab | Working; one live router registered & online |
| Per-device speed / ban / kick UI | Implemented; CGI qos uses `tc class change` |
| Public home Admin link | **Removed** (uncommitted until user commits) |
| Design system | Shared `src/components/ui.tsx` + tokens in `globals.css`; Plus Jakarta Sans / JetBrains Mono |
| Guest pages | Restyled (`/`, `/pay`, `/success`, `/splash`) |
| Admin | Search/status filter, CSV export, Audit tab, Live tab |
| Analytics | `/analytics` server page |
| Typecheck / lint | Clean (`npx tsc --noEmit` && `npm run lint`) |
| Tests / CI | None |
| Root README | Stub |
| Git / deploy | `a6cbfc0` / docs `5e80f71` on `origin/main` → Vercel live |

### Open / known gaps

- No automated tests or CI
- Payment gateway is demo-only
- `hotspot-voucher.sh` hardcodes production `api_base`
- Legacy snapshots under router_id `''` remain in DB (harmless)
- Clock skew can make `age_seconds` slightly negative (still counts as online)
- Waterfall overhaul changes not yet committed

---

## Change log (overview)

| Date | Change |
|------|--------|
| 2026-09-23 | `a6cbfc0` + `5e80f71` pushed & verified live on Vercel |
| 2026-09-23 | `a6cbfc0` pushed: design system, splash restyle, admin search/export/audit, `/analytics` |
| 2026-09-23 | Waterfall overhaul: design system, splash restyle, admin search/export/audit, `/analytics` page |
| 2026-09-23 | Initial overview created; Admin link removed from public `/` |
| 2026-09-23 | Multi-router deployed to live router; CGI ARP + voucher-log field fixes |
| 2026-09-22→23 | Neon migration, inverted control plane, admin auth, splash, NDS walled garden |
