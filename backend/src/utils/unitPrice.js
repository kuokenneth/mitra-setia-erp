// Prices support two decimal places; document totals are rounded separately.
function roundUnitPrice(value) {
  const number = Number(value);
  return Math.round((number + Number.EPSILON) * 100) / 100;
}
module.exports = { roundUnitPrice };
