import { NextResponse } from "next/server";

import {
  type ContractTransactionStatus,
  CoreApiError,
  updateContractTransaction,
} from "../../../../../lib/core-api";

const transactionHashPattern = /^0x[a-fA-F0-9]{64}$/;
const statusValues = new Set(["PREPARED", "SUBMITTED", "CONFIRMED", "FAILED", "CANCELLED"]);

type RouteContext = {
  params: Promise<{ transactionId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const body = await parseBody(request);
  const { transactionId } = await context.params;

  if (!isRecord(body)) {
    return validationError("Request body must be a JSON object.");
  }

  const transactionHash = stringField(body, "transactionHash");
  const status = stringField(body, "status");

  if (transactionHash && !transactionHashPattern.test(transactionHash)) {
    return validationError("transactionHash must be a valid EVM transaction hash.");
  }

  if (status && !statusValues.has(status)) {
    return validationError("status is not supported.");
  }

  try {
    const transaction = await updateContractTransaction(transactionId, {
      transactionHash: transactionHash || undefined,
      status: (status || undefined) as ContractTransactionStatus | undefined,
      responsePayload: body.responsePayload,
    });

    return NextResponse.json({ ok: true, data: { transaction } });
  } catch (error) {
    if (error instanceof CoreApiError) {
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "CONTRACT_TRANSACTION_UPDATE_FAILED",
          message: "Core API could not update the contract transaction.",
        },
      },
      { status: 502 },
    );
  }
}

async function parseBody(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

function validationError(message: string) {
  return NextResponse.json(
    { ok: false, error: { code: "INVALID_CONTRACT_TRANSACTION", message } },
    { status: 422 },
  );
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
