import { createPublicClient, erc20Abi, formatUnits, http, isAddress, type Address } from "viem";
import { arbitrumSepolia, base, baseSepolia, sepolia } from "viem/chains";

import type { ExecutionCapabilities } from "./core-api";
import type { PortfolioWalletBalance, Vault } from "../zip-ui/types";

type TokenBalanceResult = {
  balance: PortfolioWalletBalance;
  vaultId: string;
};

const supportedChains = [baseSepolia, sepolia, arbitrumSepolia, base] as const;

export async function readVaultWalletBalances(input: {
  address: string;
  execution: ExecutionCapabilities;
  vaults: Vault[];
}) {
  const walletAddress = normalizeAddress(input.address);

  if (!walletAddress) {
    return {} as Record<string, PortfolioWalletBalance>;
  }

  const supportedVaults = input.vaults.filter((vault) => {
    return Boolean(
      vault.chainId &&
        vault.collateralTokenAddress &&
        isAddress(vault.collateralTokenAddress),
    );
  });

  const results = await Promise.all(
    supportedVaults.map((vault) => readVaultTokenBalance(vault, walletAddress, input.execution)),
  );

  return results.reduce<Record<string, PortfolioWalletBalance>>((balances, result) => {
    balances[result.vaultId] = result.balance;
    return balances;
  }, {});
}

export function getVaultAvailableBalance(input: {
  portfolio: {
    usdcBalance: number;
    walletBalances?: Record<string, PortfolioWalletBalance>;
    wethBalance: number;
  };
  vault: Vault;
}) {
  const liveBalance = input.portfolio.walletBalances?.[input.vault.id];

  if (liveBalance?.status === "ready") {
    return liveBalance.amount;
  }

  return input.vault.asset === "USDC" ? input.portfolio.usdcBalance : input.portfolio.wethBalance;
}

async function readVaultTokenBalance(
  vault: Vault,
  walletAddress: Address,
  execution: ExecutionCapabilities,
): Promise<TokenBalanceResult> {
  const chain = findExecutionChain(execution, vault);
  const tokenAddress = normalizeAddress(vault.collateralTokenAddress ?? undefined);
  const chainId = vault.chainId ?? chain?.chainId ?? 0;
  const chainName = vault.chainName ?? chain?.chainName ?? "Unknown chain";
  const decimals = vault.collateralTokenDecimals ?? chain?.collateralTokenDecimals ?? 18;
  const symbol = vault.asset;

  if (!tokenAddress || !chainId) {
    return {
      vaultId: vault.id,
      balance: createErrorBalance({
        chainId,
        chainName,
        decimals,
        message: "Vault token metadata is missing.",
        symbol,
        tokenAddress: vault.collateralTokenAddress ?? "",
      }),
    };
  }

  const viemChain = supportedChains.find((supportedChain) => supportedChain.id === chainId);

  if (!viemChain) {
    return {
      vaultId: vault.id,
      balance: createErrorBalance({
        chainId,
        chainName,
        decimals,
        message: "No public RPC route is configured for this vault chain.",
        symbol,
        tokenAddress,
      }),
    };
  }

  try {
    const client = createPublicClient({ chain: viemChain, transport: http() });
    const rawBalance = await client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [walletAddress],
    });
    const formatted = formatUnits(rawBalance, decimals);
    const amount = Number(formatted);

    return {
      vaultId: vault.id,
      balance: {
        amount: Number.isFinite(amount) ? amount : 0,
        chainId,
        chainName,
        decimals,
        formatted,
        raw: rawBalance.toString(),
        status: "ready",
        symbol,
        tokenAddress,
        updatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      vaultId: vault.id,
      balance: createErrorBalance({
        chainId,
        chainName,
        decimals,
        message: error instanceof Error ? error.message : "Token balance read failed.",
        symbol,
        tokenAddress,
      }),
    };
  }
}

function createErrorBalance(input: {
  chainId: number;
  chainName: string;
  decimals: number;
  message: string;
  symbol: string;
  tokenAddress: string;
}): PortfolioWalletBalance {
  return {
    amount: 0,
    chainId: input.chainId,
    chainName: input.chainName,
    decimals: input.decimals,
    error: input.message,
    formatted: "0",
    raw: "0",
    status: "error",
    symbol: input.symbol,
    tokenAddress: input.tokenAddress,
    updatedAt: new Date().toISOString(),
  };
}

function findExecutionChain(execution: ExecutionCapabilities, vault: Vault) {
  return execution.chains.find((chain) => chain.chainId === vault.chainId);
}

function normalizeAddress(value: string | null | undefined) {
  if (!value) return null;

  const trimmed = value.trim();

  return isAddress(trimmed) ? (trimmed as Address) : null;
}
