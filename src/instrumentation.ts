/**
 * Next.js instrumentation file.
 * Runs once on server startup (both dev and production).
 * Used to start background jobs.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startRetentionJob } = await import("./lib/retention");
    startRetentionJob();
  }
}
