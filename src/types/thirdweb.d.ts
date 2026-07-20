declare module "thirdweb" {
  export type ThirdwebClient = unknown;
  export type ThirdwebChain = { id: number; name?: string };
  export type ThirdwebAccount = {
    address: string;
    sendTransaction?: (transaction: unknown) => Promise<{ transactionHash: string }>;
    signMessage?: (input: { message: string }) => Promise<string>;
  };
  export type ThirdwebContract = { address: string; chain: ThirdwebChain; client: ThirdwebClient };
  export function createThirdwebClient(input: { clientId: string }): ThirdwebClient;
  export function getContract(input: {
    address: string;
    chain: ThirdwebChain;
    client: ThirdwebClient;
  }): ThirdwebContract;
  export function prepareTransaction(input: {
    chain: ThirdwebChain;
    client: ThirdwebClient;
    data?: string;
    to: string;
    value?: bigint;
  }): unknown;
  export function readContract(input: {
    contract: ThirdwebContract;
    method: string;
    params?: unknown[];
  }): Promise<unknown>;
  export function sendTransaction(input: {
    account: ThirdwebAccount;
    transaction: unknown;
  }): Promise<{ transactionHash: string }>;
  export function waitForReceipt(input: {
    chain: ThirdwebChain;
    client: ThirdwebClient;
    transactionHash: string;
  }): Promise<unknown>;
}

declare module "thirdweb/chains" {
  import type { ThirdwebChain } from "thirdweb";

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
  import type { ThirdwebAccount } from "thirdweb";

  export type ThirdwebActiveWallet = unknown;

  export const ThirdwebProvider: ComponentType<{ children?: ReactNode }>;
  export const ConnectButton: ComponentType<Record<string, unknown>>;
  export function useActiveAccount(): ThirdwebAccount | undefined;
  export function useActiveWallet(): ThirdwebActiveWallet | undefined;
  export function useDisconnect(): { disconnect: (wallet: ThirdwebActiveWallet) => Promise<void> | void };
}
