import { isAddress } from "viem";
import { NextRequest, NextResponse } from "next/server";

import { getExecutionCapabilities } from "../../../lib/core-api";
import { mapExecutionToVaults } from "../../../lib/execution-vaults";
import { readVaultWalletBalances } from "../../../lib/wallet-balances";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim() ?? "";

  if (!isAddress(address)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_WALLET_ADDRESS",
          message: "A valid EVM wallet address is required.",
        },
      },
      { status: 422 },
    );
  }

  try {
    const execution = await getExecutionCapabilities();
    const vaults = mapExecutionToVaults(execution);
    const balances = await readVaultWalletBalances({ address, execution, vaults });

    return NextResponse.json({ ok: true, data: balances });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "WALLET_BALANCES_UNAVAILABLE",
          message: "Wallet token balances are unavailable right now.",
        },
      },
      { status: 502 },
    );
  }
}
