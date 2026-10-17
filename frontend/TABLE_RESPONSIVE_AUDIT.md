# ERP Responsive Table Audit

Branch: `feature/responsive-ui-overhaul`

## Verification status

- **Source/build verified** means the table structure, wrapper containment, and CSS sizing were audited, and the frontend passed lint and production build.
- **Rendered verification unavailable** means the authenticated route could not be opened in the available browser session. No claim of visual verification is made for those screens.

| Module / table | Issue addressed | Files | Sidebar expanded | Sidebar collapsed | Mobile |
| --- | --- | --- | --- | --- | --- |
| Pengeluaran transactions | Currency could wrap; description, allocation, payment, status, and action columns could collapse. Added a 1320px content-aware grid, non-wrapping right-aligned currency, controlled description wrapping, and inner horizontal scrolling. | `Expenses.jsx`, `tableResponsive.css` | Source/build verified | Source/build verified | Inner-scroll rules verified; rendered verification unavailable |
| Pengeluaran finance debt | Currency semantics inherited from the shared money-cell rules; its existing local overflow wrapper remains intact. | `Expenses.jsx`, `tableResponsive.css` | Source/build verified | Source/build verified | Source/build verified |
| Pembelian requests | Replaced the forced 1380px grid with a 920px content-aware seven-column layout. ID, photo, urgency, and action are compact; needs, target, and status wrap in controlled flexible columns. Photo thumbnails were reduced to 48×38px and the named Action column remains visible/sticky when local scrolling is required. | `Purchasing.jsx`, `tableResponsive.css` | Source/build verified | Source/build verified | Compact inner-scroll rules verified; rendered verification unavailable |
| Pembelian repair receipts | Preserved readable minimum sizing and local overflow; the final receive-result action becomes sticky only when its row contains an actionable button. | `Purchasing.jsx`, `tableResponsive.css` | Source/build verified | Source/build verified | Source/build verified |
| Inventory item/unit/movement/batch/history tables | Workspace and table regions retain `min-width: 0` and local overflow. Tables whose final column contains an action button receive the shared sticky-action treatment at constrained desktop/tablet widths. | `Inventory.jsx`, `tableResponsive.css` | Source/build verified | Source/build verified | Source/build verified |
| Servis history tables | Detail history remains an explicit horizontal scroll region; actionable final cells receive shared sticky behavior while non-action history columns remain normal. | `Maintenance.css`, `tableResponsive.css` | Source/build verified | Source/build verified | Source/build verified |
| Armada and movement tables | Preserved readable inner widths; edit/detail buttons in the final actionable column remain attached to the right edge when scrolling is necessary. | `Trucks.jsx`, `tableResponsive.css` | Source/build verified | Source/build verified | Source/build verified |
| Material stock | Board now owns horizontal overflow; quantity columns use tabular, non-wrapping numerals and a 980px table minimum. | `MaterialStock.css`, `tableResponsive.css` | Source/build verified | Source/build verified | Source/build verified |
| Piutang invoice and employee balances | Money remains non-wrapping/tabular; payment, print, and invoice actions in the last column receive sticky right-edge access at constrained widths. Existing mobile-card behavior remains intact. | `Receivables.css`, `tableResponsive.css` | Source/build verified | Source/build verified | Existing mobile-card rules retained; rendered verification unavailable |
| Profit Armada summary and detail tables | Revenue, cost, profit, and contribution columns are non-wrapping, tabular, right-aligned, and protected by table minimum widths. | `FleetProfitability.css`, `tableResponsive.css` | Source/build verified | Source/build verified | Source/build verified |
| Accounting journal | Debit and credit columns remain right-aligned and now explicitly prevent wrapping; ledger scrolls internally below 1050px. | `Accounting.css`, `tableResponsive.css` | Source/build verified | Source/build verified | Source/build verified |
| Pengguna | Existing wrapper owns horizontal overflow; edit/delete actions in the last column retain their usable width and become sticky when scrolling is necessary. | `Users.jsx`, `tableResponsive.css` | Source/build verified | Source/build verified | Source/build verified |
| Audit Trail | Date, response, references, endpoint, and action badges keep readable sizing in a 1040px inner-scrolling grid. | `AuditTrail.css`, `tableResponsive.css` | Source/build verified | Source/build verified | Source/build verified |
| Order detail material invoices | Existing local horizontal wrapper retained; shared header/status/numeric rules apply without changing nested invoice data. | `OrderDetail.jsx`, `tableResponsive.css` | Source/build verified | Source/build verified | Source/build verified |

## Shared behavior

- Table regions use `width: 100%`, `min-width: 0`, `max-width: 100%`, and internal `overflow-x: auto`.
- Horizontal overscroll is contained inside the data grid.
- Monetary and numeric cells use tabular numerals; monetary cells never wrap and are right-aligned where semantically identified.
- Headers, status badges, and action groups do not split across lines.
- Descriptive fields retain controlled wrapping instead of character-by-character compression.
- Sticky positioning is selected with `:has(tbody td:last-child button)`, so report tables without a real last-column action are left untouched.
- Sticky action cells use opaque row/header backgrounds, explicit z-index layers, and a subtle left separator.
- No columns, actions, values, or workflows were removed.

## Automated checks

- `npm run lint`: pass.
- `npm run build`: pass.
- `git diff --check`: pass.
- Vite emits its existing non-blocking large-bundle advisory.

## Remaining verification

The available browser session was not authenticated, so authenticated tables could not be rendered with real production-like records at the requested viewport/sidebar combinations. A final signed-in pass is still required at 320, 375, 430, 768, 1024, 1280, 1440, and 1920px, including both pinned-expanded and collapsed desktop sidebar states.
