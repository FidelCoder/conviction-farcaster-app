export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function signalStatusLabel() {
  return "Market call";
}

export function executionStatusLabel(status: string) {
  switch (status) {
    case "PENDING_EXECUTION":
      return "Pending execution";
    case "EXECUTED":
      return "Executed";
    case "FAILED":
      return "Failed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return titleCase(status.replace(/_/g, " "));
  }
}

export function positionExecutionStatusLabel(position: {
  averageEntryPrice?: string | null;
  chainTransactionHash?: string | null;
  executionAdapterId?: string | null;
  executionMode?: string | null;
  status: string;
}) {
  if (isConfirmedMarginIntentOnly(position)) {
    return "Intent confirmed";
  }

  return executionStatusLabel(position.status);
}

export function executionStatusNotice(
  status: string,
  position?: {
    averageEntryPrice?: string | null;
    chainTransactionHash?: string | null;
    executionAdapterId?: string | null;
    executionMode?: string | null;
  },
) {
  if (position && isConfirmedMarginIntentOnly({ ...position, status })) {
    return "Vault intent is confirmed onchain. Market execution is still pending an execution adapter.";
  }

  switch (status) {
    case "PENDING_EXECUTION":
      return "Market execution not yet enabled.";
    case "FAILED":
      return "Execution failed.";
    case "CANCELLED":
      return "Execution cancelled.";
    default:
      return null;
  }
}

function isConfirmedMarginIntentOnly(position: {
  averageEntryPrice?: string | null;
  chainTransactionHash?: string | null;
  executionAdapterId?: string | null;
  executionMode?: string | null;
  status: string;
}) {
  return Boolean(
    position.executionMode === "MARGIN" &&
      position.chainTransactionHash &&
      !position.averageEntryPrice &&
      !position.executionAdapterId &&
      (position.status === "EXECUTED" || position.status === "PENDING_EXECUTION"),
  );
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
