const API_BASE =
  (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");

export async function api(path, options = {}) {
  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  const res = await fetch(url, {
    method: options.method || "GET",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include",
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
