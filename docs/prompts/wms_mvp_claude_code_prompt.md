# WMS MVP Prompt for Claude Code

## Role

Act as a senior full-stack architect specialized in SaaS products, WMS platforms, logistics, retail operations, inventory management, fulfillment, reverse logistics, and modern enterprise applications.

You must build a functional MVP for a brand new, standalone Warehouse Management System (greenfield product). This WMS is not part of, and must not depend on, any other system. Treat it as a new product entering the market.

The codebase, file names, variable names, component names, types, interfaces, functions, routes, and comments must be written in English.

The UI copy can be in Spanish because the business users are Spanish-speaking, but the source code must remain in English.

Do not use emojis anywhere in the application. Use professional icons from Lucide React or Iconify instead.

## Main Goal

Create a functional WMS MVP using:

- Next.js App Router
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- Lucide React icons or Iconify icons
- Local seed data
- A mock data-access layer with API-like signatures
- Client-side simulated actions
- Clean architecture
- Enterprise dashboard UI

The MVP must not use a real backend, database, authentication, or external APIs yet.

The architecture must be prepared so the local seed data can later be replaced by REST API, GraphQL, tRPC, Server Actions, or another data source WITHOUT changing the page components. This is achieved by hiding all data access behind service functions with async, API-shaped signatures (see "Data Access Layer").

## Important Technical Rules

Follow modern Next.js best practices:

- Use the App Router.
- Use TypeScript strictly.
- Prefer Server Components by default.
- Use Client Components only when local state, events, dialogs, filters, tabs, or simulated actions are required.
- Keep business logic outside JSX when possible.
- Keep business logic in pure, testable functions under `src/lib/rules`.
- Use reusable UI components.
- Avoid large monolithic components.
- Keep types in dedicated files.
- Keep seed data in dedicated files.
- Keep formatting helpers in dedicated utility files.
- Keep the data-access (service) layer separated from UI components.
- Use semantic and accessible HTML.
- Use responsive layouts.
- Use consistent naming conventions.
- Use clear, maintainable, production-like code.
- Do not use emojis.
- Use Lucide React or Iconify for icons.
- Use English for all code identifiers.
- Avoid hardcoded duplicated strings where constants make sense.
- Avoid unnecessary dependencies.
- Do not implement authentication yet.
- Do not implement a real database yet.
- Do not implement heavy optimization algorithms yet. Slotting uses simple, explainable, pure functions (ABC/XYZ classification and a scoring rule), NOT solvers or metaheuristics.

## Stack Requirements

Use these technologies:

- Next.js latest stable version
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- lucide-react
- Optional: Iconify if needed for additional icons
- date-fns only if date formatting becomes necessary
- Zustand for the central client-side store (React Context + reducer acceptable if you avoid extra deps)
- A test runner already available with Next (Vitest preferred; Jest acceptable) for the pure business-rule tests

If the project does not exist, create it from scratch as a new standalone repository.

If the project already exists, inspect the current structure first and adapt the implementation without breaking existing files.

## Product Context

This is a NEW standalone WMS product. It does not integrate with any existing OMS, ERP, or in-house platform. Any external system (SAP, e-commerce, carrier, etc.) is represented only as a simulated third-party integration.

The WMS must support these operational areas:

1. Transfers.
2. Returns:
   - Outbound transit.
   - Inbound transit.
   - Distribution center to store.
   - Store to store.
   - Customer to store.
   - Customer to store to distribution center.
3. Replenishment (driven by slotting-defined pick faces).
4. Commerce orders.
5. Labels.
6. Inventory receiving with directed putaway (putaway suggestions driven by slotting / ABC class).
7. SAP-created routes (represented as an external integration source).
8. Third-party integrations.
9. Load route:
   - Manifest of everything that will be loaded onto a truck.
10. The WMS must indicate which orders and items are being carried.
11. Partial picking.
12. Wave picking.
13. Slotting as a calculated, cross-cutting technique (see "Slotting Module" and "Slotting as a Cross-Cutting Technique").
14. Reports: traceability, operator productivity, receiving/picking discrepancies, inventory, and OTIF.
15. Administration: catalogs, business rules and thresholds, operators, reasons, and general settings.

The WMS must also cover these core modules:

| Module | Scope |
|---|---|
| Inbound / Receiving | ASN, appointments, cross-docking, quality control, directed putaway (slotting-aware) |
| Inventory Management | Locations, lots, serials, expiration dates, holds, stock movements (audit log) |
| Slotting | Calculated ABC/XYZ classification, location profiling (golden zone), relocation recommendations with estimated savings |
| Picking & Fulfillment | Wave, waveless, batch, zone, cluster, put-to-store, location-accessibility ordering |
| Packing | Packing rules, verification, label generation |
| Shipping | Carriers, manifest, OTIF, SAP routes |
| Reverse Logistics | RMA, validation, inventory re-entry, scrap |
| Reports | Traceability, productivity, discrepancies, inventory, OTIF (derived aggregations + simulated CSV export) |
| Administration | Catalogs, rules/thresholds, operators, reasons, general settings (simulated CRUD) |

## Expected Result

Build a navigable and functional enterprise WMS MVP with seed data.

The application must include:

- Main layout.
- Sidebar navigation.
- Header.
- Dashboard.
- Module pages.
- Data tables.
- Filters.
- Status badges.
- Detail dialogs.
- Simulated actions using local state.
- Seed data with realistic retail/logistics examples.
- Reusable components.
- Consistent visual system.
- A stock movement audit log that makes "view movements" real.
- Calculated slotting that visibly influences putaway, replenishment, picking, and the dashboard.
- A single central store so actions propagate across modules (end-to-end flows).
- Inventory consistency: every stock action recalculates the affected `InventoryItem` and the log always matches the stock.

## Suggested App Routes

Create these routes:

```txt
/
/receiving
/inventory
/transfers
/returns
/replenishment
/commerce
/picking/tasks
/picking/waves
/packing
/labels
/shipping
/sap-routes
/load-manifests
/integrations
/slotting
/reports
/reports/traceability
/reports/productivity
/reports/discrepancies
/reports/inventory
/reports/otif
/admin
/admin/catalogs
/admin/rules
/admin/operators
/admin/reasons
/admin/settings
```

## Suggested Project Structure

Use this structure or an equivalent clean architecture:

