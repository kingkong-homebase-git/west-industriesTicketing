# Checkpoint — 2026-05-21

## 🚧 CURRENT BUILD PLAN (active) — major direction change
Order: 0 remove Notion → 1 Projects → 6 copy → 2 Attachments → **3 Views (IN PROGRESS)** → 4 Priorities/SLA/notifications → 5 CEO Google Calendar (last).
Each migration: back up first, apply **as `west_admin`** (or `ALTER TABLE … OWNER TO west_admin`).
**RESUME HERE → #3 (Board views) in progress.**

✅ **#2 DEPLOYED & VERIFIED** (commits `75fb4f0` + build-fix `fbb7ef5` + UX-fix `25159f6`,
migration `0005_curved_magma` applied as west_admin). Attachments live: links + document
uploads (bytea in Postgres, 10MB cap, images rejected), download via `/api/attachments/[id]`.
Lesson: a `"use server"` file may export **only async functions** — exporting a `number`
const broke the droplet build (tsc/lint don't catch it; only `next build` does).
Also fixed: paused the 10s `router.refresh()` poll while the slide-over is open (was
interrupting edits) + comments only auto-scroll on a new post (not on open).

0. ✅ **DONE & DEPLOYED** (`a00bfa6`, migration `0003`) — Notion sync fully removed.
1. ✅ **DONE & DEPLOYED** (`3e63ba7`, migration `0004` applied as west_admin) — Projects: `projects`
   table + `project_id` FK (legacy `tickets.project` text kept for back-compat), project actions
   (create/list/delete), sidebar Projects section + in-app "Add project" (window.prompt), Project
   dropdown in task create/edit, `/projects/[id]` board view.
6. ✅ **DONE** (in `3e63ba7`) — task-create copy → "New Task" / "Create Task".
2. ✅ **DONE (committed, NOT yet deployed)** — Attachments. **Design diverged from original
   plan:** docs are stored as **bytea in Postgres** (not DO Spaces) per user decision — ships
   today, no creds needed, and files ride along in the daily pg_dump backups. **Images skipped**
   for now (links + documents only). New `attachments` table (ticketId, kind link/file, url,
   filename, mimeType, data bytea, size, uploadedById, createdAt); `attachment_kind` enum.
   `assertTicketAccess` extracted to `src/lib/ticket-access.ts` (shared by tickets + attachments
   actions). Upload via server action (10MB cap, rejects `image/*`); download/serve via
   `GET /api/attachments/[id]` (auth + access-checked; links 302-redirect). `AttachmentsSection`
   in the SlideOver (Add link / Upload / delete). `next.config` bumped `serverActions.bodySizeLimit`
   to 12mb (default 1MB would block uploads). Migration `0005_curved_magma`.
   Follow-up if files outgrow the DB: migrate to DO Spaces (a Spaces account already exists for backups).
3. **Board views** — view-switcher dropdown (top-right): Kanban (existing) + Calendar + Timeline + Feed.
4. **Priorities/SLA/notifications** — add `urgent`,`extreme` to priority enum; email ALL active members
   on Urgent/Extreme task creation; SLA cron emails when a task is <12h from deadline + `notified_sla` flag.
5. **CEO Google Calendar 2-way sync** — jacquesmwest@gmail.com; Google Cloud OAuth + Calendar API; biggest lift.

Note: SLA assumed = "<12h before deadline" unless redefined. Notion removal was intentional (full delete).
Migration-ownership rule learned: apply migrations as `west_admin` (apply via `psql "$DATABASE_URL" -f …`)
or `ALTER TABLE … OWNER TO west_admin` after, else the app gets `permission denied`.

---

## Prior state (pre-direction-change)
Live in production at **https://app.westindustriesintl.com** (HTTPS, PM2, daily backups). Done before
this plan: Hemisphere rebrand + logo + sunset theme + light/dark toggle, mobile overhaul, self-serve
tickets, hard-delete users, password reset, dashboard, invites — and (being removed in #0) Notion sync.

---

## Where we are

Live in production at **https://app.westindustriesintl.com** (HTTPS via nginx +
Let's Encrypt). Notion two-way sync, the Resend email/invite system (now with a
**verified sending domain**), team-member ticket permissions, the org-wide board,
and user archive are all deployed and working.

### origin/main = `6a9155e` (droplet deployed at this commit)
Key commits this session (oldest → newest):
- `374b690`/`770a946`/`c896540` — A.9: push preserves human Notion body content
  (managed-section marker) + guarded reconcile script (**do not run**)
- `8b38e29`/`865ba26`/`23c9dd0` — sync-poll env ordering + PM2 worker fork/interpreter fixes
- `db651a8` — load `.env.local` into the standalone app via `--env-file`
- `df96d97` — `postbuild` copies `.next/static` + `public` into standalone
- `44cf923` — invites via Resend over HTTPS, non-fatal on failure
- `9502bda` — team members manage their OWN tickets; archive guards (self / last super_user)
- `42ff9d3` — team-member ticket UI, org board access for all roles, friendly invite errors
- `bb48564` — copy-link fallback for pending invites when email can't be delivered

`tsc --noEmit`, `lint`, `test` (17 passing) all clean.

### Live environment
- App: **https://app.westindustriesintl.com** — nginx reverse proxy → app on `127.0.0.1:3000`.
  - nginx site: `/etc/nginx/sites-available/app.westindustriesintl.com`
  - TLS: Let's Encrypt (certbot `--nginx`, auto-renew), expires 2026-08-18.
  - DNS: Hostinger A record `app` → `104.248.162.39`. (Root `@`/`www` left alone.)
- `.env.local` on droplet: `AUTH_URL="https://app.westindustriesintl.com"`,
  `AUTH_TRUST_HOST="true"`, `EMAIL_FROM="West Industries <no-reply@westindustriesintl.com>"`,
  `RESEND_API_KEY` (from the personal `enslinmarnus0@gmail.com` Resend account),
  plus `DATABASE_URL`, `NOTION_TOKEN`, `NOTION_DATABASE_ID`. Old `SMTP_*` vars unused.
- Droplet path `/var/www/west-industries`. DB user `west_admin`, db `west_industries`.
- **PM2 (`pm2 save`d):** `west-industries` (main app, fork, `node --env-file=.env.local
  .next/standalone/server.js`) + `west-industries-sync` (pull worker, fork,
  `interpreter:"none"`, `cron_restart */5`, idles `stopped` between ticks).
- **Resend domain `westindustriesintl.com` is Verified** (DKIM/SPF/DMARC in Hostinger DNS).

### Verified working
- Notion pull (incremental, every 5 min) + push (A.9 preserves page content).
- Email invites deliver via Resend; pending invites have **Resend / Copy link / Cancel**;
  users can be **Archived / Restored**; team members can create/edit/move/delete their
  OWN tickets and view (read-only) the org board.
- HTTPS + login over the domain.

---

## Deploy recipe (use every time)
```bash
cd /var/www/west-industries
git pull origin main
pnpm install                 # only if deps changed
pnpm build                   # postbuild auto-copies static + public into standalone
pm2 restart west-industries  # re-execs node --env-file, picks up new .env.local + build
pm2 save
# worker only needs recreate if ecosystem.config.js changed:
#   pm2 delete west-industries-sync && pm2 start ecosystem.config.js --only west-industries-sync --env production
```
- **Do NOT** pass `--update-env` to the main app (it clobbers env; app reads `--env-file`).
- **Do NOT** `pnpm build` on Windows (standalone symlink `EPERM`) — build on the droplet.
- **No DB migration** needed on deploy — prod schema is current.

---

## Open landmines / follow-ups
1. **Rotate the exposed secrets** (shown in a screenshot earlier): `AUTH_SECRET`,
   `RESEND_API_KEY`, `NOTION_TOKEN`, DB password, Gmail app password. Still pending.
2. **Confirm PM2 survives reboot.** A kernel upgrade is pending on the droplet. Before
   rebooting, ensure `pm2 startup systemd` was run (and its printed command executed) +
   `pm2 save`, or the app/worker won't auto-start.
3. **`scripts/reconcile-notion-bodies.ts` must NOT be run** — the linked Notion pages
   hold human/template content; A.9 already preserves them. Script is guarded.
4. **Partial fix on prod error redaction:** `inviteUser` now returns `{ok,error}` (friendly
   messages). `resendInvite`/`acceptInvite` still *throw* → show the generic toast in prod.
   Convert similarly if those errors need to read nicely.
5. **One Notion page has an empty title** → pull rejects it (`page_…_missing_title`) when
   it changes. Give it a title or archive it in Notion.
6. **Resend account is personal** (`enslinmarnus0@gmail.com`). Consider moving the verified
   domain + API key to a work-owned Resend account later (re-verify + swap key).
7. Confirm a **real invite to an arbitrary address actually delivers** now that the domain
   is verified + `EMAIL_FROM` is set (last end-to-end test not yet re-run).

---

## Done recently
- ✅ Hard-delete users (`6a9155e`), unique **Dashboard** (`969380f`), mobile shell v1 (`83c0510`).
- ✅ **A** self-serve tickets (assignee hidden for team members) + **B** mobile overhaul
  (compact KPIs, TouchSensor drag, Team table → cards) — `1b487e0`.
- ✅ **C** Hemisphere rebrand + custom logo/favicon — `63ebe3d`.
  - ⚠️ On the droplet, update the `EMAIL_FROM` *display name* to Hemisphere when convenient:
    `sed -i 's|^EMAIL_FROM=.*|EMAIL_FROM="Hemisphere <no-reply@westindustriesintl.com>"|' .env.local`
    then restart. (Sending domain stays westindustriesintl.com.)

## Next up — current build pass (resume target)

### ✅ D. Light / Dark mode toggle — DONE (`2a77a39` + polish `1ddd69c`)
next-themes class strategy; `:root` light / `.dark` dark sunset palettes; theme-aware header
(`--header`) + app background (mountain via `--bg-image-opacity`/`--app-overlay`); sun/moon
toggle in header; stronger borders both modes. Real Hemisphere logo (PNG) + wordmark gradient
also done (`7561926`/`7292789`). Bug fixes: team-board middleware + create-title (`a89a94d`).

### ✅ E. Password reset — DONE & LIVE (`6c0bf08`)
`password_resets` table (migration `0002`), request/validate/reset actions (friendly
`{ok,error}`, generic response, 1h single-use tokens), Resend reset email, `/forgot-password`
+ `/reset-password` pages, "Forgot password?" on login, both routes public in middleware.
⚠️ **Migration ownership lesson:** the table was first created via `sudo -u postgres` so it was
owned by `postgres` → app (`west_admin`) got `permission denied`. Fixed with
`ALTER TABLE password_resets OWNER TO west_admin;`. **For any future migration: apply as
`west_admin` OR `ALTER TABLE … OWNER TO west_admin` afterward.**

### F. Notifications via Resend — DEFERRED (not built)
- "You've been assigned a ticket" email on assignment.
- Deadline reminders: daily PM2 cron (reuse `west-industries-sync` pattern + a `scripts/…ts`)
  emailing assignees about tickets due within 24–48h; stamp a "reminded" field to dedupe.

### Polish / optional
- Make `resendInvite` + `acceptInvite` return friendly `{ok,error}` like `inviteUser`.
- The data **purge** (delete 3 archived test users + clear invites, keep admin + Jono) is still
  pending — backup at `/root/`. SQL: `DELETE FROM invites WHERE email <> 'justmarketme@gmail.com';`
- (LAST, only if asked) move Resend to a work-owned account.

### Backups (ops)
- ✅ **Daily on-droplet backup** — `/root/backup-db.sh` (gzip, 14-day retention) via root cron 02:15.
- **Off-server → DigitalOcean Spaces** via rclone (`dospaces:hemisphere-backups/db`, 30-day
  remote retention) — steps provided; **verify it's listing in Spaces** (`rclone ls dospaces:hemisphere-backups/db`).
- Future: was discussed but not done — the rest of off-site DR if droplet dies.

### Product overview doc
- `docs/OVERVIEW.md` — plain-English description of what Hemisphere is/does (for a PDF/marketing).

**Guardrails:** typecheck + lint + test → commit → deploy. Never build on Windows.
**Order:** A (quick) → B (mobile) → C (rebrand) → D (theme) → E (password reset) → F (notifications).

---

## How to resume
Say "resume from CHECKPOINT.md". Current pass: self-serve tickets → mobile overhaul → Hemisphere
rebrand → theme toggle → password reset → notifications.
