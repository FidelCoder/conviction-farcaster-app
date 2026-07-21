import { isAddress, type Address } from "viem";

export type VaultCollateralConfig = {
  chainId: number;
  chainName: string;
  tokenAddress: Address;
  tokenDecimals: number;
  tokenSymbol: "USDC" | "pUSD";
};

const configuredVaultCollateralByChainId: Record<number, VaultCollateralConfig> = {
  137: {
    chainId: 137,
    chainName: "Polygon",
    tokenAddress: "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB",
    tokenDecimals: 6,
    tokenSymbol: "pUSD",
  },
  84532: {
    chainId: 84532,
    chainName: "Base Sepolia",
    tokenAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    tokenDecimals: 6,
    tokenSymbol: "USDC",
  },
  11155111: {
    chainId: 11155111,
    chainName: "Ethereum Sepolia",
    tokenAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    tokenDecimals: 6,
    tokenSymbol: "USDC",
  },
  421614: {
    chainId: 421614,
    chainName: "Arbitrum Sepolia",
    tokenAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    tokenDecimals: 6,
    tokenSymbol: "USDC",
  },
};

export function getConfiguredVaultCollateral(chainId: number | null | undefined) {
  if (!chainId) return null;

  return configuredVaultCollateralByChainId[chainId] ?? null;
}

export function resolveVaultCollateral(input: {
  chainId: number | null | undefined;
  chainName?: string | null;
  tokenAddress?: string | null;
  tokenDecimals?: number | null;
  tokenSymbol?: string | null;
}) {
  const configured = getConfiguredVaultCollateral(input.chainId);
  const normalizedAddress = normalizeAddress(input.tokenAddress);

  return {
    chainName: input.chainName ?? configured?.chainName ?? "Unknown chain",
    tokenAddress: normalizedAddress ?? configured?.tokenAddress ?? null,
    tokenDecimals: input.tokenDecimals ?? configured?.tokenDecimals ?? null,
    tokenSymbol: input.tokenSymbol ?? configured?.tokenSymbol ?? null,
  };
}

function normalizeAddress(value: string | null | undefined) {
  if (!value) return null;

  const trimmed = value.trim();

  return isAddress(trimmed) ? (trimmed as Address) : null;
}
