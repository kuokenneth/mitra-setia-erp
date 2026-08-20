const buckets = new Map();

function rateLimit({ windowMs = 15 * 60 * 1000, max = 100, key = (req) => req.ip, message = "Terlalu banyak permintaan. Coba lagi nanti." } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const bucketKey = `${req.path}:${key(req) || "unknown"}`;
    const current = buckets.get(bucketKey);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    bucket.count += 1;
    buckets.set(bucketKey, bucket);

    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > max) return res.status(429).json({ ok: false, error: message });
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, 10 * 60 * 1000).unref();

module.exports = { rateLimit };
