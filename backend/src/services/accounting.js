const SYSTEM_ACCOUNTS = {
  CASH: "1001", BANK: "1002", AR: "1101", INVENTORY: "1201",
  AP: "2001", FINANCE_AP: "2101", EQUITY: "3001", REVENUE: "4001", EXPENSE: "5001",
};
const { nextDailyNumber } = require("../utils/documentNumber");

async function postJournal(tx, { date = new Date(), description, sourceType, sourceId, createdById, lines }) {
  if (!sourceType || !sourceId) throw new Error("Referensi jurnal wajib diisi");
  const existing = await tx.journalEntry.findUnique({ where: { sourceType_sourceId: { sourceType, sourceId } }, select: { id: true } });
  if (existing) return existing;
  const toAmount = value => BigInt(Math.round(Number(value || 0)));
  const debit = lines.reduce((sum, line) => sum + toAmount(line.debit), 0n);
  const credit = lines.reduce((sum, line) => sum + toAmount(line.credit), 0n);
  if (debit <= 0n || debit !== credit) throw new Error("Jurnal tidak seimbang");
  const codes = [...new Set(lines.map(line => line.code))];
  const accounts = await tx.account.findMany({ where: { code: { in: codes }, isActive: true }, select: { id: true, code: true } });
  if (accounts.length !== codes.length) throw new Error("Akun sistem accounting belum lengkap");
  const ids = Object.fromEntries(accounts.map(account => [account.code, account.id]));
  return tx.journalEntry.create({ data: {
    number: await nextDailyNumber(tx, "journalEntry", "JRN", { date: new Date(date) }), date: new Date(date), description, sourceType, sourceId,
    createdById: createdById || null,
    lines: { create: lines.map(line => ({ accountId: ids[line.code], description: line.description || null, debit: toAmount(line.debit), credit: toAmount(line.credit) })) },
  }});
}

const cashCode = method => method === "CASH" ? SYSTEM_ACCOUNTS.CASH : SYSTEM_ACCOUNTS.BANK;

module.exports = { SYSTEM_ACCOUNTS, cashCode, postJournal };
