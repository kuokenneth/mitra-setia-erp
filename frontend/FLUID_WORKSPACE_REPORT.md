# Fluid ERP Workspace Report

Branch: `feature/responsive-ui-overhaul`

## Root causes

- `designSystem.css` imposed `max-width: 1560px` and automatic horizontal margins on authenticated page roots.
- `Inventory.css` added a second centered `.inventory-shell` capped at `1420px`.
- Dashboard, Orders, Trucks, Fleet Map, Locations, Maintenance, Purchasing, Receivables, Accounting, Profitability, Audit Trail, and other operational roots each carried independent `max-width` and `margin: auto` rules.
- Some page roots supplied their own desktop padding inside the shared `.erp-content` padding, creating inconsistent or excessive gutters.
- The main region relied on implicit block sizing beside a fixed sidebar rather than explicitly tracking the remaining workspace width.

## Shared correction

- `.erp-main` now explicitly uses `calc(100% - var(--sidebar-width))` on desktop and `100%` below the drawer breakpoint.
- `.erp-content` is a full-width, `min-width: 0` workspace.
- Direct authenticated page roots no longer inherit centered maximum-width constraints.
- Operational page roots use one shared outer padding source from `.erp-content`.
- Nested Inventory and trip shells are fluid.
- Headers, boards, workspaces, and data panels stretch to the available width.
- Form cards and modals retain their intentional component-level maximum widths.

## Corrected pages

| Page group | Width behavior |
| --- | --- |
| Dashboard | KPI and operational grids expand with the workspace. |
| Inventory | Removed effective 1420px centered shell cap; hero, tabs, search, skeleton, and data workspace fill available width. |
| Pembelian | Removed effective 1500px centered page cap; tabs, metrics, filters, and tables use the workspace. |
| Pengeluaran | Full-width panel and filters; table continues to scroll internally when its readable minimum exceeds available space. |
| Orders and Trips | Page headers, filters, boards, and lists expand beside the sidebar. |
| Armada and Fleet Map | Fleet data cards and map workspace no longer remain centered at a fixed desktop width. |
| Operational Locations and Material Stock | Editor/list and data-board layouts use the full internal canvas. |
| Servis | Removed effective centered page cap while preserving modal/form proportions. |
| Piutang and Accounting | Ledger panels expand; monetary table minimums remain protected. |
| Profit Armada | Summary and profitability tables expand; detail modal limits remain unchanged. |
| Users and Audit Trail | Management tables use full workspace width; form-oriented cards keep readable internal sizing. |

## Sidebar behavior

- Pinned expanded sidebar: main width uses the remaining viewport after the 260px sidebar.
- Collapsed sidebar: main width expands after the 76px sidebar.
- Temporary hover expansion overlays the content intentionally, so merely inspecting the menu does not cause table reflow.
- Tablet/mobile: desktop sidebar is replaced by the drawer and the main workspace returns to full width.

## Verification

- `npm run lint`: pass.
- `npm run build`: pass.
- `git diff --check`: pass.
- Existing Vite large-bundle advisory remains non-blocking.

## Visual verification limit

The available browser session is not authenticated. Inventory and the other protected routes therefore could not be rendered with real data at 1440/1280 expanded and collapsed sidebar states, or at 768/375. Those combinations remain pending a signed-in browser pass and are not claimed as visually verified.
