function jakartaDateParts(date = new Date()) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).map(part => [part.type, part.value]));
}

function dailyPrefix(prefix, date = new Date()) {
  const parts = jakartaDateParts(date);
  return `${prefix}-${parts.year}-${parts.day}/${parts.month}-`;
}

async function nextDailyNumber(tx, model, prefix, options = {}) {
  const field = options.field || "number";
  const start = dailyPrefix(prefix, options.date);
  const last = await tx[model].findFirst({
    where: { [field]: { startsWith: start } },
    orderBy: { [field]: "desc" },
    select: { [field]: true },
  });
  const previous = last?.[field];
  const parsed = previous ? Number(previous.slice(start.length)) : 0;
  const sequence = Number.isFinite(parsed) ? parsed + 1 : 1;
  return `${start}${String(sequence).padStart(4, "0")}`;
}

module.exports = { dailyPrefix, jakartaDateParts, nextDailyNumber };
