import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { scrapeCreator } from "./scraper.js";
import { analyzeThreats } from "./analyzer.js";
import { getCached, setCached, listCached } from "./cache.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// ── POST /api/analyze — main endpoint ──
app.post("/api/analyze", async (req, res) => {
  const { handle, forceRefresh = false } = req.body;

  if (!handle || typeof handle !== "string") {
    return res.status(400).json({ error: "handle is required" });
  }

  const clean = handle.replace(/^@/, "").trim().toLowerCase();

  if (!clean) {
    return res.status(400).json({ error: "Invalid handle" });
  }

  // Check cache unless force refresh requested
  if (!forceRefresh) {
    const cached = await getCached(clean);
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }
  }

  try {
    // Stream progress via SSE is ideal, but for hackathon speed use polling
    console.log(`\n========== ANALYZING @${clean} ==========`);

    const scrapedData = await scrapeCreator(clean);
    const report = await analyzeThreats(clean, scrapedData);

    const fullReport = {
      ...report,
      handle: clean,
      scrapedAt: new Date().toISOString(),
      fromCache: false,
    };

    await setCached(clean, fullReport);
    res.json(fullReport);
  } catch (err) {
    console.error("Analysis failed:", err);
    res.status(500).json({ error: err.message || "Analysis failed" });
  }
});

// ── GET /api/cached — list pre-run reports for demo ──
app.get("/api/cached", async (req, res) => {
  const list = await listCached();
  res.json(list);
});

// ── GET /api/cached/:handle — load a specific cached report ──
app.get("/api/cached/:handle", async (req, res) => {
  const cached = await getCached(req.params.handle);
  if (!cached) return res.status(404).json({ error: "Not found" });
  res.json({ ...cached, fromCache: true });
});

// ── Health check ──
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    apify: !!process.env.APIFY_TOKEN,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
  });
});

app.listen(PORT, () => {
  console.log(`\nCreatorShield running at http://localhost:${PORT}`);
  console.log(`Apify token: ${process.env.APIFY_TOKEN ? "✓ set" : "✗ MISSING"}`);
  console.log(`Anthropic key: ${process.env.ANTHROPIC_API_KEY ? "✓ set" : "✗ MISSING"}\n`);
});
