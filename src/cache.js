import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, "..", "cache");

async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch {}
}

function cacheKey(handle) {
  return path.join(CACHE_DIR, `${handle.toLowerCase().replace(/[^a-z0-9_]/g, "_")}.json`);
}

export async function getCached(handle) {
  try {
    const file = await fs.readFile(cacheKey(handle), "utf-8");
    const data = JSON.parse(file);
    // Cache valid for 1 hour
    if (Date.now() - data.cachedAt < 3600 * 1000) {
      console.log(`[Cache] HIT for @${handle}`);
      return data.report;
    }
    console.log(`[Cache] STALE for @${handle}, re-running`);
    return null;
  } catch {
    return null;
  }
}

export async function setCached(handle, report) {
  await ensureCacheDir();
  await fs.writeFile(
    cacheKey(handle),
    JSON.stringify({ cachedAt: Date.now(), report }, null, 2)
  );
  console.log(`[Cache] Saved report for @${handle}`);
}

export async function listCached() {
  await ensureCacheDir();
  try {
    const files = await fs.readdir(CACHE_DIR);
    const results = [];
    for (const f of files.filter((x) => x.endsWith(".json"))) {
      const raw = JSON.parse(await fs.readFile(path.join(CACHE_DIR, f), "utf-8"));
      results.push({
        handle: raw.report?.handle || f.replace(".json", ""),
        score: raw.report?.overall_score,
        risk_level: raw.report?.risk_level,
        cachedAt: new Date(raw.cachedAt).toISOString(),
      });
    }
    return results;
  } catch {
    return [];
  }
}
