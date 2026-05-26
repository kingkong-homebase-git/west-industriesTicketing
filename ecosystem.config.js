module.exports = {
  apps: [
    {
      name: "west-industries",
      script: "node",
      // --env-file loads .env.local into the process env BEFORE server.js runs.
      // Next's standalone server does NOT auto-load .env files at runtime, so
      // without this the app has no DATABASE_URL (pg falls back to OS user
      // "root" and fails auth) and no AUTH_TRUST_HOST (Auth.js rejects the
      // host). Node 20.6+ supports --env-file; the path is relative to cwd.
      args: "--env-file=.env.local .next/standalone/server.js",
      cwd: "/var/www/west-industries", // adjust to match the droplet path
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      // SLA reminder worker — runs on a cron, emails about tasks due within 24h,
      // then exits (idles "stopped" between ticks). Loads .env.local itself via
      // dotenv. tsx runs the TS script directly (tsx is in devDependencies).
      name: "west-industries-sla",
      script: "node_modules/.bin/tsx",
      args: "scripts/sla-reminders.ts",
      cwd: "/var/www/west-industries",
      interpreter: "none",
      instances: 1,
      autorestart: false,
      watch: false,
      cron_restart: "0 */3 * * *", // every 3 hours
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
