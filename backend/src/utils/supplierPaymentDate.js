function statementDateKey(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function supplierPaymentDate(value, now = new Date()) {
  if (value === undefined) return now; // Compatibility with existing approval clients.
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Tanggal rekening koran wajib diisi dalam format YYYY-MM-DD.');
  const result = new Date(`${value}T00:00:00+07:00`);
  if (!Number.isFinite(result.getTime()) || statementDateKey(result) !== value) throw new Error('Tanggal rekening koran tidak valid.');
  if (value > statementDateKey(now)) throw new Error('Tanggal rekening koran tidak boleh melebihi hari ini.');
  return result;
}
module.exports = { supplierPaymentDate, statementDateKey };
