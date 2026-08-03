// backend/src/routes/uploads.js
const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { authRequired } = require("../middleware/authRequired");
const { prisma } = require("../prisma");

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
  // Database fallback is persistent across Render restarts.
  storage: cloudinaryEnabled ? cloudStorage : multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// Public read endpoint. IDs are unguessable CUIDs and the response is inline so
// image/PDF proofs can be opened directly from a new browser tab.
router.get("/:id", async (req, res) => {
  try {
    const file = await prisma.storedFile.findUnique({ where: { id: req.params.id } });
    if (!file) return res.status(404).send("Bukti tidak ditemukan");
    const safeName = String(file.fileName || "bukti").replace(/[\r\n"\\]/g, "_");
    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
    res.setHeader("Content-Length", String(file.size));
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(Buffer.from(file.data));
  } catch (e) {
    res.status(400).send(e.message || "Gagal membuka bukti");
  }
});

router.post("/", authRequired, upload.array("files", 10), async (req, res) => {
  try {
    const files = req.files || [];
    const out = await Promise.all(files.map(async (f) => {
      if (cloudinaryEnabled) return { url: f.path, fileName: f.originalname, mimeType: f.mimetype, size: f.size };
      const stored = await prisma.storedFile.create({ data: { fileName: f.originalname || "bukti", mimeType: f.mimetype || "application/octet-stream", size: f.size, data: f.buffer } });
      return { url: `/api/uploads/${stored.id}`, fileName: stored.fileName, mimeType: stored.mimeType, size: stored.size };
    }));
    res.json({ items: out, storage: cloudinaryEnabled ? "cloudinary" : "database" });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Upload failed" });
  }
});

module.exports = router;
