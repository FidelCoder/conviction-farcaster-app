declare module "thirdweb" {
  export type ThirdwebClient = unknown;
  export function createThirdwebClient(input: { clientId: string }): ThirdwebClient;
}

declare module "thirdweb/chains" {
  export type ThirdwebChain = { id: number; name?: string };
  export const arbitrumSepolia: ThirdwebChain;
  export const base: ThirdwebChain;
  export const baseSepolia: ThirdwebChain;
  export const sepolia: ThirdwebChain;
}

declare module "thirdweb/wallets" {
  export type ThirdwebWallet = unknown;
  export function createWallet(id: string): ThirdwebWallet;
  export function inAppWallet(input: { auth: { options: Array<"google"> } }): ThirdwebWallet;
}

declare module "thirdweb/react" {
  import type { ComponentType, ReactNode } from "react";

  export type ThirdwebAccount = { address?: string };
  export type ThirdwebActiveWallet = unknown;

  export const ThirdwebProvider: ComponentType<{ children?: ReactNode }>;
  export const ConnectButton: ComponentType<Record<string, unknown>>;
  export function useActiveAccount(): ThirdwebAccount | undefined;
  export function useActiveWallet(): ThirdwebActiveWallet | undefined;
  export function useDisconnect(): { disconnect: (wallet: ThirdwebActiveWallet) => Promise<void> | void };
}
