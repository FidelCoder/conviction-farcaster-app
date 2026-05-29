"use client";

import { FormEvent, useState } from "react";

import type { CopyIntent } from "../lib/core-api";
import { executionStatusLabel, executionStatusNotice } from "../lib/display";
import { useFarcasterSession } from "../hooks/useFarcasterSession";
import { FarcasterSessionPanel } from "./FarcasterSessionPanel";

const positiveDecimalPattern = /^(?=.*[1-9])(?:0|[1-9]\d*)(?:\.\d{1,8})?$/;

type SubmitState =
  | { status: "idle"; message: string; copyIntent?: never }
  | { status: "submitting"; message: string; copyIntent?: never }
  | { status: "submitted"; message: string; copyIntent: CopyIntent }
  | { status: "error"; message: string; copyIntent?: never };

export function CopyIntentButton({
  positionId,
  sourceSignalId,
}: {
  positionId: string;
  sourceSignalId?: string | null;
}) {
  const sessionState = useFarcasterSession();
  const [amount, setAmount] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
    message: "",
  });
  const isSubmitting = submitState.status === "submitting";
  const sessionBlockReason = sessionState.status === "ready" ? null : sessionState.message;
  const submitLabel = isSubmitting
    ? "Submitting..."
    : sessionState.status === "ready"
      ? "Submit copy intent"
      : "Connect Farcaster to copy";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedAmount = amount.trim();

    if (sessionState.status !== "ready") {
      setSubmitState({ status: "error", message: sessionState.message });
      return;
    }

    if (!positiveDecimalPattern.test(trimmedAmount)) {
      setSubmitState({
        status: "error",
        message: "Amount must be greater than zero with up to 8 decimals.",
      });
      return;
    }

    setSubmitState({ status: "submitting", message: "Submitting copy intent..." });

    try {
      const response = await fetch("/api/copy-intents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          followerId: sessionState.session.user.id,
          sourcePositionId: positionId,
          requestedQuantity: trimmedAmount,
          sourceSignalId: sourceSignalId ?? null,
        }),
      });
      const body = (await response.json()) as CopyIntentResponse;

      if (!response.ok || !body.ok) {
        const message = body.ok ? "Copy intent failed." : body.error.message;
        setSubmitState({ status: "error", message });
        return;
      }

      setSubmitState({
        status: "submitted",
        message: "Copy intent submitted.",
        copyIntent: body.data.copyIntent,
      });
      setAmount("");
    } catch {
      setSubmitState({
        status: "error",
        message: "Core API did not accept the copy intent.",
      });
    }
  }

  return (
    <form className="copy-intent-form" onSubmit={handleSubmit}>
      <FarcasterSessionPanel label="Copying as" sessionState={sessionState} />
      <label>
        <span>Amount</span>
        <input
          inputMode="decimal"
          name="amount"
          onChange={(event) => setAmount(event.target.value)}
          pattern="^(?=.*[1-9])(?:0|[1-9]\d*)(?:\.\d{1,8})?$"
          placeholder="5.00000000"
          required
          type="text"
          value={amount}
        />
      </label>
      <button
        className="primary-action"
        disabled={isSubmitting || Boolean(sessionBlockReason)}
        type="submit"
      >
        {submitLabel}
      </button>
      {submitState.message || sessionBlockReason ? (
        <p
          aria-live="polite"
          className={submitState.status === "error" ? "form-message error" : "form-message"}
        >
          {submitState.message || sessionBlockReason}
        </p>
      ) : null}
      {submitState.status === "submitted" ? (
        <div className="intent-confirmation compact" aria-live="polite">
          <div className="intent-confirmation-topline">
            <span>Copy intent</span>
            <strong>{executionStatusLabel(submitState.copyIntent.status)}</strong>
          </div>
          <dl>
            <div>
              <dt>Amount</dt>
              <dd>{submitState.copyIntent.requestedQuantity}</dd>
            </div>
            <div>
              <dt>Record</dt>
              <dd>{formatCompactId(submitState.copyIntent.id)}</dd>
            </div>
          </dl>
          <p>
            {executionStatusNotice(submitState.copyIntent.status) ?? "Core confirmed execution."}
          </p>
        </div>
      ) : null}
    </form>
  );
}

function formatCompactId(id: string) {
  return id.length > 12 ? id.slice(0, 6) + "..." + id.slice(-4) : id;
}

type CopyIntentResponse =
  | {
      ok: true;
      data: {
        copyIntent: CopyIntent;
      };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };
