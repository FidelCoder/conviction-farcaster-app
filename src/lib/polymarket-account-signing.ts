import {
  getStoredBrowserSessionWalletKind,
  type BrowserSessionWalletKind,
} from "./browser-wallet-session";
import { resolveEvmWalletProvider } from "./evm-wallet-provider";
import { convictionAccountAbstraction } from "./thirdweb-client";

type SmartSignResult = {
  address: string;
  requestId: string;
  signature: string;
};

type SmartSignFailure = {
  message: string;
  requestId: string;
};

const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;
const signaturePattern = /^0x[a-fA-F0-9]+$/;

export async function getOwnershipWalletChainId(walletKind?: BrowserSessionWalletKind | null) {
  const activeKind = walletKind ?? getStoredBrowserSessionWalletKind();

  if (activeKind === "smart") {
    return convictionAccountAbstraction.chain.id;
  }

  const provider = await resolveEvmWalletProvider();

  if (!provider) {
    throw new Error("Open Conviction in the EVM wallet linked to this profile, then try again.");
  }

  const rawChainId = await provider.request({ method: "eth_chainId" });
  const chainId =
    typeof rawChainId === "string" ? Number.parseInt(rawChainId, 16) : Number(rawChainId);

  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error("Wallet chain could not be read.");
  }

  return chainId;
}

export async function requestOwnershipSignature(input: {
  address: string;
  message: string;
  walletKind?: BrowserSessionWalletKind | null;
}) {
  const address = input.address.trim();

  if (!evmAddressPattern.test(address)) {
    throw new Error("A valid EVM signing address is required.");
  }

  const walletKind = input.walletKind ?? getStoredBrowserSessionWalletKind();

  if (walletKind === "smart") {
    return requestThirdwebSignature(address, input.message);
  }

  const provider = await resolveEvmWalletProvider();

  if (!provider) {
    throw new Error(
      "Open Conviction in the EVM wallet that controls this address, then try again.",
    );
  }

  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as unknown;
  const availableAccounts = Array.isArray(accounts)
    ? accounts.filter((item): item is string => typeof item === "string")
    : [];
  const matchingAddress = availableAccounts.find(
    (account) => account.toLowerCase() === address.toLowerCase(),
  );

  if (!matchingAddress) {
    throw new Error(
      "Switch the active wallet account to " + shortAddress(address) + " and try again.",
    );
  }

  const signature = await provider.request({
    method: "personal_sign",
    params: [input.message, matchingAddress],
  });

  if (typeof signature !== "string" || !signaturePattern.test(signature)) {
    throw new Error("The wallet did not return a valid ownership signature.");
  }

  return signature;
}

function requestThirdwebSignature(address: string, message: string) {
  return new Promise<string>((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Smart wallet signature timed out. Open the wallet and try again."));
    }, 60_000);

    const handleResult = (event: Event) => {
      const detail = (event as CustomEvent<SmartSignResult>).detail;

      if (detail?.requestId !== requestId) return;

      cleanup();

      if (
        detail.address.toLowerCase() !== address.toLowerCase() ||
        !signaturePattern.test(detail.signature)
      ) {
        reject(new Error("Smart wallet returned an invalid ownership signature."));
        return;
      }

      resolve(detail.signature);
    };

    const handleError = (event: Event) => {
      const detail = (event as CustomEvent<SmartSignFailure>).detail;

      if (detail?.requestId !== requestId) return;

      cleanup();
      reject(new Error(detail.message || "Smart wallet signature failed."));
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener("conviction-thirdweb-sign-result", handleResult);
      window.removeEventListener("conviction-thirdweb-sign-error", handleError);
    };

    window.addEventListener("conviction-thirdweb-sign-result", handleResult);
    window.addEventListener("conviction-thirdweb-sign-error", handleError);
    window.dispatchEvent(
      new CustomEvent("conviction-thirdweb-sign-message", {
        detail: { address, message, requestId },
      }),
    );
  });
}

function shortAddress(address: string) {
  return address.slice(0, 6) + "..." + address.slice(-4);
}
