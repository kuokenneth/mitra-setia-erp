function invoiceDate(value, fallback = new Date()) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Tanggal invoice tidak valid (YYYY-MM-DD)');
  const date = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime()) || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date) !== value) throw new Error('Tanggal invoice tidak valid');
  return date;
}
function receiptDate(value, fallback = null) {
  if (value === undefined) return fallback;
  if (value === "" || value === null) return null;
  invoiceDate(value);
  return value;
}
module.exports = { invoiceDate, receiptDate };
