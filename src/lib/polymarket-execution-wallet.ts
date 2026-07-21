"use client";

import { decodeFunctionResult, encodeFunctionData, erc20Abi, parseUnits } from "viem";

import type { ExecutionWalletCall, SerializedTypedData } from "./core-api";
import { getStoredBrowserSessionWalletKind } from "./browser-wallet-session";
import { resolveEvmWalletProvider, type EthereumProvider } from "./evm-wallet-provider";

const polygonChainId = 137;
const polygonChainHex = "0x89";
const transactionPollIntervalMs = 1_500;
const transactionPollLimit = 80;
const pendingReservationPrefix = "conviction-polygon-reservation:";

type AllowanceCheck = {
  owner: string;
  spender: string;
  token: string;
  requiredAssets: string;
};

type SmartTypedDataRequest = {
  address: string;
  requestId: string;
  typedData: SerializedTypedData;
};

type SmartTransactionRequest = {
  address: string;
  allowanceCheck?: AllowanceCheck;
  call: ExecutionWalletCall;
  requestId: string;
};

type BridgeResult = {
  requestId: string;
  signature?: string;
  transactionHash?: string;
  skipped?: boolean;
};
type BridgeError = { requestId: string; message: string };

export function createExecutionRequestIdentity(prefix: string) {
  return {
    idempotencyKey: `conviction-${prefix}-${crypto.randomUUID()}`,
    nonce: randomBytes32(),
  };
}

export function getPendingReservationHash(executionId: string) {
  if (typeof window === "undefined") return null;
  const hash = window.localStorage.getItem(pendingReservationPrefix + executionId);
  return hash && /^0x[a-fA-F0-9]{64}$/.test(hash) ? hash : null;
}

export function rememberPendingReservationHash(executionId: string, hash: string) {
  if (typeof window === "undefined" || !/^0x[a-fA-F0-9]{64}$/.test(hash)) return;
  window.localStorage.setItem(pendingReservationPrefix + executionId, hash.toLowerCase());
}

export function clearPendingReservationHash(executionId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(pendingReservationPrefix + executionId);
}

export async function signPolymarketTypedData(address: string, typedData: SerializedTypedData) {
  if (getStoredBrowserSessionWalletKind() === "smart") {
    const requestId = crypto.randomUUID();
    const result = await waitForBridgeResult(
      "conviction-thirdweb-typed-data-result",
      "conviction-thirdweb-typed-data-error",
      requestId,
      () =>
        window.dispatchEvent(
          new CustomEvent<SmartTypedDataRequest>("conviction-thirdweb-sign-typed-data", {
            detail: { address, requestId, typedData },
          }),
        ),
    );
    if (!result.signature)
      throw new Error("Smart wallet did not return an authorization signature.");
    return result.signature;
  }

  const provider = await requireEoaProvider(address);
  await ensurePolygonChain(provider);
  const signature = await provider.request({
    method: "eth_signTypedData_v4",
    params: [address, JSON.stringify(typedData)],
  });
  if (typeof signature !== "string" || !/^0x[a-fA-F0-9]+$/.test(signature)) {
    throw new Error("Wallet did not return a valid authorization signature.");
  }
  return signature;
}

export async function sendPolymarketWalletCall(
  address: string,
  call: ExecutionWalletCall,
  allowanceCheck?: AllowanceCheck,
) {
  if (call.chainId !== polygonChainId)
    throw new Error("Polymarket execution calls must use Polygon.");

  if (getStoredBrowserSessionWalletKind() === "smart") {
    const requestId = crypto.randomUUID();
    const result = await waitForBridgeResult(
      "conviction-thirdweb-execution-result",
      "conviction-thirdweb-execution-error",
      requestId,
      () =>
        window.dispatchEvent(
          new CustomEvent<SmartTransactionRequest>("conviction-thirdweb-execution", {
            detail: { address, allowanceCheck, call, requestId },
          }),
        ),
    );
    if (result.skipped) return null;
    if (!result.transactionHash) throw new Error("Smart wallet did not return a transaction hash.");
    return result.transactionHash;
  }

  const provider = await requireEoaProvider(address);
  await ensurePolygonChain(provider);
  if (allowanceCheck && (await hasSufficientAllowance(provider, allowanceCheck))) return null;

  const hash = await provider.request({
    method: "eth_sendTransaction",
    params: [{ data: call.data, from: address, to: call.to, value: toHexQuantity(call.value) }],
  });
  if (typeof hash !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    throw new Error("Wallet did not return a valid Polygon transaction hash.");
  }
  await waitForEoaReceipt(provider, hash);
  return hash;
}

