import { createPublicClient, erc20Abi, formatUnits, http, isAddress, type Address } from "viem";
import { arbitrumSepolia, base, baseSepolia, sepolia } from "viem/chains";

import type { ExecutionCapabilities } from "./core-api";
import { resolveVaultCollateral } from "./vault-token-config";
import type { PortfolioWalletBalance, Vault } from "../zip-ui/types";

type TokenBalanceResult = {
  availableBalance: PortfolioWalletBalance;
  depositedBalance: PortfolioWalletBalance;
  lockedBalance: PortfolioWalletBalance;
  totalVaultBalance: PortfolioWalletBalance;
  vaultId: string;
};

type BalanceCacheEntry = {
  expiresAt: number;
  result: TokenBalanceResult;
};

const supportedChains = [baseSepolia, sepolia, arbitrumSepolia, base] as const;
const balanceCache = new Map<string, BalanceCacheEntry>();
const BALANCE_CACHE_MS = 30000;
const VAULT_ACCOUNTING_ABI = [
  {
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "address" },
    ],
    name: "availableBalance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "address" },
    ],
    name: "lockedBalance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export async function readVaultWalletBalances(input: {
  address: string;
  execution: ExecutionCapabilities;
  vaults: Vault[];
}) {
  const walletAddress = normalizeAddress(input.address);

  if (!walletAddress) {
    return {
      depositedBalances: {} as Record<string, PortfolioWalletBalance>,
      lockedBalances: {} as Record<string, PortfolioWalletBalance>,
      totalVaultBalances: {} as Record<string, PortfolioWalletBalance>,
      walletBalances: {} as Record<string, PortfolioWalletBalance>,
    };
  }

  const supportedVaults = input.vaults.filter((vault) => {
    return Boolean(
      vault.chainId &&
        vault.collateralTokenAddress &&
        isAddress(vault.collateralTokenAddress),
    );
  });

  const results = await mapWithConcurrency(supportedVaults, 2, (vault) =>
    readVaultTokenBalance(vault, walletAddress, input.execution),
  );

  return results.reduce<{
    depositedBalances: Record<string, PortfolioWalletBalance>;
    lockedBalances: Record<string, PortfolioWalletBalance>;
    totalVaultBalances: Record<string, PortfolioWalletBalance>;
    walletBalances: Record<string, PortfolioWalletBalance>;
  }>(
    (balances, result) => {
      balances.walletBalances[result.vaultId] = result.availableBalance;
      balances.depositedBalances[result.vaultId] = result.depositedBalance;
      balances.lockedBalances[result.vaultId] = result.lockedBalance;
      balances.totalVaultBalances[result.vaultId] = result.totalVaultBalance;
      return balances;
    },
    { depositedBalances: {}, lockedBalances: {}, totalVaultBalances: {}, walletBalances: {} },
  );
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
  const cacheKey = [walletAddress, vault.id, vault.chainId, vault.collateralTokenAddress].join(":").toLowerCase();
  const cached = balanceCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const chain = findExecutionChain(execution, vault);
  const chainId = vault.chainId ?? chain?.chainId ?? 0;
  const collateral = resolveVaultCollateral({
    chainId,
    chainName: vault.chainName ?? chain?.chainName,
    tokenAddress: vault.collateralTokenAddress ?? chain?.collateralTokenAddress,
    tokenDecimals: vault.collateralTokenDecimals ?? chain?.collateralTokenDecimals,
    tokenSymbol: vault.asset ?? chain?.collateralTokenSymbol,
  });
  const tokenAddress = normalizeAddress(collateral.tokenAddress ?? undefined);
  const vaultAddress = normalizeAddress(chain?.vaultAddress ?? undefined);
  const chainName = collateral.chainName;
  const decimals = collateral.tokenDecimals ?? 18;
  const symbol = collateral.tokenSymbol === "WETH" ? "WETH" : "USDC";

  if (!tokenAddress || !chainId) {
    return {
      vaultId: vault.id,
      availableBalance: createErrorBalance({
        chainId,
        chainName,
        decimals,
        message: "Vault token metadata is missing.",
        symbol,
        tokenAddress: collateral.tokenAddress ?? "",
      }),
      lockedBalance: createErrorBalance({
        chainId,
        chainName,
        decimals,
        message: "Vault token metadata is missing.",
        symbol,
        tokenAddress: collateral.tokenAddress ?? "",
      }),
      totalVaultBalance: createErrorBalance({
        chainId,
        chainName,
        decimals,
        message: "Vault token metadata is missing.",
        symbol,
        tokenAddress: collateral.tokenAddress ?? "",
      }),
      depositedBalance: createErrorBalance({
        chainId,
        chainName,
        decimals,
        message: "Vault token metadata is missing.",
        symbol,
        tokenAddress: collateral.tokenAddress ?? "",
      }),
    };
  }

  const viemChain = supportedChains.find((supportedChain) => supportedChain.id === chainId);

  if (!viemChain) {
    return {
      vaultId: vault.id,
      availableBalance: createErrorBalance({
        chainId,
        chainName,
        decimals,
        message: "No public RPC route is configured for this vault chain.",
        symbol,
        tokenAddress,
      }),
      lockedBalance: createErrorBalance({
        chainId,
        chainName,
        decimals,
        message: "No public RPC route is configured for this vault chain.",
        symbol,
        tokenAddress,
      }),
      totalVaultBalance: createErrorBalance({
        chainId,
        chainName,
        decimals,
        message: "No public RPC route is configured for this vault chain.",
        symbol,
        tokenAddress,
      }),
      depositedBalance: createErrorBalance({
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
    const client = createPublicClient({ chain: viemChain, transport: http(getRpcUrl(chainId)) });
    const [rawWalletBalance, rawDepositedBalance, rawLockedBalance] = await Promise.all([
      client.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [walletAddress],
      }),
      vaultAddress
        ? client.readContract({
            address: vaultAddress,
            abi: VAULT_ACCOUNTING_ABI,
            functionName: "availableBalance",
            args: [walletAddress, tokenAddress],
          })
        : Promise.resolve(BigInt(0)),
      vaultAddress
        ? client.readContract({
            address: vaultAddress,
            abi: VAULT_ACCOUNTING_ABI,
            functionName: "lockedBalance",
            args: [walletAddress, tokenAddress],
          })
        : Promise.resolve(BigInt(0)),
    ]);
    const rawTotalVaultBalance = rawDepositedBalance + rawLockedBalance;

    const result = {
      vaultId: vault.id,
      availableBalance: createReadyBalance({
        amount: rawWalletBalance,
        chainId,
        chainName,
        decimals,
        symbol,
        tokenAddress,
      }),
      lockedBalance: createReadyBalance({
        amount: rawLockedBalance,
        chainId,
        chainName,
        decimals,
        symbol,
        tokenAddress,
      }),
      totalVaultBalance: createReadyBalance({
        amount: rawTotalVaultBalance,
        chainId,
        chainName,
        decimals,
        symbol,
        tokenAddress,
      }),
      depositedBalance: createReadyBalance({
        amount: rawDepositedBalance,
        chainId,
        chainName,
        decimals,
        symbol,
        tokenAddress,
      }),
    };

    balanceCache.set(cacheKey, { expiresAt: Date.now() + BALANCE_CACHE_MS, result });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token balance read failed.";

    return {
      vaultId: vault.id,
      availableBalance: createErrorBalance({
        chainId,
        chainName,
        decimals,
        message,
        symbol,
        tokenAddress,
      }),
      lockedBalance: createErrorBalance({
        chainId,
        chainName,
        decimals,
        message,
        symbol,
        tokenAddress,
      }),
      totalVaultBalance: createErrorBalance({
        chainId,
        chainName,
        decimals,
        message,
        symbol,
        tokenAddress,
      }),
      depositedBalance: createErrorBalance({
        chainId,
        chainName,
        decimals,
        message,
        symbol,
        tokenAddress,
      }),
    };
  }
}

function createReadyBalance(input: {
  amount: bigint;
  chainId: number;
  chainName: string;
  decimals: number;
  symbol: string;
  tokenAddress: string;
}): PortfolioWalletBalance {
  const formatted = formatUnits(input.amount, input.decimals);
  const amount = Number(formatted);

  return {
    amount: Number.isFinite(amount) ? amount : 0,
    chainId: input.chainId,
    chainName: input.chainName,
    decimals: input.decimals,
    formatted,
    raw: input.amount.toString(),
    status: "ready",
    symbol: input.symbol,
    tokenAddress: input.tokenAddress,
    updatedAt: new Date().toISOString(),
  };
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

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
) {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += limit) {
    const chunk = items.slice(index, index + limit);
    results.push(...(await Promise.all(chunk.map(mapper))));
  }

  return results;
}

function getRpcUrl(chainId: number) {
  const urls: Record<number, string> = {
    84532: "https://sepolia.base.org",
    11155111: "https://ethereum-sepolia-rpc.publicnode.com",
    421614: "https://sepolia-rollup.arbitrum.io/rpc",
  };

  return urls[chainId];
}

function findExecutionChain(execution: ExecutionCapabilities, vault: Vault) {
  return execution.chains.find((chain) => chain.chainId === vault.chainId);
}

function normalizeAddress(value: string | null | undefined) {
  if (!value) return null;

  const trimmed = value.trim();

  return isAddress(trimmed) ? (trimmed as Address) : null;
}
