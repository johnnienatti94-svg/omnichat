import * as schema from "./schema";

export function getDb() {
  const globalContext = globalThis as any;
  const dbBinding = globalContext.env?.DB || globalContext.process?.env?.DB;

  if (!dbBinding) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. In production with Supabase, database operations are managed via the Supabase repository."
    );
  }

  // Dynamic import/require to prevent bundling errors on standard Node.js / Vercel
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/d1");
    return drizzle(dbBinding, { schema });
  } catch {
    throw new Error("drizzle-orm/d1 is only available in Cloudflare Workers runtime.");
  }
}
