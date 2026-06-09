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
  | "CULTURE"
  | "TECH"
  | "ECONOMICS"
  | "WORLD";

export type MarketDiscoveryProfile = {
  regions: DiscoveryRegion[];
  topic: DiscoveryTopic;
  scope: DiscoveryScope;
};

const REGION_KEYWORDS: Array<{ region: DiscoveryRegion; terms: string[] }> = [
  {
    region: "AFRICA",
    terms: ["africa", "nigeria", "kenya", "ghana", "south africa", "ethiopia", "egypt"],
  },
  {
    region: "ASIA",
    terms: ["asia", "china", "taiwan", "japan", "india", "korea", "singapore", "hong kong"],
  },
  {
    region: "EUROPE",
    terms: ["europe", "france", "spain", "germany", "uk", "britain", "italy", "russia"],
  },
  {
    region: "LATAM",
    terms: ["latin america", "brazil", "argentina", "mexico", "colombia", "chile"],
  },
  {
    region: "MIDDLE_EAST",
    terms: ["middle east", "israel", "iran", "saudi", "uae", "qatar", "gaza"],
  },
  {
    region: "US",
    terms: [
      "united states",
      " u.s.",
      " usa",
      "trump",
      "new york",
      "san antonio",
      "oklahoma",
      "carolina",
      "vegas",
      "montreal",
      "harvey weinstein",
      "nba",
      "nhl",
    ],
  },
  {
    region: "CRYPTO_NATIVE",
    terms: ["crypto", "bitcoin", "ethereum", "eth", "megaeth", "airdrop", "token"],
  },
];

const TOPIC_KEYWORDS: Array<{ topic: DiscoveryTopic; terms: string[] }> = [
  { topic: "CRYPTO", terms: ["crypto", "bitcoin", "ethereum", "eth", "megaeth", "airdrop"] },
  { topic: "SPORTS", terms: ["nba", "nhl", "world cup", "champion", "finals", "stanley cup"] },
  { topic: "POLITICS", terms: ["election", "president", "trump", "senate", "taiwan", "china"] },
  { topic: "CULTURE", terms: ["gta", "album", "rihanna", "carti", "movie", "music"] },
  { topic: "TECH", terms: ["ai", "tech", "startup", "tesla", "spacex", "apple", "google"] },
  { topic: "ECONOMICS", terms: ["inflation", "fed", "rate", "gdp", "recession", "dollar"] },
  { topic: "WORLD", terms: ["war", "nato", "china", "taiwan", "gaza", "world"] },
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
  CRYPTO: "Crypto",
  CULTURE: "Culture",
  ECONOMICS: "Economics",
  POLITICS: "Politics",
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
