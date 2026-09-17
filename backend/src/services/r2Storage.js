const { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");

const requiredEnv = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"];

function missingR2Environment() {
  return requiredEnv.filter(name => !String(process.env[name] || "").trim());
}

function isR2Configured() {
  return missingR2Environment().length === 0;
}

let client;
function r2Client() {
  if (!isR2Configured()) throw new Error(`Konfigurasi R2 belum lengkap: ${missingR2Environment().join(", ")}`);
  if (!client) {
    const accountId = String(process.env.R2_ACCOUNT_ID).trim();
    client = new S3Client({
      region: "auto",
      endpoint: String(process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`).trim(),
      credentials: {
        accessKeyId: String(process.env.R2_ACCESS_KEY_ID).trim(),
        secretAccessKey: String(process.env.R2_SECRET_ACCESS_KEY).trim(),
      },
    });
  }
  return client;
}

function bucket() {
  return String(process.env.R2_BUCKET || "").trim();
}

async function putObject({ key, body, contentType, metadata }) {
  await r2Client().send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: body,
    ContentType: contentType,
    Metadata: metadata,
  }));
}

async function getObject(key) {
  return r2Client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
}

async function deleteObject(key) {
  await r2Client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

module.exports = { deleteObject, getObject, isR2Configured, missingR2Environment, putObject };
