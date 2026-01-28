// backend/src/routes/dispatch.js
// Generates "Surat Pengantar Muat" PDF for a Trip using HTML -> PDF (Puppeteer)

const express = require("express");
const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");

const router = express.Router();

function canWrite(user) {
  return ["OWNER", "ADMIN", "STAFF"].includes(user?.role);
}

function pad5(n) {
  return String(n).padStart(5, "0");
}

// Format: SP-YYYY-00001
async function nextDispatchNo(tx) {
  const year = new Date().getFullYear();
  const prefix = `SP-${year}-`;

  const last = await tx.dispatchLetter.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { createdAt: "desc" },
    select: { number: true },
  });

  let nextSeq = 1;
  if (last?.number) {
    const tail = last.number.replace(prefix, "");
    const parsed = parseInt(tail, 10);
    if (Number.isFinite(parsed)) nextSeq = parsed + 1;
  }

  return `${prefix}${pad5(nextSeq)}`;
}

function fmtDateId(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHtmlTemplate(data) {
  const {
    companyName,
    companyAddress,
    companyPhone,
    dispatchNo,
    city,
    recipientName,
    cargoName,
    qtyText,
    driverName,
    plateNumber,
    loadDateText,
    destination,
  } = data;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
@page { size: A4; margin: 25mm 20mm; }
body { font-family: "Times New Roman", serif; font-size: 12pt; color: #000; }
.center { text-align: center; }
.header-title { font-weight: bold; font-size: 18pt; }
.header-sub { font-size: 11pt; margin-top: 4px; }
hr { border: none; border-top: 1.5px solid #000; margin: 10px 0 18px; }
.row { display: flex; justify-content: space-between; }
.mt-20 { margin-top: 20px; }
.sign {
  margin-top: 60px;
}

.sign-space {
  height: 90px;   /* 👈 controls signature space */
}

.label { width: 140px; display: inline-block; }
.dots { display: inline-block; border-bottom: 1px dotted #000; min-width: 250px; }
</style>
</head>
<body>
  <div class="center">
    <div class="header-title">${esc(companyName || "CV. MITRA SETIA")}</div>
    <div class="header-sub">
      ${esc(companyAddress || "")}<br/>
      ${esc(companyPhone || "")}
    </div>
  </div>

  <hr/>

  <div class="row">
    <div><b>No :</b> ${esc(dispatchNo)}</div>
    <div>${esc(city || "")},</div>
  </div>

  <div class="mt-20">
    <div><b>Kepada Yth.</b></div>
    <div class="dots">${esc(recipientName || "")}</div>
  </div>

  <div class="mt-20">
    Dengan Hormat,<br/><br/>
    Melalui surat ini, agar dapat dimuat
    <span class="dots">${esc(cargoName || "")}</span>
    unit mobil sbb :
  </div>

  <div class="mt-20">
    <div><span class="label">Nama Supir</span>: ${esc(driverName || "")}</div>
    <div><span class="label">No. Polisi</span>: ${esc(plateNumber || "")}</div>
    <div><span class="label">Tanggal Muat</span>: ${esc(loadDateText || "")}</div>
    <div><span class="label">Tujuan</span>: ${esc(destination || "")}</div>
  </div>

  <div class="mt-20">
    Demikian surat pengantar muat ini kami buat, atas dan perhatian dan kerjasamanya
    kami ucapkan terima kasih.
  </div>

  <div class="sign">
    Hormat Kami,
    <div class="sign-space"></div>
    <b>( ${companyName || "CV. MITRA SETIA"} )</b>
  </div>

</body>
</html>`;
}

function getBackendOrigin(req) {
  // Prefer env if you deploy later
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/$/, "");

  // Fallback: derive from request
  const proto =
    (req.headers["x-forwarded-proto"] ? String(req.headers["x-forwarded-proto"]).split(",")[0].trim() : null) ||
    req.protocol;

  const host =
    (req.headers["x-forwarded-host"] ? String(req.headers["x-forwarded-host"]).split(",")[0].trim() : null) ||
    req.get("host");

  return `${proto}://${host}`;
}

/**
 * POST /dispatch/trips/:tripId
 */
router.post("/trips/:tripId", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });

    const tripId = req.params.tripId;
    const body = req.body || {};

    // Ensure output folder exists
    const outDir = path.join(process.cwd(), "public", "dispatch");
    fs.mkdirSync(outDir, { recursive: true });

    const backendOrigin = getBackendOrigin(req);

    const result = await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        include: { truck: true, driverUser: true, order: true, dispatchLetter: true },
      });
      if (!trip) throw new Error("Trip not found");

      const order = trip.order;

      const recipientName = order.customerName || "";
      const cargoName = order.cargoName || "";
      const qtyText =
        order.qty != null ? `${Number(order.qty)} ${order.unit || ""}`.trim() : "";

      const driverName = trip.driverNameSnap || trip.driverUser?.name || "";
      const plateNumber = trip.plateNumberSnap || trip.truck?.plateNumber || "";
      const destination = trip.toText || order.toText || "";

      const issuedAt = new Date();
      const dispatchNo = trip.dispatchLetter?.number || (await nextDispatchNo(tx));

      const loadDateText =
        body.loadDateText ||
        fmtDateId(trip.dispatchedAt || trip.plannedDepartAt || issuedAt);

      const html = buildHtmlTemplate({
        companyName: body.companyName || "CV. Mitra Setia",
        companyAddress: body.companyAddress || "",
        companyPhone: body.companyPhone || "",
        city: body.city || "",
        dispatchNo,
        recipientName,
        cargoName,
        qtyText,
        driverName,
        plateNumber,
        loadDateText,
        destination,
      });

      // Generate PDF
      const fileName = `${dispatchNo}.pdf`.replace(/[^\w\-\.]/g, "_");
      const filePath = path.join(outDir, fileName);

      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });
        await page.pdf({
          path: filePath,
          format: "A4",
          printBackground: true,
          margin: { top: "18mm", right: "16mm", bottom: "18mm", left: "16mm" },
        });
      } finally {
        await browser.close();
      }

      // ✅ IMPORTANT: ABSOLUTE URL so frontend opens backend, not React
      const pdfUrl = `${backendOrigin}/dispatch/${fileName}`;

      const saved = await tx.dispatchLetter.upsert({
        where: { tripId: trip.id },
        create: {
          tripId: trip.id,
          number: dispatchNo,
          city: body.city || null,
          issuedAt,
          pdfUrl,
          recipientName: recipientName || null,
          cargoName: cargoName || null,
          driverName: driverName || null,
          plateNumber: plateNumber || null,
          loadDateText: loadDateText || null,
          destination: destination || null,
        },
        update: {
          city: body.city || null,
          issuedAt,
          pdfUrl,
          recipientName: recipientName || null,
          cargoName: cargoName || null,
          driverName: driverName || null,
          plateNumber: plateNumber || null,
          loadDateText: loadDateText || null,
          destination: destination || null,
        },
      });

      return saved;
    });

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to generate dispatch letter" });
  }
});

module.exports = router;
