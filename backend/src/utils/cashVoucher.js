const { esc } = require("./printDocument");

const SMALL = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

function words(value) {
  const number = Math.floor(Math.abs(Number(value) || 0));
  if (number < 12) return SMALL[number];
  if (number < 20) return `${words(number - 10)} belas`;
  if (number < 100) return `${words(Math.floor(number / 10))} puluh ${words(number % 10)}`;
  if (number < 200) return `seratus ${words(number - 100)}`;
  if (number < 1000) return `${words(Math.floor(number / 100))} ratus ${words(number % 100)}`;
  if (number < 2000) return `seribu ${words(number - 1000)}`;
  if (number < 1_000_000) return `${words(Math.floor(number / 1000))} ribu ${words(number % 1000)}`;
  if (number < 1_000_000_000) return `${words(Math.floor(number / 1_000_000))} juta ${words(number % 1_000_000)}`;
  if (number < 1_000_000_000_000) return `${words(Math.floor(number / 1_000_000_000))} miliar ${words(number % 1_000_000_000)}`;
  return `${words(Math.floor(number / 1_000_000_000_000))} triliun ${words(number % 1_000_000_000_000)}`;
}

function terbilang(value) {
  const result = words(value).replace(/\s+/g, " ").trim();
  return `${result.charAt(0).toUpperCase()}${result.slice(1)} rupiah`;
}

function rupiah(value) {
  return `Rp ${Math.round(Number(value) || 0).toLocaleString("id-ID")}`;
}

function jakartaDate(value) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function cashVoucherHtml({ type, number, date, party, amount, purpose, method, notes, signatures = [] }) {
  const outgoing = type === "OUT";
  const title = outgoing ? "BUKTI PENGELUARAN KAS" : "BUKTI PENERIMAAN KAS";
  const partyLabel = outgoing ? "SUDAH DIBAYAR KEPADA" : "SUDAH DITERIMA DARI";
  const purposeLabel = outgoing ? "UNTUK PEMBAYARAN" : "UNTUK PENERIMAAN";
  const methodLabel = outgoing ? "DIBAYAR DENGAN" : "DITERIMA DENGAN";
  const fallbackSignatures = outgoing
    ? ["YANG MENGELUARKAN", "DISETUJUI OLEH", "DIBUKUKAN OLEH", "YANG MENERIMA"]
    : ["YANG MENYERAHKAN", "YANG MENERIMA", "DIBUKUKAN OLEH", "DISETUJUI OLEH"];
  const signers = fallbackSignatures.map((label, index) => ({ label, name: signatures[index] || "" }));
  const row = (label, content, extraClass = "") => `<div class="field ${extraClass}"><div class="label">${esc(label)}</div><div class="colon">:</div><div class="value">${esc(content || "-")}</div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} ${esc(number)}</title><style>
  @page{size:9.5in 5.5in;margin:0.22in}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000}body{font-family:"Courier New",Courier,monospace;font-size:11pt;line-height:1.18}.toolbar{display:flex;justify-content:flex-end;padding:8px;background:#eee}.toolbar button{font:700 13px Arial;padding:7px 14px;border:1px solid #000;background:#fff;cursor:pointer}.voucher{width:9.06in;height:5.06in;border:1px solid #000;padding:.18in .22in;display:flex;flex-direction:column}.heading{text-align:center;margin-bottom:.12in}.heading h1{display:inline-block;font-family:"Times New Roman",serif;font-size:18pt;line-height:1;margin:0;border-bottom:1px solid #000}.number{margin-top:5px;font-size:10.5pt}.fields{flex:1;padding-top:.03in}.field{display:grid;grid-template-columns:2.18in .15in 1fr;min-height:.34in;align-items:start}.field .label{font-weight:700;letter-spacing:.2px}.field .value{min-height:.25in;border-bottom:1px dotted #000;padding:0 6px 3px}.field.tall{min-height:.48in}.field.tall .value{min-height:.42in}.amount .value{font-weight:700}.place-date{text-align:right;margin:.03in 0 .08in;font-weight:700}.signatures{height:1.02in;border:1px solid #000;display:grid;grid-template-columns:repeat(4,1fr)}.signature{text-align:center;border-right:1px solid #000;display:flex;flex-direction:column}.signature:last-child{border-right:0}.signature strong{font-family:"Times New Roman",serif;font-size:10pt;border-bottom:1px solid #000;padding:4px 2px}.signature span{margin-top:auto;padding:0 4px 5px;font-size:9pt}.hint{display:none}@media print{.toolbar{display:none}.voucher{page-break-after:avoid}}
  </style></head><body><div class="toolbar"><button onclick="window.print()">Cetak</button></div><main class="voucher"><div class="heading"><h1>${esc(title)}</h1><div class="number">No. ${esc(number)}</div></div><section class="fields">${row(partyLabel, party)}${row("UANG SEJUMLAH", rupiah(amount), "amount")}${row("T E R B I L A N G", `( ${terbilang(amount)} )`, "tall")}${row(purposeLabel, purpose, "tall")}${row(methodLabel, method)}${notes ? row("CATATAN", notes) : ""}</section><div class="place-date">MEDAN, TGL. ${esc(jakartaDate(date))}</div><section class="signatures">${signers.map(signer => `<div class="signature"><strong>${esc(signer.label)}</strong><span>${esc(signer.name)}</span></div>`).join("")}</section></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),500))</script></body></html>`;
}

function cashVoucherBatchHtml(vouchers, title = "BUKTI PENERIMAAN KAS") {
  if (!vouchers.length) return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body><p>Tidak ada penerimaan kas pada periode ini.</p></body></html>`;
  const rendered = vouchers.map(cashVoucherHtml);
  const style = rendered[0].match(/<style>([\s\S]*?)<\/style>/)?.[1] || "";
  const pages = rendered.map(document => document.match(/<main class="voucher">[\s\S]*?<\/main>/)?.[0] || "").join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${style}.voucher{page-break-after:always}.voucher:last-of-type{page-break-after:avoid}</style></head><body><div class="toolbar"><button onclick="window.print()">Cetak ${vouchers.length} bukti</button></div>${pages}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),500))</script></body></html>`;
}

module.exports = { cashVoucherHtml, cashVoucherBatchHtml, terbilang };
