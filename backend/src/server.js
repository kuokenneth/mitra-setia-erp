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
const uploadsRoutes = require("./routes/uploads"); // <-- keep for POST upload API
const tripsRouter = require("./routes/trips");
const dispatchRouter = require("./routes/dispatch");

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

// Health check
app.get("/health", async (req, res) => {
  const users = await prisma.user.count();
  res.json({ ok: true, service: "backend", users });
});

/**
 * ✅ PUBLIC STATIC FIRST
 * These must NOT be behind auth, and should not be mounted twice.
 */
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

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

/**
 * ✅ Upload API should NOT be /uploads (conflicts with static).
 * Change uploadsRoutes base to /api/uploads or /files
 */
app.use("/api/uploads", uploadsRoutes);

app.use("/trips", tripsRouter);
app.use("/dispatch", express.static(path.join(process.cwd(), "public", "dispatch")));
app.use("/dispatch", dispatchRouter);


// ❌ remove this unless you REALLY have static dispatch files in public/dispatch
// app.use("/dispatch", express.static(path.join(process.cwd(), "public", "dispatch")));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Backend running on http://localhost:${port}`));
