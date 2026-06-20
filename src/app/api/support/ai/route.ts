import { NextResponse } from "next/server";

const DEFAULT_MODEL = process.env.OPENAI_SUPPORT_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.5";
const DEFAULT_BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const maxConversationMessages = 12;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(request: Request) {
  const body = await parseBody(request);

  if (!isRecord(body)) {
    return validationError("Request body must be a JSON object.");
  }

  const question = stringField(body, "question");
  const pageContext = stringField(body, "context");
  const conversation = normalizeConversation(body.conversation);

  if (!question) {
    return validationError("question is required.");
  }

  const fallback = createFallbackAnswer(question);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ ok: true, data: { answer: fallback, mode: "fallback" } });
  }

  try {
    const answer = await createAiSupportAnswer({ apiKey, conversation, pageContext, question });
    return NextResponse.json({ ok: true, data: { answer: answer || fallback, mode: answer ? "ai" : "fallback" } });
  } catch {
    return NextResponse.json({ ok: true, data: { answer: fallback, mode: "fallback" } });
  }
}

async function createAiSupportAnswer({
  apiKey,
  conversation,
  pageContext,
  question,
}: {
  apiKey: string;
  conversation: ChatMessage[];
  pageContext: string;
  question: string;
}) {
  const supportContext = [
    "Conviction Markets is a leveraged marketplace for prediction markets.",
    "Users browse real event markets, inspect rules and odds, create social signals, request margin, and manage portfolio/vault activity from Conviction routes.",
    "The product is not positioned as a simple wrapper. It adds a margin desk, vault-supplied liquidity, .viction identity, social Market Pulse, share cards, preferences, and support workflows around prediction market data.",
    "Current execution posture: be careful. If a route says intent-only or testnet, explain that users can record/prepare requests but should not be told that a leveraged trade is fully executed unless contract execution is confirmed by the app state or transaction details.",
    "Vault model: liquidity providers supply capital to vaults. Traders can use collateral plus vault liquidity for larger prediction market exposure. LP risks include smart-contract risk, market/liquidation risk, oracle/adapter risk, liquidity lockup during active use, and testnet/product rollout risk.",
    "Wallet model: EVM wallet sessions key profile, email, preferences, and support context. Users should not need Farcaster to use wallet profiles.",
    "Profile model: users claim .viction handles, avatar, bio, and email against the connected wallet. Guests should connect a wallet before editing profile.",
    "Activity model: Market Pulse is the social/news layer. Users can post market calls, reply, like, repost, follow traders, and share market cards. Public/private trade visibility must be respected.",
    "Market model: market pages should show rules, category, region/topic, odds, price history/candles when available, and avoid sending users out as the default experience.",
    "Support model: AI should answer inside the product. If account-specific help is needed, ask for email and issue summary so a Telegram-only support ticket can be created. Never mention WhatsApp.",
    "Tone: clear, practical, short enough for a product support chat, but give real context when the question is technical or risk-related. Avoid hype and avoid invented facts.",
  ].join(" ");

  const messages = [
    {
      role: "system",
      content: supportContext,
    },
    ...conversation.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    {
      role: "user",
      content: JSON.stringify({ question, pageContext: pageContext || null }),
    },
  ];

  const response = await fetch(DEFAULT_BASE_URL.replace(/\/$/, "") + "/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: messages,
    }),
  });

  if (!response.ok) {
    throw new Error("Support AI request failed.");
  }

  const parsed = (await response.json()) as unknown;
  return truncateClean(extractResponseText(parsed), 1800);
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

  if (normalized.includes("risk") || normalized.includes("locked") || normalized.includes("lock")) {
    return "Yes, liquidity providers take risk. Vault liquidity can be locked while it backs active margin, and LPs carry smart-contract, market/liquidation, adapter/oracle, and rollout risk. The upside is that vaults can earn from margin activity when the system is live and operating correctly.";
  }

  if (normalized.includes("vault") || normalized.includes("liquidity") || normalized.includes("yield")) {
    return "Vaults are the capital layer. Liquidity providers deposit capital, traders use that pool to request larger prediction-market exposure, and LPs can earn from that activity. Deposits should be treated as risk capital, not a guaranteed yield account.";
  }

  if (normalized.includes("margin") || normalized.includes("leverage")) {
    return "Margin means a trader uses their collateral plus vault liquidity to get larger exposure to a prediction market. The normal flow is: review the market rules, choose YES or NO, set collateral and leverage, then submit through the available wallet flow. If the app labels execution as intent-only, it records the request but does not mean the trade is fully executed onchain yet.";
  }

  if (normalized.includes("wallet") || normalized.includes("connect")) {
    return "Use the top-right wallet button to connect an EVM wallet. Conviction keys profile, email, preferences, portfolio context, and support tickets to that wallet address so the same account can survive refreshes.";
  }

  if (normalized.includes("profile") || normalized.includes("viction")) {
    return "Your Conviction identity is tied to your connected wallet. Claim a .viction handle, add email, avatar, and bio, then your public signals and social activity can show under that profile.";
  }

  if (normalized.includes("activity") || normalized.includes("social") || normalized.includes("post") || normalized.includes("reply")) {
    return "Activity is the Market Pulse layer: users can post market calls, follow traders, like, reply, repost, and share market cards. It is meant to feel like a social/news feed for prediction markets while still respecting private trade settings.";
  }

  return "I can help with market discovery, market rules, margin requests, vault deposits, wallet connection, .viction profiles, portfolio, Activity, or support tickets. For account-specific help, send your email and a short issue summary so the team can receive a Telegram support alert.";
}

function normalizeConversation(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((message) => {
      const role: ChatMessage["role"] = message.role === "assistant" ? "assistant" : "user";
      return { role, content: truncateClean(stringField(message, "content"), 1200) };
    })
    .filter((message) => message.content.length > 0)
    .slice(-maxConversationMessages);
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