```txt
src/
  app/
    layout.tsx
    page.tsx
    receiving/
      page.tsx
    inventory/
      page.tsx
    transfers/
      page.tsx
    returns/
      page.tsx
    replenishment/
      page.tsx
    commerce/
      page.tsx
    picking/
      tasks/
        page.tsx
      waves/
        page.tsx
    packing/
      page.tsx
    labels/
      page.tsx
    shipping/
      page.tsx
    sap-routes/
      page.tsx
    load-manifests/
      page.tsx
    integrations/
      page.tsx
    slotting/
      page.tsx
    reports/
      page.tsx
      traceability/
        page.tsx
      productivity/
        page.tsx
      discrepancies/
        page.tsx
      inventory/
        page.tsx
      otif/
        page.tsx
    admin/
      page.tsx
      catalogs/
        page.tsx
      rules/
        page.tsx
      operators/
        page.tsx
      reasons/
        page.tsx
      settings/
        page.tsx

  components/
    layout/
      app-header.tsx
      app-sidebar.tsx
      app-shell.tsx
      sidebar-nav-item.tsx
    shared/
      data-table.tsx
      detail-dialog.tsx
      empty-state.tsx
      kpi-card.tsx
      page-header.tsx
      status-badge.tsx
      table-actions.tsx
      filter-bar.tsx
    wms/
      inventory-status-badge.tsx
      label-preview.tsx
      load-manifest-summary.tsx
      picking-progress.tsx
      route-status-badge.tsx
      integration-status-badge.tsx
      abc-class-badge.tsx
      slotting-score.tsx
      movement-timeline.tsx

  data/
    seed.ts

  store/
    wms-store.ts
    selectors.ts

  services/
    receiving.service.ts
    inventory.service.ts
    transfers.service.ts
    returns.service.ts
    replenishment.service.ts
    commerce.service.ts
    picking.service.ts
    packing.service.ts
    labels.service.ts
    shipping.service.ts
    sap-routes.service.ts
    load-manifests.service.ts
    integrations.service.ts
    slotting.service.ts
    movements.service.ts
    reports.service.ts
    admin.service.ts

  types/
    wms.ts
    navigation.ts
    ui.ts

  lib/
    api/
      client.ts
      types.ts
    rules/
      slotting.ts
      replenishment.ts
      picking.ts
      shipping.ts
      inventory.ts
      reports.ts
      index.ts
    state-machines.ts
    constants.ts
    formatters.ts
    status.ts
    utils.ts

  tests/
    rules/
      slotting.test.ts
      replenishment.test.ts
      picking.test.ts
      shipping.test.ts
      inventory.test.ts
      reports.test.ts
```

## Data Access Layer

Do NOT import seed arrays directly inside pages. All data access must go through the `src/services/*.service.ts` layer, and every service function must have an async, API-shaped signature so the mock body can later be swapped for a real `fetch`/tRPC call without touching any page.

### `src/lib/api/types.ts`

```ts
export interface QueryParams<TFilters = Record<string, unknown>> {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  filters?: TFilters;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

### `src/lib/api/client.ts`

Provide small helpers that simulate a network layer over in-memory seed data, so services look like real API calls:

```ts
import type { Paginated, QueryParams } from "./types";

// Simulated latency to make loading states realistic. Keep it small.
export async function simulateLatency(ms = 120): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// Generic in-memory pagination/search/sort over an array.
export async function paginate<T>(
  source: T[],
  params: QueryParams = {},
  searchFields: (keyof T)[] = []
): Promise<Paginated<T>> {
  await simulateLatency();
  // apply search, sort, then slice by page/pageSize. Return Paginated<T>.
  // implementation left to the build, but signature must be respected.
  return { data: source, total: source.length, page: 1, pageSize: source.length };
}
```

### Service example

Each service exposes list/get/mutation functions. Reads come from the store; mutations call store actions, which validate the state transition, recalculate inventory, and append a `StockMovement` when stock changes (see "Inventory Is the Single Source of Truth"). Pages call services; they never touch seed arrays directly.

```ts
// src/services/commerce.service.ts
import { useWmsStore } from "@/store/wms-store";
import { paginate } from "@/lib/api/client";
import type { Paginated, QueryParams } from "@/lib/api/types";
import type { CommerceOrder } from "@/types/wms";

export async function listCommerceOrders(
  params?: QueryParams
): Promise<Paginated<CommerceOrder>> {
  const orders = useWmsStore.getState().commerceOrders;
  return paginate(orders, params, ["orderNumber", "customerName"]);
}

export async function getCommerceOrder(id: string): Promise<CommerceOrder | null> {
  return useWmsStore.getState().commerceOrders.find((o) => o.id === id) ?? null;
}

export async function reserveInventory(orderId: string): Promise<CommerceOrder> {
  // Store action: validates transition, applies applyReserve to inventory,
  // appends a StockMovement, returns the updated order. Now packing/picking,
  // dashboard, and inventory all see the change because they read the same store.
  return useWmsStore.getState().reserveInventory(orderId);
}
```

When migrating to a real backend later, only the service function bodies change. Pages, types, and components stay the same.

## Central State Store (CRITICAL — enables end-to-end flows)

Modules must NOT each keep isolated local state. If they do, confirming a pick in the picking page would not make the order show up in packing, and the WMS would be a set of disconnected screens instead of a working operation. To support real end-to-end flows, use a single in-memory store as the source of truth that every module reads from and writes to.

Implementation:

- Create a client-side store (Zustand preferred; React Context + reducer acceptable) seeded once from `src/data/seed.ts`.
- All service mutations operate on this store, not on per-page copies. Pages read derived selectors from the store.
- A mutation in one module is immediately visible in every other module that reads the same entities (e.g. confirming picking updates the order so packing sees it).
- State does not need to persist after a full page refresh, but it MUST be shared across module navigation within a session.

Add the store under:

```txt
src/
  store/
    wms-store.ts        # the single source of truth (seeded from data/seed.ts)
    selectors.ts        # derived reads used by pages and the dashboard
