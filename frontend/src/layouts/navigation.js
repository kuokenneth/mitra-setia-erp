import { FiBarChart2, FiBookOpen, FiBox, FiClipboard, FiCreditCard, FiDollarSign, FiFileText, FiMap, FiMapPin, FiNavigation, FiPieChart, FiShield, FiShoppingCart, FiTool, FiTrendingUp, FiTruck, FiUser, FiUserPlus, FiLayers, FiGrid } from "react-icons/fi";

/**
 * Role-aware navigation. The visibility rules are identical to the previous
 * AppLayout (OWNER/ADMIN, STAFF, SPAREPART_ADMIN, DRIVER) — only labels and
 * grouping are presented in the new design.
 */
export function buildNavigation(role) {
  const isOwnerAdmin = role === "OWNER" || role === "ADMIN";
  const isStaff = role === "STAFF";
  const canManageDrivers = isOwnerAdmin || isStaff;
  const workshop = [
    { to: "/inventory", label: "Persediaan", icon: FiBox },
    { to: "/maintenance", label: "Servis", icon: FiTool },
    { to: "/purchasing", label: "Pembelian", icon: FiShoppingCart },
    { to: "/price-analytics", label: "Analitik Harga Sparepart", icon: FiTrendingUp },
  ];
  if (role === "DRIVER") return [{ label: "Pengemudi", icon: FiClipboard, items: [{ to: "/driver/jobs", label: "Tugas Saya", icon: FiClipboard }] }];
  if (role === "SPAREPART_ADMIN") return [{ label: "Bengkel & Pembelian", icon: FiTool, items: workshop }];
  return [
    { to: "/dashboard", label: "Dashboard", icon: FiBarChart2 },
    { label: "Operasional", icon: FiTruck, items: [
      { to: "/trucks", label: "Armada", icon: FiTruck },
      { to: "/fleet-map", label: "Peta Armada", icon: FiMap },
      { to: "/operational-locations", label: "Master Lokasi", icon: FiMapPin },
      { to: "/material-stock", label: "Ambang / Material", icon: FiLayers },
      { to: "/orders", label: "Pesanan", icon: FiFileText },
      { to: "/trips", label: "Perjalanan", icon: FiNavigation },
    ] },
    { label: "Bengkel & Pembelian", icon: FiTool, items: workshop },
    { label: "Keuangan", icon: FiDollarSign, items: [
      { to: "/expenses", label: "Pengeluaran", icon: FiDollarSign },
      { to: "/receivables", label: "Piutang", icon: FiCreditCard },
      ...(isOwnerAdmin || isStaff ? [{ to: "/fleet-profitability", label: "Profit Armada", icon: FiPieChart }] : []),
      ...(isOwnerAdmin ? [{ to: "/accounting", label: "Akuntansi", icon: FiBookOpen }] : []),
    ] },
    { label: "Administrasi", icon: FiShield, items: [
      ...(isOwnerAdmin ? [{ to: "/users", label: "Pengguna", icon: FiUser }] : []),
      ...(canManageDrivers ? [{ to: "/drivers/new", label: "Tambah Pengemudi", icon: FiUserPlus }] : []),
      ...(role === "OWNER" ? [{ to: "/audit-trail", label: "Audit Trail", icon: FiShield }] : []),
    ] },
  ].filter((group) => !group.items || group.items.length);
}

/** Up to four destinations for the iPhone tab bar (the fifth slot is "Menu"). */
export function buildBottomNav(role) {
  const flat = buildNavigation(role).flatMap((group) => group.items || [group]);
  const preferred = role === "DRIVER" ? ["/driver/jobs"] : role === "SPAREPART_ADMIN" ? ["/inventory", "/maintenance", "/purchasing", "/price-analytics"] : ["/dashboard", "/trips", "/trucks", "/inventory"];
  const short = { "/dashboard": "Dashboard", "/trips": "Perjalanan", "/trucks": "Armada", "/inventory": "Persediaan", "/maintenance": "Servis", "/purchasing": "Pembelian", "/price-analytics": "Harga", "/driver/jobs": "Tugas" };
  const icons = { "/dashboard": FiGrid };
  return preferred.map((to) => flat.find((item) => item.to === to)).filter(Boolean).map((item) => ({ ...item, label: short[item.to] || item.label, icon: icons[item.to] || item.icon }));
}

const DETAIL_ROUTES = [
  [/^\/orders\/new$/, ["Operasional", { label: "Pesanan", to: "/orders" }, "Pesanan Baru"]],
  [/^\/orders\/[^/]+$/, ["Operasional", { label: "Pesanan", to: "/orders" }, "Detail Pesanan"]],
  [/^\/trips\/[^/]+$/, ["Operasional", { label: "Perjalanan", to: "/trips" }, "Detail Perjalanan"]],
  [/^\/profile$/, ["Akun", "Profil Saya"]],
  [/^\/driver(\/jobs)?$/, ["Pengemudi", "Tugas Saya"]],
];

export function breadcrumbsFor(pathname, groups) {
  for (const [pattern, trail] of DETAIL_ROUTES) {
    if (pattern.test(pathname)) return trail.map((item) => (typeof item === "string" ? { label: item } : item));
  }
  for (const group of groups) {
    if (group.to && (pathname === group.to || pathname.startsWith(`${group.to}/`))) return [{ label: group.label }];
    for (const item of group.items || []) {
      if (pathname === item.to || pathname.startsWith(`${item.to}/`)) return [{ label: group.label }, { label: item.label }];
    }
  }
  return [];
}
