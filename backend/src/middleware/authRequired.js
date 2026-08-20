// backend/src/middleware/authRequired.js
const jwt = require("jsonwebtoken");
const { prisma } = require("../prisma");

async function authRequired(req, res, next) {
  const token =
    req.cookies?.token ||
    req.headers.authorization?.replace("Bearer ", "");

  if (!token) return res.status(401).json({ message: "Not authenticated" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, role: true, isActive: true, status: true },
    });
    if (!user || !user.isActive || user.status !== "ACTIVE") {
      return res.status(401).json({ message: "Account inactive or session revoked" });
    }
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    return next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

module.exports = { authRequired };
