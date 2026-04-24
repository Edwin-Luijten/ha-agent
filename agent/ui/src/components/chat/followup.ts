export function submitFollowup(message: string) {
  window.dispatchEvent(new CustomEvent<string>("ha-agent:followup", { detail: message }));
}
