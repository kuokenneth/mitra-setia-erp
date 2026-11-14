const { randomUUID } = require('node:crypto');
const c = require('./core');
const { PROVIDER, createShoppingProvider, ProviderError } = require('./providers');
const { findItem, saveObservation } = require('./store');
const LEASE_MS = 180000;
async function enqueue(db, itemId, userId = null, now = new Date(), provider = createShoppingProvider()) {
  if (!provider.getProviderStatus().available) throw new c.MarketInputError('Sumber otomatis belum tersedia. Konfigurasikan penyedia atau tambahkan listing manual.', 503);
  const item = await findItem(db, itemId);
  if (!c.profileReady(c.profileFor(item, item.marketMonitor))) throw new c.MarketInputError('Lengkapi profil pembanding sebelum mencari harga otomatis.');
  const activeKey = `${itemId}:${PROVIDER}`;
  const existing = await db.marketPriceCheckJob.findUnique({ where: { activeKey } });
  if (existing) return { job: existing, reused: true };
  const cached = await db.marketPriceCheckJob.findFirst({ where: { itemId, provider: PROVIDER, status: 'SUCCEEDED', finishedAt: { gt: new Date(now - 5 * 60000) } }, orderBy: { finishedAt: 'desc' } });
  if (cached) return { job: cached, cached: true };
  if (userId) {
    const count = await db.marketPriceCheckJob.count({ where: { requestedById: userId, createdAt: { gt: new Date(now - 10 * 60000) } } });
    if (count >= 5) throw new c.MarketInputError('Maksimal 5 pengecekan per 10 menit. Coba lagi nanti.', 429);
  }
  const id = randomUUID();
  await db.marketPriceCheckJob.createMany({ data: [{ id, itemId, provider: PROVIDER, activeKey, requestedById: userId, availableAt: now }], skipDuplicates: true });
  return { job: await db.marketPriceCheckJob.findUnique({ where: { activeKey } }), reused: false };
}
async function claimJob(db, now = new Date()) {
  return db.$transaction(async tx => {
    // Serialize claims across every replica, with a persisted provider-wide rate limit.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7782301)`;
    const recent = await tx.marketPriceCheckJob.findFirst({ where: { provider: PROVIDER, startedAt: { gt: new Date(now - 60000) } }, select: { id: true } });
    if (recent) return null;
    const rows = await tx.$queryRaw`
      SELECT id FROM "MarketPriceCheckJob"
      WHERE attempts < 3 AND provider = ${PROVIDER}
        AND ((status = 'QUEUED' AND "availableAt" <= ${now})
          OR (status = 'RUNNING' AND "lockedAt" < ${new Date(now - LEASE_MS)}))
      ORDER BY "availableAt", "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
    if (!rows.length) return null;
    return tx.marketPriceCheckJob.update({ where: { id: rows[0].id }, data: { status: 'RUNNING', attempts: { increment: 1 }, startedAt: now, lockedAt: now, lockToken: randomUUID(), errorCode: null } });
  });
}
async function processJob(db, job, provider = createShoppingProvider(), now = new Date()) {
  try {
    const item = await findItem(db, job.itemId);
    const profile = c.profileFor(item, item.marketMonitor);
    if (!c.profileReady(profile)) throw new ProviderError('PROFILE_INCOMPLETE', false);
    const rows = await provider.searchProducts(item, profile);
    await db.$transaction(async tx => {
      // Lease token prevents a delayed/crashed worker from committing a second result set.
      const owned = await tx.marketPriceCheckJob.updateMany({ where: { id: job.id, status: 'RUNNING', lockToken: job.lockToken }, data: { lockedAt: new Date() } });
      if (owned.count !== 1) throw new ProviderError('LEASE_LOST', false);
      for (const row of rows) await saveObservation(tx, item, row, { provider: PROVIDER, eventKey: job.id, now: new Date() });
      await tx.marketPriceCheckJob.update({ where: { id: job.id }, data: { status: 'SUCCEEDED', activeKey: null, lockToken: null, lockedAt: null, finishedAt: new Date(), resultCount: rows.length, logs: [...(Array.isArray(job.logs) ? job.logs : []), { at: new Date().toISOString(), event: 'SEARCH_SUCCEEDED', count: rows.length }] } });
      await tx.marketPriceMonitor.updateMany({ where: { itemId: job.itemId }, data: { nextCheckAt: new Date(Date.now() + profile.intervalDays * c.DAY) } });
    }, { timeout: 60000 });
  } catch (error) {
    const code = error instanceof ProviderError ? error.code : 'CHECK_FAILED';
    if (code === 'LEASE_LOST') return;
    const plan = error.retryable === false ? { status: 'FAILED', availableAt: now } : c.retryPlan(job.attempts, now);
    await db.marketPriceCheckJob.updateMany({ where: { id: job.id, status: 'RUNNING', lockToken: job.lockToken }, data: {
      ...plan, ...(plan.status === 'FAILED' ? { activeKey: null, finishedAt: new Date() } : {}), lockToken: null, lockedAt: null, errorCode: code,
      logs: [...(Array.isArray(job.logs) ? job.logs : []), { at: new Date().toISOString(), event: code, attempt: job.attempts }],
    } });
    if (plan.status === 'FAILED') await db.marketPriceMonitor.updateMany({ where: { itemId: job.itemId }, data: { nextCheckAt: new Date(now.getTime() + c.DAY) } });
  }
}
async function tick(db, provider = createShoppingProvider(), now = new Date()) {
  await db.marketPriceCheckJob.updateMany({ where: { status: 'RUNNING', attempts: { gte: 3 }, lockedAt: { lt: new Date(now - LEASE_MS) } }, data: { status: 'FAILED', activeKey: null, lockToken: null, finishedAt: now, errorCode: 'LEASE_EXPIRED' } });
  if (provider.getProviderStatus().available) {
    const due = await db.marketPriceMonitor.findMany({ where: { enabled: true, nextCheckAt: { lte: now } }, orderBy: { nextCheckAt: 'asc' }, take: 25 });
    for (const monitor of due) {
      try { await enqueue(db, monitor.itemId, null, now, provider); }
      catch (e) { if (!(e instanceof c.MarketInputError)) throw e; }
    }
  }
  const job = await claimJob(db, now);
  if (job) await processJob(db, job, provider, now);
}
function startMarketPriceWorker(db) {
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try { await tick(db); } catch (e) { console.error('[market-prices worker]', e.code || e.name); } finally { busy = false; }
  };
  void run();
  const timer = setInterval(run, 30000);
  timer.unref();
  return timer;
}
module.exports = { enqueue, claimJob, processJob, tick, startMarketPriceWorker, LEASE_MS };
