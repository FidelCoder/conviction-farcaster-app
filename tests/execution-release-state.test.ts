import assert from "node:assert/strict";
import test from "node:test";

import type { ExecutionCapabilities, PolymarketExecutionReadiness } from "../src/lib/core-api";
import { deriveExecutionReleaseState } from "../src/lib/execution-release-state";

function capabilities(enabled = true): ExecutionCapabilities {
  return {
    evmOnly: true,
    architecture: "INTENT_FIRST_MULTICHAIN_MARGIN_LAYER",
    spotExecutionEnabled: false,
    marginExecutionEnabled: enabled,
    leverageEnabled: enabled,
    leverageRequiresContracts: true,
    maxPendingMarginLeverage: 2,
    activeAdapters: enabled ? ["POLYMARKET_CLOB_ADAPTER"] : [],
    recommendation: enabled ? "Canary ready" : "Execution disabled",
    chains: [
      {
        chainId: 137,
        chainName: "Polygon",
        ecosystem: "EVM",
        network: "mainnet",
        spotExecutionEnabled: false,
        marginExecutionEnabled: enabled,
        contractRequiredForMargin: true,
        plannedAdapters: [],
      },
    ],
  };
}

function readiness(
  mode: "READY" | "READY_FOR_CANARY" | "BLOCKED" = "READY_FOR_CANARY",
): PolymarketExecutionReadiness {
  const ready = mode !== "BLOCKED";
  return {
    status: mode,
    venueFillEnabled: ready,
    canaryVenueFillEnabled: mode === "READY_FOR_CANARY",
    productionVenueFillEnabled: mode === "READY",
    chainId: 137,
    custody: "ONE_POSITION_ONE_ISOLATED_ACCOUNT",
    orderType: "FOK",
    signatureType: "POLY_1271",
    gates: [{ id: "contracts", label: "Vault contracts", ready, detail: "Verified" }],
    releasePolicy: {
      mode: mode === "READY" ? "PRODUCTION" : "INVITE_ONLY_CANARY",
      canaryPassed: mode === "READY",
      inviteOnly: mode !== "READY",
      allowedWalletsCount: 1,
      allowedMarketsCount: 3,
      caps: {
        dailyLossLimitAssets: "25",
        maxLeverageBps: 20_000,
        maxPositionAssets: "5",
        maxTvlAssets: "1000",
        maxUtilizationBps: 5_000,
      },
      dailyRealizedLossAssets: "0",
      currentTvlAssets: "100",
      currentUtilizationBps: 1_000,
      missing: [],
    },
    missing: ready ? [] : ["Vault contracts are blocked."],
    warnings: [],
  };
}

test("fails closed when Core readiness is unavailable", () => {
  const state = deriveExecutionReleaseState(capabilities(), null);
  assert.equal(state.mode, "BLOCKED");
  assert.equal(state.canOpenMargin, false);
  assert.equal(state.canClaimVenueFill, false);
});

test("enables only the invite-only canary when every capability and gate agrees", () => {
  const state = deriveExecutionReleaseState(capabilities(), readiness());
  assert.equal(state.mode, "INVITE_ONLY_CANARY");
  assert.equal(state.canOpenMargin, true);
  assert.equal(state.canClaimVenueFill, true);
});

test("blocks execution on either a failed gate or capability mismatch", () => {
  const gateBlocked = deriveExecutionReleaseState(capabilities(), readiness("BLOCKED"));
  assert.equal(gateBlocked.mode, "BLOCKED");
  assert.ok(gateBlocked.blockingGates.includes("Vault contracts"));
  assert.ok(gateBlocked.blockingGates.includes("Core reports unresolved execution requirements"));

  const capabilityBlocked = deriveExecutionReleaseState(
    capabilities(false),
    readiness("READY_FOR_CANARY"),
  );
  assert.equal(capabilityBlocked.mode, "BLOCKED");
});

test("blocks internally contradictory readiness records", () => {
  const wrongOrderType = readiness();
  Object.assign(wrongOrderType, { orderType: "GTC" });
  const orderState = deriveExecutionReleaseState(capabilities(), wrongOrderType);
  assert.equal(orderState.mode, "BLOCKED");
  assert.ok(orderState.blockingGates.includes("Opening orders must use Fill-or-Kill"));

  const unresolved = readiness();
  unresolved.missing = ["Signer verification is incomplete"];
  assert.equal(deriveExecutionReleaseState(capabilities(), unresolved).mode, "BLOCKED");
});

test("enforces conservative invite-only canary caps", () => {
  const overLeverage = readiness();
  overLeverage.releasePolicy.caps.maxLeverageBps = 30_000;
  assert.ok(
    deriveExecutionReleaseState(capabilities(), overLeverage).blockingGates.includes(
      "Invite-only canary exceeds the 2x leverage cap",
    ),
  );

  const tooManyMarkets = readiness();
  tooManyMarkets.releasePolicy.allowedMarketsCount = 6;
  assert.equal(deriveExecutionReleaseState(capabilities(), tooManyMarkets).mode, "BLOCKED");
});

test("claims production only after the explicit production readiness state", () => {
  const state = deriveExecutionReleaseState(capabilities(), readiness("READY"));
  assert.equal(state.mode, "PRODUCTION");
  assert.equal(state.canOpenMargin, true);
});
