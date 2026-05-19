module.exports = {
  apps: [
    {
      name: "west-industries",
      script: "node",
      args: ".next/standalone/server.js",
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
      // Notion → dashboard pull worker. PM2's cron_restart restarts this
      // app on the given schedule; with autorestart:false the script runs
      // once per restart, exits, then waits for the next cron firing.
      // Override the schedule via NOTION_POLL_CRON in the env if needed.
      name: "west-industries-sync",
      script: "pnpm",
      args: "exec tsx scripts/sync-poll.ts",
      cwd: "/var/www/west-industries", // adjust to match the droplet path
      instances: 1,
      autorestart: false,
      watch: false,
      cron_restart: process.env.NOTION_POLL_CRON || "*/5 * * * *",
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
