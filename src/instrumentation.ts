// Runs once at server startup, in each runtime. The Node-only process guards
// live in a separate module that's imported only under the nodejs runtime, so
// the Edge bundle (middleware) never includes Node APIs.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
