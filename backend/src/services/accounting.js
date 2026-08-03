const SYSTEM_ACCOUNTS = {
  CASH: "1001", BANK: "1002", AR: "1101", INVENTORY: "1201",
  AP: "2001", EQUITY: "3001", REVENUE: "4001", EXPENSE: "5001",
};

function journalNumber() {
  const d = new Date();
  return `JRN-${d.toISOString().slice(0,10).replaceAll("-","")}-${String(Date.now()).slice(-7)}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
}

async function postJournal(tx, { date = new Date(), description, sourceType, sourceId, createdById, lines }) {
  if (!sourceType || !sourceId) throw new Error("Referensi jurnal wajib diisi");
  const existing = await tx.journalEntry.findUnique({ where: { sourceType_sourceId: { sourceType, sourceId } } });
  if (existing) return existing;
  const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  if (debit <= 0 || debit !== credit) throw new Error("Jurnal tidak seimbang");
  const codes = [...new Set(lines.map(line => line.code))];
  const accounts = await tx.account.findMany({ where: { code: { in: codes }, isActive: true } });
  if (accounts.length !== codes.length) throw new Error("Akun sistem accounting belum lengkap");
  const ids = Object.fromEntries(accounts.map(account => [account.code, account.id]));
  return tx.journalEntry.create({ data: {
    number: journalNumber(), date: new Date(date), description, sourceType, sourceId,
    createdById: createdById || null,
    lines: { create: lines.map(line => ({ accountId: ids[line.code], description: line.description || null, debit: Number(line.debit || 0), credit: Number(line.credit || 0) })) },
  }});
}

const cashCode = method => method === "CASH" ? SYSTEM_ACCOUNTS.CASH : SYSTEM_ACCOUNTS.BANK;

module.exports = { SYSTEM_ACCOUNTS, cashCode, postJournal };
