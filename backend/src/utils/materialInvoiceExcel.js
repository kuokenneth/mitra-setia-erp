const ExcelJS = require("exceljs");

const headers = ["nama barang", "jumlah", "satuan", "berat total (kg)"];
const sheetName = "Faktur Muatan";

function positiveNumber(value) {
  const input = typeof value === "string" ? value.trim() : value;
  if (typeof input === "string" && !/^\d+(?:[.,]\d+)?$/.test(input)) return null;
  const number = typeof input === "string" ? Number(input.replace(",", ".")) : input;
  return Number.isFinite(number) && number > 0 ? number : null;
}

async function readMaterialInvoiceExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new Error("File Excel tidak dapat dibaca. Gunakan template .xlsx Faktur Muatan.");
  }

  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet || headers.some((header, index) => {
    const value = sheet.getCell(1, index + 1).value;
    return typeof value !== "string" || value.trim().toLowerCase() !== header;
  })) {
    throw new Error("Kolom Excel tidak sesuai. Gunakan template Faktur Muatan dan pertahankan judul kolomnya.");
  }

  const poHeader = sheet.getCell("E1").value;
  const hasPoColumn = typeof poHeader === "string" && poHeader.trim().toLowerCase() === "no. po";
  if (poHeader != null && !hasPoColumn) {
    throw new Error("Judul kolom E harus No. PO. Gunakan template Faktur Muatan.");
  }

  const lines = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = headers.map((_, index) => row.getCell(index + 1).value);
    if (hasPoColumn) values.push(row.getCell(5).value);
    const [itemName, qty, unit, totalKg, poValue] = values.map((value) => typeof value === "string" ? value.trim() : value);
    if (values.every((value) => value == null || (typeof value === "string" && !value.trim()))) return;
    const amount = positiveNumber(qty);
    const weight = totalKg == null || totalKg === "" ? "" : positiveNumber(totalKg);

    if (typeof itemName !== "string" || !itemName || typeof unit !== "string" || !unit || amount === null || weight === null) {
      throw new Error(`Baris ${rowNumber}: isi nama barang, jumlah positif, dan satuan. Jika diisi, berat total harus berupa angka positif.`);
    }
    if (poValue != null && typeof poValue !== "string" && !Number.isSafeInteger(poValue)) {
      throw new Error(`Baris ${rowNumber}: isi No. PO sebagai teks atau angka bulat.`);
    }
    if (lines.length === 500) throw new Error("Satu file Excel dapat memuat maksimal 500 barang.");
    lines.push({ itemName, qty: String(amount), unit, totalKg: String(weight), poNumber: String(poValue ?? "") });
  });
  if (!lines.length) throw new Error("File Excel belum berisi barang.");
  return lines;
}

module.exports = { readMaterialInvoiceExcel };
