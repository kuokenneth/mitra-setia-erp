function esc(value) {
  return String(value ?? "-")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function num(value) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function money(value) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function date(value, withTime = false) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long", ...(withTime ? { timeStyle: "short" } : {}) }).format(new Date(value));
}

function documentHtml({ title, subtitle = "", meta = "", body, landscape = false }) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
  @page{size:${landscape ? "A4 landscape" : "A4"};margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17251e;margin:0;font-size:11px}header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #0d7c3d;padding-bottom:12px;margin-bottom:16px}.brand{font-size:18px;font-weight:800;color:#0d7c3d}.title{font-size:20px;font-weight:800;margin-top:5px}.muted{color:#68756e}.meta{text-align:right;line-height:1.6}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#eaf4ee;color:#164b2e;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.3px}th,td{border:1px solid #ccd8d1;padding:7px;vertical-align:top}.right{text-align:right}.center{text-align:center}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0}.box{border:1px solid #ccd8d1;border-radius:6px;padding:10px}.box b{display:block;font-size:15px;margin-top:4px}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin-top:36px;text-align:center}.signatures div:after{content:"";display:block;border-top:1px solid #526159;margin:52px 12px 0}footer{position:fixed;bottom:0;left:0;right:0;font-size:9px;color:#7a867f;text-align:center}@media print{.no-print{display:none}}
  </style></head><body><header><div><div class="brand">MITRA SETIA ERP</div><div class="title">${esc(title)}</div><div class="muted">${esc(subtitle)}</div></div><div class="meta">${meta}<br>Dicetak: ${esc(date(new Date(), true))}</div></header>${body}<footer>Dokumen dibuat otomatis oleh Mitra Setia ERP</footer><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250))</script></body></html>`;
}

module.exports = { esc, num, money, date, documentHtml };
