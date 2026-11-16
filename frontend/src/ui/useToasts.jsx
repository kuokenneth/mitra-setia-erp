import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Lightweight toast stack, fully local (no global provider needed). */
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const push = useCallback((message, tone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((items) => [...items, { id, message, tone }]);
    timers.current.push(setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3600));
  }, []);
  const node = toasts.length ? createPortal(<div className="ui-toasts" role="status" aria-live="polite">{toasts.map((toast) => <div key={toast.id} className={`ui-toast ui-toast--${toast.tone}`}>{toast.message}</div>)}</div>, document.body) : null;
  return { push, node };
}
