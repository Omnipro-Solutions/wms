@AGENTS.md

# WMS — Warehouse Management System

## What this app does

Full-stack warehouse management system for distribution centers and retail stores in Colombia. Covers the complete logistics lifecycle: inbound receiving → inventory control → picking (5 strategies) → packing → shipping → returns → slotting optimization. All UI labels are in Spanish (es-CO).

**Tech stack:** Next.js 16 (App Router) · React 19 · TypeScript 5 · Zustand 5 · TailwindCSS 4 · shadcn/Radix UI · TanStack React Table 8 · date-fns 4 · Vitest

---

## Project layout

```
src/
├── app/                   # Next.js App Router — 20 route groups
│   ├── [route]/page.tsx   # Page components (default exports allowed here only)
│   ├── [route]/_components/  # Domain-specific dialogs and cards
│   └── [route]/columns.tsx   # TanStack table column definitions
├── components/
│   ├── shared/            # KpiCard, PageHeader, StatusBadge
│   ├── ui/                # shadcn primitives — never modify these
│   └── data-table/        # TanStack React Table wrapper
├── store/
│   ├── wms-store.ts       # Zustand store — all state + 75+ actions (2,366 lines)
│   └── selectors.ts       # Computed state — KPIs, ABC/XYZ, slotting, replenishment
├── lib/
│   ├── constants.ts       # NAV_GROUPS, status icon map
│   ├── status.ts          # Status → Spanish label + color variant
│   ├── formatters.ts      # Date, currency, weight, volume (es-CO locale)
│   ├── state-machines.ts  # FSM transition maps for every entity
│   └── rules/             # Pure business logic (no state dependency)
│       ├── inventory.ts   # Stock quantity operations
│       ├── slotting.ts    # ABC/XYZ classification, scoring, affinity
│       ├── picking.ts     # Progress, batch/cluster helpers, productivity
│       ├── shipping.ts    # OTIF, rate shopping, zone resolution
│       └── packing.ts     # Box suggestion, rule triggers, label codes
├── hooks/
│   ├── use-store-helpers.ts  # Product/location/warehouse lookups
│   └── use-dialog-state.ts   # Generic modal open/close/data pattern
├── data/seed.ts           # Demo data: 6 warehouses, 200+ locations, 50 products
└── types/
    └── wms.ts             # All domain types (759 lines) — always reuse these
```

---

## Architecture rules

**Business logic lives in layers — never mix them:**

| Layer | Where | Rule |
|-------|-------|------|
| Pure functions | `lib/rules/` | No imports from store or React |
| FSM maps | `lib/state-machines.ts` | No logic, just transition tables |
| Computed state | `store/selectors.ts` | Read-only, no mutations |
| State + actions | `store/wms-store.ts` | Validate via FSM, then mutate |
| UI | `app/` | Calls store actions, reads selectors |

**Immutability:** Every store action spreads — never mutates directly. Every inventory change also appends a `StockMovement` entry for audit trail.

**No derived fields stored:** `availableQuantity` = `onHandQuantity - reservedQuantity - holdQuantity` — always compute, never store.

---

## Domain types (src/types/wms.ts)

Always import from here. Never redefine inline.

### Core entities

| Type | Purpose | Key fields |
|------|---------|-----------|
| `Warehouse` | DC or store | id, code, name, city, type (`distribution_center \| store`) |
| `StorageLocation` | Physical slot | id, warehouseId, zone, type (`pick \| reserve \| quality_control \| staging \| returns`), isPickFace, golden, isBlocked, accessibilityScore, distanceToDispatchM, maxWeightKg |
| `Product` | Catalog item | id, sku, name, category, barcode, unitWeightKg, unitVolumeM3, trackBy (`none \| lot \| serial`), imageUrl |
| `InventoryItem` | Stock record | id, productId, warehouseId, locationId, lot, serial, expirationDate, onHandQuantity, reservedQuantity, holdQuantity, holdReasonId, status |
| `StockMovement` | Audit log | type: `receipt \| putaway \| pick \| transfer \| adjustment \| hold \| release \| return \| scrap` |

### Procurement & receiving

