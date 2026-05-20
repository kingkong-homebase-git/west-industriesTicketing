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
      // Notion → dashboard pull worker. PM2's cron_restart restarts this
      // app on the given schedule; with autorestart:false the script runs
      // once per restart, exits, then waits for the next cron firing.
      // Override the schedule via NOTION_POLL_CRON in the env if needed.
      //
      // We invoke ./node_modules/.bin/tsx directly rather than going
      // through `pnpm exec` so this works regardless of whether pnpm is
      // on PM2's PATH. tsx must remain a regular dependency (not devDep)
      // so production deploys keep it installed.
      name: "west-industries-sync",
      script: "./node_modules/.bin/tsx",
      args: "scripts/sync-poll.ts",
      cwd: "/var/www/west-industries", // adjust to match the droplet path
      // .bin/tsx is a /bin/sh shim, not JS. interpreter:"none" makes PM2 exec
      // it directly via its shebang; without this PM2 wraps it in node and
      // throws "SyntaxError: missing ) after argument list" on the shell code.
      interpreter: "none",
      // fork mode is required: this is a one-shot script that runs and exits.
      // Cluster mode (Node's cluster.fork, for long-running servers sharing a
      // port) does not execute a tsx one-shot — PM2 reports it "online" but the
      // script never runs. Do NOT add `instances`, which can flip PM2 to
      // cluster mode.
      exec_mode: "fork",
      autorestart: false,
      watch: false,
      cron_restart: process.env.NOTION_POLL_CRON || "*/5 * * * *",
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
