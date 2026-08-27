const DISABLED_NOTICE = "Browser notifications are disabled. Enable notifications to receive alerts.";

export function browserPermissionDecision(permission, { asked = false } = {}) {
  if (permission === "granted") {
    return { enabled: true, showPrompt: false, notice: null };
  }
  if (permission === "denied" || asked) {
    return { enabled: false, showPrompt: false, notice: DISABLED_NOTICE };
  }
  return { enabled: false, showPrompt: true, notice: null };
}
