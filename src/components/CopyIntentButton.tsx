"use client";

export function CopyIntentButton({ positionId }: { positionId: string }) {
  return (
    <button
      className="secondary-action"
      disabled
      title={"Position " + positionId + " requires a connected user"}
    >
      Copy intent unavailable
    </button>
  );
}
