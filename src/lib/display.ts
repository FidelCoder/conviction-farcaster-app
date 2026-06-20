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

export function executionStatusNotice(status: string) {
  switch (status) {
    case "PENDING_EXECUTION":
      return "Execution not yet enabled.";
    case "FAILED":
      return "Execution failed.";
    case "CANCELLED":
      return "Execution cancelled.";
    default:
      return null;
  }
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
