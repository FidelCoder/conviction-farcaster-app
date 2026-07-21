import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  encodeFunctionData,
  formatUnits,
  http,
  isAddress,
  parseAbi,
  parseUnits,
} from "viem";
import { polygon } from "viem/chains";

import { getExecutionCapabilities } from "../../../lib/core-api";

const vaultAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function maxWithdraw(address owner) view returns (uint256)",
  "function previewWithdraw(uint256 assets) view returns (uint256)",
  "function withdraw(uint256 assets,address receiver,address owner) returns (uint256)",
  "function requestRedeem(uint256 shares,address receiver) returns (uint256)",
]);

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const address = typeof body?.address === "string" ? body.address.trim() : "";
  const amount = typeof body?.amount === "string" ? body.amount.trim() : "";
  if (!isAddress(address) || !/^\d+(?:\.\d{1,6})?$/.test(amount) || Number(amount) <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_WITHDRAWAL",
          message: "Valid wallet and pUSD amount are required.",
        },
      },
      { status: 422 },
    );
  }

  try {
    const execution = await getExecutionCapabilities();
    const chain = execution.chains.find((item) => item.chainId === 137);
    if (!chain?.vaultAddress || !isAddress(chain.vaultAddress))
      throw new Error("Polygon pUSD vault is unavailable.");
    const client = createPublicClient({
      chain: polygon,
      transport: http("https://polygon-rpc.com"),
    });
    const assets = parseUnits(amount, 6);
    const [maxWithdraw, shareBalance] = await Promise.all([
      client.readContract({
        address: chain.vaultAddress,
        abi: vaultAbi,
        functionName: "maxWithdraw",
        args: [address],
      }),
      client.readContract({
        address: chain.vaultAddress,
        abi: vaultAbi,
        functionName: "balanceOf",
        args: [address],
      }),
    ]);

    if (assets <= maxWithdraw) {
      return NextResponse.json({
        ok: true,
        data: {
          availableAssets: formatUnits(maxWithdraw, 6),
          mode: "IMMEDIATE",
          call: {
            chainId: 137,
            to: chain.vaultAddress,
            value: "0",
            data: encodeFunctionData({
              abi: vaultAbi,
              functionName: "withdraw",
              args: [assets, address, address],
            }),
          },
        },
      });
    }
    const shares = await client.readContract({
      address: chain.vaultAddress,
      abi: vaultAbi,
      functionName: "previewWithdraw",
      args: [assets],
    });
    if (shares > shareBalance) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INSUFFICIENT_VAULT_SHARES",
            message: "Requested amount exceeds your vault position.",
          },
        },
        { status: 422 },
      );
    }
    return NextResponse.json({
      ok: true,
      data: {
        availableAssets: formatUnits(maxWithdraw, 6),
        mode: "QUEUED",
        call: {
          chainId: 137,
          to: chain.vaultAddress,
          value: "0",
          data: encodeFunctionData({
            abi: vaultAbi,
            functionName: "requestRedeem",
            args: [shares, address],
          }),
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "WITHDRAWAL_PREPARATION_FAILED",
          message: error instanceof Error ? error.message : "Withdrawal could not be prepared.",
        },
      },
      { status: 502 },
    );
  }
}