async function requireEoaProvider(expectedAddress: string) {
  const provider = await resolveEvmWalletProvider();
  if (!provider)
    throw new Error("No browser wallet is available. Open Conviction in your EVM wallet browser.");
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const address = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null;
  if (!address || address.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new Error("Connected wallet does not match the active Conviction account.");
  }
  return provider;
}

async function ensurePolygonChain(provider: EthereumProvider) {
  const current = await provider.request({ method: "eth_chainId" });
  if (normalizeChainId(current) === polygonChainId) return;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: polygonChainHex }],
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? Number(error.code) : null;
    if (code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          blockExplorerUrls: ["https://polygonscan.com"],
          chainId: polygonChainHex,
          chainName: "Polygon",
          nativeCurrency: { decimals: 18, name: "POL", symbol: "POL" },
          rpcUrls: ["https://polygon-rpc.com"],
        },
      ],
    });
  }
}

async function hasSufficientAllowance(provider: EthereumProvider, check: AllowanceCheck) {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "allowance",
    args: [check.owner as `0x${string}`, check.spender as `0x${string}`],
  });
  const result = await provider.request({
    method: "eth_call",
    params: [{ data, to: check.token }, "latest"],
  });
  if (typeof result !== "string") return false;
  const allowance = decodeFunctionResult({
    abi: erc20Abi,
    data: result as `0x${string}`,
    functionName: "allowance",
  });
  return allowance >= parseUnits(check.requiredAssets, 6);
}

async function waitForEoaReceipt(provider: EthereumProvider, transactionHash: string) {
  for (let attempt = 0; attempt < transactionPollLimit; attempt += 1) {
    const receipt = await provider.request({
      method: "eth_getTransactionReceipt",
      params: [transactionHash],
    });
    if (receipt && typeof receipt === "object") {
      const status = "status" in receipt ? String(receipt.status) : "0x1";
      if (status === "0x0") throw new Error("Polygon transaction reverted.");
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, transactionPollIntervalMs));
  }
  throw new Error("Polygon confirmation timed out. Resume this position from Portfolio.");
}

function waitForBridgeResult(
  successEvent: string,
  errorEvent: string,
  requestId: string,
  dispatch: () => void,
) {
  return new Promise<BridgeResult>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => finish(() => reject(new Error("Smart wallet request timed out."))),
      120_000,
    );
    const success = (event: Event) => {
      const detail = (event as CustomEvent<BridgeResult>).detail;
      if (detail?.requestId === requestId) finish(() => resolve(detail));
    };
    const failure = (event: Event) => {
      const detail = (event as CustomEvent<BridgeError>).detail;
      if (detail?.requestId === requestId)
        finish(() => reject(new Error(detail.message || "Smart wallet request failed.")));
    };
    const finish = (callback: () => void) => {
      window.clearTimeout(timeout);
      window.removeEventListener(successEvent, success);
      window.removeEventListener(errorEvent, failure);
      callback();
    };
    window.addEventListener(successEvent, success);
    window.addEventListener(errorEvent, failure);
    dispatch();
  });
}

function randomBytes32() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return "0x" + Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeChainId(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  return Number.parseInt(value, value.startsWith("0x") ? 16 : 10);
}

function toHexQuantity(value: string) {
  return "0x" + BigInt(value || "0").toString(16);
}
