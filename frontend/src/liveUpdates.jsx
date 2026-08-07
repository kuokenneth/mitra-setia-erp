import { createContext, useContext, useEffect, useRef, useState } from "react";
import { API_BASE } from "./api";

const LiveContext = createContext({ status: "connecting", lastUpdate: null });

export function LiveUpdatesProvider({ children }) {
  const [status, setStatus] = useState(navigator.onLine ? "connecting" : "offline");
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    let controller;
    let retry;
    let stopped = false;
    const connect = async () => {
      if (stopped || !navigator.onLine) return setStatus("offline");
      setStatus("connecting");
      controller = new AbortController();
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE}/events`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(`Live connection failed (${response.status})`);
        setStatus("live");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split("\n\n");
          buffer = messages.pop() || "";
          for (const message of messages) {
            const event = message.match(/^event:\s*(.+)$/m)?.[1];
            const raw = message.match(/^data:\s*(.+)$/m)?.[1];
            if (event !== "update" || !raw) continue;
            let detail = {};
            try { detail = JSON.parse(raw); } catch { /* ignore malformed event */ }
            setLastUpdate(detail.at || new Date().toISOString());
            window.dispatchEvent(new CustomEvent("erp:live-update", { detail }));
          }
        }
        if (!stopped) throw new Error("Live connection closed");
      } catch (error) {
        if (stopped || error.name === "AbortError") return;
        setStatus(navigator.onLine ? "connecting" : "offline");
        clearTimeout(retry);
        retry = setTimeout(connect, 5000);
      }
    };
    const online = () => { clearTimeout(retry); connect(); };
    const offline = () => { controller?.abort(); setStatus("offline"); };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    connect();
    return () => { stopped = true; clearTimeout(retry); controller?.abort(); window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, []);

  return <LiveContext.Provider value={{ status, lastUpdate }}>{children}<LiveIndicator status={status}/></LiveContext.Provider>;
}

export function useLiveRefresh(callback, { interval = 60000, enabled = true } = {}) {
  const callbackRef = useRef(callback);
  const timerRef = useRef();
  callbackRef.current = callback;
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => callbackRef.current?.({ background: true }), 500);
    };
    const visible = () => document.visibilityState === "visible" && refresh();
    window.addEventListener("erp:live-update", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visible);
    const polling = interval > 0 ? setInterval(() => document.visibilityState === "visible" && refresh(), interval) : null;
    return () => { clearTimeout(timerRef.current); if (polling) clearInterval(polling); window.removeEventListener("erp:live-update", refresh); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", visible); };
  }, [enabled, interval]);
}

export const useLiveStatus = () => useContext(LiveContext);

function LiveIndicator({ status }) {
  const text = status === "live" ? "Live" : status === "offline" ? "Offline" : "Menghubungkan…";
  return <div className={`live-indicator ${status}`} title="Status pembaruan data otomatis"><i/>{text}</div>;
}
