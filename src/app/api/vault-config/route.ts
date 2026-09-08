import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const vaultAddress =
    process.env.EQUITY_VAULT_ADDRESS ||
    process.env.NEXT_PUBLIC_EQUITY_VAULT_ADDRESS ||
    "0x0000000000000000000000000000000000000000";

  return NextResponse.json({ vaultAddress });
}
