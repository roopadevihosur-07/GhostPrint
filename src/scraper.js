import { ApifyClient } from "apify-client";

const apify = new ApifyClient({ token: process.env.APIFY_TOKEN });

// ── Generic Actor runner with timeout + error isolation ──
async function runActor(actorId, input, limitItems = 30) {
  try {
    console.log(`  → Starting ${actorId}...`);
    const run = await apify.actor(actorId).call(input, { waitSecs: 45 });
    const { items } = await apify
      .dataset(run.defaultDatasetId)
      .listItems({ limit: limitItems });
    console.log(`  ✓ ${actorId} returned ${items.length} items`);
    return items;
  } catch (e) {
    console.warn(`  ✗ ${actorId} failed: ${e.message}`);
    return [];
  }
}

// ── Extract bio links from IG + TikTok for website crawl ──
function extractBioLinks(igItems, ttItems) {
  const links = [];
  for (const p of igItems) {
    if (p.externalUrl) links.push(p.externalUrl);
  }
  for (const p of ttItems) {
    const link = p.authorMeta?.bioLink?.link;
    if (link) links.push(link);
  }
  return [...new Set(links)].slice(0, 3);
}

// ── Main scrape function: fires all 8 Actors ──
export async function scrapeCreator(handle) {
  console.log(`\n[Scraper] Firing 7 actors in parallel for @${handle}...`);

  const [igResult, ttResult, twResult, ytResult, gSearchResult, gNewsResult, liResult] =
    await Promise.allSettled([

      // 1. Instagram — bio, captions, tagged locations
      runActor("apify/instagram-scraper", {
        usernames: [handle],
        resultsLimit: 30,
        addParentData: false,
      }),

      // 2. TikTok — captions, bio link, region
      runActor("clockworks/tiktok-scraper", {
        profiles: [`https://www.tiktok.com/@${handle}`],
        resultsPerPage: 20,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      }),

      // 3. Twitter/X — replies, location field, bio
      runActor("apidojo/tweet-scraper-v2", {
        searchTerms: [`from:${handle}`],
        maxItems: 50,
        queryType: "Latest",
      }),

      // 4. YouTube — about page, descriptions, channel location
      runActor("streamers/youtube-scraper", {
        searchKeywords: handle,
        maxResults: 10,
        type: "channel",
      }),

      // 5. Google Search — 3 privacy-targeted queries
      runActor("apify/google-search-scraper", {
        queries: [
          `"${handle}" phone OR email OR address OR location`,
          `"${handle}" site:pastebin.com OR site:rentry.co OR site:doxbin.com`,
          `"${handle}" doxxed OR leaked OR exposed`,
        ].join("\n"),
        resultsPerPage: 10,
        maxPagesPerQuery: 1,
      }),

      // 6. Google News — press articles, scam reports
      runActor("misceres/google-news", {
        query: handle,
        maxItems: 20,
        language: "en",
      }),

      // 7. LinkedIn — public profile: bio, location, employer, education
      runActor("bebity/linkedin-profile-scraper", {
        profileUrls: [`https://www.linkedin.com/in/${handle}`],
      }, 5),
    ]);

  const resolve = (r) => (r.status === "fulfilled" ? r.value : []);

  const igItems = resolve(igResult);
  const ttItems = resolve(ttResult);
  const twItems = resolve(twResult);
  const ytItems = resolve(ytResult);
  const gsItems = resolve(gSearchResult);
  const gnItems = resolve(gNewsResult);
  const liItems = resolve(liResult);

  // 7. Website content crawler — fires on bio links from IG + TikTok
  const bioLinks = extractBioLinks(igItems, ttItems);
  let websiteItems = [];
  if (bioLinks.length > 0) {
    console.log(`  → Crawling ${bioLinks.length} bio link(s): ${bioLinks.join(", ")}`);
    websiteItems = await runActor(
      "apify/website-content-crawler",
      {
        startUrls: bioLinks.map((url) => ({ url })),
        maxCrawlPages: 2,
        maxCrawlDepth: 1,
        outputFormats: ["text"],
      },
      10
    );
  }

  console.log(`[Scraper] All actors complete.\n`);

  // ── Normalize into privacy-relevant text payload ──
  return {
    handle,
    instagram: igItems.slice(0, 10).map((p) => ({
      bio: p.biography || "",
      location: p.location || "",
      externalUrl: p.externalUrl || "",
      captions: (p.latestPosts || [])
        .map((x) => x.caption)
        .filter(Boolean)
        .slice(0, 10)
        .join(" | "),
      tagged: (p.latestPosts || [])
        .map((x) => x.locationName)
        .filter(Boolean)
        .join(", "),
    })),

    tiktok: ttItems.slice(0, 10).map((p) => ({
      bio: p.authorMeta?.signature || "",
      region: p.authorMeta?.region || "",
      bioLink: p.authorMeta?.bioLink?.link || "",
      caption: p.text || "",
    })),

    twitter: twItems.slice(0, 20).map((t) => ({
      text: t.full_text || t.text || "",
      location: t.user?.location || "",
      bio: t.user?.description || "",
      userUrl: t.user?.url || "",
    })),

    youtube: ytItems.slice(0, 5).map((v) => ({
      description: (v.description || "").slice(0, 600),
      channelLocation: v.channelLocation || "",
      aboutPage: (v.aboutPage || "").slice(0, 400),
    })),

    googleResults: gsItems.map((r) => ({
      title: r.title || "",
      snippet: r.snippet || "",
      url: r.url || "",
    })),

    newsHeadlines: gnItems.map((n) => ({
      title: n.title || "",
      description: (n.description || "").slice(0, 200),
      source: n.source || "",
    })),

    websiteText: websiteItems.slice(0, 3).map((p) => ({
      url: p.url || "",
      text: (p.text || "").slice(0, 500),
    })),

    linkedin: liItems.slice(0, 3).map((p) => ({
      name:       p.name || p.fullName || "",
      headline:   p.headline || "",
      location:   p.location || p.geoLocation || "",
      summary:    (p.summary || p.about || "").slice(0, 400),
      employer:   p.currentCompany || p.position || "",
      education:  (p.education || []).map((e) => e.schoolName || e.school || "").filter(Boolean).join(", "),
      connections: p.connectionsCount || "",
    })),
  };
}
