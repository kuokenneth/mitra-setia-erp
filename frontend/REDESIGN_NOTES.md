# Mitra Setia ERP — UI/UX redesign (Citra Jaya design language, Mitra Setia green)

Frontend-only. No backend, API, Prisma, calculation, permission or validation code was changed.

## What changed

**Design system — `src/ui/`**
- `tokens.css` — Citra Jaya tokens (Inter, slate neutrals, 8px radius, 36px controls / 44px on touch, 240px sidebar, 56px header) with the Mitra Setia green as primary. All legacy tokens (`--color-*`, `--radius-*`, …) are re-pointed here, so every module inherits them. To change the brand colour, edit the `--ms-primary*` variables only.
- `components.css` + `primitives.jsx`, `overlays.jsx`, `DataTable.jsx`, `useToasts.jsx`: Page, PageHeader, Breadcrumbs, Button/PrimaryButton/SecondaryButton/IconButton, Card, StatCard (KPIStatCard), Meter, Badge, StatusBadge (`status.js` maps backend values to labels/colours, values unchanged), DetailPanel, EmptyState, Skeleton/LoadingSkeleton, Tabs, FormField, Input, SelectField, DatePicker, SearchInput, FilterBar, StickyActionBar, Pagination, Modal/BottomSheet (bottom sheet on phones), Drawer, ConfirmationDialog, FileUploader, ImagePreview (lightbox), DataTable/ResponsiveTable (table on desktop, card list on phones), useToasts.
- `useResponsiveTables.js` — labels every existing table's cells so it renders as a stacked card list on phones. It only adds attributes; no element is moved or re-rendered, so every button/input/handler keeps working. Opt a table out with `data-keep-table`.

**Application shell — `src/layouts/`**
- `navigation.js` — same role rules as before (OWNER/ADMIN, STAFF, SPAREPART_ADMIN, DRIVER); Citra-style collapsible groups; breadcrumbs.
- `AppLayout.jsx/.css` — full sidebar ≥1280px (collapsible to icons, remembered), icon rail 744–1279px, phone header + drawer + bottom tab bar (Dashboard · Perjalanan · Armada · Persediaan · Menu) below 744px, safe-area insets for Dynamic Island / home indicator. Live status and user menu live in the header.

**Dashboard** — rebuilt on the shared components. Data loading and every calculation were carried over unchanged; added "Perjalanan hari ini", "Armada tersedia", quick actions and recent activity (derived from the same responses). Navigation now uses the router instead of full page reloads.

**All other modules** — `src/styles/modules.css` (loaded last) applies the design language to every module's existing markup: page headers, KPI groups (2-up on iPhone), cards, tabs, filters, buttons, badges, tables (cards on iPhone), dialogs (bottom sheets with pinned header/footer on iPhone), forms (single column, 16px inputs to stop Safari zoom), PO/receiving line items as cards on iPhone. Page CSS and inline style colours were migrated to the palette (colour values only). All-caps eyebrows/labels changed to sentence case (display text only).

## Verification performed (mock API, headless Chrome — not real devices)
- Build: 0 errors. ESLint: 0 problems on the whole `src`.
- 22 routes × 14 viewports (360 → 1920) + 440×956: no horizontal page overflow, no clipped elements outside scroll areas, no runtime errors.
- 13 create/receive dialogs opened at 440 and 834: no overflow, sticky actions reachable.
- Before/after inventory of every button, link and input on every route: nothing removed (only the redesigned dashboard relabels its links; all destinations kept).
- Roles checked: OWNER, STAFF, SPAREPART_ADMIN, DRIVER navigation.

## Not verified here — please click-test against your backend
Real saves (create order, dispatch/arrive/complete trip, receive PO, consume stock, approve purchase request, pay bill, expenses approve), file/photo uploads, printing (`openPrintDocument`), Google Maps pages (no API key in test), and real Safari on iPhone/iPad (keyboard behaviour, safe areas).
