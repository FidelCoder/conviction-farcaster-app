import { NextResponse } from "next/server";

import { getMarket } from "../../../lib/core-api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const marketId = url.searchParams.get("marketId") ?? "";
  const market = marketId ? await getMarket(marketId) : null;
  const title = escapeHtml(market?.title ?? "Conviction market update");
  const category = escapeHtml(market?.providerMetadata?.primaryTag ?? market?.category ?? "Prediction Market");
  const image = "/api/miniapp-image?type=market&id=" + encodeURIComponent(marketId);

  return new NextResponse(`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title><style>html,body{margin:0;background:#090909;color:#fff;font-family:Inter,Arial,sans-serif}main{min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 20% 10%,rgba(255,107,18,.28),transparent 30%),radial-gradient(circle at 90% 80%,rgba(124,58,237,.24),transparent 34%),#090909;overflow:hidden}.stage{width:min(92vw,960px);aspect-ratio:1200/630;border:1px solid rgba(255,255,255,.12);border-radius:18px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.55);animation:float 6s ease-in-out infinite}.stage img{width:100%;height:100%;object-fit:cover;display:block}.ticker{position:fixed;left:0;right:0;bottom:0;padding:14px 0;background:#111;border-top:1px solid rgba(255,255,255,.12);white-space:nowrap;overflow:hidden}.ticker span{display:inline-block;padding-left:100%;animation:ticker 22s linear infinite;color:#ff6b12;font-weight:800;letter-spacing:.08em;text-transform:uppercase}@keyframes float{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-10px) scale(1.012)}}@keyframes ticker{to{transform:translateX(-100%)}}</style></head><body><main><div class="stage"><img src="${image}" alt="${title}"/></div><div class="ticker"><span>${category} · ${title} · Conviction Markets</span></div></main></body></html>`, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=300",
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
