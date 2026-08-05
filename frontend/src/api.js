export const API_BASE =
  (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");

export function apiAssetUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

export async function uploadFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return [];

  const fd = new FormData();
  files.forEach((file) => fd.append("files", file));
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/api/uploads`, {
    method: "POST",
    body: fd,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(data?.error || data?.message || `Upload gagal (${res.status})`);
  return data?.items || [];
}

export async function api(path, options = {}) {
  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  const token = localStorage.getItem("token"); // ✅

  const res = await fetch(url, {
    method: options.method || "GET",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}), // ✅
      ...(options.headers || {}),
    },
    credentials: "include", // keep this (works for Chrome cookie too)
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  return data;
}


// ✅ Profile APIs
export function getMe() {
  return api("/users/me");
}

export function updateMe(payload) {
  return api("/users/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
