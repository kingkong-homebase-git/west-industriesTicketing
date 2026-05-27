// Runs once at server startup (Node runtime). Installs process-level guards so
// that benign aborted client connections don't crash the standalone server.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Clients (browsers, health checks, scanners) dropping a connection mid-
  // request surface as an uncaught `ECONNRESET` / "aborted" error in Next's
  // standalone server. With no handler, Node treats it as fatal and exits,
  // which made PM2 restart the app repeatedly. Swallow only those benign cases;
  // genuine uncaught errors still crash so PM2 can restart on a real fault.
  process.on("uncaughtException", (err: NodeJS.ErrnoException) => {
    if (err?.code === "ECONNRESET" || err?.message === "aborted") {
      console.warn("[ignored] aborted client connection");
      return;
    }
    console.error("[fatal] uncaughtException:", err);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[unhandledRejection]", reason);
  });
}
