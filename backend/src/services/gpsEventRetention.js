const { prisma } = require("../prisma");

const RETENTION_DAYS = 7;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function deleteExpiredGpsEvents(now = new Date()) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.gpsEvent.deleteMany({
    where: { receivedAt: { lt: cutoff } },
  });

  if (result.count > 0) {
    console.log(`Deleted ${result.count} GPS events older than ${RETENTION_DAYS} days`);
  }

  return result.count;
}

function startGpsEventRetention() {
  let cleanupRunning = false;

  const cleanup = async () => {
    if (cleanupRunning) return;
    cleanupRunning = true;
    try {
      await deleteExpiredGpsEvents();
    } catch (error) {
      console.error("Failed to delete expired GPS events", error);
    } finally {
      cleanupRunning = false;
    }
  };

  void cleanup();
  const timer = setInterval(cleanup, CLEANUP_INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = { deleteExpiredGpsEvents, startGpsEventRetention };
