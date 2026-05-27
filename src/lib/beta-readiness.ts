import { getCoreApiUrl, getExecutionCapabilities, listLeaderboard, listMarkets } from "./core-api";
import { getAbsoluteAppUrl, getAppUrl, getFarcasterAccountAssociation } from "./miniapp";

export type BetaReadinessCheck = {
  detail: string;
  label: string;
  status: "pass" | "warn" | "fail";
};

export type FarcasterBetaReadiness = {
  appUrl: string;
  coreApiUrl: string;
  manifestUrl: string;
  checkedAt: string;
  coreReachable: boolean;
  hostedManifestConfigured: boolean;
  accountAssociationConfigured: boolean;
  noindex: boolean;
  marketsCount: number;
  leaderboardEntries: number;
  leverageEnabled: boolean;
  marginExecutionEnabled: boolean;
  marginIntentsEnabled: boolean;
  checks: BetaReadinessCheck[];
};

export async function getFarcasterBetaReadiness(): Promise<FarcasterBetaReadiness> {
  const [coreHealth, markets, execution, leaderboard] = await Promise.all([
    checkCoreHealth(),
    listMarkets(),
    getExecutionCapabilities(),
    listLeaderboard(10),
  ]);
  const appUrl = getAppUrl();
  const coreApiUrl = getCoreApiUrl();
  const accountAssociationConfigured = Boolean(getFarcasterAccountAssociation());
  const hostedManifestConfigured = Boolean(process.env.FARCASTER_HOSTED_MANIFEST_ID?.trim());
  const noindex = process.env.FARCASTER_MINIAPP_NOINDEX !== "false";
  const usesPublicHttpsAppUrl = appUrl.startsWith("https://");
  const manifestConfigured = accountAssociationConfigured || hostedManifestConfigured;

  const checks: BetaReadinessCheck[] = [
    {
      label: "Public app URL",
      status: usesPublicHttpsAppUrl ? "pass" : "warn",
      detail: usesPublicHttpsAppUrl
        ? "NEXT_PUBLIC_APP_URL is using HTTPS."
        : "Set NEXT_PUBLIC_APP_URL to the deployed HTTPS URL before testing in Farcaster clients.",
    },
    {
      label: "Mini App manifest",
      status: manifestConfigured ? "pass" : "warn",
      detail: manifestConfigured
        ? "A signed account association or hosted manifest redirect is configured."
        : "Set FARCASTER_ACCOUNT_ASSOCIATION_JSON or FARCASTER_HOSTED_MANIFEST_ID before public beta publishing.",
    },
    {
      label: "Farcaster indexing",
      status: noindex ? "warn" : "pass",
      detail: noindex
        ? "FARCASTER_MINIAPP_NOINDEX is enabled. Keep it for private tests, set it to false for public beta discovery."
        : "Farcaster noindex is disabled for public discovery.",
    },
    {
      label: "Core API",
      status: coreHealth ? "pass" : "fail",
      detail: coreHealth
        ? "Core API /health is reachable."
        : "Core API is not reachable from this app runtime.",
    },
    {
      label: "Real markets",
      status: markets.length > 0 ? "pass" : "warn",
      detail:
        markets.length > 0
          ? markets.length + " synced markets are available from the core API."
          : "No markets are available. Sync a real provider or keep the empty state for private tests.",
    },
    {
      label: "Execution claims",
      status: execution.leverageEnabled || execution.marginExecutionEnabled ? "warn" : "pass",
      detail:
        execution.leverageEnabled || execution.marginExecutionEnabled
          ? "Core reports execution is enabled. Confirm adapters and contracts before beta claims execution."
          : "Execution remains intent-only; the app should not claim fills, balances, PnL, or leverage execution.",
    },
  ];

  return {
    appUrl,
    coreApiUrl,
    manifestUrl: getAbsoluteAppUrl("/.well-known/farcaster.json"),
    checkedAt: new Date().toISOString(),
    coreReachable: coreHealth,
    hostedManifestConfigured,
    accountAssociationConfigured,
    noindex,
    marketsCount: markets.length,
    leaderboardEntries: leaderboard.length,
    leverageEnabled: execution.leverageEnabled,
    marginExecutionEnabled: execution.marginExecutionEnabled,
    marginIntentsEnabled: Boolean(execution.marginIntentsEnabled),
    checks,
  };
}

async function checkCoreHealth() {
  try {
    const response = await fetch(getCoreApiUrl() + "/health", { cache: "no-store" });

    return response.ok;
  } catch {
    return false;
  }
}
