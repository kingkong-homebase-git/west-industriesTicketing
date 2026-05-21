# Checkpoint — 2026-05-20 (late)

Resume target: **three new feature requests** — hard-delete users, purge bad
test data, and a mobile-first responsive redesign (see "Next up" at the bottom).
Everything above that is the verified-live current state.

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
- ✅ Hard-delete users (`6a9155e`), unique **Dashboard** (`969380f`), mobile shell v1:
  collapsible sidebar + drawer (`83c0510`).

## Next up — current build pass (resume target)

### A. Team-member self-serve tickets — hide assignee in create (quick unblock)
Team members are blocked creating tickets (assignee step). In `TicketForm`, hide the Assignee
field for non-privileged users in **create mode** (don't render a disabled control); server
already forces `assigneeId = self` (`createTicket`). Privileged keep the picker. Verify with a
real team_member: create → succeeds → appears in My Tasks.

### B. Mobile overhaul — make it genuinely good (feels too "zoomed in" now)
- Density: smaller padding/font/card heights on mobile; My Tasks KPI cards are huge → compact
  (tight 2×2 or slim scrollable stat strip); scale type down a step at `sm`.
- Kanban touch DnD: `touch-action` on cards + `@dnd-kit` TouchSensor/activation tuning (drag vs scroll).
- Team table → **card stacks** on mobile (keep table on desktop).
- Tap targets ≥40px, no horizontal overflow, dialogs/slide-over as bottom-sheets.

### C. Rebrand to "Hemisphere" + custom logo (UI/product name only)
Replace visible "West Industries" → **Hemisphere** with a distinctive SVG logo (hemisphere /
half-globe, gradient, glow, works in both themes + favicon): header, sidebar (rail + drawer),
login/accept-invite, `<title>`/metadata, invite email template (`src/lib/email.ts`) + `EMAIL_FROM`
display name. **Leave infra unchanged** (domain `westindustriesintl.com`, `admin@westindustries.com`,
Notion DB, env vars) — UI rename only.

### D. Light / Dark mode toggle (header)
Add light theme tokens (premium, not flat) alongside the dark ones in `globals.css`; sun/moon
toggle in the header; persist + respect system pref; no flash on load (`next-themes` or manual
`data-theme` + localStorage). Ensure glass/dashboard/charts/bg image read well in both.

### E. Password reset / "forgot password"
No self-serve reset exists. "Forgot password" on `/login` → time-limited reset link via Resend →
set-new-password page → sign in. Mirror the invite-token pattern; friendly `{ok,error}`.

### F. Notifications via Resend
- "You've been assigned a ticket" email on assignment.
- Deadline reminders: daily PM2 cron (reuse `west-industries-sync` pattern + a `scripts/…ts`)
  emailing assignees about tickets due within 24–48h; stamp a "reminded" field to dedupe.

### Polish / optional
- Make `resendInvite` + `acceptInvite` return friendly `{ok,error}` like `inviteUser`.
- The data **purge** (delete 3 archived test users + clear invites, keep admin + Jono) is still
  pending — backup at `/root/`. SQL: `DELETE FROM invites WHERE email <> 'justmarketme@gmail.com';`
- (LAST, only if asked) move Resend to a work-owned account.

**Guardrails:** typecheck + lint + test → commit → deploy. Never build on Windows.
**Order:** A (quick) → B (mobile) → C (rebrand) → D (theme) → E (password reset) → F (notifications).

---

## How to resume
Say "resume from CHECKPOINT.md". Current pass: self-serve tickets → mobile overhaul → Hemisphere
rebrand → theme toggle → password reset → notifications.
