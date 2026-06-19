import type { Market } from "./core-api";

export type DiscoveryScope = "ALL" | "GLOBAL" | "LOCAL";

export type DiscoveryRegion =
  | "ALL"
  | "GLOBAL"
  | "AFRICA"
  | "ASIA"
  | "EUROPE"
  | "LATAM"
  | "MIDDLE_EAST"
  | "US"
  | "CRYPTO_NATIVE";

export type DiscoveryTopic =
  | "ALL"
  | "CRYPTO"
  | "SPORTS"
  | "POLITICS"
  | "GEOPOLITICS"
  | "CULTURE"
  | "SOCIAL"
  | "TECH"
  | "ECONOMICS"
  | "CLIMATE"
  | "WORLD";

export type MarketDiscoveryProfile = {
  regions: DiscoveryRegion[];
  topic: DiscoveryTopic;
  scope: DiscoveryScope;
};

const REGION_KEYWORDS: Array<{ region: DiscoveryRegion; terms: string[] }> = [
  {
    region: "AFRICA",
    terms: [
      "africa",
      "nigeria",
      "kenya",
      "ghana",
      "south africa",
      "ethiopia",
      "egypt",
      "morocco",
      "algeria",
      "tanzania",
      "uganda",
      "rwanda",
      "senegal",
      "ivory coast",
      "cote d'ivoire",
    ],
  },
  {
    region: "ASIA",
    terms: [
      "asia",
      "china",
      "taiwan",
      "japan",
      "india",
      "pakistan",
      "bangladesh",
      "korea",
      "singapore",
      "hong kong",
      "indonesia",
      "philippines",
      "vietnam",
      "thailand",
    ],
  },
  {
    region: "EUROPE",
    terms: [
      "europe",
      "eu ",
      "e.u.",
      "france",
      "spain",
      "germany",
      "uk",
      "britain",
      "united kingdom",
      "italy",
      "russia",
      "ukraine",
      "poland",
      "netherlands",
      "portugal",
    ],
  },
  {
    region: "LATAM",
    terms: [
      "latin america",
      "latam",
      "brazil",
      "argentina",
      "mexico",
      "colombia",
      "chile",
      "peru",
      "venezuela",
    ],
  },
  {
    region: "MIDDLE_EAST",
    terms: [
      "middle east",
      "israel",
      "iran",
      "saudi",
      "uae",
      "qatar",
      "gaza",
      "palestine",
      "turkey",
      "syria",
      "iraq",
      "lebanon",
    ],
  },
  {
    region: "US",
    terms: [
      "united states",
      " u.s.",
      " usa",
      "america",
      "american",
      "trump",
      "biden",
      "congress",
      "senate",
      "new york",
      "san antonio",
      "oklahoma",
      "carolina",
      "vegas",
      "nba",
      "nfl",
      "mlb",
    ],
  },
  {
    region: "CRYPTO_NATIVE",
    terms: [
      "crypto",
      "bitcoin",
      "ethereum",
      "eth",
      "megaeth",
      "airdrop",
      "token",
      "defi",
      "solana",
      "base",
      "arbitrum",
      "layer 2",
      "l2",
      "on-chain",
      "onchain",
    ],
  },
];

const TOPIC_KEYWORDS: Array<{ topic: DiscoveryTopic; terms: string[] }> = [
  {
    topic: "GEOPOLITICS",
    terms: [
      "war",
      "ceasefire",
      "nato",
      "china",
      "taiwan",
      "gaza",
      "israel",
      "iran",
      "russia",
      "ukraine",
      "sanction",
      "border",
      "coup",
    ],
  },
  {
    topic: "CRYPTO",
    terms: ["crypto", "bitcoin", "btc", "ethereum", "eth", "megaeth", "airdrop", "token", "defi", "solana", "onchain", "on-chain"],
  },
  {
    topic: "SPORTS",
    terms: [
      "nba",
      "nfl",
      "nhl",
      "mlb",
      "world cup",
      "champion",
      "finals",
      "stanley cup",
      "premier league",
      "uefa",
      "olympics",
      "ufc",
      "cricket",
      "f1",
      "formula 1",
      "football",
      "soccer",
    ],
  },
  {
    topic: "POLITICS",
    terms: ["election", "president", "minister", "trump", "biden", "senate", "congress", "parliament", "policy", "government", "vote"],
  },
  {
    topic: "SOCIAL",
    terms: ["trend", "tiktok", "twitter", "x.com", "meme", "protest", "strike", "celebrity", "influencer", "court", "trial"],
  },
  {
    topic: "CULTURE",
    terms: ["gta", "album", "rihanna", "carti", "movie", "music", "box office", "oscar", "grammy", "streaming", "netflix"],
  },
  {
    topic: "TECH",
    terms: ["ai", "openai", "tech", "startup", "tesla", "spacex", "apple", "google", "nvidia", "robot", "chip"],
  },
  {
    topic: "ECONOMICS",
    terms: ["inflation", "fed", "rate", "gdp", "recession", "dollar", "oil", "stock", "unemployment", "cpi", "tariff"],
  },
  {
    topic: "CLIMATE",
    terms: ["climate", "weather", "hurricane", "temperature", "rain", "flood", "wildfire", "carbon", "earthquake"],
  },
  { topic: "WORLD", terms: ["world", "global", "international"] },
];

