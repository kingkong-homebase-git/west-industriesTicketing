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

### origin/main = `bb48564` (droplet deployed at this commit)
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

## Next up — three new feature requests (resume target)

### 1. Permanently delete users (hard delete, any state)
Today users can only be **archived** (soft delete). Add a true **Delete** that removes the
user from the DB regardless of state (active *or* archived).
- Add `deleteUser(userId)` in `src/actions/users.ts` + a **Delete** button in
  `src/components/team/TeamTable.tsx` (confirm dialog; show for active *and* archived rows).
- Handle foreign keys before deleting: `tickets.assignee_id` / `tickets.creator_id` and
  `comments.author_id` reference the user — null out assignee/creator (keep the tickets;
  comments already `set null`). Don't let the delete throw on an FK constraint.
- **Guards (server-side):** never delete yourself, never delete the last active
  `super_user`, keep protecting `admin@westindustries.com`.
- Keep archive/restore as-is; Delete is the new permanent option.

### 2. Purge the bad test invite/user data in production
Keep only **Jono Jettoo (`justmarketme@gmail.com`)** and the **Super Admin
(`admin@westindustries.com`)**. Remove everyone/everything else — incl.
`enslinmarnus0@gmail.com` (Marnusq, archived), `william.alexander.mcdonald@gmail.com`
(archived), `perseverancezengele08@gmail.com` (pending Admin invite), and any other stale
rows in `users` and `invites`.
- Use the new hard-delete UI **and** clear leftover `invites` rows (pending/expired) so no
  orphaned invites remain.
- **Take a `pg_dump` backup first** — irreversible.

### 3. Mobile-first responsive redesign + collapsible side panel
UI is currently desktop-only. Rework mobile-first while keeping desktop polished.
- **Sidebar:** collapse/minimize toggle on **desktop** (icon-only rail ⇄ full) + a
  **hamburger drawer** on **mobile** (off-canvas overlay, closes on nav). Persist the
  desktop collapsed state.
- **Layout:** mobile-first breakpoints throughout — header/stat cards, Kanban, Team table,
  slide-over all reflow cleanly on small screens.
- **Kanban:** usable on mobile (horizontal scroll/snap); ensure `@dnd-kit` drag works with
  touch (PointerSensor + appropriate `touch-action`).
- **Team table → cards on mobile** so actions stay reachable.
- **Slide-over / dialogs:** full-width / bottom-sheet on mobile.
- Keep the glassmorphism look; don't regress desktop.

**Guardrails:** hard delete + the purge are destructive/irreversible — **backup first**.
Each change: typecheck + lint + test, commit, deploy via the recipe.

Suggested order: #1 (hard delete) → use it for #2's cleanup → then #3 (mobile) as its own pass.

---

## How to resume
Say "resume from CHECKPOINT.md". Then start at feature #1 (hard delete).
