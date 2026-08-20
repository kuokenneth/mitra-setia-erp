export const API_BASE =
  (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");

export function getAccessToken() {
  return sessionStorage.getItem("accessToken");
}

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
  const token = getAccessToken();
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

  const token = getAccessToken();
  const res = await fetch(url, {
    method: options.method || "GET",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export async function openPrintDocument(path) {
  const popup = window.open("", "_blank");
  try {
    const token = getAccessToken();
    const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
    const response = await fetch(url, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const html = await response.text();
    if (!response.ok) throw new Error(`Dokumen tidak dapat dibuat (${response.status})`);
    if (!popup) throw new Error("Popup diblokir browser");
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  } catch (error) {
    popup?.close();
    throw error;
  }
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