const REGION_LABELS: Record<DiscoveryRegion, string> = {
  AFRICA: "Africa",
  ALL: "Any region",
  ASIA: "Asia",
  CRYPTO_NATIVE: "Crypto-native",
  EUROPE: "Europe",
  GLOBAL: "Global",
  LATAM: "Latin America",
  MIDDLE_EAST: "Middle East",
  US: "United States",
};

const TOPIC_LABELS: Record<DiscoveryTopic, string> = {
  ALL: "All topics",
  CLIMATE: "Climate",
  CRYPTO: "Crypto",
  CULTURE: "Culture",
  ECONOMICS: "Economics",
  GEOPOLITICS: "Geopolitics",
  POLITICS: "Politics",
  SOCIAL: "Social",
  SPORTS: "Sports",
  TECH: "Tech",
  WORLD: "World",
};

export function getRegionLabel(region: DiscoveryRegion) {
  return REGION_LABELS[region];
}

export function getTopicLabel(topic: DiscoveryTopic) {
  return TOPIC_LABELS[topic];
}

export function getMarketDiscoveryProfile(market: Market): MarketDiscoveryProfile {
  const haystack = getMarketSearchText(market);
  const matchedRegions = REGION_KEYWORDS.filter(({ terms }) => matchesAnyTerm(haystack, terms)).map(
    ({ region }) => region,
  );
  const regions: DiscoveryRegion[] = matchedRegions.length > 0 ? dedupeRegions(matchedRegions) : ["GLOBAL"];
  const topic =
    TOPIC_KEYWORDS.find(({ terms }) => matchesAnyTerm(haystack, terms))?.topic ?? "WORLD";
  const hasLocalSignal = regions.some((region) => region !== "GLOBAL" && region !== "CRYPTO_NATIVE");

  return {
    regions,
    scope: hasLocalSignal ? "LOCAL" : "GLOBAL",
    topic,
  };
}

export function marketMatchesDiscoveryFilters(
  market: Market,
  filters: {
    query: string;
    region: DiscoveryRegion;
    scope: DiscoveryScope;
    topic: DiscoveryTopic;
  },
) {
  const profile = getMarketDiscoveryProfile(market);
  const query = filters.query.trim().toLowerCase();

  if (query && !getMarketSearchText(market).includes(query)) {
    return false;
  }

  if (filters.scope !== "ALL" && profile.scope !== filters.scope) {
    return false;
  }

  if (filters.region !== "ALL" && !profile.regions.includes(filters.region)) {
    return false;
  }

  if (filters.topic !== "ALL" && profile.topic !== filters.topic) {
    return false;
  }

  return true;
}

export function getMarketDiscoveryLabel(market: Market) {
  const profile = getMarketDiscoveryProfile(market);
  const region = profile.regions[0] ?? "GLOBAL";

  return getRegionLabel(region) + " / " + getTopicLabel(profile.topic);
}

export function getMarketSearchText(market: Market) {
  return [market.title, market.category, market.description, market.source]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesAnyTerm(haystack: string, terms: string[]) {
  return terms.some((term) => haystack.includes(term));
}

function dedupeRegions(regions: DiscoveryRegion[]) {
  return Array.from(new Set(regions));
}
