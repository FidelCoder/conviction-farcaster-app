export type EthereumProvider = {
  isCoinbaseWallet?: boolean;
  isMetaMask?: boolean;
  isRabby?: boolean;
  isTrust?: boolean;
  request(args: { method: string; params?: unknown }): Promise<unknown>;
};

type Eip6963ProviderDetail = {
  info?: {
    name?: string;
    rdns?: string;
    uuid?: string;
  };
  provider?: EthereumProvider;
};

type ProviderCandidate = {
  label: string;
  provider: EthereumProvider;
  source: "farcaster" | "eip6963" | "injected";
};

export async function resolveEvmWalletProvider() {
  const candidates = await getEvmWalletProviders();

  return candidates[0]?.provider ?? null;
}

export async function getEvmWalletProviders() {
  if (typeof window === "undefined") {
    return [] as ProviderCandidate[];
  }

  const candidates: ProviderCandidate[] = [];
  const seen = new Set<EthereumProvider>();

  const addCandidate = (candidate: ProviderCandidate | null | undefined) => {
    if (!candidate?.provider || typeof candidate.provider.request !== "function") return;
    if (seen.has(candidate.provider)) return;

    seen.add(candidate.provider);
    candidates.push(candidate);
  };

  const farcasterProvider = await getFarcasterProvider();

  addCandidate(
    farcasterProvider
      ? { label: "Farcaster wallet", provider: farcasterProvider, source: "farcaster" }
      : null,
  );

  for (const candidate of await getEip6963Providers()) {
    addCandidate(candidate);
  }

  for (const candidate of getInjectedProviders()) {
    addCandidate(candidate);
  }

  return candidates;
}

export function getNoWalletDetectedMessage() {
  return "No EVM wallet provider was detected. Open this page inside Coinbase Wallet, MetaMask, Rabby, Trust Wallet, Rainbow, OKX Wallet, or a Farcaster client with wallet support, then try again.";
}

async function getFarcasterProvider() {
  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    const isInMiniApp = await sdk.isInMiniApp();

    if (!isInMiniApp) return null;

    const provider = await sdk.wallet.getEthereumProvider();

    return isEthereumProvider(provider) ? provider : null;
  } catch {
    return null;
  }
}

async function getEip6963Providers() {
  if (typeof window === "undefined") {
    return [] as ProviderCandidate[];
  }

  const providers: ProviderCandidate[] = [];

  await new Promise<void>((resolve) => {
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;

      if (isEthereumProvider(detail?.provider)) {
        providers.push({
          label: detail.info?.name ?? detail.info?.rdns ?? "EVM wallet",
          provider: detail.provider,
          source: "eip6963",
        });
      }
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    window.setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce as EventListener);
      resolve();
    }, 250);
  });

  return providers;
}

function getInjectedProviders() {
  if (typeof window === "undefined") {
    return [] as ProviderCandidate[];
  }

  const injectedWindow = window as Window & {
    BinanceChain?: EthereumProvider;
    coinbaseWalletExtension?: EthereumProvider;
    ethereum?: EthereumProvider & { providers?: EthereumProvider[] };
    okxwallet?: EthereumProvider;
    phantom?: { ethereum?: EthereumProvider };
    rabby?: EthereumProvider;
    trustwallet?: EthereumProvider;
  };
  const ethereum = injectedWindow.ethereum;
  const candidates: ProviderCandidate[] = [];

  if (ethereum?.providers?.length) {
    for (const provider of ethereum.providers) {
      candidates.push({ label: getInjectedProviderLabel(provider), provider, source: "injected" });
    }
  }

  if (isEthereumProvider(ethereum)) {
    candidates.push({ label: getInjectedProviderLabel(ethereum), provider: ethereum, source: "injected" });
  }

  const namedProviders: Array<[string, EthereumProvider | undefined]> = [
    ["Coinbase Wallet", injectedWindow.coinbaseWalletExtension],
    ["Rabby", injectedWindow.rabby],
    ["Trust Wallet", injectedWindow.trustwallet],
    ["OKX Wallet", injectedWindow.okxwallet],
    ["Binance Wallet", injectedWindow.BinanceChain],
    ["Phantom", injectedWindow.phantom?.ethereum],
  ];

  for (const [label, provider] of namedProviders) {
    if (isEthereumProvider(provider)) {
      candidates.push({ label, provider, source: "injected" });
    }
  }

  return candidates;
}

function getInjectedProviderLabel(provider: EthereumProvider) {
  if (provider.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider.isRabby) return "Rabby";
  if (provider.isTrust) return "Trust Wallet";
  if (provider.isMetaMask) return "MetaMask";

  return "EVM wallet";
}

function isEthereumProvider(value: unknown): value is EthereumProvider {
  return typeof value === "object" &&
    value !== null &&
    "request" in value &&
    typeof (value as { request?: unknown }).request === "function";
}
