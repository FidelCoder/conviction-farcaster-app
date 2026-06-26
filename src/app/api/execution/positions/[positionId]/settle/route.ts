import { NextResponse } from "next/server";

import { CoreApiError, settlePositionExecution } from "../../../../../../lib/core-api";

type RouteContext = {
  params: Promise<{ positionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { positionId } = await context.params;

  if (!positionId) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_POSITION",
          message: "positionId is required.",
        },
      },
      { status: 422 },
    );
  }

  try {
    const executionAttempt = await settlePositionExecution(positionId);

    return NextResponse.json({ ok: true, data: { executionAttempt } }, { status: 202 });
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
          code: "EXECUTION_SETTLEMENT_FAILED",
          message: "Core API could not settle this margin execution.",
        },
      },
      { status: 502 },
    );
  }
}
