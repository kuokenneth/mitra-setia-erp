/*
 * Turns backend auth errors into clear Indonesian messages for employees.
 * Unknown/server errors are replaced with a generic message so internal
 * details (stack traces, config names, DB errors) never reach the screen.
 *
 * Returns { message, field } — `field` names the input the error belongs to
 * (or null for a form-level error).
 */
const RULES = [
  // login
  { test: /invalid credentials/i, message: "Email atau password tidak sesuai. Periksa kembali lalu coba lagi.", field: null },
  { test: /account inactive|account is /i, message: "Akun Anda sedang tidak aktif. Hubungi admin perusahaan untuk mengaktifkannya.", field: null },
  { test: /email and password required/i, message: "Email dan password wajib diisi.", field: null },
  // register
  { test: /invalid invitation code/i, message: "Kode undangan tidak valid. Minta kode terbaru kepada admin perusahaan.", field: "inviteCode" },
  { test: /email already used/i, message: "Email ini sudah terdaftar. Silakan masuk menggunakan akun tersebut.", field: "email" },
  { test: /passwords do not match/i, message: "Konfirmasi password tidak sama dengan password.", field: "confirmPassword" },
  { test: /confirm password required/i, message: "Konfirmasi password wajib diisi.", field: "confirmPassword" },
  { test: /at least \d+ characters/i, message: "Password minimal 10 karakter.", field: "password" },
  { test: /missing invite_code/i, message: "Pendaftaran sedang tidak tersedia. Hubungi admin perusahaan.", field: null },
  // rate limiting (backend already answers in Indonesian)
  { test: /terlalu banyak/i, message: null, field: null },
  // network
  { test: /failed to fetch|networkerror|load failed|network request failed/i, message: "Tidak dapat terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.", field: null },
];

export function friendlyAuthError(error, context = "login") {
  const raw = String(error?.message || error || "");
  const rule = RULES.find(r => r.test.test(raw));
  if (rule) return { message: rule.message ?? raw, field: rule.field };
  return {
    message: context === "register"
      ? "Pendaftaran belum dapat diproses. Coba lagi beberapa saat atau hubungi admin."
      : "Login belum dapat diproses. Coba lagi beberapa saat.",
    field: null,
  };
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN = 10; // must match backend/src/routes/auth.js

/** Where a signed-in user lands — same rule the login page has always used. */
export function homeFor(user) {
  return user?.role === "SPAREPART_ADMIN" ? "/inventory" : "/dashboard";
}
