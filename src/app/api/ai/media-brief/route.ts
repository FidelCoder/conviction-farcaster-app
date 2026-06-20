import { NextResponse } from "next/server";

import { getMarket } from "../../../../lib/core-api";

type MediaBrief = {
  headline: string;
  subline: string;
  visualDirection: string;
  palette: string[];
  altText: string;
};

const DEFAULT_MODEL = process.env.OPENAI_MEDIA_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.5";
const DEFAULT_BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

export async function POST(request: Request) {
  const body = await parseBody(request);

  if (!isRecord(body)) {
    return validationError("Request body must be a JSON object.");
  }

  const marketId = stringField(body, "marketId");
  const side = normalizeSide(stringField(body, "side"));

  if (!marketId) {
    return validationError("marketId is required.");
  }

  const market = await getMarket(marketId);

  if (!market) {
    return NextResponse.json(
      { ok: false, error: { code: "MARKET_NOT_FOUND", message: "Market not found." } },
      { status: 404 },
    );
  }

  const fallback = createFallbackBrief({
    category: market.providerMetadata?.primaryTag ?? market.category ?? "Prediction Market",
    marketTitle: market.title,
    side,
  });

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ ok: true, data: { brief: fallback, mode: "fallback" } });
  }

  try {
    const brief = await createAiBrief({
      apiKey,
      category: market.providerMetadata?.primaryTag ?? market.category ?? "Prediction Market",
      description: market.description,
      marketTitle: market.title,
      side,
    });

    return NextResponse.json({ ok: true, data: { brief, mode: "ai" } });
  } catch {
    return NextResponse.json({ ok: true, data: { brief: fallback, mode: "fallback" } });
  }
}

async function createAiBrief({
  apiKey,
  category,
  description,
  marketTitle,
  side,
}: {
  apiKey: string;
  category: string;
  description: string | null;
  marketTitle: string;
  side: "YES" | "NO";
}): Promise<MediaBrief> {
  const response = await fetch(DEFAULT_BASE_URL.replace(/\/$/, "") + "/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: [
        {
          role: "system",
          content:
            "You create concise media briefs for Conviction Markets social cards. Never invent odds, winners, claims, or facts. Do not include a user's post text in the image. Return strict JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            marketTitle,
            category,
            side,
            rulesSummary: description?.slice(0, 900) ?? null,
            outputSchema: {
              headline: "Use the exact market title or a tiny cleanup of it.",
              subline: "Short neutral context, max 90 characters.",
              visualDirection: "Specific visual art direction, max 220 characters.",
              palette: "3 hex colors matching Conviction brand.",
              altText: "Accessible image alt text, max 140 characters.",
            },
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "conviction_media_brief",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["headline", "subline", "visualDirection", "palette", "altText"],
            properties: {
              headline: { type: "string" },
              subline: { type: "string" },
              visualDirection: { type: "string" },
              palette: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                items: { type: "string" },
              },
              altText: { type: "string" },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error("AI media brief request failed.");
  }

  const parsed = await response.json() as unknown;
  return coerceBrief(parsed) ?? createFallbackBrief({ category, marketTitle, side });
}

function coerceBrief(value: unknown): MediaBrief | null {
  const text = extractResponseText(value);
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isRecord(parsed)) return null;

    const palette = Array.isArray(parsed.palette)
      ? parsed.palette.filter((item): item is string => typeof item === "string").slice(0, 3)
      : [];

    if (palette.length !== 3) return null;

    return {
      headline: truncateClean(stringField(parsed, "headline"), 140),
      subline: truncateClean(stringField(parsed, "subline"), 100),
      visualDirection: truncateClean(stringField(parsed, "visualDirection"), 240),
      palette,
      altText: truncateClean(stringField(parsed, "altText"), 160),
    };
  } catch {
    return null;
  }
}

function extractResponseText(value: unknown): string {
  if (!isRecord(value)) return "";
  if (typeof value.output_text === "string") return value.output_text;

  const output = value.output;
  if (!Array.isArray(output)) return "";

  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isRecord(content) && typeof content.text === "string") return content.text;
    }
  }

  return "";
}

function createFallbackBrief({ category, marketTitle, side }: { category: string; marketTitle: string; side: "YES" | "NO" }): MediaBrief {
  return {
    headline: marketTitle,
    subline: side + " market call | " + category,
    visualDirection:
      "Dark Conviction Markets event card with the official logo, bold market headline, orange/purple accents, clean odds modules, and no user post text in the image.",
    palette: ["#ff6b12", "#7c3aed", side === "YES" ? "#10b981" : "#ef4444"],
    altText: "Conviction Markets event card for " + marketTitle,
  };
}

async function parseBody(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

function normalizeSide(value: string): "YES" | "NO" {
  return value.toUpperCase() === "NO" ? "NO" : "YES";
}

function validationError(message: string) {
  return NextResponse.json(
    { ok: false, error: { code: "INVALID_MEDIA_BRIEF_REQUEST", message } },
    { status: 422 },
  );
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function truncateClean(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength - 1) + "...";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