| Type | Key statuses |
|------|-------------|
| `PurchaseOrder` | draft → confirmed → partial → received → cancelled |
| `Asn` | pending → in_progress → partial → completed / short_received / cancelled |

### Picking & fulfillment

| Type | Purpose |
|------|---------|
| `CommerceOrder` | Customer order with channel (`ecommerce \| marketplace \| pos \| b2b \| app`) and fulfillmentType (`ship_from_dc \| ship_from_store \| pickup_in_store \| put_to_store \| cross_docking`) |
| `PickingTask` | Single item pick — complex FSM (see below) |
| `PickingWave` | Grouped picking batch — draft → in_progress → partial/completed |
| `BatchTask` | Consolidated picks for same product+location from multiple orders |
| `ClusterTask` | Multi-order cluster — single picker, N container slots, route-optimized |
| `PutToStoreTask` | Bulk pick → distribute to multiple store destinations |
| `WavelessOrder` | Immediate picking without wave grouping |

### Packing & shipping

| Type | Purpose |
|------|---------|
| `PackingOrder` | Fulfillment pack — scanning, box selection, rule application, label generation |
| `PackingBoxType` | Container dimensions/weight limits |
| `PackingRule` | Conditional handling triggered by product category/weight (fragile, liquid, heavy, cold_chain, high_value) |
| `Shipment` | Outbound logistics with OTIF tracking |
| `LoadManifest` | Truck route document with SAP integration |

### Returns (complex FSM)

```
requested → received_at_store → in_transit_to_dc → received_at_dc → under_validation
  └─ disposition='restock'         → reentered → closed
  └─ disposition='scrap'           → sent_to_scrap → closed
  └─ disposition='repair'          → sent_to_repair → closed
  └─ disposition='quality_control' → sent_to_quality_control → [reentered|scrap|repair|rejected]
  └─ disposition='rejected'        → rejected → closed
```

Related: `ReturnInspection`, `ReentryBatch`, `ScrapRecord`, `RepairTicket`

### Slotting & optimization

| Type | Purpose |
|------|---------|
| `ProductDemandStat` | Historical picking frequency + demand samples for ABC/XYZ |
| `SlottingRecommendation` | Scored relocation opportunity (0–100) |
| `SlottingSnapshot` | Health checkpoint for trend comparison |
| `ReplenishmentTask` | Pick-face restocking from reserve to pick-face |

### Admin & config

`Operator`, `Reason` (context-scoped: return/partial_picking/adjustment/scrap/hold), `Carrier`, `CarrierService`, `CarrierZone`, `IntegrationConnection`, `WmsSettings`

---

## Zustand store (src/store/wms-store.ts)

18 entity slices. 75+ actions. Access via the `useWmsStore` hook.

**Key action groups:**

- **Inventory:** `holdInventory`, `holdByLot`, `holdByLocation`, `releaseInventory`, `adjustInventory`, `relocateInventory`
- **Receiving:** `confirmArrival`, `receiveAsn`, `putawayItem`, `approveQc`, `rejectQc`, `closeAsnWithDiscrepancy`
- **Picking tasks:** `startPicking`, `completePick`, `approvePart`, `rejectPart`
- **Waves:** `createWave`, `releaseWave`
- **Batch:** `startBatchTask`, `completeBatchTask`
- **Cluster:** `startClusterTask`, `depositToSlot`, `completeClusterTask`
- **Put-to-store:** `startPutToStore`, `distributeToStore`, `completePutToStore`
- **Waveless:** `createWavelessOrder`, `startWavelessOrder`
- **Packing:** `startPacking`, `scanItem`, `completePacking`, `applyPackingRule`, `removePackingRule`, `selectBox`, `generateLabel`, `sendToShipping`
- **Shipping:** `createShipment`, `shipOrder`, `deliverShipment`
- **Manifests:** `createManifest`, `addDocumentToManifest`, `dispatchManifest`, `closeManifest`
- **Transfers:** `advanceTransfer`
- **Returns:** `advanceReturn`, `inspectReturn`, `setReturnDisposition`, `executeReentry`, `executeScrap`, `createRepairTicket`, `receiveRepairReturn`
- **Replenishment:** `startReplenishment`, `completeReplenishment`, `generateReplenishmentTasks`
- **Slotting:** `relocateAll`, `captureSlottingSnapshot`
- **Admin CRUD:** operators, reasons, carriers, warehouses, locations, products, packing rules, settings

