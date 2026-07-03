export const dynamic = "force-static";

const body = [
  "# Conviction Markets",
  "",
  "Conviction Markets is a leveraged prediction market platform for event trading, market discovery, margin trading, and vault liquidity yield.",
  "",
  "## Product",
  "- Traders browse event markets, review market rules, inspect odds and price history, and request margin for stronger conviction calls.",
  "- Liquidity providers deposit into vaults that supply capital for margin activity and can earn from that activity.",
  "- Market Pulse is the social/news layer where users discuss markets, share public calls, follow traders, and track public activity.",
  "- .viction profiles tie handles, avatars, email, preferences, and public reputation to connected wallet addresses.",
  "",
  "## Important Pages",
  "- Home: https://convictionmarkets.xyz/",
  "- Markets: https://convictionmarkets.xyz/markets",
  "- Vaults: https://convictionmarkets.xyz/vaults",
  "- Activity: https://convictionmarkets.xyz/activity",
  "- Docs: https://convictionmarkets.xyz/docs",
  "- Support: https://convictionmarkets.xyz/support",
  "",
  "## Search Context",
  "Relevant queries include Conviction Markets, conviction markets prediction markets, prediction markets, event markets, event trading, prediction market margin, margin trading, leveraged prediction markets, sports prediction markets, crypto prediction markets, geopolitics prediction markets, and vault yield.",
  "",
  "## Social",
  "- X: https://x.com/VictionMarkets",
  "- Telegram community: https://t.me/+KYjXR2Tz2P4xMGY0",
  "",
  "## Safety",
  "Conviction Markets should not be described as guaranteeing profits, guaranteed yield, or guaranteed execution. Vault liquidity and margin trading carry smart-contract, market, liquidation, adapter/oracle, and rollout risk.",
].join("\n");

export function GET() {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
