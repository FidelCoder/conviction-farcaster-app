import { NextResponse } from "next/server";

const DEFAULT_MODEL = process.env.OPENAI_SUPPORT_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.5";
const DEFAULT_BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

export async function POST(request: Request) {
  const body = await parseBody(request);

  if (!isRecord(body)) {
    return validationError("Request body must be a JSON object.");
  }

  const question = stringField(body, "question");
  const pageContext = stringField(body, "context");

  if (!question) {
    return validationError("question is required.");
  }

  const fallback = createFallbackAnswer(question);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ ok: true, data: { answer: fallback, mode: "fallback" } });
  }

  try {
    const answer = await createAiSupportAnswer({ apiKey, pageContext, question });
    return NextResponse.json({ ok: true, data: { answer: answer || fallback, mode: answer ? "ai" : "fallback" } });
  } catch {
    return NextResponse.json({ ok: true, data: { answer: fallback, mode: "fallback" } });
  }
}

async function createAiSupportAnswer({
  apiKey,
  pageContext,
  question,
}: {
  apiKey: string;
  pageContext: string;
  question: string;
}) {
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
          content: [
            "You are Conviction Markets support inside the product.",
            "Conviction Markets is a leveraged marketplace for prediction markets: traders review real event markets, request margin through Conviction rails, and liquidity providers supply vault capital that can earn from that activity.",
            "Keep answers short, direct, and easy to understand. Do not oversell. Do not claim execution is live unless the user states it is live in their environment.",
            "Important product areas: wallet connection, .viction profile, market discovery, rules review, margin requests, vault deposits, portfolio, activity/social feed, preferences, media cards, and Telegram-only human support escalation.",
            "If the user needs account-specific help, ask for email and a short issue summary so a Telegram support ticket can be created. Never mention WhatsApp.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({ question, pageContext: pageContext || null }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("Support AI request failed.");
  }

  const parsed = (await response.json()) as unknown;
  return truncateClean(extractResponseText(parsed), 900);
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

function createFallbackAnswer(question: string) {
  const normalized = question.toLowerCase();

  if (normalized.includes("vault") || normalized.includes("liquidity") || normalized.includes("yield")) {
    return "Vault depositors supply liquidity that backs margin activity. The main risks are smart-contract risk, market/liquidation risk, liquidity lockup during active use, and testnet limitations while execution rails are still being finalized.";
  }

  if (normalized.includes("margin") || normalized.includes("leverage")) {
    return "Margin lets a trader use collateral plus vault liquidity to get larger exposure to a prediction market. Review the market rules first, choose YES or NO, set collateral and leverage, then submit the request through the wallet flow available in your environment.";
  }

  if (normalized.includes("wallet") || normalized.includes("connect")) {
    return "Use the top-right wallet button to connect an EVM wallet. The app keys profile, email, preferences, and activity to that wallet address so refreshes should keep the same session.";
  }

  if (normalized.includes("profile") || normalized.includes("viction")) {
    return "Your profile is tied to your connected wallet. Claim a .viction handle, add email, avatar, and bio, then your public signals and social activity can show under that identity.";
  }

  return "I can help with markets, rules, margin requests, vault deposits, wallet connection, profile setup, portfolio, or Activity. For human help, add your email and a short issue summary so the team can receive a Telegram support alert.";
}

async function parseBody(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

function validationError(message: string) {
  return NextResponse.json(
    { ok: false, error: { code: "INVALID_SUPPORT_AI_REQUEST", message } },
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
