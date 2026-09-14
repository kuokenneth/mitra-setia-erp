const REQUIRED_CONFIG = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_OWNER_NUMBER",
  "WHATSAPP_OWNER_TEMPLATE",
  "WHATSAPP_GRAPH_VERSION",
];

function cleanPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function frontendLink(path) {
  const base = String(process.env.FRONTEND_URL || "").replace(/\/$/, "");
  if (!base) return "Buka aplikasi ERP";
  return `${base}${String(path || "").startsWith("/") ? "" : "/"}${path || ""}`;
}

function whatsappOwnerConfigured() {
  return process.env.WHATSAPP_ENABLED === "true" && REQUIRED_CONFIG.every(key => String(process.env[key] || "").trim());
}

async function notifyOwner({ event, title, details, path }) {
  if (!whatsappOwnerConfigured()) return { sent: false, reason: "disabled" };

  const graphVersion = String(process.env.WHATSAPP_GRAPH_VERSION).trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID).trim();
  const endpoint = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone(process.env.WHATSAPP_OWNER_NUMBER),
      type: "template",
      template: {
        name: String(process.env.WHATSAPP_OWNER_TEMPLATE).trim(),
        language: { code: String(process.env.WHATSAPP_TEMPLATE_LANGUAGE || "id").trim() },
        components: [{
          type: "body",
          parameters: [event, title, details, frontendLink(path)].map(text => ({
            type: "text",
            text: String(text || "-").slice(0, 1000),
          })),
        }],
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WhatsApp API ${response.status}: ${body.slice(0, 300)}`);
  }
  return { sent: true };
}

async function notifyOwnerSafely(payload) {
  try {
    return await notifyOwner(payload);
  } catch (error) {
    // Notifications must never roll back or interrupt the ERP transaction.
    console.error("Owner WhatsApp notification failed:", error.message);
    return { sent: false, reason: "provider_error" };
  }
}

module.exports = { notifyOwnerSafely, whatsappOwnerConfigured };
