# ARVI POS - web app

The ARVI POS front end for cafes and restaurants: till, tables and floors, kitchen display, bills, menu and pricing, stock,
staff, owner dashboard, and the platform screen for the people who run ARVI itself. One install serves many cafes, and each
cafe can have many branches.

It is the **neram-pos-web React app (v3.21)** with a cafe and branch layer on top, so it can be taken together with the
matching `arvi-pos-be` release. Neram's own notes on the app (stack, rules, selector contract for the browser tests) apply here too.

## What ARVI adds on top of the neram app

| Area | How it works |
|---|---|
| **Cafe code at sign-in** | The login asks for the cafe code, username and password. The code picks the cafe's own database on the server. |
| **Branches** | An owner or main manager picks a branch in the header ("All branches" is allowed for reading; the till asks for one). The choice is sent as `X-Outlet-Id`. A branch manager and staff work in their own branch only and never see the switcher. |
| **Role tiers** | owner (`ADMIN`/`CAFE_ADMIN`) > main manager (`GENERAL_MANAGER`) > branch manager (`MANAGER`) > staff (`CASHIER`/`CAPTAIN`/`KITCHEN`/`EMPLOYEE`). The server decides; the screen only hides what it would refuse (`src/api/roles.ts`). |
| **Staff rights** | Per person: take orders, cancel orders, print bills, manage stock, manage the menu, manage branch settings. (Bill / expenses / reports toggles were never checked by the server and are gone.) |
| **Floors and tables** | Tables belong to a branch and a floor; the till filters by floor. |
| **Branches screen, Cafe & Branding** | Branch list and details, logo and payment QR uploads per branch or for the whole cafe. Receipts use the cafe's own name, logo and QR. |
| **Per-branch menu** | One shared menu, with a price and "sold out" per branch. |
| **Kitchen display** | Open kitchen tickets with no prices, updated live. Kitchen staff land here. |
| **Platform screen** | Platform owners list, create and suspend cafes and issue bridge tokens. |
| **Public menu** | `/menu?cafe=<code>[&branch=<CODE>]` for customers (no sign-in, branch prices and sold-out shown). `/menu` without `cafe` is the staff Menu & Pricing screen. |
| **Offline** | Orders taken while offline wait in an outbox that is kept per cafe and branch, so they are never sent into the wrong place. |

## Commands (Node 20.19+ or 22)

```bash
npm install
npm run dev          # http://localhost:5173/  (proxies /api to the backend; set VITE_API_PROXY to change)
npm run check        # typecheck + lint + unit tests + production build (run before every commit)
npm run test         # unit tests only
npm run build        # dist/
```

## Layout

```
src/
  main.tsx, app/        entry, providers, routes, header / navigation / drawer
  api/                  client (token refresh, branch header), session store, role tiers (roles.ts), types
  auth/                 login screen (cafe code), forced password change, role -> screen rules (tabs.ts)
  features/             one folder per screen (pos, kitchen, bills, menu, outlets, settings, platform, public-menu, ...)
  offline/              order outbox and offline copies, scoped by cafe and branch
  lib/, styles/         time formatting, theme, live-stream hook, design tokens
public/                 manifest, service worker, vendored fonts and icons, themed error pages
nginx.conf              CSP, microcache for the public menu, login rate limit, API proxy, immutable asset caching
Dockerfile              node build stage, then nginx
```

The vanilla-JS files at the repository root (`app.js`, `js/`, `legacy/`, `menu.html`, `style.css`, `sw.js`) belong to the previous
front end and are not part of this app or its build.

## Docker

```bash
docker build -t arvi-ui .
docker run -d -p 3000:80 --name arvi-frontend arvi-ui
```

nginx proxies `/api` to a service called `backend` (a Docker network alias), so run it on the same network as the backend.
The site uses `script-src 'self'`: fonts and icons are vendored, nothing loads from outside hosts.
