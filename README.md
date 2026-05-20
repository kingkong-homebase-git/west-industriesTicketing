# West Industries Dashboard

Internal operations dashboard (v1: Tasks system). Built with Next.js 15, App Router, Tailwind CSS (v4), shadcn/ui, Drizzle ORM, and PostgreSQL.

## Prerequisites
- Node.js 20+
- pnpm (or npm/yarn)
- PostgreSQL 15+

## Local Development Setup

1. **Clone and Install**
   ```bash
   git clone <repo-url>
   cd app
   pnpm install
   ```

2. **Environment Variables**
   ```bash
   cp .env.example .env.local
   ```
   *Edit `.env.local` to match your local PostgreSQL setup. Generate `AUTH_SECRET` using `openssl rand -base64 32`.*

3. **Database Migration & Seeding**
   ```bash
   pnpm exec drizzle-kit generate
   pnpm exec drizzle-kit migrate
   pnpm exec tsx scripts/seed.ts
   ```

4. **Run Development Server**
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Drizzle Commands
- `pnpm exec drizzle-kit generate` - Generate SQL migration files
- `pnpm exec drizzle-kit migrate` - Apply migrations to the database
- `pnpm exec drizzle-kit studio` - Open visual database viewer
- `pnpm exec tsx scripts/seed.ts` - Run seed script to create initial admin user

## Environment Variables Breakdown
- `DATABASE_URL`: Connection string for PostgreSQL database.
- `AUTH_SECRET`: Used to encrypt the NextAuth.js JWT.
- `AUTH_URL`: The URL where the application is hosted (e.g., `https://dashboard.example.com`).
- `AUTH_TRUST_HOST`: Set to `true` so Auth.js trusts the host when running on a bare IP/host or behind a proxy (required in production; otherwise `/api/auth/*` throws `UntrustedHost`).
- `SEED_ADMIN_EMAIL`: Email for the initial `super_user`.
- `SEED_ADMIN_PASSWORD`: Password for the initial `super_user`.
- `NODE_ENV`: Set to `production` when deployed.

### Notion sync
- `NOTION_TOKEN`: Internal-integration secret from `https://www.notion.so/profile/integrations`. The integration must be connected to the Tasks database page (open the DB → `⋯` → Connections → add).
- `NOTION_DATABASE_ID`: 32-hex chunk before `?v=` in the Notion database URL. Resolved internally to a primary data source ID (Notion API 2025-09-03).
- `NOTION_SYNC_ENABLED`: Kill switch. Set to `false` to disable all push/pull. Defaults to `true`. When false, `pushTicketToNotion` and `pullAllFromNotion` no-op silently.
- `NOTION_POLL_CRON`: Cron schedule for the PM2 sync worker (`west-industries-sync` app in `ecosystem.config.js`). Default `*/5 * * * *` (every 5 minutes).

### Email (Resend)
Invites are delivered via [Resend](https://resend.com) over HTTPS (port 443) so they work where outbound SMTP is blocked (e.g. DigitalOcean droplets block SMTP egress). Email failures are non-fatal: the invite + accept link are still created and logged.
- `RESEND_API_KEY`: API key from `https://resend.com/api-keys`. If unset, invite emails are skipped (link still logged to the server console).
- `EMAIL_FROM`: Sender address. Without a verified domain use `onboarding@resend.dev` (delivers only to your own Resend account email). With a verified domain: e.g. `West Industries <no-reply@yourdomain.com>`.

## Deployment (PM2 & Nginx)

1. **Production Build**
   ```bash
   pnpm build
   ```

2. **PM2 Setup**
   Ensure `ecosystem.config.js` `cwd` matches your deployment path in **both** app entries (`west-industries` and `west-industries-sync`).
   ```bash
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup
   ```
   This launches two apps:
   - `west-industries` — the Next.js server on port 3000.
   - `west-industries-sync` — the Notion poll worker. Runs once per `cron_restart` firing (default every 5 min via `NOTION_POLL_CRON`), then exits. The script is invoked directly via `./node_modules/.bin/tsx` so PM2 doesn't need `pnpm` on its PATH. `tsx` is a regular dependency (not a devDependency) so production installs keep it.
   - Confirm both came up: `pm2 list` should show two running entries.
   - Tail the sync worker: `pm2 logs west-industries-sync`.

3. **Nginx Reverse Proxy Snippet**
   ```nginx
   server {
       server_name dashboard.example.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **SSL (Let's Encrypt)**
   ```bash
   sudo certbot --nginx -d dashboard.example.com
   ```

## Roles Overview

| Capability | `super_user` | `team_member` |
| --- | --- | --- |
| View Tasks | ✅ | ✅ |
| Create Task | ✅ | ❌ |
| Edit Details (Title, Desc, etc.) | ✅ | ❌ |
| Update Status | ✅ Full range | ❌ |
| Delete Task | ✅ | ❌ |
| Manage Checklist | ✅ Full CRUD, reorder | ✅ Toggle done only |
| Add Comments | ✅ | ✅ |
| Manage Team | ✅ | ❌ |

Ticket statuses mirror the Notion workspace exactly: `not_started`, `on_track`, `behind`, `at_risk`, `reprioritized`, `accomplished`, `failed`.
