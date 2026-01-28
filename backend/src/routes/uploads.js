// backend/src/routes/uploads.js
const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { authRequired } = require("../middleware/authRequired");

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// allow images + pdf
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isPdf = file.mimetype === "application/pdf";
    return {
      folder: "mitra-setia/orders",
      resource_type: isPdf ? "raw" : "image",
      // keep original-ish name
      public_id: `${Date.now()}-${(file.originalname || "file").replace(/\.[^/.]+$/, "")}`.replace(/[^\w\-]/g, "_"),
    };
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

router.post("/", authRequired, upload.array("files", 10), async (req, res) => {
  try {
    const files = req.files || [];
    const out = files.map((f) => ({
      url: f.path, // Cloudinary URL
      fileName: f.originalname,
      mimeType: f.mimetype,
      size: f.size,
    }));
    res.json({ items: out });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Upload failed" });
  }
});

module.exports = router;
