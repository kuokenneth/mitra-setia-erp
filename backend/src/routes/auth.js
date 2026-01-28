const express = require("express");
const bcrypt = require("bcrypt");
const { prisma } = require("../prisma");
const { signToken, requireAuth } = require("../auth");

const router = express.Router();

// Register (INVITE CODE REQUIRED)
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, confirmPassword, inviteCode } = req.body || {};

    const emailNorm = String(email || "").trim().toLowerCase();
    const nm = String(name || "").trim() || null;
    const pwd = String(password || "");
    const cpwd = String(confirmPassword || "");
    const code = String(inviteCode || "").trim();

    if (!emailNorm || !pwd) {
      return res.status(400).json({ ok: false, error: "email and password required" });
    }

    if (!cpwd) {
      return res.status(400).json({ ok: false, error: "confirm password required" });
    }
    if (pwd !== cpwd) {
      return res.status(400).json({ ok: false, error: "passwords do not match" });
    }

    if (!process.env.INVITE_CODE) {
      return res.status(500).json({ ok: false, error: "server missing INVITE_CODE" });
    }
    if (code !== process.env.INVITE_CODE) {
      return res.status(403).json({ ok: false, error: "invalid invitation code" });
    }

    const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existing) {
      return res.status(409).json({ ok: false, error: "Email already used" });
    }

    const hashed = await bcrypt.hash(pwd, 12);

    const user = await prisma.user.create({
      data: {
        name: nm,
        email: emailNorm,
        password: hashed,
        role: "STAFF",
        isActive: true,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return res.json({ ok: true, user });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const emailNorm = String(email || "").trim().toLowerCase();
    const pwd = String(password || "");

    if (!emailNorm || !pwd) {
      return res.status(400).json({ ok: false, error: "email and password required" });
    }

    const user = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (!user) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res.status(403).json({ ok: false, error: "Account inactive" });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({ ok: false, error: `Account is ${user.status}. Contact admin.` });
    }

    const match = await bcrypt.compare(pwd, user.password);
    if (!match) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // if HTTPS later, set true
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user || !user.isActive) {
    res.clearCookie("token");
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  res.json({ ok: true, user });
});

module.exports = router;
