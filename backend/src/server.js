const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const { prisma } = require("./prisma");
const path = require("path");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const driverRoutes = require("./routes/drivers");
const truckRoutes = require("./routes/trucks");
const inventoryRoutes = require("./routes/inventory");
const maintenanceRoutes = require("./routes/maintenance");
const ordersRoutes = require("./routes/orders");
const expensesRoutes = require("./routes/expenses");
const uploadsRoutes = require("./routes/uploads"); // <-- keep for POST upload API
const tripsRouter = require("./routes/trips");
const dispatchRouter = require("./routes/dispatch");
const purchasingRoutes = require("./routes/purchasing");
const receivablesRoutes = require("./routes/receivables");
const accountingRoutes = require("./routes/accounting");
const fleetProfitabilityRoutes = require("./routes/fleetProfitability");
const realtimeRoutes = require("./routes/realtime");
const auditRoutes = require("./routes/audit");
const { publishUpdate } = require("./realtime");
const { auditTrail } = require("./middleware/auditTrail");
const { authRequired } = require("./middleware/authRequired");

const app = express();
app.set("trust proxy", 1);

app.use(helmet());

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  // ✅ Netlify default (kalau masih dipakai)
  "https://mitra-setia-erp.netlify.app",

  // ✅ Custom domains
  "https://mitrasetia.co.id",
  "https://www.mitrasetia.co.id",
  process.env.FRONTEND_URL, // if you set it
].filter(Boolean);

const corsOptions = {
    origin: function (origin, cb) {
      // allow Postman/curl with no origin
      if (!origin) return cb(null, true);

      if (allowedOrigins.includes(origin)) return cb(null, true);

      return cb(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };
app.use(cors(corsOptions));

// ✅ Handle preflight for all routes
app.options(/.*/, cors(corsOptions));

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(morgan("dev"));

// Cookie authentication crosses origins in production, so every browser data
// mutation must originate from an explicitly allowed frontend.
app.use((req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const origin = req.get("origin");
  const hasBearer = req.headers.authorization?.startsWith("Bearer ");
  if (process.env.NODE_ENV !== "production" && !origin) return next();
  if (hasBearer || (origin && allowedOrigins.includes(origin))) return next();
  return res.status(403).json({ error: "Invalid request origin" });
});
app.use(auditTrail);

// Notify connected ERP clients after every successful data mutation.
app.use((req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  res.on("finish", () => {
    if (res.statusCode < 400 && !req.path.startsWith("/auth/")) {
      publishUpdate({ method: req.method, resource: req.path.split("/").filter(Boolean)[0] || "data" });
    }
  });
  next();
});

// Health check
app.get("/health", async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true, service: "backend" });
});

/**
 * ✅ PUBLIC STATIC FIRST
 * These must NOT be behind auth, and should not be mounted twice.
 */
app.use("/uploads", authRequired, express.static(path.join(__dirname, "..", "uploads"), { dotfiles: "deny", index: false }));

/**
 * ✅ API ROUTES
 */
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/drivers", driverRoutes);
app.use("/trucks", truckRoutes);
app.use("/inventory", inventoryRoutes);
app.use("/maintenance", maintenanceRoutes);
app.use("/orders", ordersRoutes);
app.use("/expenses", expensesRoutes);
app.use("/purchasing", purchasingRoutes);
app.use("/receivables", receivablesRoutes);
app.use("/accounting", accountingRoutes);
app.use("/fleet-profitability", fleetProfitabilityRoutes);
app.use("/events", realtimeRoutes);
app.use("/audit", auditRoutes);

/**
 * ✅ Upload API should NOT be /uploads (conflicts with static).
 * Change uploadsRoutes base to /api/uploads or /files
 */
app.use("/api/uploads", uploadsRoutes);

app.use("/trips", tripsRouter);
app.use("/dispatch", authRequired, express.static(path.join(process.cwd(), "public", "dispatch"), { dotfiles: "deny", index: false }));
app.use("/dispatch", dispatchRouter);


// ❌ remove this unless you REALLY have static dispatch files in public/dispatch
// app.use("/dispatch", express.static(path.join(process.cwd(), "public", "dispatch")));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Backend running on http://localhost:${port}`));