```

Services call store actions; pages call services (or read selectors). Keep the API-shaped service signatures from the Data Access Layer — the store is the mock "database" behind them.

## Inventory Is the Single Source of Truth

Every stock-changing action must do BOTH of the following atomically, in the store:

1. Append a `StockMovement` to the audit log.
2. Recalculate the affected `InventoryItem` quantities so the log and the stock never diverge.

Quantity effects (apply in `src/lib/rules/inventory.ts` and call them from the store actions):

- Reserve (commerce/transfer): `reservedQuantity += qty` (cannot exceed available).
- Pick: `onHandQuantity -= qty` and `reservedQuantity -= qty`.
- Receipt + putaway: create/increase the `InventoryItem` at the putaway location (`onHandQuantity += qty`).
- Transfer / relocation (slotting, replenishment, location change): decrease at source, increase at destination; while moving between warehouses, reflect an `in_transit` state.
- Hold / release: move quantity into/out of `holdQuantity`.
- Adjustment: set `onHandQuantity` to the counted value; the movement quantity is the delta.
- Return re-entry: `onHandQuantity += qty` at the destination location.
- Scrap: `onHandQuantity -= qty` (removed from stock).

`availableQuantity` is always derived (`onHand - reserved - hold`, floored at 0) — never stored. Guard rails: actions must reject (no-op + message) when they would drive `available`, `onHand`, `reserved`, or `hold` below 0.

## End-to-End Flows (must be wired through the store)

These cross-module flows must actually propagate. An action in one module advances the entity so the next module picks it up:

- Outbound order flow: Commerce order → reserve inventory → send to picking (creates `PickingTask`s) → confirm picks (updates order, decrements stock) → packing (verify + label) → shipping (assign carrier, confirm) → load manifest (add, validate, load) → SAP route. Each step transitions the order status (via its state machine) so the next module sees it in the correct state.
- Inbound flow: ASN → receive (full/partial) → quality control (if required) → generate putaway → putaway confirmation increases stock at the slotting-suggested location and makes it available in Inventory.
- Returns flow: RMA → receive at store/DC → validate → disposition (re-entry increases stock; scrap removes it; repair/reject route accordingly) → close.
- Replenishment flow: slotting/min-max triggers a task → assign → confirm → stock moves from reserve to the pick face (source down, destination up).
- Transfer flow: create → reserve → pick → outbound (source down, in_transit) → inbound receipt (destination up, partial or full).

For each flow, the "next" module must read the entity from the store and reflect the state produced by the previous step. Verify at least the outbound and inbound flows end-to-end.

## UI Requirements

Use shadcn/ui components where appropriate:

- Card
- Button
- Badge
- Table
- Dialog
- Sheet
- DropdownMenu
- Tabs
- Input
- Select
- Textarea
- Separator
- Progress
- Alert
- Tooltip
- Command if useful

Use icons from:

- lucide-react
- Iconify only if Lucide does not include a suitable icon

Recommended Lucide icons:

- LayoutDashboard
- Warehouse
- PackageSearch
- PackageCheck
- Boxes
- ArrowRightLeft
- Undo2
- RefreshCcw
- ShoppingCart
- ClipboardList
- ListChecks
- Waves
- Package
- Tags
- Truck
- Route
- FileText
- Cable
- MapPinned
- Grid3x3
- TrendingUp
- BarChart3
- Settings
- Users
- ListFilter
- AlertTriangle
- CheckCircle2
- Clock
- XCircle
- CircleDashed

Do not use emojis in menu items, buttons, empty states, cards, tables, seed data, or messages.

## Design Guidelines

Create a professional enterprise dashboard.

The UI should include:

- Fixed sidebar on desktop.
- Responsive navigation for smaller screens.
- Clean page headers.
- KPI cards.
- Clear status badges.
- Consistent spacing.
- Tables with row actions.
- Dialogs for details.
- Filters at the top of list pages.
- Empty states.
- Simple simulated loading states using the service latency.
- Progress indicators for picking, receiving, packing, load capacity, and route occupancy.

## Shared Components

Create these reusable components.

### KpiCard

Purpose: display dashboard metrics.

Props:

```ts
interface KpiCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: string;
  icon?: React.ComponentType<{ className?: string }>;
}
```

### StatusBadge

Purpose: show operational statuses consistently.

Supported variants:

- success
- warning
- danger
- info
- neutral
- progress

The badge maps an entity-specific status to a variant + Spanish label via a shared mapping in `src/lib/status.ts`. Do not duplicate status mapping across pages.

### PageHeader

Purpose: page title, description, and optional actions.

```ts
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}
```

### DataTable

Purpose: reusable visual table wrapper based on shadcn/ui Table.

It should support: header, body, empty state, optional actions column, and a simulated loading state.

### DetailDialog

Purpose: reusable dialog for record details. Accepts title, description, children, trigger.

### EmptyState

Purpose: consistent empty state. Use a Lucide or Iconify icon. No emojis.

### LabelPreview

Purpose: visual preview for generated labels. Show label type, code, reference, a simulated barcode using simple visual blocks or text, and creation date.

### LoadManifestSummary

Purpose: display manifest totals. Show orders, transfers, returns, units, packages, weight, volume.

### PickingProgress

Purpose: display picking progress. Show requested, picked, missing, percentage, and a progress bar.

### AbcClassBadge

Purpose: show ABC class (A/B/C) and XYZ class (X/Y/Z) with consistent color coding. A = high rotation (highlight), C = low rotation.

### SlottingScore

Purpose: show a slotting recommendation's estimated benefit. Display current vs suggested location, accessibility delta, and estimated picking-distance/time savings.

### MovementTimeline

Purpose: render a list of `StockMovement` records (the audit log) for an inventory item, ordered by date.

## Data Model Requirements

Create clear TypeScript types in `src/types/wms.ts`.

Key modeling rules:

- Stock is derived, not stored inconsistently. `availableQuantity` is computed as `onHandQuantity - reservedQuantity - holdQuantity` (never below 0). Store `onHandQuantity`, `reservedQuantity`, `holdQuantity`; compute available in `src/lib/rules/inventory.ts`.
- Serial-tracked items always have quantity 1. Lot-tracked items may carry an `expirationDate`.
- Every stock change is recorded as a `StockMovement` (audit log). This is what powers "view movements".
- Locations carry slotting attributes used by the slotting technique.
- Each entity has its OWN status union and its OWN valid transitions (see "State Machines"). `OperationalStatus` below is only an umbrella set used by the `StatusBadge` color mapping.

Include at least these types:

```ts
export type OperationalStatus =
  | "draft"
  | "pending"
  | "assigned"
  | "in_progress"
  | "partial"
  | "completed"
  | "cancelled"
  | "in_transit"
  | "on_hold"
  | "error"
  | "synced";

export type UnitOfMeasure = "unit" | "box" | "pallet";

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  city: string;
  type: "distribution_center" | "store";
}

export interface Store {
  id: string;
  code: string;
  name: string;
  city: string;
}

// Locations carry slotting attributes. `golden` marks the ergonomic
// "golden zone" (waist-to-shoulder height, close to dispatch/packing).
export interface StorageLocation {
  id: string;
  code: string;
  warehouseId: string;
  zone: string;
  type: "pick" | "reserve" | "quality_control" | "staging" | "returns";
  isPickFace: boolean;
  golden: boolean;
  accessibilityScore: number; // 0-100; higher = easier/faster to pick
  maxWeightKg: number;
  volumeCapacityM3: number;
  distanceToDispatchM: number; // meters from location to dispatch/packing
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  barcode: string;
  unitWeightKg: number;
  unitVolumeM3: number;
  trackBy: "none" | "lot" | "serial";
}

export interface InventoryItem {
  id: string;
  productId: string;
  warehouseId: string;
  locationId: string;
  lot?: string;
  serial?: string;
  expirationDate?: string;
  onHandQuantity: number;
  reservedQuantity: number;
  holdQuantity: number;
  // availableQuantity is DERIVED via rules/inventory.ts, not stored.
  status: "available" | "reserved" | "on_hold" | "in_transit" | "expired" | "damaged";
}

// The audit log. Every receipt, putaway, pick, transfer, adjustment,
// hold, release, return or scrap appends one of these.
export interface StockMovement {
  id: string;
  productId: string;
  warehouseId: string;
  fromLocationId?: string;
  toLocationId?: string;
  type:
    | "receipt"
    | "putaway"
    | "pick"
    | "transfer"
    | "adjustment"
    | "hold"
    | "release"
    | "return"
    | "scrap";
  quantity: number;
  lot?: string;
  serial?: string;
  referenceType:
    | "asn"
    | "transfer"
    | "return"
    | "commerce_order"
    | "replenishment"
    | "slotting"
    | "manual";
  referenceId: string;
  operatorName: string;
  createdAt: string;
}

export interface Asn {
  id: string;
  code: string;
  supplierName: string;
  appointmentDate: string;
  expectedQuantity: number;
  receivedQuantity: number;
  status: OperationalStatus;
  requiresQualityControl: boolean;
  crossDocking: boolean;
  // Directed putaway suggestion comes from slotting (ABC class of product).
  suggestedPutawayLocationId?: string;
}

export interface OrderLine {
  id: string;
  productId: string;
  requestedQuantity: number;
  pickedQuantity?: number;
  packedQuantity?: number;
}

export interface TransferOrder {
  id: string;
  code: string;
  type: "dc_to_store" | "store_to_store" | "store_to_dc" | "dc_to_dc";
  originId: string;
  destinationId: string;
  status: OperationalStatus;
  createdAt: string;
  estimatedArrivalDate: string;
  routeId?: string;
  items: OrderLine[];
}

export type ReturnStatus =
  | "requested"
  | "received_at_store"
  | "in_transit_to_dc"
  | "received_at_dc"
  | "under_validation"
  | "sent_to_quality_control"
  | "reentered"
  | "sent_to_repair"
  | "sent_to_scrap"
  | "rejected"
  | "closed";

export interface ReturnOrder {
  id: string;
  rmaCode: string;
  customerName: string;
  type:
    | "customer_to_store"
    | "customer_store_to_dc"
    | "store_to_dc"
    | "store_to_store"
    | "dc_to_supplier";
  originId: string;
  destinationId: string;
  status: ReturnStatus;
  reasonId: string; // references a Reason (context: "return")
  disposition: "restock" | "scrap" | "quality_control" | "repair" | "rejected";
  items: OrderLine[];
}

