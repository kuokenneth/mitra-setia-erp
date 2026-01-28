const jwt = require("jsonwebtoken");

exports.requireAuth = (req, res, next) => {
  const token =
    req.cookies.token ||
    req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // must include { id, role }
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};