---

## Selectors (src/store/selectors.ts)

Computed state — import and call with store state, never derive these inline in components.

| Selector | Returns |
|----------|---------|
| `selectDashboardKpis(state)` | `DashboardKpis` — pendingOrders, OTIF, misplacedAClass, criticalAlerts |
| `abcByProduct(state)` | `Record<productId, 'A'\|'B'\|'C'>` — Pareto on pickingFrequency |
| `xyzByProduct(state)` | `Record<productId, 'X'\|'Y'\|'Z'>` — coefficient of variation on demandSamples |
| `selectSlottingRecommendations(state)` | `SlottingRecommendation[]` — scored, sorted desc |
| `selectSlottingImpact(state, recs)` | `SlottingImpactSummary` — aggregate distance/time saved |
| `simulateRelocateAll(state, recs)` | `SimulationSummary` — dry-run before execution |
| `selectReplenishmentNeeds(state)` | `ReplenishmentNeed[]` — pick faces below minStock |
| `selectAffinityRecommendations(state)` | `AffinityRecommendation[]` — co-picked products to co-locate |
| `selectSlottingTrends(state)` | `SlottingTrend` — delta between two most recent snapshots |

---

## Business rules (src/lib/rules/)

Pure functions — import directly, no store dependency.

### Inventory (`inventory.ts`)
```ts
availableStock(item)              // onHandQty - reservedQty - holdQty
applyReceipt(item, qty)           // +onHand
applyReserve(item, qty)           // +reserved (validates available >= qty)
applyPick(item, qty)              // -onHand, -reserved
applyHold(item, qty)              // +hold (validates available >= qty)
applyRelease(item, qty)           // -hold
applyScrap(item, qty)             // -onHand
applyAdjustment(item, countedQty) // onHand = countedQty (cycle count)
isExpired(item)                   // expirationDate < now (FIFO gate)
```

### Slotting (`slotting.ts`)
- `classifyAbc(items, thresholdA=0.8, thresholdB=0.95)` — Pareto curve on pickingFrequency
- `classifyXyz(samples, cvX=0.5, cvY=1.0)` — coefficient of variation on demandSamples
- `idealLocationTier(abc, xyz)` → `'golden' | 'standard' | 'remote'` (AX/AY → golden, CZ → remote)
- `slottingScore(...)` → 0–100: ABC weight × XYZ multiplier + accessibility gain + golden bonus + distance gain
- `estimatedDistanceSaved`, `estimatedTimeSaved` — distance/time impact per relocation

### Shipping (`shipping.ts`)
- `rateShop(carriers, weightKg, zone, date)` → `CarrierRateQuote[]` sorted by cost
- `otifPercentage(shipments)`, `otifBreakdown(shipments)`, `otifByCarrier(shipments)`
- `deriveOtifStatus(promisedDate, estimatedDate)` → `'on_time' | 'at_risk' | 'late'`
- `resolveCarrierZone(carrier, city)` — maps city to zone code

### Packing (`packing.ts`)
- `suggestBox(weightKg, volumeM3, boxes)` — smallest box fitting with 10% safety margin
- `applicableRules(products, rules)` — triggers: heavy (≥15kg), oversized (≥0.05m³), fragile, liquid, cold_chain, high_value
- `calcPackingDimensions(items, products)` → `{ weightKg, volumeM3 }`
- `verificationStatus(scanned, expected)` → `'pending' | 'verified' | 'mismatch'`

### Picking (`picking.ts`)
- `groupTasksForBatch(tasks)` — groups by product+location (>1 order = batch candidate)
- `productivityByOperator(tasks)` → `ProductivityRow[]` sorted by unitsPicked
- `batchProgress(batch)`, `clusterProgress(cluster)`, `clusterSlotsCompleted(cluster)`

---

