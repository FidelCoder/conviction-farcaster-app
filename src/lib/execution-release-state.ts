import type { ExecutionCapabilities, PolymarketExecutionReadiness } from "./core-api";

export type ExecutionReleaseState = {
  blockingGates: string[];
  canClaimVenueFill: boolean;
  canOpenMargin: boolean;
  mode: "BLOCKED" | "INVITE_ONLY_CANARY" | "PRODUCTION";
  reason: string;
};

export function deriveExecutionReleaseState(
  capabilities: ExecutionCapabilities,
  readiness: PolymarketExecutionReadiness | null,
): ExecutionReleaseState {
  if (!readiness) {
    return {
      blockingGates: ["Core readiness unavailable"],
      canClaimVenueFill: false,
      canOpenMargin: false,
      mode: "BLOCKED",
      reason: "Core did not return a verified Polygon execution readiness record.",
    };
  }

  const failedGates = readiness.gates.filter((gate) => !gate.ready);
  const invariantFailures = readinessInvariantFailures(capabilities, readiness);
  const blockingGates = Array.from(
    new Set([...failedGates.map((gate) => gate.label), ...invariantFailures]),
  );
  const polygon = capabilities.chains.find((chain) => chain.chainId === 137);
  const capabilityEnabled = Boolean(
    capabilities.marginExecutionEnabled &&
      capabilities.leverageEnabled &&
      polygon?.marginExecutionEnabled,
  );
  const verified = readiness.venueFillEnabled && blockingGates.length === 0;
  if (!capabilityEnabled || !verified) {
    return {
      blockingGates:
        blockingGates.length > 0 ? blockingGates : ["Core execution capability disabled"],
      canClaimVenueFill: false,
      canOpenMargin: false,
      mode: "BLOCKED",
      reason:
        readiness.missing[0] ??
        invariantFailures[0] ??
        failedGates[0]?.detail ??
        capabilities.recommendation,
    };
  }

  if (readiness.productionVenueFillEnabled && readiness.status === "READY") {
    return {
      blockingGates: [],
      canClaimVenueFill: true,
      canOpenMargin: true,
      mode: "PRODUCTION",
      reason: "Production readiness and the recorded canary gate are verified.",
    };
  }

  if (readiness.canaryVenueFillEnabled && readiness.status === "READY_FOR_CANARY") {
    return {
      blockingGates: [],
      canClaimVenueFill: true,
      canOpenMargin: true,
      mode: "INVITE_ONLY_CANARY",
      reason: "Execution is limited to configured wallets, markets, and canary caps.",
    };
  }

  return {
    blockingGates: ["Readiness state mismatch"],
    canClaimVenueFill: false,
    canOpenMargin: false,
    mode: "BLOCKED",
    reason: "Core capability and readiness states do not agree. Keep execution disabled.",
  };
}

function readinessInvariantFailures(
  capabilities: ExecutionCapabilities,
  readiness: PolymarketExecutionReadiness,
) {
  const failures: string[] = [];
  const policy = readiness.releasePolicy;

  if (readiness.chainId !== 137) failures.push("Execution chain must be Polygon mainnet");
  if (readiness.custody !== "ONE_POSITION_ONE_ISOLATED_ACCOUNT")
    failures.push("Isolated position custody is not verified");
  if (readiness.orderType !== "FOK") failures.push("Opening orders must use Fill-or-Kill");
  if (readiness.signatureType !== "POLY_1271")
    failures.push("Polymarket isolated-account signatures are not verified");
  if (readiness.missing.length > 0 || policy.missing.length > 0)
    failures.push("Core reports unresolved execution requirements");

  if (readiness.status === "READY_FOR_CANARY") {
    if (
      !readiness.canaryVenueFillEnabled ||
      readiness.productionVenueFillEnabled ||
      policy.mode !== "INVITE_ONLY_CANARY" ||
      policy.canaryPassed ||
      !policy.inviteOnly
    ) {
      failures.push("Invite-only canary state is inconsistent");
    }
    if (policy.allowedWalletsCount < 1) failures.push("Invite-only canary has no approved wallets");
    if (policy.allowedMarketsCount < 1 || policy.allowedMarketsCount > 5)
      failures.push("Invite-only canary must use one through five markets");
    if (
      capabilities.maxPendingMarginLeverage === undefined ||
      capabilities.maxPendingMarginLeverage > 2 ||
      policy.caps.maxLeverageBps > 20_000
    ) {
      failures.push("Invite-only canary exceeds the 2x leverage cap");
    }
    const maxPositionAssets = Number(policy.caps.maxPositionAssets);
    if (!Number.isFinite(maxPositionAssets) || maxPositionAssets <= 0 || maxPositionAssets > 5)
      failures.push("Invite-only canary exceeds the 5 pUSD position cap");
  }

  if (readiness.status === "READY") {
    if (
      !readiness.productionVenueFillEnabled ||
      readiness.canaryVenueFillEnabled ||
      policy.mode !== "PRODUCTION" ||
      !policy.canaryPassed ||
      policy.inviteOnly
    ) {
      failures.push("Production release state is inconsistent");
    }
  }

  return failures;
}
