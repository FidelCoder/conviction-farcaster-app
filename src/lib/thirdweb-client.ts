import { createThirdwebClient } from "thirdweb";
import { arbitrumSepolia, base, baseSepolia, sepolia } from "thirdweb/chains";
import { createWallet, inAppWallet } from "thirdweb/wallets";

export const thirdwebClientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ?? "";

export const thirdwebClient = createThirdwebClient({
  clientId: thirdwebClientId || "missing-thirdweb-client-id",
});

export const convictionThirdwebChains = [baseSepolia, sepolia, arbitrumSepolia, base] as const;

export const convictionAccountAbstraction = {
  chain: baseSepolia,
  sponsorGas: true,
} as const;

const googleWallet = inAppWallet({
  auth: {
    options: ["google"],
  },
});

export const convictionSmartWallets = [googleWallet];

export const convictionEoaWallets = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
  createWallet("com.trustwallet.app"),
  createWallet("com.okex.wallet"),
  createWallet("app.phantom"),
];

export function isThirdwebConfigured() {
  return thirdwebClientId.trim().length > 0;
}

export function getThirdwebChain(chainId: number) {
  return convictionThirdwebChains.find((chain) => chain.id === chainId) ?? null;
}
