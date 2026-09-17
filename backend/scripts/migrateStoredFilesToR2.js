require("dotenv").config();
const { prisma } = require("../src/prisma");
const { isR2Configured, missingR2Environment, putObject } = require("../src/services/r2Storage");

const batchSize = Math.max(1, Math.min(100, Number(process.env.R2_MIGRATION_BATCH_SIZE || 25)));

async function main() {
  if (!isR2Configured()) throw new Error(`Konfigurasi R2 belum lengkap: ${missingR2Environment().join(", ")}`);
  let migrated = 0;
  while (true) {
    const files = await prisma.storedFile.findMany({
      where: { storageProvider: "DATABASE", data: { not: null } },
      orderBy: { createdAt: "asc" },
      take: batchSize,
    });
    if (!files.length) break;
    for (const file of files) {
      const created = new Date(file.createdAt);
      const key = `proofs/${created.getUTCFullYear()}/${String(created.getUTCMonth() + 1).padStart(2, "0")}/legacy-${file.id}`;
      await putObject({
        key,
        body: Buffer.from(file.data),
        contentType: file.mimeType,
        metadata: { originalname: encodeURIComponent(file.fileName) },
      });
      await prisma.storedFile.update({
        where: { id: file.id },
        data: { storageProvider: "R2", storageKey: key, data: null },
      });
      migrated += 1;
      console.log(`Migrated ${migrated}: ${file.id} (${file.size} bytes)`);
    }
  }
  console.log(`R2 migration complete. ${migrated} file(s) migrated.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
