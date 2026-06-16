import { NextResponse } from "next/server";

import { CoreApiError, updateUserEmail } from "../../../lib/core-api";

export async function PATCH(request: Request) {
  const body = await parseBody(request);

  if (!isRecord(body)) {
    return validationError("Request body must be a JSON object.");
  }

  const userId = stringField(body, "userId");
  const email = stringField(body, "email");

  if (!userId) {
    return validationError("A core user id is required.");
  }

  if (!email || !email.includes("@")) {
    return validationError("A valid email address is required.");
  }

  try {
    const result = await updateUserEmail(userId, email);

    return NextResponse.json({ ok: true, data: { email: result.email } });
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
          code: "EMAIL_UPDATE_FAILED",
          message: "Core API did not accept the email update.",
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
    { ok: false, error: { code: "INVALID_EMAIL_UPDATE", message } },
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
