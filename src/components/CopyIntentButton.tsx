"use client";

import { FormEvent, useState } from "react";

import type { CopyIntent } from "../lib/core-api";
import { executionStatusLabel } from "../lib/display";

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
  const [followerId, setFollowerId] = useState("");
  const [amount, setAmount] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
    message: "",
  });
  const isSubmitting = submitState.status === "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState({ status: "submitting", message: "Submitting copy intent..." });

    try {
      const response = await fetch("/api/copy-intents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          followerId,
          sourcePositionId: positionId,
          requestedQuantity: amount,
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
      <label>
        <span>Follower user ID</span>
        <input
          autoComplete="off"
          name="followerId"
          onChange={(event) => setFollowerId(event.target.value)}
          required
          type="text"
          value={followerId}
        />
      </label>
      <label>
        <span>Amount</span>
        <input
          inputMode="decimal"
          name="amount"
          onChange={(event) => setAmount(event.target.value)}
          pattern="^(?:0|[1-9]\d*)(?:\.\d{1,8})?$"
          required
          type="text"
          value={amount}
        />
      </label>
      <button className="primary-action" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Submitting..." : "Submit copy intent"}
      </button>
      {submitState.message ? (
        <p className={submitState.status === "error" ? "form-message error" : "form-message"}>
          {submitState.message}
          {submitState.status === "submitted" && submitState.copyIntent.status !== "EXECUTED"
            ? " Execution not yet enabled."
            : null}
          {submitState.status === "submitted" && submitState.copyIntent.status === "EXECUTED"
            ? " " + executionStatusLabel(submitState.copyIntent.status) + "."
            : null}
        </p>
      ) : null}
    </form>
  );
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
