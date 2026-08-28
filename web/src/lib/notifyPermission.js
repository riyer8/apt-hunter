const DISABLED_NOTICE = "Notifications disabled.";

export function browserPermissionDecision(permission, { asked = false } = {}) {
  if (permission === "granted") {
    return { enabled: true, showPrompt: false, notice: null };
  }
  if (permission === "denied" || asked) {
    return { enabled: false, showPrompt: false, notice: DISABLED_NOTICE };
  }
  return { enabled: false, showPrompt: true, notice: null };
}
