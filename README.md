# GhostPrint

**Know your exposure, Own your privacy.**

Influencer privacy threat scanner powered by 8 Apify Actors + Claude AI. Scrapes Instagram, TikTok, Twitter/X, YouTube, LinkedIn, Google Search, Google News, and bio-linked websites in parallel — then uses Claude to classify threats into 4 categories with verbatim evidence and actionable fixes.

---

## Quick start (3 minutes)

### 1. Install dependencies
```bash
npm install
```

### 2. Add your API keys
```bash
cp .env.example .env
```
Edit `.env` and fill in:
- `APIFY_TOKEN` — from https://console.apify.com/account/integrations
- `ANTHROPIC_API_KEY` — from https://console.anthropic.com

### 3. (Recommended) Pre-cache demo creators before presenting
```bash
node pre-cache.js mrbeast charlidamelio mkbhd
```
This runs the full scan for each handle and saves results to `/cache`. Demo chips on the UI will then load instantly.

### 4. Start the server
```bash
npm start
```
Open http://localhost:3000

---

## How it works

```
User enters @handle
       │
       ▼
8 Apify Actors fire in parallel (Promise.allSettled)
  1. apify/instagram-scraper          → bio, captions, tagged locations
  2. clockworks/tiktok-scraper        → captions, bio link, region
  3. apidojo/tweet-scraper-v2         → tweets, replies, location field
  4. streamers/youtube-scraper        → descriptions, channel location
  5. apify/google-search-scraper      → 3 privacy-targeted queries
  6. misceres/google-news             → press articles, scam reports
  7. apify/website-content-crawler    → bio-linked sites (Linktree etc.)
  8. bebity/linkedin-profile-scraper  → headline, location, employer, education
       │
       ▼
Normalize → single JSON payload (text only, capped at ~9k tokens)
       │
       ▼
Claude threat analysis → 4 scored categories + verbatim evidence
  • Location exposure
  • Dox surface area
  • Breach exposure
  • Impersonation risk
       │
       ▼
Full-page privacy report + remediation checklist
```

---

## Report features

- **Threats tab** — 4 scored threat categories with verbatim evidence and fix checklist
- **Platforms tab** — direct profile links for all 8 scraped platforms (Instagram, TikTok, Twitter/X, YouTube, LinkedIn, Google Search, Google News, Bio Website)
- **Light / dark mode** — auto-detects system preference, persisted to localStorage
- **Download** — export full report as JSON

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/analyze` | Run full scan. Body: `{ "handle": "mrbeast" }` |
| `GET` | `/api/cached` | List all cached reports |
| `GET` | `/api/cached/:handle` | Load specific cached report |
| `GET` | `/api/health` | Check API key configuration |

---

## Competitive advantage over existing tools

| Tool | What it misses |
|------|----------------|
| Talkwalker / Brand24 | Brand monitoring for brands, no creator privacy angle |
| HaveIBeenPwned | Single signal only (email breaches) |
| PimEyes | Image search only |
| Jumbo / PrivacyBee | Generic consumer, not creator-specific |
| Maltego / Social Links | $500+/mo enterprise tools, not self-serve |

**GhostPrint is the only self-serve, creator-first, multi-platform privacy scanner that explains threats in plain English with specific evidence from your own content.**

---

## Project structure

```
ghostprint/
├── src/
│   ├── server.js       — Express API server
│   ├── scraper.js      — 8 Apify Actor calls (parallel)
│   ├── analyzer.js     — Claude threat classification
│   └── cache.js        — File-based result caching
├── public/
│   └── index.html      — Full-page dashboard UI (single file)
├── cache/              — Auto-created, stores JSON reports
├── pre-cache.js        — Demo prep script
├── package.json
├── .env.example
└── README.md
```

---

## Hackathon demo tips

1. Run `node pre-cache.js` on 2-3 creators the night before
2. On stage: enter a creator name the judge suggests — their report will appear live via cache
3. Point out a real evidence quote from the scrape: "This exact caption from their Instagram is what gives away their neighborhood"
4. Pitch line: *"Every privacy tool was built for IT teams. Creators have a unique problem — being public is their job. GhostPrint is the first scanner that understands that."*
