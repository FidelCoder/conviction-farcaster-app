import Link from "next/link";

import type { Market, Position } from "../lib/core-api";
import { executionStatusLabel, executionStatusNotice } from "../lib/display";
import { getWarpcastShareUrl } from "../lib/miniapp";
import { CopyIntentButton } from "./CopyIntentButton";

const EXPLORER_TX_BASE_BY_CHAIN: Record<number, string> = {
  1: "https://etherscan.io/tx/",
  10: "https://optimistic.etherscan.io/tx/",
  11155111: "https://sepolia.etherscan.io/tx/",
  42161: "https://arbiscan.io/tx/",
  421614: "https://sepolia.arbiscan.io/tx/",
  8453: "https://basescan.org/tx/",
  84532: "https://sepolia.basescan.org/tx/",
};

export function PositionCard({
  copyCount,
  market,
  position,
  showCopyIntent = false,
  sourceSignalId = null,
}: {
  copyCount?: number;
  market?: Market | null;
  position: Position;
  showCopyIntent?: boolean;
  sourceSignalId?: string | null;
}) {
  const notice = executionStatusNotice(position.status);
  const sharePath = "/positions/" + position.id;
  const explorerUrl = getExplorerTxUrl(position.chainId, position.chainTransactionHash);

  return (
    <article className={"card position-card side-" + position.side.toLowerCase()}>
      <div className="card-kicker">
        <span>{position.side}</span>
        <span className="status-pill">{executionStatusLabel(position.status)}</span>
      </div>
      <h3>
        <Link href={"/positions/" + position.id}>{position.quantity} shares</Link>
      </h3>
      <dl className="metric-list">
        <div>
          <dt>Market</dt>
          <dd>
            <Link href={"/markets/" + position.marketId}>{market?.title ?? position.marketId}</Link>
          </dd>
        </div>
        {typeof copyCount === "number" ? (
          <div>
            <dt>Copy count</dt>
            <dd>{copyCount}</dd>
          </div>
        ) : null}
        <div>
          <dt>Entry price</dt>
          <dd>{position.averageEntryPrice ?? "No confirmed execution"}</dd>
        </div>
        {position.observedMarketPrice ? (
          <div>
            <dt>Observed price</dt>
            <dd>{position.observedMarketPrice}</dd>
          </div>
        ) : null}
        {position.executionMode ? (
          <div>
            <dt>Mode</dt>
            <dd>{position.executionMode}</dd>
          </div>
        ) : null}
        {position.leverageMultiplier ? (
          <div>
            <dt>Leverage</dt>
            <dd>{position.leverageMultiplier}x</dd>
          </div>
        ) : null}
        {position.chainId ? (
          <div>
            <dt>Chain</dt>
            <dd>{formatChainId(position.chainId)}</dd>
          </div>
        ) : null}
        {position.walletAddress ? (
          <div>
            <dt>Wallet</dt>
            <dd>{truncateHash(position.walletAddress)}</dd>
          </div>
        ) : null}
        {position.chainTransactionHash ? (
          <div>
            <dt>Transaction</dt>
            <dd>
              {explorerUrl ? (
                <a href={explorerUrl} rel="noreferrer" target="_blank">
                  {truncateHash(position.chainTransactionHash)}
                </a>
              ) : (
                truncateHash(position.chainTransactionHash)
              )}
            </dd>
          </div>
        ) : null}
      </dl>
      {notice ? <p className="notice">{notice}</p> : null}
      {showCopyIntent ? (
        <CopyIntentButton positionId={position.id} sourceSignalId={sourceSignalId} />
      ) : null}
      <a
        className="secondary-link"
        href={getWarpcastShareUrl({
          path: sharePath,
          text: position.side + " position intent on Conviction Markets",
        })}
        rel="noreferrer"
        target="_blank"
      >
        Share on Farcaster
      </a>
    </article>
  );
}

function getExplorerTxUrl(chainId: number | null | undefined, hash: string | null | undefined) {
  if (!chainId || !hash) return null;
  const baseUrl = EXPLORER_TX_BASE_BY_CHAIN[chainId];

  return baseUrl ? baseUrl + hash : null;
}

function formatChainId(chainId: number) {
  if (chainId === 1) return "Ethereum";
  if (chainId === 10) return "Optimism";
  if (chainId === 11155111) return "Ethereum Sepolia";
  if (chainId === 42161) return "Arbitrum";
  if (chainId === 421614) return "Arbitrum Sepolia";
  if (chainId === 8453) return "Base";
  if (chainId === 84532) return "Base Sepolia";

  return "Chain " + chainId;
}

function truncateHash(value: string) {
  return value.length > 14 ? value.slice(0, 6) + "..." + value.slice(-4) : value;
}
