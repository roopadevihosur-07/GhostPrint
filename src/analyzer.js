import Anthropic from "@anthropic-ai/sdk";

const claude = new Anthropic();

const SYSTEM_PROMPT = `You are a privacy analyst specializing in protecting public content creators and influencers from real-world threats: stalking, doxxing, social engineering, impersonation scams, and targeted harassment.

You receive OSINT data scraped from a creator's PUBLIC profiles. Your job is to identify what a malicious actor could learn and weaponize — and tell the creator exactly what to fix.

Return ONLY valid JSON. No markdown, no prose, no code fences. Just the JSON object.`;

const USER_PROMPT = (handle, data) => `
Analyze this OSINT data for creator @${handle} and return a privacy threat report as JSON.

Required format:
{
  "overall_score": <integer 0-100, higher = more exposed>,
  "risk_level": <"critical" | "high" | "medium" | "low">,
  "summary": "<2 sentences, plain English, what is the biggest risk right now>",
  "categories": {
    "location_exposure": {
      "score": <0-100>,
      "risk_level": <"critical"|"high"|"medium"|"low">,
      "headline": "<8 words max, the specific location risk>",
      "evidence": ["<verbatim quote or data point from the scraped content — must be a real string from the data, not a paraphrase>"],
      "fixes": ["<specific action, under 12 words each, ordered by urgency>"]
    },
    "dox_surface": {
      "score": <0-100>,
      "risk_level": <"critical"|"high"|"medium"|"low">,
      "headline": "<8 words max>",
      "evidence": [],
      "fixes": []
    },
    "breach_exposure": {
      "score": <0-100>,
      "risk_level": <"critical"|"high"|"medium"|"low">,
      "headline": "<8 words max>",
      "evidence": [],
      "fixes": []
    },
    "impersonation_risk": {
      "score": <0-100>,
      "risk_level": <"critical"|"high"|"medium"|"low">,
      "headline": "<8 words max>",
      "evidence": [],
      "fixes": []
    }
  },
  "top_3_actions": [
    "<most urgent action — be specific, 15 words max>",
    "<second priority>",
    "<third priority>"
  ],
  "scraped_platforms": ["instagram", "tiktok", ...],
  "data_points_analyzed": <integer count of total scraped items>
}

Scoring guide:
- 80-100 = critical: a determined attacker could find home address or real-time location
- 50-79 = high: significant personal info exposed, easy social engineering
- 20-49 = medium: some exposure, non-trivial to exploit
- 0-19 = low: minimal public exposure found

Evidence rules:
- Must be verbatim text from the data below, or a specific factual observation like "Bio states: 'Los Angeles, CA'"
- If no evidence found for a category, use ["No significant exposure found in scraped data"]
- Never fabricate evidence

Data (trimmed to fit context):
${JSON.stringify(data, null, 2).slice(0, 9000)}
`;

export async function analyzeThreats(handle, scrapedData) {
  console.log(`[Analyzer] Sending data to Claude for @${handle}...`);

  const response = await claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: USER_PROMPT(handle, scrapedData),
      },
    ],
  });

  const raw = response.content[0].text.trim();

  // Strip accidental code fences if present
  const clean = raw.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();

  const parsed = JSON.parse(clean);
  console.log(
    `[Analyzer] Done. Overall score: ${parsed.overall_score} (${parsed.risk_level})\n`
  );
  return parsed;
}
