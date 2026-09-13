#!/usr/bin/env node
/**
 * demo-reset.mjs — Safe development-only demo data reset script.
 *
 * SAFETY: Refuses to run in NODE_ENV=production.
 * Reseeds the database with all demo scenarios, users, listings, trades, etc.
 *
 * Usage:
 *   pnpm demo:reset
 *   node scripts/demo-reset.mjs
 */

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(__dirname, "..");

// ─── Production guard ───────────────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  console.error("❌  demo:reset refused — NODE_ENV is 'production'.");
  console.error("   Demo reset is only available in development/demo environments.");
  process.exit(1);
}

if (process.env.DEMO_MODE === "false") {
  console.warn("⚠️  DEMO_MODE is 'false'. Set DEMO_MODE=true to enable demo resets.");
  console.warn("   Proceeding anyway since NODE_ENV is not 'production'...");
}

// ─── Execute seed ────────────────────────────────────────────────────────────
console.log("🔄  Starting GridTrade demo data reset...");
console.log(`   Workspace root: ${workspaceRoot}`);
console.log("   Running: pnpm db:seed");
console.log("");

const start = Date.now();

try {
  execSync("pnpm db:seed", {
    cwd: workspaceRoot,
    stdio: "inherit",
    timeout: 60_000,
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || "development" },
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log("");
  console.log(`✅  Demo reset complete in ${elapsed}s`);
  console.log("");
  console.log("Demo accounts restored:");
  console.log("  Bearer demo:prosumer  →  Aarav Mehta (PROSUMER)");
  console.log("  Bearer demo:consumer  →  Rohit Verma (CONSUMER)");
  console.log("  Bearer demo:utility   →  State Grid Control (UTILITY)");
  console.log("  Bearer demo:regulator →  Central Electricity Regulator (REGULATOR)");
  console.log("  Bearer demo:admin     →  Platform Admin (ADMIN)");
  console.log("");
  console.log("Grid scenario: SUNNY_SURPLUS (default)");
  console.log("Listings: Active marketplace listings restored");
  console.log("Grid data: Fresh readings seeded");
} catch (error) {
  console.error("");
  console.error("❌  Demo reset failed:", error.message);
  process.exit(1);
}
