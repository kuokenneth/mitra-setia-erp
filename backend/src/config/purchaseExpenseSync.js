// Temporary switch for mirroring approved supplier payments into Expenses.
// Keep the purchasing transaction and its accounting journal intact while disabled.
const SUPPLIER_PAYMENT_EXPENSE_SYNC_ENABLED = false;
const SUPPLIER_PAYMENT_EXPENSE_MARKER = "AUTO_SUPPLIER_PAYMENT:";

function visibleExpenseWhere() {
  if (SUPPLIER_PAYMENT_EXPENSE_SYNC_ENABLED) return {};
  return {
    OR: [
      { notes: null },
      { NOT: { notes: { startsWith: SUPPLIER_PAYMENT_EXPENSE_MARKER } } },
    ],
  };
}

module.exports = {
  SUPPLIER_PAYMENT_EXPENSE_SYNC_ENABLED,
  SUPPLIER_PAYMENT_EXPENSE_MARKER,
  visibleExpenseWhere,
};
