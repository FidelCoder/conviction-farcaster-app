import type { ExecutionCapabilities } from "./core-api";
import { resolveVaultCollateral } from "./vault-token-config";
import type { Vault } from "../zip-ui/types";

export function mapExecutionToVaults(execution: ExecutionCapabilities): Vault[] {
  const chains = execution.chains.filter((chain) => chain.walletFlowEnabled || chain.vaultAddress);

  return chains.map((chain, index) => {
    const collateral = resolveVaultCollateral({
      chainId: chain.chainId,
      chainName: chain.chainName,
      tokenAddress: chain.collateralTokenAddress,
      tokenDecimals: chain.collateralTokenDecimals,
      tokenSymbol: chain.collateralTokenSymbol,
    });
    const collateralSymbol = collateral.tokenSymbol ?? chain.collateralTokenSymbol ?? "USDC";

    return {
      id: "chain-" + chain.chainId,
      name: chain.chainName + " " + collateralSymbol + " Vault",
      riskTag: chain.network === "mainnet" ? "Low Risk" : "High Risk",
      apy: 0,
      apyType: chain.marginExecutionEnabled ? "Variable Yield" : "Base Yield",
      tvl: chain.vaultAddress ? "Configured" : "Not deployed",
      utilization: 0,
      healthRatio: 0,
      maxLeverage: execution.maxPendingMarginLeverage ?? 10,
      asset: collateralSymbol === "WETH" ? "WETH" : collateralSymbol === "pUSD" ? "pUSD" : "USDC",
      accentColor: index % 2 === 0 ? "orange" : "purple",
      userDeposited: 0,
      chainId: chain.chainId,
      chainName: collateral.chainName,
      collateralTokenAddress: collateral.tokenAddress,
      collateralTokenDecimals: collateral.tokenDecimals,
    };
  });
}

export function mergeReadyVaultBalances(
  currentBalances: Record<string, number>,
  depositedBalances: Record<string, { amount: number; status: string }>,
) {
  return Object.entries(depositedBalances).reduce(
    (balances, [vaultId, balance]) => {
      if (balance.status === "ready") {
        balances[vaultId] = balance.amount;
      }

      return balances;
    },
    { ...currentBalances },
  );
}
