# Checkpoint — 2026-05-19 evening

Resume target: **Workstream B (B.1 → B.6)**, the email-invite hardening.

---

## Where we are

Workstream A (Notion two-way sync) is **complete and verified live against
production**. End-to-end push round-trip works.

### Commits since divergence from origin/main (oldest first)
- `bd34bcb` — schema + initial generated migration + npm deps
- `6b0c418` — A.1 fixes + A.2 (notion client, mappers, consumer updates)
- `f0be876` — A.3 (dashboard → Notion push)
- `1699efa` — A.4 + A.5 (pull, PM2 cron worker, manual trigger)
- `54d445d` — A.6 + A.7 + A.8 (admin UI, env vars, vitest suite)
- `<checkpoint commit>` — smoke-test scripts + this file

`pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` all clean.

### Production DB state (verified end of session)
- 10 tickets, all linked to Notion pages
- All have `notion_sync_status = 'synced'`
- 12 sync_logs rows (10 inserts + 1 expected failure for the empty-title
  Notion row + 1 batch-summary row + push smoke test entries from the run)
- `sync_state.last_poll_at` is set, `last_poll_status='success'`

### Production Notion state
- 11 pages in the Key Initiatives database
- 10 of those are linked to dashboard tickets
- 1 page has an empty title — pull rejects it with `page_<id>_missing_title`
  every poll cycle. **Either give it a title or archive it in Notion before
  the next poll**, or accept one failure row per 5 minutes.

### What's running on the droplet right now
- `west-industries` (main Next.js app on port 3000) — **not yet rebuilt with
  the new code**. The deployed app is still the pre-A code.
- `west-industries-sync` (PM2 cron worker) — **does not exist on the
  droplet yet**. Defined in `ecosystem.config.js` but never started there.

So sync is **only working from your laptop right now**. Push won't fire
from end-user actions until you deploy.

---

## What to do FIRST tomorrow (before any B work)

### 1. Deploy A to the droplet

```bash
# On the droplet, in the app directory:
git pull
pnpm install
pnpm build
pm2 reload ecosystem.config.js --update-env
pm2 save
pm2 list                                # confirm both apps listed
pm2 logs west-industries-sync --lines 50  # tail one cron firing
```

The `cwd` in `ecosystem.config.js` is currently `/var/www/west-industries`.
If your real deploy path differs, edit both entries before `pm2 reload`.

### 2. Verify the cron worker fires
Wait 5 minutes after `pm2 reload`, then run on the droplet:
```bash
psql -U west_admin -d west_industries -c \
  "SELECT direction, status, error_message, created_at FROM sync_logs ORDER BY created_at DESC LIMIT 5"
```
You should see a fresh `pull / success` row from the worker.

### 3. (Optional, recommended) Take a fresh DB backup
The existing backup at `/tmp/west_industries_backup_20260519_144227.sql`
is from BEFORE we wiped local test tickets. To snapshot the current
post-sync state:
```bash
sudo -u postgres pg_dump -d west_industries -F p \
  > /tmp/west_industries_backup_$(date +%Y%m%d_%H%M%S).sql
ls -lh /tmp/west_industries_backup_*.sql
```

---

## Open landmines (read before resuming)

1. **Push wipes rich Notion body content.** First push from dashboard to
   any Notion page deletes ALL existing body blocks and replaces with our
   structured layout (description paragraphs + Checklist heading + Comments
   heading). If any of the 10 linked pages have bullet lists, headings,
   embeds, or callouts in the body, **those are destroyed on first edit**.
   Decision needed: do we leave this as designed, or refactor push.ts to
   preserve unknown block types?

2. **`cwd` in `ecosystem.config.js`** is `/var/www/west-industries` in two
   places. Confirm or update before redeploying.

3. **Per-process rate limiter** is fine at current scale; revisit if
   `sync_logs` shows Notion 429 errors.

4. **3.5s sync-status race in the kanban toast** is UX-only; defer until
   users complain.

---

## Resume: Workstream B (email invites)

The prompt's plan, restated here so we don't have to re-derive it.

### B.1 — SMTP env vars validated at boot
In `src/lib/email.ts`, read and validate:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`,
  `SMTP_FROM`
If any missing AND `NODE_ENV=production` → throw at boot. In dev, warn and
fall back to nodemailer's stream transport. Add a `previewEmail()` helper
that returns rendered HTML. Update `.env.example` + README.

### B.2 — Styled invite email template
Create `src/lib/email/templates/invite.tsx` — small React component
rendered via `react-dom/server.renderToStaticMarkup`. Inline CSS only.
Table-based CTA button for Outlook. Plain-text fallback. Hook into
`sendInviteEmail`. Add dev-only `src/app/api/dev/email-preview/route.ts`
for visual review.

### B.3 — Accept-invite page handles all error states
`src/app/(auth)/accept-invite/page.tsx`. Four cases:
- token missing
- token invalid / revoked
- already accepted
- expired (show inviter name)
- valid → existing password form

All use the same shadcn Card shell with `lucide-react` icon + single CTA.

### B.4 — Pending invites table + resend / cancel
- New `PendingInvitesTable` on `/team` showing email, role, invited-by,
  invited-at, expires-in, status
- 3-dot menu per row: Resend (regenerates token + expires_at) / Cancel
- Verify `resendInvite` regenerates the token (old becomes invalid)

### B.5 — Expiry warning
Two pieces:
1. In-app banner on `/team` for invites expiring < 24h
2. Daily cron `scripts/invite-expiry-warn.ts`:
   - Selects invites expiring within 24h with `warning_sent_at IS NULL`
   - Sends `inviteExpiryWarning` email to the inviter
   - Stamps `warning_sent_at`
   - PM2 cron once daily 09:00 UTC
3. **New migration**: add `invites.warning_sent_at timestamptz NULL`

### B.6 — Expiry-warning email template
Same skeleton as B.2's invite template, different body copy.

Each subsection ends with: typecheck + lint + commit.

---

## How to talk to me tomorrow

1. Paste this file (or just say "resume from CHECKPOINT.md").
2. Confirm whether A is deployed yet (step 1 above).
3. Tell me which decision you made on landmine #9 (rich body content) —
   "leave it" or "refactor to preserve".
4. Then we start at B.1.
