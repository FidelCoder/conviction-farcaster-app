import type { PortfolioWalletBalance, UserPortfolio } from "../zip-ui/types";
import { mergeReadyVaultBalances } from "./execution-vaults";

type WalletBalancesResponse =
  | {
      ok: true;
      data: {
        depositedBalances: Record<string, PortfolioWalletBalance>;
        walletBalances: Record<string, PortfolioWalletBalance>;
      };
    }
  | { ok: false; error: { code: string; message: string } };

export async function fetchWalletBalanceSnapshot(address: string) {
  const response = await fetch("/api/wallet-balances?address=" + encodeURIComponent(address), {
    cache: "no-store",
  });
  const body = (await response.json()) as WalletBalancesResponse;

  if (!response.ok || !body.ok) {
    throw new Error(body.ok ? "Wallet balance read failed." : body.error.message);
  }

  return body.data;
}

export function applyWalletBalanceSnapshot(
  portfolio: UserPortfolio,
  snapshot: {
    depositedBalances: Record<string, PortfolioWalletBalance>;
    walletBalances: Record<string, PortfolioWalletBalance>;
  },
): UserPortfolio {
  const readyBalances = Object.values(snapshot.walletBalances).filter((balance) => balance.status === "ready");
  const usdcBalance = sumReadyBalances(readyBalances, "USDC");
  const wethBalance = sumReadyBalances(readyBalances, "WETH");

  return {
    ...portfolio,
    usdcBalance: usdcBalance ?? portfolio.usdcBalance,
    wethBalance: wethBalance ?? portfolio.wethBalance,
    vaultBalances: mergeReadyVaultBalances(portfolio.vaultBalances, snapshot.depositedBalances),
    walletBalances: snapshot.walletBalances,
    walletBalancesMessage: "Wallet token balances updated.",
    walletBalancesStatus: "ready",
  };
}

function sumReadyBalances(balances: PortfolioWalletBalance[], symbol: "USDC" | "WETH") {
  const matchingBalances = balances.filter((balance) => balance.symbol === symbol);

  if (matchingBalances.length === 0) return null;

  return matchingBalances.reduce((total, balance) => total + balance.amount, 0);
}