export interface CommerceOrder {
  id: string;
  orderNumber: string;
  channel: "ecommerce" | "marketplace" | "pos" | "b2b" | "app";
  customerName: string;
  status: OperationalStatus;
  createdAt: string;
  promisedDeliveryDate: string;
  fulfillmentType:
    | "ship_from_dc"
    | "ship_from_store"
    | "pickup_in_store"
    | "put_to_store"
    | "cross_docking";
  items: OrderLine[];
}

export type PickingTaskStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "partially_picked"
  | "partial_with_shortage"
  | "partial_approved"
  | "partial_rejected"
  | "completed"
  | "with_issue";

export interface PickingTask {
  id: string;
  code: string;
  orderId: string;
  productId: string;
  locationId: string;
  requestedQuantity: number;
  pickedQuantity: number;
  // Pending balance kept for missing items so picking can be retried later.
  pendingQuantity: number; // requestedQuantity - pickedQuantity, never below 0
  status: PickingTaskStatus;
  operatorName?: string;
  priority: "low" | "medium" | "high";
  partialReasonId?: string; // references a Reason (context: "partial_picking")
  issueReason?: string;
}

export interface PickingWave {
  id: string;
  code: string;
  name: string;
  orderCount: number;
  unitCount: number;
  zone: string;
  // How orders were grouped into this wave.
  groupBy: "zone" | "route" | "priority" | "carrier" | "dispatch_window" | "fulfillment_type";
  groupValue: string; // e.g. the zone code, route id, carrier name, etc.
  priority: "low" | "medium" | "high";
  status: OperationalStatus;
  assignedTeam?: string;
  createdAt: string;
  orderIds: string[];
}

export interface PackingOrder {
  id: string;
  orderId: string;
  customerName: string;
  expectedItems: number;
  scannedItems: number;
  verificationStatus: "pending" | "verified" | "mismatch";
  suggestedBox: string;
  weightKg: number;
  volumeM3: number;
  labelGenerated: boolean;
}

export interface WmsLabel {
  id: string;
  code: string;
  type: "product" | "location" | "box" | "pallet" | "shipping" | "return";
  reference: string;
  status: OperationalStatus;
  createdAt: string;
  createdBy: string;
}

export interface Shipment {
  id: string;
  orderId: string;
  customerName: string;
  carrierName: string;
  sapRouteId?: string;
  status: OperationalStatus;
  shippedAt?: string;
  packageCount: number;
  weightKg: number;
  trackingNumber?: string;
  otifStatus: "on_time" | "at_risk" | "late";
}

export interface SapRoute {
  id: string;
  code: string;
  name: string;
  originId: string;
  destinationIds: string[];
  carrierName: string;
  routeDate: string;
  status: OperationalStatus;
  truckPlate: string;
  driverName: string;
  capacityKg: number;
  currentLoadKg: number;
}

export interface ManifestStop {
  id: string;
  sequence: number;
  destinationId: string;
  orderIds: string[];
  transferIds: string[];
  returnIds: string[];
}

export interface LoadManifest {
  id: string;
  code: string;
  sapRouteId: string;
  truckPlate: string;
  driverName: string;
  carrierName: string;
  manifestDate: string;
  status: OperationalStatus;
  orderIds: string[];
  transferIds: string[];
  returnIds: string[];
  totalUnits: number;
  totalPackages: number;
  totalWeightKg: number;
  totalVolumeM3: number;
  stops: ManifestStop[];
}

export interface IntegrationConnection {
  id: string;
  name: string;
  type:
    | "sap"
    | "ecommerce"
    | "marketplace"
    | "carrier"
    | "erp"
    | "oms"
    | "pos"
    | "supplier";
  status: "active" | "inactive" | "error" | "pending_configuration";
  lastSyncAt?: string;
  lastError?: string;
  processedMessages: number;
}

export interface ReplenishmentTask {
  id: string;
  productId: string;
  originLocationId: string;
  destinationLocationId: string; // a slotting-defined pick face
  currentStock: number;
  minStock: number;
  maxStock: number;
  suggestedQuantity: number;
  priority: "low" | "medium" | "high";
  status: OperationalStatus;
  operatorName?: string;
}

// --- Slotting domain ---

export type AbcClass = "A" | "B" | "C";
export type XyzClass = "X" | "Y" | "Z";

// Demand history used to CALCULATE ABC/XYZ. Lives in seed data so the
// classification is derived, not pre-baked.
export interface ProductDemandStat {
  productId: string;
  unitsSold: number;
  pickingFrequency: number; // picks per period
  demandSamples: number[]; // per-period demand, used for XYZ variability
}

// A slotting recommendation is COMPUTED (see lib/rules/slotting.ts),
// not stored as a fixed seed row.
export interface SlottingRecommendation {
  id: string;
  productId: string;
  abcClass: AbcClass;
  xyzClass: XyzClass;
  currentLocationId: string;
  suggestedLocationId: string;
  rotationRate: number;
  unitsSold: number;
  pickingFrequency: number;
  score: number; // 0-100, how strongly relocation is recommended
  estimatedDistanceSavedM: number;
  estimatedTimeSavedSeconds: number;
  recommendation: string; // human-readable Spanish explanation
}

// --- Administration domain ---

// Operators become a real catalog instead of free-text. PickingTask.operatorName
// and ReplenishmentTask.operatorName should reference an Operator by name/id.
export interface Operator {
  id: string;
  code: string;
  name: string;
  role: "picker" | "packer" | "receiver" | "driver" | "supervisor";
  active: boolean;
}

// Reasons become a referenceable catalog instead of free-text strings
// (return reason, partial-picking reason, adjustment reason, etc.).
export interface Reason {
  id: string;
  code: string;
  label: string; // Spanish label shown in the UI
  context: "return" | "partial_picking" | "adjustment" | "scrap" | "hold";
  active: boolean;
}

