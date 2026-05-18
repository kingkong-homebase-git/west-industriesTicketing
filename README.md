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
- `SEED_ADMIN_EMAIL`: Email for the initial `super_user`.
- `SEED_ADMIN_PASSWORD`: Password for the initial `super_user`.
- `NODE_ENV`: Set to `production` when deployed.

## Deployment (PM2 & Nginx)

1. **Production Build**
   ```bash
   pnpm build
   ```

2. **PM2 Setup**
   Ensure `ecosystem.config.js` `cwd` matches your deployment path.
   ```bash
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup
   ```

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
| Update Status | ✅ Full range | ✅ Only `In Progress` → `Review` (Own tickets) |
| Delete Task | ✅ | ❌ |
| Manage Checklist | ✅ Full CRUD, reorder | ✅ Toggle done only |
| Add Comments | ✅ | ✅ |
| Manage Team | ✅ | ❌ |