## Routes & pages

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — KPIs, recent orders, slotting health, integration status |
| `/receiving` | 5 tabs: POs · ASN appointments · Active receipts · QC queue · Putaway staging |
| `/receiving/[asnId]` | ASN detail with FSM stepper |
| `/inventory` | Stock search, detail sheet, hold/release, cycle count |
| `/inventory/lot-trace` | FIFO traceability, lot-level holds |
| `/locations` | Warehouse map, golden zone management, blocking |
| `/slotting` | 5 tabs: Recommendations · ABC/XYZ matrix · Replenishment needs · Affinity · Snapshot history |
| `/transfers` | Inter-warehouse transfer orders |
| `/returns` | 5 tabs: Orders · Inspections · Reentries · Repairs · Scrap |
| `/commerce` | Customer orders browser |
| `/picking` | 7 tabs: Tasks · Waves · Waveless · Batch · Cluster · Put-to-store · Zone |
| `/packing` | Scanning, rule application, box selection, label generation |
| `/labels` | Barcode/QR management (product, location, box, pallet, shipping, return) |
| `/shipping` | Rate shopping, OTIF tracking, carrier performance |
| `/load-manifests` | Truck manifests, SAP route integration, dispatch |
| `/integrations` | SAP, ecommerce, marketplace, carrier connection health |
| `/reports` | Productivity, discrepancies, inventory, OTIF trends |
| `/admin` | CRUD: operators, reasons, carriers, warehouses, locations, products, packing rules, settings |

---

## Picking strategies

Five complementary approaches — all coexist in the same store:

1. **Wave-based** — group orders, release wave, pick by zone/route (traditional)
2. **Waveless** — individual orders auto-generate tasks without grouping (immediate)
3. **Batch** — consolidate PickingTasks for same product+location from multiple orders
4. **Cluster** — single picker carries N containers, fills while walking a route
5. **Put-to-store** — bulk pick at DC, then distribute to multiple store destinations

---

## Picking task FSM (most complex)

```
pending → assigned → in_progress → completed
                                 → partially_picked → partial_approved → completed
                                                    → partial_rejected → in_progress
                                                    → partial_with_shortage → partial_approved/rejected
                   → with_issue → in_progress
```

---

## Shared UI components

| Component | Usage |
|-----------|-------|
| `<PageHeader>` | Title + description at top of every page |
| `<KpiCard>` | Numeric metric, icon, label, tone (`amber/blue/red/green/neutral`) |
| `<StatusBadge status={...}>` | Maps status string → Spanish label + color |
| `<DataTable>` | TanStack wrapper — always use with column definitions file |
| `useDialogState()` | Returns `{ isOpen, openDialog, closeDialog, data }` — use for all modals |

---

## WMS-specific coding rules

- **Types:** Import from `src/types/wms.ts` — never redefine domain types inline
- **Store actions:** Arrow functions inside `create()` — use FSM maps before mutating
- **Pages:** Only place where `default export` is allowed
- **Tables:** shadcn `<Table>` + clause guards for empty/loading/error before rows
- **Forms:** react-hook-form + zod — never raw `useState` for form state
- **Status display:** Always use `<StatusBadge>` + `STATUS_MAP` from `lib/status.ts`
- **Classes:** Always `cn()` from `lib/utils` — never template literals for conditional classes
- **Dates:** Always date-fns with `es` locale — never native `.toLocaleDateString()`
- **Columns:** Each page's table columns live in `[route]/columns.tsx`, imported by page
- **Dialogs:** Domain-specific dialogs go in `[route]/_components/`, not inline in page

---

## Configuration defaults (WmsSettings)

```ts
abcThresholdA: 0.8          // cumulative share → A class
abcThresholdB: 0.95         // cumulative share → B class
xyzCvX: 0.5                 // coefficient of variation → X/Y boundary
xyzCvY: 1.0                 // coefficient of variation → Y/Z boundary
replenishmentHighFactor: 0.5 // stock < minStock × factor → HIGH priority
```

---

## Navigation groups (constants.ts)

```
Entrada:   Recepción · Inventario · Trazabilidad lotes · Ubicaciones · Slotting
Operación: Traslados · Devoluciones · Commerce · Picking · Packing · Etiquetas
Despacho:  Shipping · Manifiestos · SAP Rutas
Sistema:   Integraciones · Reportes · Administración
```
