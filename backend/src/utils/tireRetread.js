function expectedRetreadSku(sourceSku) {
  const sku = String(sourceSku || "")
    .trim()
    .toUpperCase()
    .replace(/_SECOND$/, "");
  if (sku.startsWith("BAN_MASAK_")) return sku;
  if (!sku.startsWith("BAN_")) return null;
  return `BAN_MASAK_${sku.slice(4)}`;
}

function assertRetreadTarget(sourceItem, targetItem) {
  const expectedSku = expectedRetreadSku(sourceItem?.sku);
  if (expectedSku && String(targetItem?.sku || "").trim().toUpperCase() !== expectedSku) {
    throw new Error(`${sourceItem.name || sourceItem.sku} harus menjadi ${expectedSku}`);
  }
}

module.exports = { expectedRetreadSku, assertRetreadTarget };
