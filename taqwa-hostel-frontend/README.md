# Taqwa Boys Hostel — Frontend (Phase 3 + redesign foundation)

Next.js 14 + TypeScript + Tailwind, mobile-first. Design direction
(redesign foundation): enterprise-clean, Primary `#103D30`, active
background `#E8F2EC`, page background `#F7F8FA`, card `#FFFFFF`,
borders `#E2E8E5`, primary text `#172B25`, secondary text `#64748B`,
success `#28805A`, warning `#B78119`, danger `#DC2626`. No gradients,
no glassmorphism, no gold/cream theme. Noto Nastaliq Urdu for Urdu,
Inter for everything else. Icons: `lucide-react` (no emoji).

## Design tokens & shared components (foundation)

- Tokens live in `tailwind.config.ts`: `brand` / `pine` (same new
  primary scale — `pine-*` is a backwards-compatible alias, prefer
  `brand-*`), `page`, `active`, `line`, `ink`, `muted`, `success`,
  `warning`, `danger`; `rounded-btn` 8px, `rounded-card` 12px,
  `rounded-modal` 16px; `shadow-card`, `shadow-modal`. Type scale:
  page headings 28–30px semibold, section headings 18–20px semibold,
  body 14–15px, supporting text 12–13px. Buttons 40–44px high,
  inputs 44px, card padding 20–24px, page padding 24–32px.
- `src/components/ui.tsx` — `Button` (primary/secondary/tertiary/
  destructive, `loading`, `icon`), `IconButton`, `Input`, `Select`,
  `Modal` (fixed header/footer, Escape/backdrop close, autofocus +
  focus return), `ConfirmDialog`, `DropdownMenu` +
  `DropdownMenuItem`, `Pagination`, `EmptyState`, `Skeleton`,
  `ToastProvider` + `useToast` (mounted in `src/app/layout.tsx`),
  `StatusBadge` (alias `StatusPill`), `MetricCard` (label + icon on
  top, value below, optional `tone` default/success/warning/danger,
  optional `href` for a stretched-link clickable card with arrow +
  hover/focus states, optional `extra` content such as a progress bar),
  `InfoTooltip` (hover + focus definition tooltip), `DataTable`
  primitives (`TableContainer`, `Table`, `TableHead`, `TableBody`,
  `TableRow`, `TableHeadCell`, `TableCell`, `DataTable`), `Toolbar`,
  `SearchInput`. Kept for existing pages: `Card`, `SectionTitle`,
  `Loading`, `ErrorBox`, `Field`, `inputCls`, `PrimaryButton`.
- `src/components/shell.tsx` — shared portal layout used by
  `AdminShell` (groups: Overview → Dashboard; Management → Rooms &
  Buildings, Residents, Applications; Finance → Rent, Payments;
  Preferences → Edit Requests, Settings) and `ResidentShell`
  (Home, Pay, History, Profile). Sidebar 248px, active item =
  light-green `#E8F2EC` background + dark-green text/icon; profile
  dropdown with Logout at the bottom; drawer navigation on mobile;
  sidebar is full viewport height (`100dvh`), nav scrolls
  independently with a thin low-contrast scrollbar, branding fixed
  at the top and profile anchored at the bottom. The shell root is
  `h-dvh overflow-hidden` — no document-level scrolling; the main
  content scrolls independently under a fixed global header, which
  shows a compact breadcrumb (role / page) plus the Urdu toggle and
  A+ large-text control on the right. Admin-only header extras: a
  residents search box (Cmd/Ctrl+K focuses it, Enter routes to
  `/admin/residents?search=`, collapses to an icon on mobile) and a
  pending-work bell (badge = pending payments + pending applications —
  STATIC sample counts for now, 2 + 3 = 5, from
  `src/lib/staticPreview.ts`; panel links to pending
  payments and applications). Neither renders in the resident shell.
  Role is still verified
  via `/me` in `useEffect`; the public header in `SiteChrome`
  stays static (Login only) — never read the session there.

Covers the locked POC scope only — landing page, single login, admin
portal (Qari), resident portal — plus PWA install. No mess, no ERP,
no hotel features, no ads inside admin/resident, no OTP, no WhatsApp API.

## What is inside

- `/` — public landing page: hero, live seat availability per building
  and room (real counts from the backend, never sample numbers), 2/3/4-seater
  rooms starting from Rs 8,000, facilities, About + Founder Qari Abdul
  Majeed (real photo), admission steps, location + Google Maps, apply form
  and WhatsApp apply (wa.me link only).
- `/hostels/[slug]` — the SAME landing template for a later hostel.
  Today the backend serves only Taqwa, so any other slug shows an honest
  "not live yet" page instead of Taqwa's data under another name.
- `/apply` — public onboarding form (also the target of the admin invite
  link `/apply?token=...`). Creates a PENDING application; login starts
  only after the admin approves it and assigns a seat.
- `/login` — one login for everyone, phone + password, no role choice.
  The backend decides the role: admin → `/admin/dashboard`,
  resident → `/resident/home`.
