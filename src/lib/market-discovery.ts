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
  | "WORLD_CUP"
  | "BREAKING"
  | "CRYPTO"
  | "ESPORTS"
  | "SPORTS"
  | "POLITICS"
  | "GEOPOLITICS"
  | "FINANCE"
  | "ECONOMICS"
  | "TECH"
  | "CULTURE"
  | "WEATHER"
  | "MENTIONS"
  | "ELECTIONS"
  | "SOCIAL"
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
      "hormuz",
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
      "btc",
      "ethereum",
      "megaeth",
      "airdrop",
      "token",
      "defi",
      "solana",
      "layer 2",
      "l2",
      "on-chain",
      "onchain",
    ],
  },
];

const TOPIC_KEYWORDS: Array<{ topic: DiscoveryTopic; terms: string[] }> = [
  {
    topic: "WORLD_CUP",
    terms: ["world cup", "fifa world cup", "2026-fifa-world-cup", "fifa-world-cup", "wc-group", "golden boot"],
  },
  {
    topic: "ESPORTS",
    terms: ["esports", "counter-strike", "cs2", "league of legends", " lck ", "valorant", "dota", "pubg", "rocket league"],
  },
  {
    topic: "BREAKING",
    terms: ["breaking", "by end of", "today", "tomorrow", "this week", "returns to normal", "ceasefire", "attack"],
  },
  {
    topic: "GEOPOLITICS",
    terms: [
      "geopolitics",
      "foreign affairs",
      "international affairs",
      "war",
      "ceasefire",
      "nato",
      "china",
      "taiwan",
      "gaza",
      "israel",
      "iran",
      "hormuz",
      "russia",
      "ukraine",
      "sanction",
      "border",
      "coup",
    ],
  },
  {
    topic: "ELECTIONS",
    terms: ["election", "elections", "ballot", "voting", "vote share", "presidential race", "general election"],
  },
  {
    topic: "SPORTS",
    terms: [
      "sports",
      "soccer",
      "nba",
      "nfl",
      "nhl",
      "mlb",
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
    ],
  },
  {
    topic: "POLITICS",
    terms: ["politics", "president", "minister", "trump", "biden", "senate", "congress", "parliament", "policy", "government", "vote"],
  },
  {
    topic: "MENTIONS",
    terms: ["mentions", "mentioned", "tweet", "tweets", "x.com", "social media post", "will elon musk tweet"],
  },
  {
    topic: "SOCIAL",
    terms: ["trend", "tiktok", "twitter", "meme", "protest", "strike", "celebrity", "influencer", "court", "trial", "sentenced", "sentence", "prison", "retrial", "lawsuit"],
  },
  {
    topic: "CRYPTO",
    terms: ["crypto", "bitcoin", "btc", "ethereum", "megaeth", "airdrop", "token", "defi", "solana", "onchain", "on-chain"],
  },
  {
    topic: "FINANCE",
    terms: ["finance", "business", "earnings", "ipo", "stock", "stocks", "nasdaq", "s&p", "dow", "bond", "yield"],
  },
  {
    topic: "ECONOMICS",
    terms: ["economy", "economics", "inflation", "fed", "rate", "rates", "gdp", "recession", "dollar", "oil", "unemployment", "cpi", "tariff"],
  },
  {
    topic: "WEATHER",
    terms: ["weather", "hurricane", "temperature", "rain", "flood", "wildfire", "storm", "snowfall"],
  },
  {
    topic: "CULTURE",
    terms: ["culture", "pop culture", "gta", "album", "rihanna", "carti", "movie", "music", "box office", "oscar", "grammy", "streaming", "netflix", "art"],
  },
  {
    topic: "TECH",
    terms: ["tech", "technology", "ai", "openai", "startup", "tesla", "spacex", "apple", "google", "nvidia", "robot", "chip"],
  },
  {
    topic: "CLIMATE",
    terms: ["climate", "carbon", "earthquake"],
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
  BREAKING: "Breaking",
  CLIMATE: "Climate",
  CRYPTO: "Crypto",
  CULTURE: "Culture",
  ECONOMICS: "Economy",
  ELECTIONS: "Elections",
  ESPORTS: "Esports",
  FINANCE: "Finance",
  GEOPOLITICS: "Geopolitics",
  MENTIONS: "Mentions",
  POLITICS: "Politics",
  SOCIAL: "Social",
  SPORTS: "Sports",
  TECH: "Tech",
  WEATHER: "Weather",
  WORLD: "World",
  WORLD_CUP: "World Cup",
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
  return [
    market.title,
    market.category,
    market.description,
    market.source,
    market.providerMetadata?.primaryTag,
    market.providerMetadata?.eventTitle,
    market.providerMetadata?.eventSlug,
    ...(market.providerMetadata?.tagLabels ?? []),
    ...(market.providerMetadata?.tagSlugs ?? []),
  ]
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
