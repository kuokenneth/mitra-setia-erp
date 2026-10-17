# ERP Frontend UI Inventory

This inventory tracks the visual redesign scope on `feature/responsive-ui-overhaul`.

## Public and authentication

| Route | Screen | Primary UI | Dialogs / special states |
| --- | --- | --- | --- |
| `/` | Corporate landing | Fixed navigation, service cards, statistics, CTA, footer | Mobile navigation drawer, reveal states |
| `/login` | ERP login | Email/password form, access notice, security state | Validation and API error state |
| `/register` | Staff registration | Identity, password and invitation fields | Field validation and API error state |

## Authenticated operations

| Route | Screen | Primary UI | Dialogs / special states |
| --- | --- | --- | --- |
| `/dashboard` | Operations dashboard | KPI summary, utilization, GPS health, warnings, recent arrivals, action centre | Loading, disconnected and empty states |
| `/orders` | Order management | Summary, filters, order list, status and document references | Customer-create and order-create dialogs |
| `/orders/new` | Order creation | Customer, route, cargo and quantity workflow | Inline validation and save states |
| `/orders/:id` | Order detail | Status workflow, allocation, trips, material invoices and proofs | Assignment, trip, material and document dialogs |
| `/trips` | Trip management | Filters, trip cards, operational warnings and actions | Single trip, empty-return and warning-action dialogs |
| `/trips/:id` | Trip detail | Status timeline, proof capture, allocations and expenses | Material allocation and expense dialogs |
| `/trucks` | Fleet management | Fleet summary, vehicle cards/table, assignments and movement history | Create truck, edit/detail, movement and assignment dialogs |
| `/fleet-map` | Live fleet map | Map, GPS status, filters, moving fleet and city grouping | Setup, runtime-error and empty states |
| `/operational-locations` | Location master | Search/map picker and location cards | Create/edit form state and Google Maps states |
| `/material-stock` | Material custody | Stock table, receipts, proof menu and allocation | Receipt-entry and allocation dialogs |

## Workshop and purchasing

| Route | Screen | Primary UI | Dialogs / special states |
| --- | --- | --- | --- |
| `/inventory` | Inventory and serial tracking | Item, unit, movement, batch and emergency tabs; filters and reports | Item, receipt, consume, transfer, serial/tire, repair and emergency dialogs |
| `/maintenance` | Workshop/service management | Service cards/table, status workflow, parts, costs, notes and evidence | Create, detail, purchase, return, progress and image-editor dialogs |
| `/purchasing` | Purchasing and supplier billing | Requests, PO documents, receipts, repair receipts, bills and payments | Request, approval, PO, cancellation, receipt, supplier bill and payment dialogs |

## Finance and administration

| Route | Screen | Primary UI | Dialogs / special states |
| --- | --- | --- | --- |
| `/expenses` | Expense management | KPI totals, period tools, approval table/cards and reports | Create/edit expense and allocation workflows |
| `/receivables` | Customer/employee receivables | Invoice/employee tabs, reports, data grids and payment actions | Manual invoice, source selection, pricing, detail and payment dialogs |
| `/accounting` | General ledger | Period toolbar, financial KPIs, journal and account tabs | Sync progress, success/error and empty states |
| `/fleet-profitability` | Fleet profitability | Period summary, profitability table and cost breakdown | Vehicle detail, fixed cost and revenue dialogs |
| `/users` | User management | User table/cards, role/status controls and driver assignment | Inline edit/create and confirmation states |
| `/audit-trail` | Audit log | Search/filter toolbar, event table and pagination | Event detail dialog and copy feedback |

## Staff and driver workflows

| Route | Screen | Primary UI | Dialogs / special states |
| --- | --- | --- | --- |
| `/drivers/new` | Driver creation | Personal, contact and account form | Validation and save states |
| `/driver`, `/driver/jobs` | Driver work area | Driver-specific job surface | Empty state |
| `/profile` | Profile settings | Identity and password forms | Validation, success and error states |

## Shared components and infrastructure

- Authenticated shell: grouped, role-aware desktop sidebar; compact mode; tablet/mobile drawer; user controls.
- Public shell: corporate navigation and mobile menu.
- Shared states: `LoadingState`, `PageErrorBoundary`, upload progress and protected-file preview.
- Media workflow: protected images/files and `ImageAnnotationEditor` dialog.
- Print surfaces: purchase orders, goods receipts, supplier receipts, invoices, cash vouchers, expense reports, receivable reports and inventory reports.
- Data access: all existing calls continue through `api.js`; no endpoint, schema, calculation or permission changes are in redesign scope.

## Responsive targets

- 320, 375 and 430px: single-column forms, viewport-safe dialogs, touch-sized controls, controlled table scrolling.
- 768 and 1024px: navigation drawer, adaptive grids and two-column forms only where space allows.
- 1280, 1440 and 1920px: persistent sidebar, dense enterprise tables, bounded content widths and efficient multi-column workflows.
