const RESEND_ENDPOINT = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 8000;
const { prisma } = require("../prisma");
const { getObject } = require("./r2Storage");

function clean(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function frontendLink(path) {
  const base = clean(process.env.FRONTEND_URL).replace(/\/$/, "");
  if (!base) return "";
  const suffix = clean(path);
  return `${base}${suffix.startsWith("/") ? "" : "/"}${suffix}`;
}

function recipients() {
  return clean(process.env.OWNER_NOTIFICATION_EMAIL)
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
}

function emailOwnerConfigured() {
  return process.env.EMAIL_NOTIFICATIONS_ENABLED === "true"
    && Boolean(clean(process.env.RESEND_API_KEY))
    && Boolean(clean(process.env.EMAIL_FROM))
    && recipients().length > 0;
}

async function streamToBuffer(stream) {
  if (typeof stream?.transformToByteArray === "function") {
    return Buffer.from(await stream.transformToByteArray());
  }
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function inlineProofAttachment(proof) {
  const match = String(proof?.url || "").match(/^\/api\/uploads\/([^/?#]+)/);
  if (!match || !String(proof?.mimeType || "").startsWith("image/")) return null;
  const file = await prisma.storedFile.findUnique({ where: { id: match[1] } });
  if (!file) return null;
  let content;
  if (file.storageProvider === "R2" && file.storageKey) {
    const object = await getObject(file.storageKey);
    if (!object.Body) return null;
    content = await streamToBuffer(object.Body);
  } else if (file.data) {
    content = Buffer.from(file.data);
  }
  if (!content?.length) return null;
  return {
    filename: proof.fileName || file.fileName || "bukti-pembelian.jpg",
    content: content.toString("base64"),
    content_type: proof.mimeType || file.mimeType || "image/jpeg",
    content_id: "purchase-proof",
  };
}

async function sendOwnerEmail({ event, title, details, path, actionLabel, proof }) {
  if (!emailOwnerConfigured()) return { sent: false, reason: "disabled" };

  const link = frontendLink(path);
  const proofAttachment = await inlineProofAttachment(proof).catch(error => {
    console.error("Email inline proof failed:", error.message);
    return null;
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${clean(process.env.RESEND_API_KEY)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: clean(process.env.EMAIL_FROM),
        to: recipients(),
        ...(clean(process.env.EMAIL_REPLY_TO) ? { reply_to: clean(process.env.EMAIL_REPLY_TO) } : {}),
        subject: `[Mitra Setia ERP] ${clean(event) || "Notifikasi baru"}`,
        text: [event, title, details, link && `Buka ERP: ${link}`].filter(Boolean).join("\n\n"),
        ...(proofAttachment ? { attachments: [proofAttachment] } : {}),
        html: `
          <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#17221b">
            <div style="border-top:5px solid #0d7c3d;padding:24px;border-left:1px solid #dce7df;border-right:1px solid #dce7df;border-bottom:1px solid #dce7df;border-radius:10px">
              <div style="color:#0d7c3d;font-size:12px;font-weight:700;letter-spacing:.08em">MITRA SETIA ERP</div>
              <h2 style="margin:10px 0 6px">${escapeHtml(event || "Notifikasi baru")}</h2>
              <div style="font-size:16px;font-weight:700;margin-bottom:12px">${escapeHtml(title || "-")}</div>
              <p style="color:#59665e;line-height:1.6;margin:0;white-space:pre-line">${escapeHtml(details || "-")}</p>
              ${proofAttachment ? `<div style="margin-top:18px"><div style="font-size:11px;font-weight:700;color:#647269;margin-bottom:7px">BUKTI FOTO</div><img src="cid:purchase-proof" alt="Bukti permintaan pembelian" style="display:block;max-width:100%;max-height:420px;border-radius:9px;border:1px solid #dce7df" /></div>` : ""}
              ${link ? `<a href="${escapeHtml(link)}" style="display:inline-block;margin-top:22px;background:#0d7c3d;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:700">${escapeHtml(actionLabel || "Buka di ERP")}</a>` : ""}
            </div>
            <p style="font-size:11px;color:#849087;text-align:center">Email otomatis dari Mitra Setia ERP.</p>
          </div>`,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend API ${response.status}: ${body.slice(0, 300)}`);
    }
    return { sent: true };
  } finally {
    clearTimeout(timeout);
  }
}

// Pengiriman dilakukan setelah pekerjaan utama masuk event loop. Kegagalan email
// tidak boleh memperlambat atau membatalkan transaksi operasional ERP.
async function notifyOwnerSafely(payload) {
  if (!emailOwnerConfigured()) return { sent: false, reason: "disabled" };
  setImmediate(() => {
    sendOwnerEmail(payload).catch(error => {
      console.error("Owner email notification failed:", error.message);
    });
  });
  return { sent: false, queued: true };
}

module.exports = { notifyOwnerSafely, sendOwnerEmail, emailOwnerConfigured };
