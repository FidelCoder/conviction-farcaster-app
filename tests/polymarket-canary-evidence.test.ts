import assert from "node:assert/strict";
import test from "node:test";

import {
  hasCompletePolymarketCanaryEvidence,
  missingPolymarketCanaryEvidence,
  type PolymarketCanaryEvidence,
} from "../src/lib/polymarket-canary-evidence";

const transactionHash = `0x${"a".repeat(64)}`;

function closedEvidence(): PolymarketCanaryEvidence {
  return {
    actualFeeAssets: "0.01",
    actualFillPrice: "0.42",
    actualShares: "20",
    actualSpentAssets: "8.4",
    clobOrderId: "open-order",
    clobTradeIds: ["open-trade"],
    closeAttemptId: "close-attempt",
    closeOrderId: "close-order",
    closeReason: "VOLUNTARY",
    closeTradeIds: ["close-trade"],
    conditionId: `0x${"b".repeat(64)}`,
    custodyAddress: `0x${"c".repeat(40)}`,
    executionId: "execution",
    finalState: "CLOSED",
    loanId: `0x${"d".repeat(64)}`,
    lpAssetsAfter: "100.05",
    lpAssetsBefore: "100",
    polygonTransactionHashes: [transactionHash],
    repaymentTransactionHash: transactionHash,
    side: "YES",
    tokenId: "123",
  };
}

test("accepts complete open-close evidence only when source IDs and hashes exist", () => {
  assert.equal(hasCompletePolymarketCanaryEvidence("OPEN_CLOSE", closedEvidence()), true);
  assert.ok(
    missingPolymarketCanaryEvidence("OPEN_CLOSE", {
      ...closedEvidence(),
      clobTradeIds: [],
    }).includes("CLOB open trade IDs"),
  );
});

test("requires explicit failed no-fill recovery evidence", () => {
  const noFill: PolymarketCanaryEvidence = {
    conditionId: `0x${"b".repeat(64)}`,
    executionId: "execution",
    failureCode: "FOK_NO_FILL",
    finalState: "FAILED",
    polygonTransactionHashes: [transactionHash],
    side: "NO",
    tokenId: "456",
  };
  assert.equal(hasCompletePolymarketCanaryEvidence("NO_FILL", noFill), true);
  assert.ok(
    missingPolymarketCanaryEvidence("NO_FILL", { ...noFill, failureCode: null }).includes(
      "FOK_NO_FILL recovery code",
    ),
  );
});

test("does not label a normal close as liquidation evidence", () => {
  const evidence = closedEvidence();
  assert.ok(
    missingPolymarketCanaryEvidence("LIQUIDATION", evidence).includes("LIQUIDATION close reason"),
  );
  assert.equal(
    hasCompletePolymarketCanaryEvidence("LIQUIDATION", {
      ...evidence,
      closeReason: "LIQUIDATION",
    }),
    true,
  );
});
