import assert from "node:assert/strict";
import test from "node:test";

import type { EthereumProvider } from "../src/lib/evm-wallet-provider";
import {
  parsePolymarketChallengeResponse,
  signInWithPolymarketWallet,
} from "../src/lib/polymarket-browser-auth";

const ownerAddress = `0x${"1".repeat(40)}`;
const funderAddress = `0x${"2".repeat(40)}`;
const signature = `0x${"a".repeat(130)}`;

function challengeResponse(address = ownerAddress) {
  return {
    ok: true,
    data: {
      challenge: {
        id: "challenge-1",
        message: "Sign in to Conviction Markets with Polymarket",
        ownerAddress: address,
        funderAddress,
        walletType: "GNOSIS_SAFE",
        expiresAt: "2026-07-21T10:00:00.000Z",
      },
    },
  };
}

test("rejects a challenge that is not bound to the connected Polymarket owner", () => {
  assert.throws(
    () => parsePolymarketChallengeResponse(challengeResponse(`0x${"3".repeat(40)}`), ownerAddress),
    /invalid challenge/i,
  );
});

test("signs the server challenge and never sends CLOB credentials", async () => {
  const walletRequests: Array<{ method: string; params?: unknown }> = [];
  const provider: EthereumProvider = {
    async request(input) {
      walletRequests.push(input);

      if (input.method === "eth_requestAccounts") return [ownerAddress];
      if (input.method === "personal_sign") return signature;

      throw new Error("Unexpected wallet method");
    },
  };
  const requestBodies: Array<Record<string, unknown>> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requestBodies.push(body);

    if (body.action === "challenge") {
      return Response.json(challengeResponse(), { status: 201 });
    }

    return Response.json(
      {
        ok: true,
        data: {
          session: {
            user: { id: "user-1" },
            socialAccount: {
              id: "social-1",
              userId: "user-1",
              platform: "WEB",
              platformUserId: ownerAddress,
              authProvider: "POLYMARKET_WALLET",
            },
            traderProfile: null,
          },
          account: {
            id: "account-1",
            userId: "user-1",
            ownerAddress,
            funderAddress,
            walletType: "GNOSIS_SAFE",
          },
        },
      },
      { status: 201 },
    );
  };

  try {
    const result = await signInWithPolymarketWallet(provider);

    assert.equal(result.session.user.id, "user-1");
    assert.deepEqual(walletRequests, [
      { method: "eth_requestAccounts" },
      {
        method: "personal_sign",
        params: ["Sign in to Conviction Markets with Polymarket", ownerAddress],
      },
    ]);
    assert.deepEqual(requestBodies, [
      { action: "challenge", ownerAddress },
      { action: "complete", challengeId: "challenge-1", signature },
    ]);
    assert.equal(
      requestBodies.some((body) =>
        ["apiKey", "secret", "passphrase"].some((key) => Object.hasOwn(body, key)),
      ),
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
