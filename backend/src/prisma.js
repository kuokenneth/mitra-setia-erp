// backend/src/prisma.js
const { PrismaClient } = require("@prisma/client");

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // optional, but nice during dev:
    log: ["error", "warn"],
    // prevent interactive transaction timeouts on slower DBs
    transactionOptions: { maxWait: 5000, timeout: 15000 },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

module.exports = { prisma };
