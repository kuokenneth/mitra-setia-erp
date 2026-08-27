const { prisma } = require("../prisma");

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SENSITIVE_KEYS = new Set([
  "password", "confirmpassword", "token", "authorization", "invitecode",
  "secret", "apikey", "api_secret", "data",
]);

function sanitize(value, depth = 0) {
  if (depth > 4) return "[nested data]";
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitize(item, depth + 1));
  if (typeof value !== "object") return String(value);

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SENSITIVE_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : sanitize(item, depth + 1),
  ]));
}

function actionFor(req, path) {
  if (path === "/auth/login") return "LOGIN";
  if (path === "/auth/logout") return "LOGOUT";
  if (path === "/auth/register") return "REGISTER";
  return ({ POST: "CREATE", PUT: "UPDATE", PATCH: "UPDATE", DELETE: "DELETE" })[req.method] || req.method;
}

function auditTrail(req, res, next) {
  if (!MUTATION_METHODS.has(req.method)) return next();
  // High-frequency GPS payloads are stored in GpsEvent and must not duplicate
  // into the general user audit log.
  if (req.originalUrl.split("?")[0] === "/integrations/golacak/events") return next();

  res.on("finish", () => {
    if (res.statusCode >= 400) return;

    const path = req.originalUrl.split("?")[0];
    const segments = path.split("/").filter(Boolean);
    const resource = segments[0] || "system";
    const candidateId = segments[1];
    const entityId = candidateId && !["new", "sync", "overview", "register", "login", "logout"].includes(candidateId)
      ? candidateId
      : (req.body?.id || req.body?.orderId || req.body?.tripId || null);
    const forwarded = req.headers["x-forwarded-for"];
    const ipAddress = String(Array.isArray(forwarded) ? forwarded[0] : forwarded || req.ip || "")
      .split(",")[0].trim() || null;

    const actorPromise = req.user?.id
      ? prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true, email: true, role: true } })
      : Promise.resolve(null);

    actorPromise.then((actor) => prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        actorName: actor?.name || null,
        actorEmail: actor?.email || req.user?.email || null,
        actorRole: actor?.role || req.user?.role || null,
        action: actionFor(req, path),
        method: req.method,
        resource,
        entityId: entityId ? String(entityId) : null,
        path,
        statusCode: res.statusCode,
        changes: sanitize(req.body || {}),
        ipAddress,
        userAgent: String(req.headers["user-agent"] || "").slice(0, 500) || null,
      },
    })).catch((error) => console.error("Failed to write audit log:", error.message));
  });

  next();
}

module.exports = { auditTrail };
