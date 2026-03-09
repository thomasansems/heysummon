/**
 * Next.js instrumentation hook — runs once on server startup.
 * Used for startup checks and background initialization.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runStartupCheck } = await import("./src/lib/startup-check");
    await runStartupCheck();
  }
}
