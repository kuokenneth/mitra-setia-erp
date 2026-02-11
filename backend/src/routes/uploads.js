// backend/src/routes/uploads.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { authRequired } = require("../middleware/authRequired");

const router = express.Router();

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const cloudKey = process.env.CLOUDINARY_API_KEY;
const cloudSecret = process.env.CLOUDINARY_API_SECRET;
const cloudinaryEnabled = Boolean(cloudName && cloudKey && cloudSecret && ![cloudName, cloudKey, cloudSecret].includes("xxxx"));

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: cloudKey,
    api_secret: cloudSecret,
  });
}

// Local storage fallback
const uploadsDir = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const localStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safeBase = path
      .basename(file.originalname || "file")
      .replace(/\s+/g, "-")
      .replace(/[^\w.-]/g, "");
    cb(null, `${Date.now()}-${safeBase}`);
  },
});

// Cloudinary storage
const cloudStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isPdf = file.mimetype === "application/pdf";
    return {
      folder: "mitra-setia/expenses",
      resource_type: isPdf ? "raw" : "image",
      public_id: `${Date.now()}-${(file.originalname || "file").replace(/\.[^/.]+$/, "")}`.replace(/[\W]/g, "_"),
    };
  },
});

const upload = multer({
  storage: cloudinaryEnabled ? cloudStorage : localStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.post("/", authRequired, upload.array("files", 10), async (req, res) => {
  try {
    const files = req.files || [];
    const out = files.map((f) => {
      const isLocal = !cloudinaryEnabled;
      const url = isLocal
        ? `/uploads/${path.basename(f.path)}`
        : f.path; // Cloudinary URL

      return {
        url,
        fileName: f.originalname,
        mimeType: f.mimetype,
        size: f.size,
      };
    });
    res.json({ items: out, storage: cloudinaryEnabled ? "cloudinary" : "local" });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Upload failed" });
  }
});

module.exports = router;
