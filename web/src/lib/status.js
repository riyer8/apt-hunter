import { STATUS } from "@shared/schema.js";

export function statusMeta(status) {
  switch (status) {
    case STATUS.SUCCESS:
      return { label: "Monitoring", tone: "good", icon: "●" };
    case STATUS.PARTIAL:
      return { label: "Partial", tone: "warn", icon: "●" };
    case STATUS.FAILED:
      return { label: "Couldn’t read page", tone: "bad", icon: "●" };
    case STATUS.ANALYZING:
      return { label: "Checking", tone: "warn", icon: "●" };
    default:
      return { label: "Waiting for first check", tone: "muted", icon: "○" };
  }
}
