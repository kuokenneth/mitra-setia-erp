// For an external cron / always-on worker. Uses the same persisted queue as the web service.
require('dotenv').config();
const { prisma } = require('../src/prisma');
const { tick } = require('../src/services/marketPrices/jobs');
tick(prisma).catch(error => {
  console.error('[market-prices cron]', error.code || error.name);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
