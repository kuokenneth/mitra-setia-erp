import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

    setUser(data.user);
    return data.user;
  }

  async function logout() {
    try {
      // Keep the bearer token available until the authenticated logout request
      // has reached the server, so the audit log can identify the actor.
      await api("/auth/logout", { method: "POST" });
    } finally {
      localStorage.removeItem("token");
      sessionStorage.removeItem("accessToken");
      setUser(null);
    }
  }

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, login, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
