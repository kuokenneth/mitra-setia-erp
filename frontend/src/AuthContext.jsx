import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "./api";

const AuthCtx = createContext(null);
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;
const INACTIVITY_WARNING_MS = 14 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inactivityWarning, setInactivityWarning] = useState(false);
  const [logoutReason, setLogoutReason] = useState("");
  const lastActivityRef = useRef(Date.now());

  async function refresh() {
    try {
      const data = await api("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    localStorage.removeItem("token");
    refresh();
  }, []);

  async function login(email, password) {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (data.token) sessionStorage.setItem("accessToken", data.token);

    lastActivityRef.current = Date.now();
    setInactivityWarning(false);
    setLogoutReason("");
    setUser(data.user);
    return data.user;
  }

  const logout = useCallback(async (reason = "") => {
    try {
      // Keep the bearer token available until the authenticated logout request
      // has reached the server, so the audit log can identify the actor.
      await api("/auth/logout", { method: "POST" });
    } finally {
      localStorage.removeItem("token");
      sessionStorage.removeItem("accessToken");
      setInactivityWarning(false);
      setLogoutReason(reason);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    let warningTimer;
    let logoutTimer;
    let lastHandledAt = 0;

    const scheduleTimers = () => {
      window.clearTimeout(warningTimer);
      window.clearTimeout(logoutTimer);

      const inactiveFor = Date.now() - lastActivityRef.current;
      if (inactiveFor >= INACTIVITY_LIMIT_MS) {
        void logout("Sesi berakhir karena tidak ada aktivitas selama 15 menit.");
        return;
      }

      setInactivityWarning(inactiveFor >= INACTIVITY_WARNING_MS);
      warningTimer = window.setTimeout(
        () => setInactivityWarning(true),
        Math.max(0, INACTIVITY_WARNING_MS - inactiveFor),
      );
      logoutTimer = window.setTimeout(
        () => void logout("Sesi berakhir karena tidak ada aktivitas selama 15 menit."),
        Math.max(0, INACTIVITY_LIMIT_MS - inactiveFor),
      );
    };

    const markActive = () => {
      const now = Date.now();
      if (now - lastHandledAt < 1000) return;
      lastHandledAt = now;
      lastActivityRef.current = now;
      setInactivityWarning(false);
      scheduleTimers();
    };

    const activityEvents = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, markActive, { passive: true }));
    document.addEventListener("visibilitychange", scheduleTimers);
    lastActivityRef.current = Date.now();
    scheduleTimers();

    return () => {
      window.clearTimeout(warningTimer);
      window.clearTimeout(logoutTimer);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, markActive));
      document.removeEventListener("visibilitychange", scheduleTimers);
    };
  }, [user, logout]);

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, login, logout, refresh, logoutReason }}>
      {children}
      {user && inactivityWarning && (
        <div
          role="alert"
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            zIndex: 10000,
            width: "min(390px, calc(100vw - 40px))",
            padding: "16px 18px",
            border: "1px solid #f1cf76",
            borderRadius: 12,
            background: "#fff8df",
            boxShadow: "0 16px 45px rgba(55, 42, 10, 0.2)",
            color: "#684d08",
            fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
          }}
        >
          <strong style={{ display: "block", marginBottom: 5 }}>Sesi hampir berakhir</strong>
          <span style={{ fontSize: 13, lineHeight: 1.5 }}>
            Anda akan keluar otomatis dalam 1 menit. Gerakkan mouse, klik, atau tekan tombol untuk melanjutkan sesi.
          </span>
        </div>
      )}
    </AuthCtx.Provider>
  );
}

// This module intentionally exports the provider together with its companion hook.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthCtx);
}
