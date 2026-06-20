import type { MetadataRoute } from "next";

import { listMarkets } from "../lib/core-api";

const appUrl = "https://convictionmarkets.xyz";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const markets = await listMarkets().catch(() => []);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: appUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: appUrl + "/markets", lastModified: now, changeFrequency: "hourly", priority: 0.95 },
    { url: appUrl + "/margin-desk", lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: appUrl + "/docs", lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: appUrl + "/social", lastModified: now, changeFrequency: "daily", priority: 0.75 },
    { url: appUrl + "/leaderboard", lastModified: now, changeFrequency: "daily", priority: 0.65 },
    { url: appUrl + "/me", lastModified: now, changeFrequency: "weekly", priority: 0.35 },
  ];

  const marketRoutes: MetadataRoute.Sitemap = markets.slice(0, 500).map((market) => ({
    url: appUrl + "/markets/" + encodeURIComponent(market.id),
    lastModified: market.syncedAt ? new Date(market.syncedAt) : now,
    changeFrequency: "hourly",
    priority: market.status === "ACTIVE" ? 0.85 : 0.45,
  }));

  return [...staticRoutes, ...marketRoutes];
}
