#!/usr/bin/env node
/**
 * pre-cache.js — Run this BEFORE your demo to seed cached reports
 * Usage: node pre-cache.js mrbeast charlidamelio mkbhd
 */
import "dotenv/config";
import { scrapeCreator } from "./src/scraper.js";
import { analyzeThreats } from "./src/analyzer.js";
import { setCached } from "./src/cache.js";

const handles = process.argv.slice(2);

if (handles.length === 0) {
  console.error("Usage: node pre-cache.js <handle1> [handle2] ...");
  process.exit(1);
}

for (const handle of handles) {
  const clean = handle.replace(/^@/, "").trim().toLowerCase();
  console.log(`\n[Pre-cache] Scanning @${clean}...`);
  try {
    const scrapedData = await scrapeCreator(clean);
    const report = await analyzeThreats(clean, scrapedData);
    const fullReport = {
      ...report,
      handle: clean,
      scrapedAt: new Date().toISOString(),
    };
    await setCached(clean, fullReport);
    console.log(
      `[Pre-cache] ✓ @${clean} cached — score: ${fullReport.overall_score} (${fullReport.risk_level})`
    );
  } catch (err) {
    console.error(`[Pre-cache] ✗ @${clean} failed: ${err.message}`);
  }
}

console.log("\n[Pre-cache] All done. Start the server and demo creators will load instantly.");
process.exit(0);