- `/admin/*` — admin portal behind its OWN left sidebar on desktop
  (drawer navigation on mobile) with ONLY admin items: Dashboard,
  Rooms, Residents, Applications, Rent, Payments, Edit Requests,
  Settings, Logout — no public website nav inside the admin area.
  Urdu toggle + A+ large-text toggle are in the global header.
  Dashboard (time-based greeting with the admin's name from `/me` +
  a plain "This month" label; 4 KPI cards — numbers live from the
  dashboard API, Total Rooms "N building(s)" and Occupancy "X of Y
  seats" live; the "N new this month" and "N rooms have space"
  sub-lines are STATIC sample for now. A hand-rolled SVG Rent
  Collected / New Residents area chart for the last 6 months, a Rent
  Collection donut (Collected Rs 56,000 / Pending Rs 18,000 / Total
  Due Rs 74,000 / Overdue Rs 9,000 sample) with legend links to
  approved payments / due rent / overdue rent, and a Recent Activity
  list — all three STATIC sample, labelled "Sample" on screen with a
  preview note under the greeting. All sample data lives in one file,
  `src/lib/staticPreview.ts`, which the later backend step replaces;
  no trend chips anywhere),
  rooms (room cards grid: seat dots + counts, resident
  names, monthly rent, View/Edit; building, room create and room edit
  are all modal pop-outs; room create building is optional — blank
  uses the only building or auto-creates a "Main Building"), residents
  (search by name/phone/CNIC — also honours `?search=` in the URL,
  used by the header search and dashboard activity rows, pagination, Export CSV, manual add in a
  modal with optional AC/Cooler/Geyser + custom extra charges, person
  card with base + extras breakdown and an extras manager to
  add/toggle/remove), applications (invite link, approve with
  vacant-seat assignment + optional extras, reject), rent (due/paid
  lists with base + extras breakdown, wa.me reminder links),
  payments (pending screenshots, view, approve/reject), edits (profile
  edit requests), settings (grace days; rent duration fixed at 30 days).
- `/resident/*` — resident portal with its OWN simple nav: Home, Pay,
  History, Profile, Logout — no public nav. Home shows my room +
  current rent cycle + my extra charges and monthly total (base +
  active extras).

**Extra-charges rule (shown in the UI): monthly total = base rent +
sum of ACTIVE extras. A change applies from the NEXT rent cycle
only, never to a cycle that already exists.**
- PWA: `manifest.webmanifest`, icons, `sw.js` offline shell, installable.
  The same website is wrapped for Play Store later (see below).

Urdu toggle is on top of every page (default English). The `A+` button
turns on large text for Qari Sahib. Both choices are remembered.

## Run locally

Backend first (from `../taqwa-hostel-backend`):

```bash
uv sync
cp .env.example .env
# Edit .env: set a real JWT_SECRET_KEY — openssl rand -hex 32
# Never commit .env. The dev default is for local testing only.
uv run python -m app.seed_admin
uv run uvicorn main:app --reload
```

Seed admin: Qari Abdul Majeed, phone `03004493800`, temporary dev
password `Taqwa@123` — change it after the first login. (There is no
password-change endpoint in the system yet — that decision is still
pending with Ismail. Until it exists, the temporary password can only
be changed by the developer in the database, so keep it local-only.)

Frontend (this folder):

```bash
npm install
npm run dev
```

Open http://localhost:3000. The frontend proxies `/api/*` and
`/uploads/*` to the backend on `http://127.0.0.1:8000` (see
`next.config.js`), so no CORS setup is needed. Production build:

```bash
npm run build
npm run start
```

## How live data works

- Landing seats come from `GET /api/v1/public/seats/by-room` (added in
  Phase 3): per-room vacant/total counts, no names or phones. When the
  backend has no rooms yet, the page says so honestly instead of
  showing invented seats.
- All admin/resident data comes from the real backend endpoints only.
- The frontend never shows a real backend error — only the backend's
  generic message, or a fixed fallback.
- The hero image is an illustration (labelled on the page). Real Taqwa
  photos are not available yet — replace `public/hero.svg` when they are.
  The founder photo is Qari Sahib's real photo (`public/founder.jpg`).

## Play Store (TWA wrapper) — preparation, not published

1. Deploy this site on HTTPS (required for TWA + installability).
2. Create a Google Play developer account — $25 one-time (about
   Rs 7,000). No separate monthly app cost: the app is the same
   website + backend, wrapped.
3. Use a TWA wrapper (e.g. Bubblewrap / PWABuilder): point it at the
   deployed URL, generate the Android package, upload the `.aab` to
   Play Console with the app icon (`public/icon-512.png`) and screenshots.
4. Verify `assetlinks.json` on the deployed domain so the TWA opens
   without the browser bar (Bubblewrap generates it).
5. Do NOT publish until Qari approves the live site and the seed
   password / JWT secret are real (see backend README).

iPhone (App Store, $99/year) is skipped at the start — residents and
Qari mostly use Android, and the PWA installs on iPhone from Safari
anyway ("Add to Home Screen").

## Rules

- Never present sample/demo data as live. Empty states are labelled.
- No SaaS pricing on the public landing page. Room rent is shown only
  as "starting from Rs 8,000" (as approved in the sample).
- No password change/reset endpoints exist yet — do not build them
  until Ismail decides.
