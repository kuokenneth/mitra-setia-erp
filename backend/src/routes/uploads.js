// backend/src/routes/uploads.js
const express = require("express");
const multer = require("multer");
const { authRequired } = require("../middleware/authRequired");
const { prisma } = require("../prisma");

const router = express.Router();

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function hasValidSignature(file) {
  const b = file.buffer;
  if (!b || b.length < 12) return false;
  if (file.mimetype === "application/pdf") return b.subarray(0, 5).toString("ascii") === "%PDF-";
  if (file.mimetype === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (file.mimetype === "image/png") return b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (file.mimetype === "image/webp") return b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

const upload = multer({
  // Proofs are kept behind authenticated download routes, never public URLs.
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = allowedTypes.has(String(file.mimetype || "").toLowerCase());
    cb(allowed ? null : new Error("Hanya PDF, JPG, PNG, dan WEBP yang diperbolehkan"), allowed);
  },
});

// Public read endpoint. IDs are unguessable CUIDs and the response is inline so
// image/PDF proofs can be opened directly from a new browser tab.
router.get("/:id", authRequired, async (req, res) => {
  try {
    const file = await prisma.storedFile.findUnique({ where: { id: req.params.id } });
    if (!file) return res.status(404).send("Bukti tidak ditemukan");
    const safeName = String(file.fileName || "bukti").replace(/[\r\n"\\]/g, "_");
    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
    res.setHeader("Content-Length", String(file.size));
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.send(Buffer.from(file.data));
  } catch (e) {
    res.status(400).send(e.message || "Gagal membuka bukti");
  }
});

router.post("/", authRequired, (req, res, next) => {
  upload.array("files", 10)(req, res, (error) => {
    if (!error) return next();
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "Ukuran setiap file maksimal 15 MB"
      : error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE"
        ? "Maksimal 10 file dalam sekali upload"
        : error.message || "Upload gagal";
    return res.status(400).json({ error: message });
  });
}, async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: "Pilih minimal satu file PDF atau gambar" });
    if (files.some((file) => !hasValidSignature(file))) {
      return res.status(400).json({ error: "Isi file tidak sesuai dengan format PDF atau gambar yang dipilih" });
    }
    const out = await Promise.all(files.map(async (f) => {
      const stored = await prisma.storedFile.create({ data: { fileName: f.originalname || "bukti", mimeType: f.mimetype || "application/octet-stream", size: f.size, data: f.buffer } });
      return { url: `/api/uploads/${stored.id}`, fileName: stored.fileName, mimeType: stored.mimeType, size: stored.size };
    }));
    res.json({ items: out, storage: "database" });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Upload failed" });
  }
});

module.exports = router;
