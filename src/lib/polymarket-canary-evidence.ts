export type PolymarketCanaryScenario = "OPEN_CLOSE" | "NO_FILL" | "LIQUIDATION";

export type PolymarketCanaryEvidence = {
  actualFeeAssets?: string | null;
  actualFillPrice?: string | null;
  actualShares?: string | null;
  actualSpentAssets?: string | null;
  clobOrderId?: string | null;
  clobTradeIds?: string[] | null;
  closeAttemptId?: string | null;
  closeOrderId?: string | null;
  closeReason?: string | null;
  closeTradeIds?: string[] | null;
  conditionId?: string | null;
  custodyAddress?: string | null;
  executionId?: string | null;
  finalState?: string | null;
  loanId?: string | null;
  lpAssetsAfter?: string | null;
  lpAssetsBefore?: string | null;
  polygonTransactionHashes?: string[] | null;
  repaymentTransactionHash?: string | null;
  failureCode?: string | null;
  side?: "YES" | "NO" | null;
  tokenId?: string | null;
};

export function missingPolymarketCanaryEvidence(
  scenario: PolymarketCanaryScenario,
  evidence: PolymarketCanaryEvidence,
) {
  const missing: string[] = [];
  requireText(missing, evidence.executionId, "execution ID");
  requireText(missing, evidence.conditionId, "condition ID");
  requireText(missing, evidence.tokenId, "outcome token ID");
  if (evidence.side !== "YES" && evidence.side !== "NO") missing.push("YES/NO side");
  requireHashes(missing, evidence.polygonTransactionHashes, "Polygon transaction hashes");

  if (scenario === "NO_FILL") {
    if (evidence.finalState !== "FAILED") missing.push("FAILED final state");
    if (evidence.failureCode !== "FOK_NO_FILL") missing.push("FOK_NO_FILL recovery code");
    return missing;
  }

  requireText(missing, evidence.clobOrderId, "CLOB open order ID");
  requireList(missing, evidence.clobTradeIds, "CLOB open trade IDs");
  requireText(missing, evidence.actualFillPrice, "actual fill price");
  requireText(missing, evidence.actualShares, "actual shares");
  requireText(missing, evidence.actualSpentAssets, "actual spent assets");
  requireText(missing, evidence.actualFeeAssets, "actual fee assets");
  requireText(missing, evidence.loanId, "vault loan ID");
  requireText(missing, evidence.custodyAddress, "isolated custody address");
  requireText(missing, evidence.closeAttemptId, "close attempt ID");
  requireText(missing, evidence.closeOrderId, "CLOB close order ID");
  requireList(missing, evidence.closeTradeIds, "CLOB close trade IDs");
  requireText(missing, evidence.repaymentTransactionHash, "vault repayment hash");
  requireText(missing, evidence.lpAssetsBefore, "LP assets before");
  requireText(missing, evidence.lpAssetsAfter, "LP assets after");
  if (evidence.finalState !== "CLOSED") missing.push("CLOSED final state");
  if (scenario === "LIQUIDATION" && evidence.closeReason !== "LIQUIDATION")
    missing.push("LIQUIDATION close reason");
  return missing;
}

export function hasCompletePolymarketCanaryEvidence(
  scenario: PolymarketCanaryScenario,
  evidence: PolymarketCanaryEvidence,
) {
  return missingPolymarketCanaryEvidence(scenario, evidence).length === 0;
}

function requireText(missing: string[], value: string | null | undefined, label: string) {
  if (!value?.trim()) missing.push(label);
}

function requireList(missing: string[], value: string[] | null | undefined, label: string) {
  if (!value?.some((item) => item.trim())) missing.push(label);
}

function requireHashes(missing: string[], value: string[] | null | undefined, label: string) {
  if (!value?.some((item) => /^0x[a-fA-F0-9]{64}$/.test(item))) missing.push(label);
}
