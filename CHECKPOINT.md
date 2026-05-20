# Checkpoint — 2026-05-20

Resume target: **three new feature requests** (see "Next up" at the bottom).
Everything below "Where we are" is the verified-live current state.

---

## Where we are

**Workstream A (Notion two-way sync) is fully deployed and verified live for the
first time**, and the **email/invite system now works via Resend.** This session
turned out to be the *first real deployment of Workstream A* — the droplet had
been running pre-A code (`d072453`) the whole time; A was on GitHub but never
pulled/built/started on the server.

### origin/main = `44cf923` (droplet is deployed at this commit)
Commits added this session (oldest first):
- `374b690` — A.9: push preserves human Notion body content (managed-section marker)
- `770a946` — A.9: one-shot reconcile script (now guarded; **do not run** — see below)
- `8b38e29` — fix: sync-poll loads env before importing notion (tsx CJS hoisting crash)
- `865ba26` — fix(pm2): force `exec_mode:"fork"` for the sync worker
- `23c9dd0` — fix(pm2): run `.bin/tsx` via `interpreter:"none"` (not node)
- `c896540` — safety: guard reconcile script against wiping human content
- `db651a8` — fix(pm2): load `.env.local` into the standalone app via `--env-file`
- `df96d97` — fix(build): `postbuild` copies `.next/static` + `public` into standalone
- `44cf923` — feat(email): invites via Resend over HTTPS, non-fatal on failure

`tsc --noEmit`, `lint`, and `test` (17 passing) are all clean.

### Live environment
- App: **http://104.248.162.39:3000** (bare IP, plain HTTP, `NODE_ENV=production`).
- Droplet path: `/var/www/west-industries`. DB user: `west_admin`, db `west_industries`.
- Auth works over HTTP because `AUTH_URL` is `http://…` (→ non-secure cookies) and
  `AUTH_TRUST_HOST="true"` is set.
- **PM2 (`pm2 save`d):**
  - `west-industries` — main Next.js app, fork mode, started as
    `node --env-file=.env.local .next/standalone/server.js`.
  - `west-industries-sync` — pull worker, fork mode, `interpreter:"none"`,
    `cron_restart */5`, runs once per tick then sits `stopped` (correct idle state).

### Verified working
- **Notion pull**: worker fires every 5 min, `last_poll_status=success`. Pull is
  incremental (filters `last_edited_time >= last_poll_at`), so `pages=N` only counts
  pages changed since the last poll — `pages=0/1` is normal, not a bug.
- **Notion push**: editing a ticket writes `push/success` rows; A.9 appends our
  managed section **below** existing page content without deleting it.
- **Email**: a styled invite email was delivered to a Gmail inbox via Resend.

---

## Deploy recipe (use this every time)
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
- **Do NOT** pass `--update-env` to the main app — it refreshes PM2's env from the
  shell and clobbers the vars (the app gets them via `--env-file`, not PM2).
- **Do NOT** run `pnpm build` on Windows — Next standalone symlinking fails with
  `EPERM`. Build on the droplet (Linux) only.
- **No DB migration** is needed on deploy — the prod schema is already current.

---

## Open landmines / follow-ups (read before resuming)

1. **Secrets were exposed in a screenshot** (full `.env.local`). Rotate when
   convenient: `AUTH_SECRET`, `RESEND_API_KEY`, `NOTION_TOKEN`, the DB password,
   and the Gmail app password.
2. **Resend has no verified domain.** With the shared `onboarding@resend.dev`
   sender, invites only deliver to *your own Resend account email*. Sending to any
   other recipient returns a Resend error (handled gracefully = amber warning, no
   crash). **A verified domain is required to invite arbitrary people** — this is
   feature request #1 below.
3. **Production redacts thrown server-action error messages.** Validation errors
   (duplicate/expired/invalid invite) surface as the generic "An error occurred in
   the Server Components render…" toast instead of a friendly message. Fix by
   *returning* errors as values rather than throwing.
4. **`scripts/reconcile-notion-bodies.ts` must NOT be run.** The 9 linked Notion
   pages hold rich human/template content (headings, callouts, bullet lists), not
   old machine output. A.9's push already preserves them. The script is guarded
   (refuses to wipe non-machine blocks) but leave it alone.
5. **App is bare HTTP on an IP** with no domain/TLS. Fine for now; needed for
   real production + for Resend domain verification.
6. **One Notion page has an empty title** → pull rejects it (`page_…_missing_title`)
   when it changes. Give it a title or archive it to avoid the occasional error row.
7. The old `SMTP_*` vars in `.env.local` are now unused (code uses Resend only).

---

## Next up — three new feature requests (the resume target)

### 0. Prerequisites (do these before / alongside #1)
- **Point a domain at the app + add HTTPS** (currently bare `http://IP:3000`).
  Required for Resend domain verification and to clear the "Not secure" warning.
- **Rotate the secrets** exposed in the screenshot: `AUTH_SECRET`,
  `RESEND_API_KEY`, `NOTION_TOKEN`, DB password, Gmail app password.

### 1. Open invitations — invite anyone, zero-friction onboarding
**Gated on the domain (#0):** Resend will not deliver to arbitrary recipients
until a sending domain is verified.
Invite any email address; recipient receives the styled email → clicks Accept →
sets a password → is logged in with access. No manual steps.
- Verify a sending domain in Resend (DNS records) so arbitrary recipients get mail;
  update `EMAIL_FROM` to a domain address.
- Verify the full new-user flow end-to-end: accept-invite → set password →
  auto sign-in → dashboard.
- Address landmine #3 so invite validation errors show friendly messages.

### 2. Team members can create their own tickets in "My Tasks"
Allow `role=team_member` to create tickets that appear under their own "My Tasks".
- Permit ticket creation for team members (check current role gating in
  `src/actions/tickets.ts` and the create UI).
- Auto-assign new tickets to the creator so they land in "My Tasks"
  (which filters by `assignee_id`).
- **Org visibility:** those same tickets must also appear in the org-wide
  "Tasks"/Team board so the whole org can see them (not only the creator).

### 3. Admin can remove users from "My Team"
Add a super-user/admin action in the Team UI to remove (deactivate or delete) a user.
- Add Remove to the team table (`src/components/team/TeamTable.tsx`).
- Decide deactivate vs hard-delete; reassign or null their tickets gracefully.
- Guard against removing yourself or the last `super_user`.

---

## How to resume
Say "resume from CHECKPOINT.md". Confirm whether you've (a) rotated the exposed
secrets and (b) verified a Resend domain, then we start on feature #1.
