// Central status vocabulary: backend values are never changed, only how they look.
// tone → .ui-badge--{tone}
const STATUS = {
  // Truck
  READY: ["success", "Siap"],
  DISPATCH: ["info", "Beroperasi"],
  PLANNED: ["neutral", "Direncanakan"],
  MAINTENANCE: ["warning", "Servis"],
  INACTIVE: ["muted", "Nonaktif"],
  WAITING_BACKHAUL: ["violet", "Tunggu Muatan Balik"],
  RETURNING_EMPTY: ["neutral", "Kembali Kosong"],
  // Trip
  DISPATCHED: ["info", "Dalam Perjalanan"],
  ON_ROUTE: ["info", "Dalam Perjalanan"],
  IN_TRANSIT: ["info", "Dalam Perjalanan"],
  LOADING: ["info", "Muat"],
  ARRIVED: ["warning", "Tiba"],
  COMPLETED: ["success", "Selesai"],
  CANCELLED: ["muted", "Dibatalkan"],
  // Maintenance
  OPEN: ["warning", "Terbuka"],
  IN_PROGRESS: ["info", "Diproses"],
  DONE: ["success", "Selesai"],
  // Order
  DRAFT: ["muted", "Draft"],
  CONFIRMED: ["info", "Dikonfirmasi"],
  // Purchasing
  WAITING_APPROVAL: ["warning", "Menunggu Approval"],
  APPROVED: ["info", "Disetujui"],
  REJECTED: ["danger", "Ditolak"],
  ORDERED: ["info", "Dipesan"],
  SENT_TO_SUPPLIER: ["info", "Dikirim ke Supplier"],
  PARTIALLY_RECEIVED: ["warning", "Diterima Sebagian"],
  RECEIVED: ["success", "Diterima"],
  // Finance
  PENDING: ["warning", "Menunggu"],
  PAID: ["success", "Lunas"],
  UNPAID: ["danger", "Belum Dibayar"],
  PARTIALLY_PAID: ["warning", "Dibayar Sebagian"],
  SENT: ["info", "Terkirim"],
  OVERDUE: ["danger", "Lewat Tempo"],
  VOID: ["muted", "Batal"],
  POSTED: ["success", "Diposting"],
  // Users / stock
  ACTIVE: ["success", "Aktif"],
  IN_STOCK: ["success", "Tersedia"],
  ASSIGNED: ["info", "Terpasang"],
  RETREADING: ["violet", "Vulkanisir"],
  SCRAPPED: ["muted", "Afkir"],
  LOW: ["warning", "Menipis"],
  OUT: ["danger", "Habis"],
};

export function statusTone(status) {
  return STATUS[String(status || "").toUpperCase()]?.[0] || "neutral";
}

export function statusLabel(status) {
  const key = String(status || "").toUpperCase();
  return STATUS[key]?.[1] || key.replaceAll("_", " ") || "-";
}