export interface Carrier {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

// Configurable thresholds previously hardcoded as constants. Admin can edit
// these; rules in lib/rules read them instead of magic numbers.
export interface WmsSettings {
  abcThresholdA: number; // e.g. 0.8 cumulative share
  abcThresholdB: number; // e.g. 0.95 cumulative share
  xyzCvX: number; // e.g. 0.5
  xyzCvY: number; // e.g. 1.0
  replenishmentHighFactor: number; // e.g. 0.5 of min stock
  simulatedLatencyMs: number;
}

// --- Reports domain (derived aggregations, NOT stored entities) ---

export interface ProductivityRow {
  operatorName: string;
  picksCompleted: number;
  unitsPicked: number;
  partialCount: number;
  issueCount: number;
}

export interface DiscrepancyRow {
  referenceType: "asn" | "picking";
  referenceCode: string;
  expected: number;
  actual: number;
  difference: number;
}

export interface InventoryReportRow {
  warehouseId: string;
  abcClass: AbcClass;
  totalOnHand: number;
  totalReserved: number;
  totalHold: number;
  totalAvailable: number;
}
```

You may improve or extend these types if needed, as long as the modeling rules above hold.

## State Machines

Define per-entity valid status transitions in `src/lib/state-machines.ts`. Simulated actions MUST validate a transition is allowed before applying it; otherwise they no-op and surface a message.

Example:

```ts
import type { OperationalStatus } from "@/types/wms";

export const transferTransitions: Record<string, OperationalStatus[]> = {
  draft: ["pending", "cancelled"],
  pending: ["in_progress", "cancelled"],
  in_progress: ["in_transit"],
  in_transit: ["partial", "completed"],
  partial: ["completed"],
  completed: [],
  cancelled: [],
};

export function canTransition(
  map: Record<string, OperationalStatus[]>,
  from: OperationalStatus,
  to: OperationalStatus
): boolean {
  return map[from]?.includes(to) ?? false;
}
```

Provide similar maps for receiving (ASN), returns (the full `ReturnStatus` lifecycle), commerce orders, picking tasks (the full `PickingTaskStatus` lifecycle, including the partial sub-states partial_with_shortage / partial_approved / partial_rejected), picking waves, packing, shipments, and SAP routes.

## Business Logic and Tests

Implement lightweight, PURE business logic in `src/lib/rules/` and unit-test it under `src/tests/rules/`. Pages and services call these functions; the logic is never duplicated inline.

### `lib/rules/inventory.ts`

```ts
export interface StockLevels {
  onHandQuantity: number;
  reservedQuantity: number;
  holdQuantity: number;
}

export function availableStock(item: StockLevels): number {
  return Math.max(0, item.onHandQuantity - item.reservedQuantity - item.holdQuantity);
}

// Pure quantity transforms used by the store actions. Each returns the new
// levels or throws if the operation would drive any value below 0. The store
// pairs each successful transform with an appended StockMovement.

export function applyReserve(item: StockLevels, qty: number): StockLevels {
  if (qty > availableStock(item)) throw new Error("insufficient available stock");
  return { ...item, reservedQuantity: item.reservedQuantity + qty };
}

export function applyPick(item: StockLevels, qty: number): StockLevels {
  if (qty > item.onHandQuantity || qty > item.reservedQuantity) {
    throw new Error("cannot pick more than on-hand/reserved");
  }
  return {
    ...item,
    onHandQuantity: item.onHandQuantity - qty,
    reservedQuantity: item.reservedQuantity - qty,
  };
}

export function applyReceipt(item: StockLevels, qty: number): StockLevels {
  return { ...item, onHandQuantity: item.onHandQuantity + qty };
}

export function applyHold(item: StockLevels, qty: number): StockLevels {
  if (qty > availableStock(item)) throw new Error("insufficient available stock to hold");
  return { ...item, holdQuantity: item.holdQuantity + qty };
}

export function applyRelease(item: StockLevels, qty: number): StockLevels {
  if (qty > item.holdQuantity) throw new Error("cannot release more than held");
  return { ...item, holdQuantity: item.holdQuantity - qty };
}

export function applyScrap(item: StockLevels, qty: number): StockLevels {
  if (qty > item.onHandQuantity) throw new Error("cannot scrap more than on-hand");
  return { ...item, onHandQuantity: item.onHandQuantity - qty };
}

// Adjustment sets on-hand to the counted value; caller records the delta.
export function applyAdjustment(item: StockLevels, countedOnHand: number): StockLevels {
  if (countedOnHand < 0) throw new Error("counted quantity cannot be negative");
  return { ...item, onHandQuantity: countedOnHand };
}
```

Unit-test these transforms, especially the guard rails (operations that would go below 0 must throw).

### `lib/rules/picking.ts`

```ts
export function pickingProgress(picked: number, requested: number): number {
  if (requested <= 0) return 0;
  return Math.min(100, Math.round((picked / requested) * 100));
}

export function missingQuantity(requested: number, picked: number): number {
  return Math.max(0, requested - picked);
}

// Clamp a pick confirmation so it never exceeds the requested quantity
// (prevents unauthorized over-picking).
export function clampPickedQuantity(picked: number, requested: number): number {
  return Math.max(0, Math.min(picked, requested));
}

// Order picking tasks so the most accessible locations are picked first.
export function orderTasksByAccessibility<T extends { accessibilityScore: number }>(
  tasks: T[]
): T[] {
  return [...tasks].sort((a, b) => b.accessibilityScore - a.accessibilityScore);
}
```

### `lib/rules/replenishment.ts`

```ts
export type Priority = "low" | "medium" | "high";

export function replenishmentPriority(current: number, min: number): Priority {
  if (current < min * 0.5) return "high";
  if (current < min) return "medium";
  return "low";
}

export function suggestedReplenishmentQuantity(
  current: number,
  max: number
): number {
  return Math.max(0, max - current);
}
```

### `lib/rules/shipping.ts`

```ts
export function routeOccupancy(currentLoadKg: number, capacityKg: number): number {
  if (capacityKg <= 0) return 0;
  return Math.min(100, Math.round((currentLoadKg / capacityKg) * 100));
}

export function otifPercentage(
  shipments: { otifStatus: "on_time" | "at_risk" | "late" }[]
): number {
  if (shipments.length === 0) return 0;
  const onTime = shipments.filter((s) => s.otifStatus === "on_time").length;
  return Math.round((onTime / shipments.length) * 100);
}
```

### `lib/rules/slotting.ts`

This is the core of the slotting technique. Keep it simple and explainable (no solvers).

```ts
import type { AbcClass, XyzClass } from "@/types/wms";

// ABC via Pareto over a movement metric (e.g. pickingFrequency or unitsSold).
// A = items making up the top ~80% of cumulative volume, B = next ~15%, C = rest.
export function classifyAbc(
  items: { productId: string; metric: number }[]
): Record<string, AbcClass> {
  // sort desc by metric, accumulate share, assign A/B/C by cumulative thresholds.
  return {};
}

// XYZ via demand variability (coefficient of variation).
// X = stable (low CV), Y = variable, Z = erratic (high CV).
export function classifyXyz(samples: number[]): XyzClass {
  // CV = stddev / mean. Map: CV <= 0.5 => X, <= 1.0 => Y, else Z.
  return "X";
}

// A location is a good fit for a product when:
// - high-rotation (A) products go to golden, high-accessibility, near-dispatch pick faces
// - heavy products do not exceed the location max weight
// Returns a score 0-100; higher means relocation is more beneficial.
export function slottingScore(args: {
  abcClass: AbcClass;
  product: { unitWeightKg: number; unitVolumeM3: number };
  current: { accessibilityScore: number; golden: boolean; distanceToDispatchM: number };
  candidate: {
    accessibilityScore: number;
    golden: boolean;
    distanceToDispatchM: number;
    maxWeightKg: number;
  };
}): number {
  // higher score when an A item is currently poorly slotted and the candidate
  // is golden / closer to dispatch / more accessible.
  return 0;
}

// Estimated savings make the recommendation tangible on screen.
export function estimatedDistanceSaved(
  currentDistanceM: number,
  candidateDistanceM: number,
  pickingFrequency: number
): number {
  return Math.max(0, (currentDistanceM - candidateDistanceM) * pickingFrequency);
}
```

### `lib/rules/reports.ts`

Reports are pure aggregations over existing seed data; they do NOT introduce new stored entities.

```ts
import type {
  StockMovement,
  PickingTask,
  Asn,
  InventoryItem,
  Shipment,
  ProductivityRow,
  DiscrepancyRow,
} from "@/types/wms";

// Traceability: filter the movement audit log by product / lot / serial.
export function traceMovements(
  movements: StockMovement[],
  filter: { productId?: string; lot?: string; serial?: string }
): StockMovement[] {
  return movements.filter(
    (m) =>
      (!filter.productId || m.productId === filter.productId) &&
      (!filter.lot || m.lot === filter.lot) &&
      (!filter.serial || m.serial === filter.serial)
  );
}

// Productivity: group completed picks by operator.
export function productivityByOperator(tasks: PickingTask[]): ProductivityRow[] {
  // group by operatorName, count picks/units/partials/issues.
  return [];
}

// Discrepancies: expected vs actual for ASN receiving and picking.
export function receivingDiscrepancies(asns: Asn[]): DiscrepancyRow[] {
  return asns
    .map((a) => ({
      referenceType: "asn" as const,
      referenceCode: a.code,
      expected: a.expectedQuantity,
      actual: a.receivedQuantity,
      difference: a.receivedQuantity - a.expectedQuantity,
    }))
    .filter((row) => row.difference !== 0);
}
```

Write unit tests for every function above (boundaries, zero/empty inputs, threshold edges), including the report aggregations.

## Slotting as a Cross-Cutting Technique

Slotting is NOT just the `/slotting` page. The calculated ABC/XYZ classification and location profiling must visibly influence other modules:

- Receiving (directed putaway): when an ASN arrives, suggest `suggestedPutawayLocationId` based on the product's ABC class (A items -> golden / near-dispatch pick faces; C items -> reserve/back locations).
- Replenishment: replenishment tasks target slotting-defined pick faces; min/max apply to those pick faces.
- Picking: when a wave/tasks are generated, order tasks by location `accessibilityScore` (use `orderTasksByAccessibility`) so the shortest, most accessible picks come first.
- Dashboard: include a KPI "SKUs mal ubicados" counting class A products NOT currently in a golden pick face, plus a slotting health summary.

This keeps slotting explainable and tangible without heavy optimization.

## Dashboard Requirements

Create the main dashboard at `/`.

Show KPI cards for:

- Pending orders
- Orders in picking
- Partial picking tasks
- Active picking waves
- Pending receipts
- Returns in transit
- Inventory on hold
- Active load routes
- Estimated OTIF
- Misplaced A-class SKUs (slotting health)
- Critical alerts

Dashboard must include:

- KPI section
- Recent commerce orders
- Active picking waves
- SAP routes summary
- Inventory alerts
- Slotting health summary (A items out of golden zone, top relocation opportunities)
- Integration health summary

All KPIs must be calculated from seed data via `lib/rules` functions, never hardcoded.

## Receiving Module

Route: `/receiving`

Create a page for inventory receiving.

Show ASN records with: ASN code, supplier, appointment date, status, expected quantity, received quantity, differences, quality control flag, cross-docking flag, putaway status, and suggested putaway location (from slotting/ABC).

Simulated actions: view detail, mark as partially received, mark as fully received, send to quality control, generate putaway task (records a `putaway` StockMovement to the suggested location).

Use local state and the service layer for simulated updates.

## Inventory Module

Route: `/inventory`

Create a page to consult inventory.

Show: SKU, product, warehouse or store, location, lot, serial, expiration date, on-hand quantity, reserved quantity, hold quantity, in-transit quantity, available quantity (derived), status (available / reserved / on_hold / in_transit / expired / damaged).

Filters: SKU, location, status, lot, expiration date, warehouse or store.

Simulated actions: put on hold (records `hold` movement), release hold (records `release` movement), adjust inventory (records an `adjustment` movement with a reason from the `Reason` catalog, context `adjustment`), view movements (renders the `StockMovement` audit log via `MovementTimeline`), transfer location (records a `transfer` movement).

## Transfers Module

Route: `/transfers`

Create a page for transfer orders.

Transfer types: DC to store, store to store, store to DC, DC to DC.

Show: transfer code, type, origin, destination, status, created date, estimated arrival date, SKUs, quantities, responsible person if available, associated route.

Statuses: Draft, Pending picking, In picking, In transit, Partially received, Fully received, Cancelled.

Simulated actions (validated against transfer state machine): create transfer, view detail, confirm outbound, confirm partial receipt, confirm full receipt.

## Returns Module

Route: `/returns`

Create a page for reverse logistics.

Return flows: customer to store, customer to store to DC, store to DC, store to store, DC to supplier.

Show: RMA code, customer, origin, destination, return type, status, reason (from `Reason` catalog), SKUs, quantities, validation status, final disposition.

Dispositions: Restock, Scrap, Quality control, Repair, Rejected.

Statuses (`ReturnStatus`): Requested, Received at store, In transit to DC, Received at DC, Under validation, Sent to quality control, Re-entered, Sent to repair, Sent to scrap, Rejected, Closed.

Simulated actions (validated against the returns state machine): validate return, send to quality control, re-enter inventory (records a `return` movement back into stock), send to repair, mark as scrap (records a `scrap` movement), reject, close return. Selecting a return reason uses the `Reason` catalog, not free text.

## Replenishment Module

Route: `/replenishment`

Create a replenishment page.

Show: SKU, product, origin location, destination pick face, current stock, minimum stock, maximum stock, suggested quantity, priority, status.

Business rules (from `lib/rules/replenishment.ts`):

- If current stock is lower than minimum stock, suggest replenishment.
- Priority high when stock is below 50% of minimum.
- Priority medium when stock is below minimum.
- Priority low when stock is close to minimum.
- Suggested quantity = max - current.

Replenishment destinations are slotting-defined pick faces.

Simulated actions: create replenishment task, assign operator, confirm replenishment (records a `transfer` movement from reserve to pick face).

## Commerce Orders Module

Route: `/commerce`

Create a page for commerce orders.

Show: order number, channel, customer, status, created date, promised delivery date, items, quantities, availability, fulfillment type.

Channels: Ecommerce, Marketplace, POS, B2B, App.

Fulfillment types: Ship from DC, Ship from store, Pick up in store, Put-to-store, Cross-docking.

Statuses: New, Reserved, Pending picking, In picking, Partial picking, Packed, Shipped, Delivered, Cancelled.

Simulated actions (state-machine validated): reserve inventory (updates reserved quantity), send to picking, allow partial picking, view detail.

## Picking Tasks Module

Route: `/picking/tasks`

Create a page for picking tasks.

Support: individual, partial, batch, zone, cluster, put-to-store. Tasks are ordered by location accessibility (slotting) by default.

Show: task ID, order, SKU, product, location, requested quantity, picked quantity, missing/pending quantity, status, operator, priority, partial reason if available, issue reason if available.

Statuses (`PickingTaskStatus`): Pending, Assigned, In progress, Partially picked, Partial with shortage, Partial approved, Partial rejected, Completed, With issue.

Simulated actions: assign operator (from the `Operator` catalog), confirm picked quantity (records a `pick` movement; never allow picked > requested — prevent over-picking), mark as partial (capture a partial reason from the `Reason` catalog and keep the pending balance), approve/reject partial, retry picking the pending balance later, report issue, complete task.

Partial picking is a formal sub-flow and must clearly show: requested, picked, pending balance kept for missing items, partial reason, visual status, progress bar. Marking a task partial creates a picking incident, updates the order/transfer status, and (conceptually) notifies external systems of partial fulfillment. Over-picking must be prevented.

## Picking Waves Module

Route: `/picking/waves`

Create a page for picking waves.

Show: wave ID, name, order count, unit count, zone, grouping criterion and value, priority, status, operator or team, created date, included orders.

Waves can group orders by: zone, route, priority, carrier, dispatch window, or fulfillment type (`groupBy` + `groupValue`).

Simulated actions: create wave (choosing a grouping criterion), release wave, pause wave, close wave, assign operators or team, view included orders and items with total quantities, register a wave-level incident.

## Packing Module

Route: `/packing`

Create a packing page.

Show: order, customer, expected items, scanned items, verification status, suggested box, weight, volume, label generated status.

Simulated actions: verify items, confirm packing, generate label, send to shipping.

## Labels Module

Route: `/labels`

Create a page for label management.

Label types: product, location, box, pallet, shipping, return.

Show: code, type, reference, status, created date, created by.

Simulated actions: generate label, reprint label, view label preview.

The label preview must be visual but simple: a card, label metadata, and a simulated barcode using blocks or repeated characters. No external barcode library required.

## Shipping Module

Route: `/shipping`

Create a shipping page.

Show: order, customer, carrier, SAP route, status, shipping date, packages, weight, tracking number, OTIF status.

Simulated actions: assign carrier, confirm shipment, generate manifest, view tracking.

## SAP Routes Module

Route: `/sap-routes`

Create a page for routes created in SAP (represented as an external integration source).

Show: SAP route code, route name, origin, destinations, carrier, date, status, truck plate, driver, capacity, current load, occupancy percentage (from `routeOccupancy`).

Statuses: Created in SAP, Synced, Planned, Loading, In transit, Closed.

Simulated actions: sync route, view detail, associate orders, associate transfers, associate returns.

## Load Manifest Module

Route: `/load-manifests`

Create a page for load manifests. A load manifest represents everything that will be loaded onto a truck.

Show: manifest code, SAP route, truck plate, driver, carrier, date, status, included orders, included transfers, included returns, total units, total packages, total weight, total volume, delivery stops.

The manifest detail must clearly show, per order/item: order number, customer, destination, channel, SKU, product name, requested quantity, picked quantity, packed quantity, loaded quantity, packages, weight, volume, delivery sequence, associated route, order status, and loading status.

Truck loading validations (must be enforced before closing the manifest):

- Validate the order was picked.
- Validate the order was packed.
- Validate the order was assigned to a route.
- Validate the order was loaded.
- Prevent loading unauthorized items (items not in an associated order/transfer/return).
- Prevent closing the truck while required items are still missing.

Simulated actions: create manifest, add order/transfer/return, remove order, validate truck capacity, confirm loading, close manifest (blocked if validations fail, with a clear message), print manifest, report a loading discrepancy.

## Integrations Module

Route: `/integrations`

Create a page for third-party integrations.

Integration examples: SAP, Ecommerce platform, Marketplace, Carrier, ERP, OMS, POS, External supplier.

Show: name, type, status, last synchronization, last error, processed messages.

Statuses: Active, Inactive, Error, Pending configuration.

Simulated actions: sync now, view logs, activate, deactivate.

## Slotting Module

Route: `/slotting`

Create a slotting page that demonstrates the calculated slotting technique.

Show, per SKU: product, ABC class (calculated), XYZ class (calculated), current location, suggested location, rotation rate, units sold, picking frequency, slotting score, estimated distance/time saved, and a human-readable recommendation in Spanish.

The page must:

- Compute ABC/XYZ from `ProductDemandStat` seed data via `lib/rules/slotting.ts` (not read pre-baked classes).
- Profile locations (golden zone, accessibility, distance to dispatch) and score relocation opportunities.
- Surface a summary: count of A items out of golden zone, top relocation opportunities by estimated savings.

Simulated actions: apply recommendation (records a `transfer`/`slotting` StockMovement relocating the item to the suggested location and updates inventory location), create relocation task.

## Reports Module

Route: `/reports` (overview) with sub-routes for each report.

Reports are read-only, derived aggregations computed via `lib/rules/reports.ts` from existing seed data. No new stored entities. Each report supports basic filters and a simulated CSV export (build a CSV string in memory and trigger a client-side download).

Sub-reports:

- Traceability (`/reports/traceability`): query the `StockMovement` audit log by product, lot, or serial. Show the full movement history (type, from/to location, quantity, reference, operator, date) via `MovementTimeline` or a table.
- Productivity (`/reports/productivity`): picks completed, units picked, partial count, and issue count per operator (`productivityByOperator`).
- Discrepancies (`/reports/discrepancies`): expected vs actual for ASN receiving and for picking (requested vs picked); show only rows with a difference.
- Inventory (`/reports/inventory`): on-hand / reserved / hold / available totals grouped by warehouse and ABC class.
- OTIF (`/reports/otif`): OTIF percentage (from `otifPercentage`) with a breakdown of on-time / at-risk / late shipments.

Simulated actions: apply filters, export CSV.

## Administration Module

Route: `/admin` (overview) with sub-routes. Provide simulated CRUD (create, edit, delete in local state; no persistence after refresh). These catalogs make previously free-text fields referenceable and previously hardcoded thresholds configurable.

Sub-sections:

- Catalogs (`/admin/catalogs`): manage products, storage locations, carriers, and warehouses with simulated CRUD.
- Rules (`/admin/rules`): edit packing rules and the configurable thresholds in `WmsSettings` (ABC cumulative thresholds, XYZ CV cutoffs, replenishment high-priority factor). The slotting and replenishment rules in `lib/rules` must read these settings instead of magic numbers.
- Operators (`/admin/operators`): manage the `Operator` catalog. `PickingTask` and `ReplenishmentTask` operator assignment should pick from this catalog.
- Reasons (`/admin/reasons`): manage the `Reason` catalog (return reasons, partial-picking reasons, adjustment reasons, etc.). Modules that capture a reason should select from this catalog instead of free text.
- Settings (`/admin/settings`): general configuration, including `simulatedLatencyMs`.

Simulated actions: create, edit, delete catalog entries; update settings/thresholds.

## Seed Data Requirements

Create realistic seed data in `src/data/seed.ts`, enough to populate every page and to make calculations meaningful.

Include: warehouses/DCs, stores, storage locations (with slotting attributes), products (with `trackBy`), inventory items, stock movements (initial history), product demand stats, ASN records, transfer orders, return orders, commerce orders, picking tasks, picking waves, packing orders, labels, shipments, SAP routes, load manifests, integration connections, replenishment tasks, operators, reasons, carriers, and default `WmsSettings`.

Seed enough stock movements, ASN differences, and picking tasks per operator so the Reports module produces meaningful aggregations (non-empty traceability, productivity, discrepancies, inventory, and OTIF).

Ensure the seed makes slotting interesting: include at least a few A-class products currently sitting in low-accessibility / non-golden locations so recommendations appear.

### Example Warehouses and Stores

Bogota Distribution Center, Medellin Distribution Center, Andino Store, Santa Fe Store, Viva Envigado Store, Unicentro Store.

### Example Internal Locations

A-01-01, A-01-02, B-02-04, PICK-FAST-01, PICK-FAST-02, QC-01, STAGE-OUT-01, RETURNS-01, RESERVE-05-12.

### Example Products

Black Basic T-Shirt, Blue Slim Jeans, White Urban Sneakers, Waterproof Jacket, Sports Bag, Logo Cap, Socks Pack x3, Floral Dress, Cargo Pants, Oversize Hoodie.

## Simulated Actions

Each module must have at least one working simulated action that goes through the service layer into the central store (NOT isolated per-page state). State does not need to persist after a full refresh, but it MUST be shared across module navigation so flows propagate. Mutations that change stock must both recalculate the affected `InventoryItem` and append a `StockMovement`.

Representative actions: change receiving status, mark ASN partially/fully received, generate putaway to suggested location, put inventory on hold / release hold, view movements, confirm transfer outbound/receipt, validate return, restock, mark scrap, create replenishment task, assign picking operator, confirm picked quantity, mark picking partial, release/close picking wave, generate label, confirm packing, confirm shipment, sync SAP route, confirm/close load manifest, sync integration, apply slotting recommendation.

## Page-Level Acceptance Criteria

- Flows & store: all modules read/write a single central store; the outbound flow (order -> picking -> packing -> shipping -> manifest) and the inbound flow (ASN -> receive -> putaway -> available stock) work end-to-end across module navigation; stock actions keep inventory consistent and the movement log in sync.
- Dashboard: KPI cards calculated from store via `lib/rules` selectors; recent activity; alerts; slotting health; integration health.
- Receiving: shows ASN data and expected vs received differences; shows slotting-based suggested putaway; status changes go through the ASN state machine.
- Inventory: shows SKU/location/lot/serial/status (incl. in_transit) and derived available quantity; supports filters; hold/release/adjust/transfer record movements (adjustment uses a reason from the catalog); "view movements" renders the audit log.
- Transfers: shows all types and origin/destination; outbound/receipt actions validated by state machine.
- Returns: shows all flows incl. DC-to-supplier; full `ReturnStatus` lifecycle validated by state machine; supports validation, QC, re-entry, repair, scrap, reject, close with movements recorded; reason from catalog.
- Replenishment: shows min/max/current/suggested/priority computed from rules; targets slotting pick faces; supports create/confirm.
- Commerce: shows orders by channel and fulfillment type; reserve/send-to-picking/partial validated by state machine.
- Picking Tasks: shows requested/picked/pending balance/progress; tasks ordered by accessibility; partial picking is a formal sub-flow (partial reason from catalog, pending balance kept, approve/reject, retry, over-picking prevented, picking incident created); supports issue reporting.
- Picking Waves: shows active waves, grouping criterion, included orders/items/quantities; supports create-by-grouping (zone/route/priority/carrier/dispatch window/fulfillment type), release/pause/close, assign team, wave incident.
- Packing: shows verification and label status; supports confirm packing and label generation.
- Labels: shows list; supports generation and visual preview card.
- Shipping: shows shipments, carrier, tracking, OTIF (from rules); supports confirm shipment and generate manifest.
- SAP Routes: shows capacity and occupancy (from rules); supports sync.
- Load Manifest: shows what goes into each truck (orders, transfers, returns, items, requested/picked/packed/loaded quantities, destinations, sequence); enforces loading validations (picked, packed, route-assigned, loaded, no unauthorized items, no missing required items) and blocks closing the truck when they fail; supports confirm loading and close.
- Integrations: shows health; supports sync/activate/deactivate.
- Slotting: shows CALCULATED ABC/XYZ and scored recommendations with estimated savings; apply recommendation relocates the item and records a movement.
- Reports: each sub-report (traceability, productivity, discrepancies, inventory, OTIF) renders non-empty aggregations computed via `lib/rules/reports.ts`, supports filters, and offers a simulated CSV export.
- Administration: catalogs (products, locations, carriers, warehouses), operators, and reasons support simulated CRUD; rules/settings edits update `WmsSettings`, and slotting/replenishment rules read those settings; operator/reason pickers elsewhere reference these catalogs.

## Code Quality Requirements

- Descriptive component names; English code identifiers.
- PascalCase components, camelCase variables/functions, kebab-case route folders.
- Named exports where appropriate.
- Avoid `any` unless absolutely necessary; keep data model types explicit.
- Avoid deeply nested JSX; prefer small helper functions.
- Do not duplicate status mapping; centralize in `lib/status.ts`.
- Do not duplicate business logic; centralize in `lib/rules` and cover with tests.
- Consistent date and number formatting helpers in `lib/formatters.ts`.
- Keep page components readable and client components focused on interactivity.

## UI Copy Language

Code is in English. Visible UI uses Spanish labels.

```tsx
<PageHeader
  title="Recepcion de inventario"
  description="Gestiona ASN, citas, control de calidad, cross-docking y putaway."
/>
```

But components and variables remain English:

```tsx
const pendingReceipts = asnRecords.filter((asn) => asn.status === "pending");
```

## Icon Usage Rules

Do not use emojis. Use Lucide React:

```tsx
import { Warehouse, Truck, PackageCheck, Grid3x3 } from "lucide-react";
```

```tsx
<KpiCard
  title="Pedidos pendientes"
  value={pendingOrders.length}
  description="Pedidos commerce pendientes de operacion"
  icon={PackageCheck}
/>
```

Use Iconify only for icons missing from Lucide, and keep usage consistent.

## Suggested Development Order

1. Create the new standalone Next.js project.
2. Configure Tailwind CSS 4.
3. Configure shadcn/ui.
4. Install lucide-react.
5. Configure the test runner (Vitest preferred).
6. Create global layout and app shell.
7. Create sidebar navigation.
8. Create TypeScript WMS types (including StockMovement and slotting domain).
9. Create the `lib/rules` pure functions and their unit tests (including the inventory quantity transforms and their guard rails).
10. Create the state machines.
11. Create seed data (with slotting-relevant cases).
12. Create the central store (`store/wms-store.ts` + selectors), seeded once; implement store actions that recalculate inventory and append movements.
13. Create the `lib/api` client and the `services` layer on top of the store.
14. Create shared components.
15. Build the dashboard (KPIs from rules + slotting health, read via selectors).
16. Build each module route.
17. Wire the end-to-end flows through the store (outbound, inbound, returns, replenishment, transfer); verify outbound and inbound work across modules.
18. Wire slotting into receiving putaway, replenishment, and picking ordering.
19. Build the Reports module (derived aggregations + simulated CSV export).
20. Build the Administration module (catalogs, operators, reasons, rules/thresholds, settings) and wire operator/reason pickers and settings-driven thresholds.
21. Add filters and dialogs.
22. Wire the remaining module actions through the store (recording movements where stock changes).
23. Polish UI consistency.
24. Run lint, tests, and build; fix all errors.

## Final Validation

Run the appropriate checks (use the project's package manager):

```bash
npm run lint
npm test
npm run build
```

Fix all TypeScript, linting, import, test, and build errors before considering the task complete.

## Final Deliverable

A running standalone WMS MVP where:

- All main routes exist and sidebar navigation works.
- Dashboard KPIs are calculated from seed data via `lib/rules`.
- Each module displays realistic data and has at least one simulated action.
- Stock-changing actions append a `StockMovement`, and "view movements" renders the audit log.
- Partial picking is a formal sub-flow (pending balance, partial reason, approve/reject, retry, no over-picking) and wave picking supports grouping by zone/route/priority/carrier/dispatch window/fulfillment type.
- SAP routes and load manifests clearly show which orders, items, quantities, destinations, and delivery sequence are loaded into a truck, and the manifest enforces loading validations before closing the truck.
- Returns cover all flows including DC-to-supplier, with the full status lifecycle (re-entry, repair, scrap, reject, close).
- Inventory supports adjustments and an in-transit state in addition to holds.
- Labels include a visual preview.
- Slotting is CALCULATED (ABC/XYZ from data) and visibly influences putaway, replenishment, picking ordering, and the dashboard, with scored recommendations and estimated savings.
- Reports cover traceability, productivity, discrepancies, inventory, and OTIF as derived aggregations with simulated CSV export.
- Administration provides simulated CRUD for catalogs, operators, and reasons, plus editable rules/thresholds that the business rules actually consume.
- All data access goes through the service layer with API-shaped signatures backed by a single central store, so swapping to a real backend later does not change pages.
- End-to-end flows propagate: an action in one module (e.g. confirming picking) is visible in the next module (e.g. packing) because they share the store.
- Inventory is consistent: every stock action recalculates `onHand`/`reserved`/`hold`, the derived `available` is correct, guard rails prevent negative stock, and the `StockMovement` log always matches the stock.
- No emojis; icons from Lucide React or Iconify; code identifiers in English.
- Business rules live in tested pure functions; status/state logic is centralized.

Build the MVP completely. Do not stop at a superficial scaffold.
