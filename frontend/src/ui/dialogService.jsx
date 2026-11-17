import { createRoot } from "react-dom/client";
import ConfirmView from "./ConfirmView";

/**
 * Styled, promise-based replacements for window.confirm / window.alert.
 *   if (!(await confirmDialog({ message, destructive: true }))) return;
 * Behaviour matches the native dialogs: confirm resolves true/false, alert resolves when
 * dismissed, Escape = cancel, and a click outside never dismisses (no accidental decisions).
 */
let host = null;
let root = null;
const queue = [];

function ensureRoot() {
  if (root) return;
  host = document.createElement("div");
  host.setAttribute("data-ms-dialog-host", "");
  document.body.appendChild(host);
  root = createRoot(host);
}

function render() {
  const current = queue[0];
  root.render(current ? <ConfirmView key={current.id} {...current} onDone={finish} /> : null);
}

function finish(value) {
  const current = queue.shift();
  current?.resolve(value);
  render();
}

function open(kind, input) {
  const options = typeof input === "string" ? { message: input } : { ...(input || {}) };
  if (typeof document === "undefined") return Promise.resolve(kind === "alert" ? undefined : false);
  ensureRoot();
  return new Promise((resolve) => {
    queue.push({ ...options, kind, id: Date.now() + Math.random(), resolve });
    if (queue.length === 1) render();
  });
}

export const confirmDialog = (options) => open("confirm", options);
export const alertDialog = (options) => open("alert", options).then(() => undefined);

