import {
  getCoreApiUrl,
  getExecutionCapabilities,
  getPolymarketExecutionReadiness,
  listLeaderboard,
  listMarkets,
  type PolymarketExecutionReadiness,
} from "./core-api";
import { deriveExecutionReleaseState, type ExecutionReleaseState } from "./execution-release-state";
import {
  getAbsoluteAppUrl,
  getAppUrl,
  getFarcasterAccountAssociationState,
  isMiniAppNoindexEnabled,
} from "./miniapp";

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
  manifestReachable: boolean;
  hostedManifestConfigured: boolean;
  accountAssociationConfigured: boolean;
  accountAssociationValid: boolean;
  accountAssociationError: string | null;
  noindex: boolean;
  marketsCount: number;
  leaderboardEntries: number;
  leverageEnabled: boolean;
  marginExecutionEnabled: boolean;
  marginIntentsEnabled: boolean;
  polymarketReadiness: PolymarketExecutionReadiness | null;
  releaseState: ExecutionReleaseState;
  checks: BetaReadinessCheck[];
};

type ManifestHealth = {
  detail: string;
  reachable: boolean;
};

export async function getFarcasterBetaReadiness(): Promise<FarcasterBetaReadiness> {
  const appUrl = getAppUrl();
  const manifestUrl = getAbsoluteAppUrl("/.well-known/farcaster.json");
  const [
    coreHealthResult,
    marketsResult,
    executionResult,
    polymarketReadinessResult,
    leaderboardResult,
    manifestHealthResult,
  ] = await Promise.allSettled([
    checkCoreHealth(),
    listMarkets(),
    getExecutionCapabilities(),
    getPolymarketExecutionReadiness(),
    listLeaderboard(10),
    checkManifestEndpoint(manifestUrl, appUrl),
  ]);
  const coreHealth = settledValue(coreHealthResult, false);
  const markets = settledValue(marketsResult, []);
  const execution = settledValue(executionResult, null);
  const polymarketReadiness = settledValue(polymarketReadinessResult, null);
  const leaderboard = settledValue(leaderboardResult, []);
  const manifestHealth = settledValue(manifestHealthResult, {
    detail: "Farcaster manifest health check did not complete.",
    reachable: false,
  });
  const coreApiUrl = getCoreApiUrl();
  const accountAssociationState = getFarcasterAccountAssociationState();
  const accountAssociationConfigured = accountAssociationState.status !== "missing";
  const accountAssociationValid = accountAssociationState.status === "valid";
  const hostedManifestConfigured = Boolean(process.env.FARCASTER_HOSTED_MANIFEST_ID?.trim());
  const noindex = isMiniAppNoindexEnabled();
  const usesPublicHttpsAppUrl = appUrl.startsWith("https://");
  const manifestConfigured = accountAssociationValid || hostedManifestConfigured;
  const releaseState = execution
    ? deriveExecutionReleaseState(execution, polymarketReadiness)
    : {
        blockingGates: ["Core execution capability unavailable"],
        canClaimVenueFill: false,
        canOpenMargin: false,
        mode: "BLOCKED" as const,
        reason: "Core execution capability request did not complete.",
      };

  const checks: BetaReadinessCheck[] = [
    {
      label: "Public app URL",
      status: usesPublicHttpsAppUrl ? "pass" : "warn",
      detail: usesPublicHttpsAppUrl
        ? "NEXT_PUBLIC_APP_URL is using HTTPS."
        : "Set NEXT_PUBLIC_APP_URL to the deployed HTTPS URL before testing in Farcaster clients.",
    },
    {
      label: "Manifest endpoint",
      status: manifestHealth.reachable ? "pass" : usesPublicHttpsAppUrl ? "fail" : "warn",
      detail: manifestHealth.detail,
    },
    {
      label: "Mini App verification",
      status: manifestConfigured ? "pass" : accountAssociationConfigured ? "fail" : "warn",
      detail: getMiniAppVerificationDetail({
        accountAssociationError: accountAssociationState.error,
        accountAssociationValid,
        hostedManifestConfigured,
      }),
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
      label: "Polymarket margin release",
      status:
        releaseState.mode === "PRODUCTION"
          ? "pass"
          : releaseState.mode === "INVITE_ONLY_CANARY"
            ? "warn"
            : "fail",
      detail: releaseState.reason,
    },
  ];

  return {
    appUrl,
    coreApiUrl,
    manifestUrl,
    checkedAt: new Date().toISOString(),
    coreReachable: coreHealth,
    manifestReachable: manifestHealth.reachable,
    hostedManifestConfigured,
    accountAssociationConfigured,
    accountAssociationValid,
    accountAssociationError: accountAssociationState.error,
    noindex,
    marketsCount: markets.length,
    leaderboardEntries: leaderboard.length,
    leverageEnabled: execution?.leverageEnabled ?? false,
    marginExecutionEnabled: execution?.marginExecutionEnabled ?? false,
    marginIntentsEnabled: Boolean(execution?.marginIntentsEnabled),
    polymarketReadiness,
    releaseState,
    checks,
  };
}

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T) {
  return result.status === "fulfilled" ? result.value : fallback;
}

async function checkCoreHealth() {
  try {
    const response = await fetch(getCoreApiUrl() + "/health", { cache: "no-store" });

    return response.ok;
  } catch {
    return false;
  }
}

async function checkManifestEndpoint(manifestUrl: string, appUrl: string): Promise<ManifestHealth> {
  try {
    const response = await fetch(manifestUrl, { cache: "no-store" });

    if (!response.ok) {
      return {
        reachable: false,
        detail: "Farcaster manifest returned HTTP " + response.status + ".",
      };
    }

    const body = (await response.json()) as unknown;

    if (!isRecord(body) || !isRecord(body.miniapp)) {
      return {
        reachable: false,
        detail: "Farcaster manifest is reachable but does not include a miniapp object.",
      };
    }

    const homeUrl = body.miniapp.homeUrl;

    if (typeof homeUrl === "string" && normalizeUrl(homeUrl) !== normalizeUrl(appUrl)) {
      return {
        reachable: false,
        detail: "Farcaster manifest homeUrl does not match NEXT_PUBLIC_APP_URL.",
      };
    }

    return {
      reachable: true,
      detail: "Farcaster manifest is reachable and points at the configured app URL.",
    };
  } catch {
    return {
      reachable: false,
      detail: "Farcaster manifest could not be fetched from the configured app URL.",
    };
  }
}

function getMiniAppVerificationDetail({
  accountAssociationError,
  accountAssociationValid,
  hostedManifestConfigured,
}: {
  accountAssociationError: string | null;
  accountAssociationValid: boolean;
  hostedManifestConfigured: boolean;
}) {
  if (hostedManifestConfigured) {
    return "Hosted Farcaster manifest redirect is configured.";
  }

  if (accountAssociationValid) {
    return "Signed account association is configured with header, payload, and signature.";
  }

  if (accountAssociationError) {
    return accountAssociationError;
  }

  return "Set FARCASTER_ACCOUNT_ASSOCIATION_JSON before public beta publishing, or set FARCASTER_HOSTED_MANIFEST_ID to use Farcaster's hosted manifest.";
}

function normalizeUrl(value: string) {
  return value.trim().replace(/\/$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
