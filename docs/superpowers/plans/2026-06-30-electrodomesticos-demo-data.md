# Demo Data — Distribuidor Electrodomésticos: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el catálogo de ropa en `src/data/seed.ts` con 12 SKUs de electrodomésticos y flujos de picking multi-zona, rutas de camiones y 4 flujos de cliente para demo.

**Architecture:** Edición in-place de `src/data/seed.ts`. Todos los arrays que referencian productIds (inventoryItems, demandStats, stockMovements, purchaseOrders, asns, commerceOrders, pickingTasks, pickingWaves, packingOrders, shipments, loadManifests, returnOrders, returnInspections, batchTasks, clusterTasks, putToStoreTasks, wavelessOrders, dashboardHistory) se actualizan en cascada para usar los nuevos IDs. Los IDs de warehouses, locations, operators, carriers, reasons y packingBoxTypes no cambian.

**Tech Stack:** TypeScript, seed.ts estático (sin runtime), tipos de `src/types/wms.ts`

## Global Constraints

- **Archivo único:** Todo en `src/data/seed.ts` — no crear nuevos archivos
- **IDs warehouses y locations:** No modificar — solo cambiar productId en registros dependientes
- **IDs productos:** Prefijo `p-` en kebab-case (p-nevera, p-estufa, etc.)
- **Imágenes:** URLs Unsplash `?w=80&h=80&fit=crop&auto=format`
- **Locale:** Labels en español colombiano
- **Fecha base del seed:** `2026-06-30T08:00:00.000Z`
- **TypeScript:** No usar `any`, respetar tipos de `src/types/wms.ts`

---

## Mapa de archivos

| Archivo | Acción | Secciones modificadas |
|---------|--------|-----------------------|
| `src/data/seed.ts` | Modify | products, demandStats, inventoryItems, stockMovements, purchaseOrders, asnRecords, commerceOrders, pickingTasks, pickingWaves, packingOrders, shipments, loadManifests, returnOrders, returnInspections, batchTasks, clusterTasks, putToStoreTasks, wavelessOrders, dashboardHistory, replenishmentTasks |

---

## Task 1: Reemplazar `products[]` con catálogo de electrodomésticos

**Files:**
- Modify: `src/data/seed.ts:265-453` (bloque `export const products`)

**Interfaces:**
- Produces: IDs `p-nevera`, `p-lavadora`, `p-lavaplatos`, `p-secadora`, `p-estufa`, `p-microondas`, `p-extractor`, `p-licuadora`, `p-batidora`, `p-cafetera`, `p-sanduchera`, `p-plancha` — usados por todas las tareas siguientes

- [ ] **Step 1: Reemplazar el array `products` completo**

Localizar en `src/data/seed.ts` la línea `export const products: Product[] = [` (aprox. línea 265) hasta el cierre del array (aprox. línea 453, antes de `// Demand stats`). Reemplazar todo ese bloque con:

```typescript
export const products: Product[] = [
  // ─── Línea Blanca ────────────────────────────────────────────────────────────
  {
    id: 'p-nevera',
    sku: 'LB-NEV-001',
    name: 'Nevera No Frost 320L',
    category: 'Línea Blanca',
    barcode: '7700000000011',
    unitWeightKg: 68,
    unitVolumeM3: 0.55,
    trackBy: 'serial',
    baseUomId: 'uom-und',
    uomConversions: [],
    imageUrl:
      'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=80&h=80&fit=crop&auto=format',
    rotationStrategy: 'fifo',
    minStockUnits: 2,
    maxStockUnits: 20,
  },
  {
    id: 'p-lavadora',
    sku: 'LB-LAV-002',
    name: 'Lavadora Carga Frontal 12kg',
    category: 'Línea Blanca',
    barcode: '7700000000028',
    unitWeightKg: 72,
    unitVolumeM3: 0.48,
    trackBy: 'serial',
    baseUomId: 'uom-und',
    uomConversions: [],
    imageUrl:
      'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=80&h=80&fit=crop&auto=format',
    rotationStrategy: 'fifo',
    minStockUnits: 2,
    maxStockUnits: 20,
  },
  {
    id: 'p-lavaplatos',
    sku: 'LB-LVP-003',
    name: 'Lavaplatos 12 Puestos',
    category: 'Línea Blanca',
    barcode: '7700000000035',
    unitWeightKg: 45,
    unitVolumeM3: 0.38,
    trackBy: 'serial',
    baseUomId: 'uom-und',
    uomConversions: [],
    imageUrl:
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=80&h=80&fit=crop&auto=format',
    rotationStrategy: 'fifo',
    minStockUnits: 2,
    maxStockUnits: 20,
  },
  {
    id: 'p-secadora',
    sku: 'LB-SEC-004',
    name: 'Secadora de Ropa 10kg',
    category: 'Línea Blanca',
    barcode: '7700000000042',
    unitWeightKg: 40,
    unitVolumeM3: 0.35,
    trackBy: 'serial',
    baseUomId: 'uom-und',
    uomConversions: [],
    imageUrl:
      'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?w=80&h=80&fit=crop&auto=format',
    rotationStrategy: 'fifo',
    minStockUnits: 2,
    maxStockUnits: 20,
  },
  // ─── Línea Cocina ─────────────────────────────────────────────────────────────
  {
    id: 'p-estufa',
    sku: 'LC-EST-005',
    name: 'Estufa 4 Puestos Gas',
    category: 'Línea Cocina',
    barcode: '7700000000059',
    unitWeightKg: 35,
    unitVolumeM3: 0.28,
    trackBy: 'serial',
    baseUomId: 'uom-und',
    uomConversions: [],
    imageUrl:
      'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=80&h=80&fit=crop&auto=format',
    rotationStrategy: 'fifo',
    minStockUnits: 3,
    maxStockUnits: 15,
  },
  {
    id: 'p-microondas',
    sku: 'LC-MIC-006',
    name: 'Microondas 28L Digital',
    category: 'Línea Cocina',
    barcode: '7700000000066',
    unitWeightKg: 12,
    unitVolumeM3: 0.06,
    trackBy: 'serial',
    baseUomId: 'uom-und',
    uomConversions: [{ fromUomId: 'uom-caj6', toUomId: 'uom-und', factor: 6 }],
    imageUrl:
      'https://images.unsplash.com/photo-1585515320310-259814833e62?w=80&h=80&fit=crop&auto=format',
    rotationStrategy: 'fifo',
    minStockUnits: 5,
    maxStockUnits: 30,
  },
  {
    id: 'p-extractor',
    sku: 'LC-EXT-007',
    name: 'Extractor de Cocina 60cm',
    category: 'Línea Cocina',
    barcode: '7700000000073',
    unitWeightKg: 8,
    unitVolumeM3: 0.05,
    trackBy: 'lot',
    baseUomId: 'uom-und',
    uomConversions: [{ fromUomId: 'uom-caj6', toUomId: 'uom-und', factor: 6 }],
    imageUrl:
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=80&h=80&fit=crop&auto=format',
    rotationStrategy: 'fifo',
    minStockUnits: 5,
    maxStockUnits: 30,
  },
  // ─── Pequeños Electrodomésticos ───────────────────────────────────────────────
  {
    id: 'p-licuadora',
    sku: 'PE-LIC-008',
    name: 'Licuadora Industrial 2L',
    category: 'Pequeños Electrodomésticos',
    barcode: '7700000000080',
    unitWeightKg: 2.8,
    unitVolumeM3: 0.008,
    trackBy: 'none',
    baseUomId: 'uom-und',
    uomConversions: [
      { fromUomId: 'uom-caj6', toUomId: 'uom-und', factor: 6 },
      { fromUomId: 'uom-pal', toUomId: 'uom-und', factor: 60 },
    ],
    imageUrl:
      'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=80&h=80&fit=crop&auto=format',
    rotationStrategy: 'fifo',
    minStockUnits: 5,
    maxStockUnits: 50,
  },
  {
    id: 'p-batidora',
    sku: 'PE-BAT-009',
    name: 'Batidora de Pedestal 5L',
    category: 'Pequeños Electrodomésticos',
    barcode: '7700000000097',
    unitWeightKg: 3.2,
    unitVolumeM3: 0.009,
    trackBy: 'none',
    baseUomId: 'uom-und',
    uomConversions: [{ fromUomId: 'uom-caj6', toUomId: 'uom-und', factor: 6 }],
    imageUrl:
      'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=80&h=80&fit=crop&auto=format',
    rotationStrategy: 'fifo',
    minStockUnits: 5,
    maxStockUnits: 50,
  },
  {
    id: 'p-cafetera',
    sku: 'PE-CAF-010',
    name: 'Cafetera Espresso Automática',
    category: 'Pequeños Electrodomésticos',
    barcode: '7700000000103',
    unitWeightKg: 2.1,
    unitVolumeM3: 0.007,
    trackBy: 'none',
    baseUomId: 'uom-und',
    uomConversions: [
      { fromUomId: 'uom-caj6', toUomId: 'uom-und', factor: 6 },
      { fromUomId: 'uom-pal', toUomId: 'uom-und', factor: 60 },
    ],
    imageUrl:
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=80&h=80&fit=crop&auto=format',
    rotationStrategy: 'fifo',
    minStockUnits: 5,
    maxStockUnits: 50,
  },
  {
    id: 'p-sanduchera',
    sku: 'PE-SAN-011',
    name: 'Sanduchera Grill 1200W',
    category: 'Pequeños Electrodomésticos',
    barcode: '7700000000110',
    unitWeightKg: 1.4,
    unitVolumeM3: 0.004,
    trackBy: 'none',
    baseUomId: 'uom-und',
    uomConversions: [
      { fromUomId: 'uom-caj12', toUomId: 'uom-und', factor: 12 },
      { fromUomId: 'uom-pal', toUomId: 'uom-und', factor: 120 },
    ],
    imageUrl:
      'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=80&h=80&fit=crop&auto=format',
    rotationStrategy: 'fifo',
    minStockUnits: 5,
    maxStockUnits: 50,
  },
  {
    id: 'p-plancha',
    sku: 'PE-PLA-012',
    name: 'Plancha a Vapor 2800W',
    category: 'Pequeños Electrodomésticos',
    barcode: '7700000000127',
    unitWeightKg: 1.8,
    unitVolumeM3: 0.005,
    trackBy: 'lot',
    baseUomId: 'uom-und',
    uomConversions: [
      { fromUomId: 'uom-caj12', toUomId: 'uom-und', factor: 12 },
      { fromUomId: 'uom-pal', toUomId: 'uom-und', factor: 120 },
    ],
    imageUrl:
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=80&h=80&fit=crop&auto=format',
    rotationStrategy: 'fifo',
    minStockUnits: 5,
    maxStockUnits: 50,
  },
]
```

- [ ] **Step 2: Verificar compilación TypeScript**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -30
```

Esperado: 0 errores en el bloque de products (puede haber errores downstream por IDs cambiados — se corrigen en tareas siguientes).

- [ ] **Step 3: Commit**

```bash
git add src/data/seed.ts
git commit -m "feat(seed): replace apparel products with electrodomesticos catalog (12 SKUs)"
```

---

## Task 2: Actualizar `demandStats[]` y `dashboardHistory`

**Files:**
- Modify: `src/data/seed.ts` — bloque `export const demandStats` y `export const dashboardHistory`

**Interfaces:**
- Consumes: IDs de productos de Task 1
- Produces: demandStats con picks diseñados para ABC A={nevera,estufa,lavadora}, B={microondas,lavaplatos,licuadora,cafetera}, C={secadora,extractor,batidora,sanduchera,plancha}

- [ ] **Step 1: Reemplazar el array `demandStats`**

Localizar `export const demandStats: ProductDemandStat[] = [` y reemplazar todo el bloque hasta su cierre:

```typescript
// demandStats drive ABC/XYZ classification via selectors.ts:
// A-class (≥80% cumulative pickingFrequency): nevera, estufa, lavadora
// B-class (80-95%): microondas, lavaplatos, licuadora, cafetera
// C-class (<5%): secadora, extractor, batidora, sanduchera, plancha
// X (CV<0.5 stable): nevera, estufa, lavadora
// Z (CV>1.0 erratic): extractor, plancha
export const demandStats: ProductDemandStat[] = [
  {
    productId: 'p-nevera',
    unitsSold: 3840,
    pickingFrequency: 320,
    demandSamples: [310, 315, 318, 322, 325],
  },
  {
    productId: 'p-estufa',
    unitsSold: 3360,
    pickingFrequency: 280,
    demandSamples: [272, 278, 282, 285, 283],
  },
  {
    productId: 'p-lavadora',
    unitsSold: 2520,
    pickingFrequency: 210,
    demandSamples: [205, 208, 212, 215, 210],
  },
  {
    productId: 'p-microondas',
    unitsSold: 1800,
    pickingFrequency: 150,
    demandSamples: [140, 155, 148, 152, 155],
  },
  {
    productId: 'p-lavaplatos',
    unitsSold: 1320,
    pickingFrequency: 110,
    demandSamples: [105, 112, 108, 115, 110],
  },
  {
    productId: 'p-licuadora',
    unitsSold: 1140,
    pickingFrequency: 95,
    demandSamples: [90, 98, 92, 100, 95],
  },
  {
    productId: 'p-cafetera',
    unitsSold: 960,
    pickingFrequency: 80,
    demandSamples: [75, 82, 78, 85, 80],
  },
  {
    productId: 'p-secadora',
    unitsSold: 540,
    pickingFrequency: 45,
    demandSamples: [42, 46, 44, 48, 45],
  },
  {
    productId: 'p-extractor',
    unitsSold: 360,
    pickingFrequency: 30,
    demandSamples: [5, 58, 8, 50, 9],
  },
  {
    productId: 'p-batidora',
    unitsSold: 300,
    pickingFrequency: 25,
    demandSamples: [22, 28, 24, 26, 25],
  },
  {
    productId: 'p-sanduchera',
    unitsSold: 216,
    pickingFrequency: 18,
    demandSamples: [15, 20, 17, 20, 18],
  },
  {
    productId: 'p-plancha',
    unitsSold: 180,
    pickingFrequency: 15,
    demandSamples: [2, 32, 4, 28, 9],
  },
]
```

- [ ] **Step 2: Reemplazar `dashboardHistory.weeklyDemand`**

Localizar el objeto `dashboardHistory` al final del archivo y reemplazar la sección `weeklyDemand`:

```typescript
export const dashboardHistory = {
  weeklyOtif: [91, 89, 92, 88, 85, 90, 87, 91],
  weeklyDemand: {
    'p-nevera': [298, 305, 312, 308, 318, 315, 320, 325],
    'p-estufa': [265, 272, 278, 275, 282, 280, 285, 283],
    'p-lavadora': [198, 205, 208, 210, 212, 208, 215, 210],
    'p-microondas': [138, 145, 148, 150, 152, 148, 155, 150],
    'p-cafetera': [72, 78, 75, 80, 82, 78, 85, 80],
  },
}
```

- [ ] **Step 3: Commit**

```bash
git add src/data/seed.ts
git commit -m "feat(seed): update demandStats and dashboardHistory for electrodomesticos"
```

---

## Task 3: Actualizar `inventoryItems[]` y `stockMovements[]`

**Files:**
- Modify: `src/data/seed.ts` — bloques `inventoryItems` y `stockMovements`

**Interfaces:**
- Consumes: IDs productos Task 1; location IDs existentes (`loc-a0101`, `loc-a0102`, `loc-b0204`, `loc-pickfast1`, `loc-pickfast2`, `loc-reserve`, `loc-qc`, `loc-stageout`)
- Produces: inventoryItems con seriales para línea blanca, lots para extractor/plancha; incluye `inv-ret-1` en QC para flujo devolución (Task 7)

- [ ] **Step 1: Reemplazar `inventoryItems`**

Localizar `export const inventoryItems: InventoryItem[] = [` y reemplazar todo el bloque:

```typescript
export const inventoryItems: InventoryItem[] = [
  // ─── Línea Blanca en zona reserva (serial-tracked, un registro por unidad) ────
  { id: 'inv-nev-1', productId: 'p-nevera', warehouseId: 'wh-bog', locationId: 'loc-reserve', serial: 'NEV-2026-0001', onHandQuantity: 1, reservedQuantity: 1, holdQuantity: 0, status: 'available' },
  { id: 'inv-nev-2', productId: 'p-nevera', warehouseId: 'wh-bog', locationId: 'loc-reserve', serial: 'NEV-2026-0002', onHandQuantity: 1, reservedQuantity: 1, holdQuantity: 0, status: 'available' },
  { id: 'inv-nev-3', productId: 'p-nevera', warehouseId: 'wh-bog', locationId: 'loc-reserve', serial: 'NEV-2026-0003', onHandQuantity: 1, reservedQuantity: 0, holdQuantity: 0, status: 'available' },
  { id: 'inv-nev-4', productId: 'p-nevera', warehouseId: 'wh-bog', locationId: 'loc-reserve', serial: 'NEV-2026-0004', onHandQuantity: 1, reservedQuantity: 0, holdQuantity: 0, status: 'available' },
  { id: 'inv-nev-5', productId: 'p-nevera', warehouseId: 'wh-bog', locationId: 'loc-b0204', serial: 'NEV-2026-0005', onHandQuantity: 1, reservedQuantity: 0, holdQuantity: 0, status: 'available' },
  { id: 'inv-lav-1', productId: 'p-lavadora', warehouseId: 'wh-bog', locationId: 'loc-reserve', serial: 'LAV-2026-0001', onHandQuantity: 1, reservedQuantity: 1, holdQuantity: 0, status: 'available' },
  { id: 'inv-lav-2', productId: 'p-lavadora', warehouseId: 'wh-bog', locationId: 'loc-reserve', serial: 'LAV-2026-0002', onHandQuantity: 1, reservedQuantity: 0, holdQuantity: 0, status: 'available' },
  { id: 'inv-lav-3', productId: 'p-lavadora', warehouseId: 'wh-bog', locationId: 'loc-reserve', serial: 'LAV-2026-0003', onHandQuantity: 1, reservedQuantity: 0, holdQuantity: 0, status: 'available' },
  { id: 'inv-lvp-1', productId: 'p-lavaplatos', warehouseId: 'wh-bog', locationId: 'loc-reserve', serial: 'LVP-2026-0001', onHandQuantity: 1, reservedQuantity: 0, holdQuantity: 0, status: 'available' },
  { id: 'inv-lvp-2', productId: 'p-lavaplatos', warehouseId: 'wh-bog', locationId: 'loc-reserve', serial: 'LVP-2026-0002', onHandQuantity: 1, reservedQuantity: 0, holdQuantity: 0, status: 'available' },
  { id: 'inv-sec-1', productId: 'p-secadora', warehouseId: 'wh-bog', locationId: 'loc-reserve', serial: 'SEC-2026-0001', onHandQuantity: 1, reservedQuantity: 0, holdQuantity: 0, status: 'available' },
  { id: 'inv-sec-2', productId: 'p-secadora', warehouseId: 'wh-bog', locationId: 'loc-reserve', serial: 'SEC-2026-0002', onHandQuantity: 1, reservedQuantity: 0, holdQuantity: 0, status: 'available' },
  // ─── Línea Cocina ─────────────────────────────────────────────────────────────
  { id: 'inv-est-1', productId: 'p-estufa', warehouseId: 'wh-bog', locationId: 'loc-reserve', serial: 'EST-2026-0001', onHandQuantity: 1, reservedQuantity: 1, holdQuantity: 0, status: 'available' },
  { id: 'inv-est-2', productId: 'p-estufa', warehouseId: 'wh-bog', locationId: 'loc-reserve', serial: 'EST-2026-0002', onHandQuantity: 1, reservedQuantity: 1, holdQuantity: 0, status: 'available' },
  { id: 'inv-est-3', productId: 'p-estufa', warehouseId: 'wh-bog', locationId: 'loc-b0204', serial: 'EST-2026-0003', onHandQuantity: 1, reservedQuantity: 0, holdQuantity: 0, status: 'available' },
  { id: 'inv-mic-1', productId: 'p-microondas', warehouseId: 'wh-bog', locationId: 'loc-a0101', serial: 'MIC-2026-0001', onHandQuantity: 1, reservedQuantity: 1, holdQuantity: 0, status: 'available' },
  { id: 'inv-mic-2', productId: 'p-microondas', warehouseId: 'wh-bog', locationId: 'loc-a0101', serial: 'MIC-2026-0002', onHandQuantity: 1, reservedQuantity: 0, holdQuantity: 0, status: 'available' },
  { id: 'inv-mic-3', productId: 'p-microondas', warehouseId: 'wh-bog', locationId: 'loc-a0101', serial: 'MIC-2026-0003', onHandQuantity: 1, reservedQuantity: 0, holdQuantity: 0, status: 'available' },
  {
    id: 'inv-ext-1',
    productId: 'p-extractor',
    warehouseId: 'wh-bog',
    locationId: 'loc-a0102',
    lot: 'LOT-EXT-2601',
    onHandQuantity: 12,
    reservedQuantity: 0,
    holdQuantity: 4,
    holdReasonId: 'rs-8',
    status: 'on_hold',
  },
  // ─── Pequeños en pick-face ────────────────────────────────────────────────────
  {
    id: 'inv-lic-1',
    productId: 'p-licuadora',
    warehouseId: 'wh-bog',
    locationId: 'loc-pickfast1',
    onHandQuantity: 24,
    reservedQuantity: 5,
    holdQuantity: 0,
    status: 'available',
  },
  {
    id: 'inv-bat-1',
    productId: 'p-batidora',
    warehouseId: 'wh-bog',
    locationId: 'loc-pickfast2',
    onHandQuantity: 18,
    reservedQuantity: 0,
    holdQuantity: 0,
    status: 'available',
  },
  {
    id: 'inv-caf-1',
    productId: 'p-cafetera',
    warehouseId: 'wh-bog',
    locationId: 'loc-pickfast1',
    onHandQuantity: 30,
    reservedQuantity: 3,
    holdQuantity: 0,
    status: 'available',
  },
  {
    id: 'inv-san-1',
    productId: 'p-sanduchera',
    warehouseId: 'wh-bog',
    locationId: 'loc-a0101',
    onHandQuantity: 40,
    reservedQuantity: 2,
    holdQuantity: 0,
    status: 'available',
  },
  {
    id: 'inv-pla-1',
    productId: 'p-plancha',
    warehouseId: 'wh-bog',
    locationId: 'loc-a0102',
    lot: 'LOT-PLA-2601',
    onHandQuantity: 35,
    reservedQuantity: 0,
    holdQuantity: 0,
    status: 'available',
  },
  // ─── Staging (ASN recibida pendiente putaway) ─────────────────────────────────
  {
    id: 'inv-stg-nev',
    productId: 'p-nevera',
    warehouseId: 'wh-bog',
    locationId: 'loc-stageout',
    serial: 'NEV-2026-0010',
    onHandQuantity: 1,
    reservedQuantity: 0,
    holdQuantity: 0,
    status: 'available',
  },
  // ─── QC — nevera devuelta en inspección (Flujo D) ─────────────────────────────
  {
    id: 'inv-ret-1',
    productId: 'p-nevera',
    warehouseId: 'wh-bog',
    locationId: 'loc-qc',
    serial: 'NEV-2025-0099',
    onHandQuantity: 1,
    reservedQuantity: 0,
    holdQuantity: 1,
    status: 'on_hold',
  },
]
```

- [ ] **Step 2: Reemplazar `stockMovements`**

Localizar `export const stockMovements: StockMovement[] = [` y reemplazar:

```typescript
export const stockMovements: StockMovement[] = [
  {
    id: 'mv-1',
    productId: 'p-nevera',
    warehouseId: 'wh-bog',
    toLocationId: 'loc-reserve',
    type: 'receipt',
    quantity: 5,
    referenceType: 'asn',
    referenceId: 'asn-1',
    operatorName: 'Carlos Ramírez',
    createdAt: '2026-06-20T09:00:00.000Z',
  },
  {
    id: 'mv-2',
    productId: 'p-estufa',
    warehouseId: 'wh-bog',
    toLocationId: 'loc-reserve',
    type: 'receipt',
    quantity: 4,
    referenceType: 'asn',
    referenceId: 'asn-2',
    operatorName: 'Carlos Ramírez',
    createdAt: '2026-06-21T09:30:00.000Z',
  },
  {
    id: 'mv-3',
    productId: 'p-microondas',
    warehouseId: 'wh-bog',
    toLocationId: 'loc-a0101',
    type: 'putaway',
    quantity: 3,
    referenceType: 'asn',
    referenceId: 'asn-3',
    operatorName: 'Diana López',
    createdAt: '2026-06-22T10:00:00.000Z',
  },
  {
    id: 'mv-4',
    productId: 'p-extractor',
    warehouseId: 'wh-bog',
    fromLocationId: 'loc-a0102',
    type: 'hold',
    quantity: 4,
    referenceType: 'manual',
    referenceId: 'adj-1',
    operatorName: 'Diana López',
    createdAt: '2026-06-23T11:00:00.000Z',
  },
  {
    id: 'mv-5',
    productId: 'p-nevera',
    warehouseId: 'wh-bog',
    fromLocationId: 'loc-reserve',
    type: 'pick',
    quantity: 2,
    referenceType: 'commerce_order',
    referenceId: 'co-b2b-1',
    operatorName: 'Andrés Gómez',
    createdAt: '2026-06-28T14:00:00.000Z',
  },
  {
    id: 'mv-6',
    productId: 'p-nevera',
    warehouseId: 'wh-bog',
    fromLocationId: 'loc-reserve',
    type: 'return',
    quantity: 1,
    referenceType: 'return_order',
    referenceId: 'ret-1',
    operatorName: 'Carlos Mora',
    createdAt: '2026-06-29T08:00:00.000Z',
  },
]
```

- [ ] **Step 3: Commit**

```bash
git add src/data/seed.ts
git commit -m "feat(seed): update inventoryItems and stockMovements for electrodomesticos"
```

---

## Task 4: Actualizar `purchaseOrders[]` y `asnRecords[]`

**Files:**
- Modify: `src/data/seed.ts` — bloques `purchaseOrders` y `asnRecords`

**Interfaces:**
- Consumes: IDs productos Task 1; carrier IDs existentes (`ca-1`=Coordinadora, `ca-2`=Servientrega, `ca-3`=TCC)
- Produces: POs de proveedores de electrodomésticos, ASNs con estados variados para la UI de receiving

- [ ] **Step 1: Reemplazar `purchaseOrders`**

Localizar `export const purchaseOrders: PurchaseOrder[] = [` y reemplazar todo el bloque:

```typescript
export const purchaseOrders: PurchaseOrder[] = [
  {
    id: 'po-1',
    code: 'PO-2406-001',
    supplierId: 'sup-1',
    supplierName: 'Electrónica del Caribe S.A.',
    status: 'received',
    expectedDate: '2026-06-20',
    carrierId: 'ca-3',
    notes: 'Entrega completa confirmada. Neveras y estufas.',
    createdAt: '2026-06-10T08:00:00.000Z',
    lines: [
      { id: 'pol-1', productId: 'p-nevera', orderedQty: 5, receivedQty: 5, unitCost: 1850000 },
      { id: 'pol-2', productId: 'p-estufa', orderedQty: 4, receivedQty: 4, unitCost: 980000 },
    ],
  },
  {
    id: 'po-2',
    code: 'PO-2406-002',
    supplierId: 'sup-2',
    supplierName: 'Importaciones Samsung Colombia',
    status: 'partial',
    expectedDate: '2026-06-22',
    carrierId: 'ca-1',
    notes: 'Faltaron 2 lavadoras. Proveedor confirma reposición semana siguiente.',
    createdAt: '2026-06-12T09:00:00.000Z',
    lines: [
      { id: 'pol-3', productId: 'p-lavadora', orderedQty: 5, receivedQty: 3, unitCost: 2200000 },
      { id: 'pol-4', productId: 'p-lavaplatos', orderedQty: 3, receivedQty: 3, unitCost: 1650000 },
    ],
  },
  {
    id: 'po-3',
    code: 'PO-2406-003',
    supplierId: 'sup-3',
    supplierName: 'Distribuidora LG Andina',
    status: 'confirmed',
    expectedDate: '2026-07-05',
    carrierId: 'ca-2',
    notes: 'Incluye microondas y pequeños. Cita programada.',
    createdAt: '2026-06-15T10:00:00.000Z',
    lines: [
      { id: 'pol-5', productId: 'p-microondas', orderedQty: 10, receivedQty: 0, unitCost: 420000 },
      { id: 'pol-6', productId: 'p-licuadora', orderedQty: 20, receivedQty: 0, unitCost: 185000 },
      { id: 'pol-7', productId: 'p-cafetera', orderedQty: 15, receivedQty: 0, unitCost: 320000 },
    ],
  },
  {
    id: 'po-4',
    code: 'PO-2406-004',
    supplierId: 'sup-4',
    supplierName: 'Global Home Appliances',
    status: 'draft',
    expectedDate: '2026-07-12',
    createdAt: '2026-06-28T08:30:00.000Z',
    lines: [
      { id: 'pol-8', productId: 'p-secadora', orderedQty: 4, receivedQty: 0, unitCost: 1750000 },
      { id: 'pol-9', productId: 'p-extractor', orderedQty: 8, receivedQty: 0, unitCost: 380000 },
      { id: 'pol-10', productId: 'p-batidora', orderedQty: 12, receivedQty: 0, unitCost: 220000 },
    ],
  },
  {
    id: 'po-5',
    code: 'PO-2406-005',
    supplierId: 'sup-1',
    supplierName: 'Electrónica del Caribe S.A.',
    status: 'confirmed',
    expectedDate: '2026-07-08',
    carrierId: 'ca-3',
    createdAt: '2026-06-25T07:00:00.000Z',
    lines: [
      { id: 'pol-11', productId: 'p-sanduchera', orderedQty: 30, receivedQty: 0, unitCost: 95000 },
      { id: 'pol-12', productId: 'p-plancha', orderedQty: 25, receivedQty: 0, unitCost: 110000 },
    ],
  },
]
```

- [ ] **Step 2: Reemplazar `asnRecords`**

Localizar `export const asnRecords: Asn[] = [` y reemplazar todo el bloque:

```typescript
export const asnRecords: Asn[] = [
  {
    id: 'asn-1',
    code: 'ASN-2406-001',
    supplierName: 'Electrónica del Caribe S.A.',
    appointmentDate: '2026-06-20',
    expectedQuantity: 9,
    receivedQuantity: 9,
    damagedQuantity: 0,
    status: 'completed',
    requiresQualityControl: false,
    crossDocking: false,
    productId: 'p-nevera',
    suggestedPutawayLocationId: 'loc-reserve',
    deliveryCount: 1,
    purchaseOrderId: 'po-1',
    sourceType: 'purchase',
  },
  {
    id: 'asn-2',
    code: 'ASN-2406-002',
    supplierName: 'Importaciones Samsung Colombia',
    appointmentDate: '2026-06-22',
    expectedQuantity: 8,
    receivedQuantity: 6,
    damagedQuantity: 0,
    status: 'partial',
    requiresQualityControl: true,
    crossDocking: false,
    productId: 'p-lavadora',
    suggestedPutawayLocationId: 'loc-reserve',
    deliveryCount: 1,
    purchaseOrderId: 'po-2',
    sourceType: 'purchase',
  },
  {
    id: 'asn-3',
    code: 'ASN-2406-003',
    supplierName: 'Distribuidora LG Andina',
    appointmentDate: '2026-07-05',
    expectedQuantity: 45,
    receivedQuantity: 0,
    damagedQuantity: 0,
    status: 'pending',
    requiresQualityControl: false,
    crossDocking: false,
    productId: 'p-microondas',
    suggestedPutawayLocationId: 'loc-a0101',
    deliveryCount: 0,
    purchaseOrderId: 'po-3',
    sourceType: 'purchase',
  },
  {
    id: 'asn-4',
    code: 'ASN-2406-004',
    supplierName: 'Electrónica del Caribe S.A.',
    appointmentDate: '2026-06-30',
    expectedQuantity: 1,
    receivedQuantity: 1,
    damagedQuantity: 0,
    status: 'in_progress',
    requiresQualityControl: false,
    crossDocking: false,
    productId: 'p-nevera',
    suggestedPutawayLocationId: 'loc-reserve',
    deliveryCount: 1,
    purchaseOrderId: 'po-1',
    sourceType: 'purchase',
  },
  {
    id: 'asn-5',
    code: 'ASN-2406-005',
    supplierName: 'Global Home Appliances',
    appointmentDate: '2026-07-12',
    expectedQuantity: 24,
    receivedQuantity: 0,
    damagedQuantity: 0,
    status: 'pending',
    requiresQualityControl: false,
    crossDocking: false,
    productId: 'p-secadora',
    suggestedPutawayLocationId: 'loc-reserve',
    deliveryCount: 0,
    purchaseOrderId: 'po-4',
    sourceType: 'purchase',
  },
]
```

- [ ] **Step 3: Commit**

```bash
git add src/data/seed.ts
git commit -m "feat(seed): update purchaseOrders and asnRecords for electrodomesticos"
```

---

## Task 5: Flujo A & B — `commerceOrders[]`, `pickingTasks[]`, `pickingWaves[]`

**Files:**
- Modify: `src/data/seed.ts` — bloques `commerceOrders`, `pickingTasks`, `pickingWaves`

**Interfaces:**
- Consumes: IDs productos Task 1; location IDs existentes
- Produces: IDs `co-b2b-1`, `co-b2b-2`, `co-eco-1`, `co-eco-2`, `co-eco-3`, `co-pts-1`; picking tasks `pt-b2b-1`…`pt-b2b-3`, `pt-eco-1`…`pt-eco-3`, `pt-pts-1`, `pt-pts-2`; waves `wv-1`, `wv-2`, `wv-3` — usados por Tasks 6, 7, 8

- [ ] **Step 1: Reemplazar `commerceOrders`**

Localizar `export const commerceOrders: CommerceOrder[] = [` y reemplazar todo el bloque:

```typescript
export const commerceOrders: CommerceOrder[] = [
  // ─── Flujo A: B2B / Mayorista ─────────────────────────────────────────────────
  {
    id: 'co-b2b-1',
    orderNumber: 'PED-B2B-001',
    channel: 'b2b',
    customerName: 'Alkosto S.A.',
    status: 'completed',
    createdAt: '2026-06-25T08:00:00.000Z',
    promisedDeliveryDate: '2026-06-28',
    fulfillmentType: 'ship_from_dc',
    items: [
      { id: 'col-b2b-1a', productId: 'p-nevera', requestedQuantity: 2, pickedQuantity: 2, packedQuantity: 2 },
      { id: 'col-b2b-1b', productId: 'p-estufa', requestedQuantity: 2, pickedQuantity: 2, packedQuantity: 2 },
    ],
  },
  {
    id: 'co-b2b-2',
    orderNumber: 'PED-B2B-002',
    channel: 'b2b',
    customerName: 'Éxito Kennedy',
    status: 'in_progress',
    createdAt: '2026-06-27T09:00:00.000Z',
    promisedDeliveryDate: '2026-07-01',
    fulfillmentType: 'ship_from_dc',
    items: [
      { id: 'col-b2b-2a', productId: 'p-nevera', requestedQuantity: 1, pickedQuantity: 1 },
      { id: 'col-b2b-2b', productId: 'p-estufa', requestedQuantity: 1, pickedQuantity: 0 },
      { id: 'col-b2b-2c', productId: 'p-microondas', requestedQuantity: 2, pickedQuantity: 0 },
    ],
  },
  // ─── Flujo B: Ecommerce / Marketplace ────────────────────────────────────────
  {
    id: 'co-eco-1',
    orderNumber: 'PED-ECO-001',
    channel: 'ecommerce',
    customerName: 'Laura Méndez',
    status: 'completed',
    createdAt: '2026-06-24T10:00:00.000Z',
    promisedDeliveryDate: '2026-06-27',
    fulfillmentType: 'ship_from_dc',
    items: [
      { id: 'col-eco-1a', productId: 'p-microondas', requestedQuantity: 1, pickedQuantity: 1, packedQuantity: 1 },
    ],
  },
  {
    id: 'co-eco-2',
    orderNumber: 'PED-ECO-002',
    channel: 'marketplace',
    customerName: 'Andrés Castro',
    status: 'in_progress',
    createdAt: '2026-06-28T11:00:00.000Z',
    promisedDeliveryDate: '2026-07-02',
    fulfillmentType: 'ship_from_dc',
    items: [
      { id: 'col-eco-2a', productId: 'p-cafetera', requestedQuantity: 1, pickedQuantity: 1 },
    ],
  },
  {
    id: 'co-eco-3',
    orderNumber: 'PED-ECO-003',
    channel: 'ecommerce',
    customerName: 'Sofía Rincón',
    status: 'assigned',
    createdAt: '2026-06-29T12:00:00.000Z',
    promisedDeliveryDate: '2026-07-03',
    fulfillmentType: 'ship_from_dc',
    items: [
      { id: 'col-eco-3a', productId: 'p-sanduchera', requestedQuantity: 2, pickedQuantity: 0 },
    ],
  },
  // ─── Flujo C: Reposición Tienda (put-to-store) ────────────────────────────────
  {
    id: 'co-pts-1',
    orderNumber: 'PED-PTS-001',
    channel: 'b2b',
    customerName: 'Tienda Andino (Reposición)',
    status: 'in_progress',
    createdAt: '2026-06-29T07:00:00.000Z',
    promisedDeliveryDate: '2026-07-01',
    fulfillmentType: 'put_to_store',
    items: [
      { id: 'col-pts-1a', productId: 'p-licuadora', requestedQuantity: 5, pickedQuantity: 5 },
      { id: 'col-pts-1b', productId: 'p-cafetera', requestedQuantity: 3, pickedQuantity: 3 },
    ],
  },
]
```

- [ ] **Step 2: Reemplazar `pickingTasks`**

Localizar `export const pickingTasks: PickingTask[] = [` y reemplazar todo el bloque:

```typescript
export const pickingTasks: PickingTask[] = [
  // ─── Flujo A: B2B ─────────────────────────────────────────────────────────────
  {
    id: 'pt-b2b-1',
    code: 'PICK-B2B-001',
    orderId: 'co-b2b-1',
    productId: 'p-nevera',
    locationId: 'loc-reserve',
    requestedQuantity: 2,
    pickedQuantity: 2,
    pendingQuantity: 0,
    status: 'completed',
    operatorName: 'Andrés Gómez',
    priority: 'high',
  },
  {
    id: 'pt-b2b-2',
    code: 'PICK-B2B-002',
    orderId: 'co-b2b-1',
    productId: 'p-estufa',
    locationId: 'loc-reserve',
    requestedQuantity: 2,
    pickedQuantity: 2,
    pendingQuantity: 0,
    status: 'completed',
    operatorName: 'Andrés Gómez',
    priority: 'high',
  },
  {
    id: 'pt-b2b-3',
    code: 'PICK-B2B-003',
    orderId: 'co-b2b-2',
    productId: 'p-nevera',
    locationId: 'loc-reserve',
    requestedQuantity: 1,
    pickedQuantity: 1,
    pendingQuantity: 0,
    status: 'completed',
    operatorName: 'Andrés Gómez',
    priority: 'high',
  },
  {
    id: 'pt-b2b-4',
    code: 'PICK-B2B-004',
    orderId: 'co-b2b-2',
    productId: 'p-estufa',
    locationId: 'loc-b0204',
    requestedQuantity: 1,
    pickedQuantity: 0,
    pendingQuantity: 1,
    status: 'partial_with_shortage',
    operatorName: 'Andrés Gómez',
    priority: 'high',
    partialReasonId: 'rs-4',
  },
  {
    id: 'pt-b2b-5',
    code: 'PICK-B2B-005',
    orderId: 'co-b2b-2',
    productId: 'p-microondas',
    locationId: 'loc-a0101',
    requestedQuantity: 2,
    pickedQuantity: 0,
    pendingQuantity: 2,
    status: 'pending',
    priority: 'medium',
  },
  // ─── Flujo B: Ecommerce ────────────────────────────────────────────────────────
  {
    id: 'pt-eco-1',
    code: 'PICK-ECO-001',
    orderId: 'co-eco-1',
    productId: 'p-microondas',
    locationId: 'loc-a0101',
    requestedQuantity: 1,
    pickedQuantity: 1,
    pendingQuantity: 0,
    status: 'completed',
    operatorName: 'Paula Vega',
    priority: 'medium',
  },
  {
    id: 'pt-eco-2',
    code: 'PICK-ECO-002',
    orderId: 'co-eco-2',
    productId: 'p-cafetera',
    locationId: 'loc-pickfast1',
    requestedQuantity: 1,
    pickedQuantity: 1,
    pendingQuantity: 0,
    status: 'completed',
    operatorName: 'Paula Vega',
    priority: 'medium',
  },
  {
    id: 'pt-eco-3',
    code: 'PICK-ECO-003',
    orderId: 'co-eco-3',
    productId: 'p-sanduchera',
    locationId: 'loc-a0101',
    requestedQuantity: 2,
    pickedQuantity: 0,
    pendingQuantity: 2,
    status: 'assigned',
    operatorName: 'Paula Vega',
    priority: 'low',
  },
  // ─── Flujo C: Put-to-Store ────────────────────────────────────────────────────
  {
    id: 'pt-pts-1',
    code: 'PICK-PTS-001',
    orderId: 'co-pts-1',
    productId: 'p-licuadora',
    locationId: 'loc-pickfast1',
    requestedQuantity: 5,
    pickedQuantity: 5,
    pendingQuantity: 0,
    status: 'completed',
    operatorName: 'Carlos Ramírez',
    priority: 'medium',
  },
  {
    id: 'pt-pts-2',
    code: 'PICK-PTS-002',
    orderId: 'co-pts-1',
    productId: 'p-cafetera',
    locationId: 'loc-pickfast1',
    requestedQuantity: 3,
    pickedQuantity: 3,
    pendingQuantity: 0,
    status: 'completed',
    operatorName: 'Carlos Ramírez',
    priority: 'medium',
  },
]
```

- [ ] **Step 3: Reemplazar `pickingWaves`**

Localizar `export const pickingWaves: PickingWave[] = [` y reemplazar todo el bloque:

```typescript
export const pickingWaves: PickingWave[] = [
  {
    id: 'wv-1',
    code: 'WAVE-001',
    name: 'Oleada mañana — Línea Blanca B2B',
    orderCount: 2,
    unitCount: 8,
    zone: 'A',
    groupBy: 'fulfillment_type',
    groupValue: 'ship_from_dc',
    priority: 'high',
    status: 'in_progress',
    assignedTeam: 'Equipo 1',
    createdAt: '2026-06-30T07:00:00.000Z',
    orderIds: ['co-b2b-1', 'co-b2b-2'],
  },
  {
    id: 'wv-2',
    code: 'WAVE-002',
    name: 'Oleada ecommerce pequeños',
    orderCount: 3,
    unitCount: 4,
    zone: 'B',
    groupBy: 'channel',
    groupValue: 'ecommerce',
    priority: 'medium',
    status: 'draft',
    createdAt: '2026-06-30T07:30:00.000Z',
    orderIds: ['co-eco-1', 'co-eco-2', 'co-eco-3'],
  },
  {
    id: 'wv-3',
    code: 'WAVE-003',
    name: 'Reposición Tienda Andino',
    orderCount: 1,
    unitCount: 8,
    zone: 'S',
    groupBy: 'fulfillment_type',
    groupValue: 'put_to_store',
    priority: 'medium',
    status: 'released',
    assignedTeam: 'Equipo 2',
    createdAt: '2026-06-29T07:00:00.000Z',
    orderIds: ['co-pts-1'],
  },
]
```

- [ ] **Step 4: Commit**

```bash
git add src/data/seed.ts
git commit -m "feat(seed): add commerce orders, picking tasks and waves for electrodomesticos flows"
```

---

## Task 6: Actualizar `packingOrders[]`, `shipments[]`, `loadManifests[]`

**Files:**
- Modify: `src/data/seed.ts` — bloques `packingOrders`, `shipments`, `loadManifests`

**Interfaces:**
- Consumes: IDs de órdenes de Task 5 (`co-b2b-1`, `co-eco-1`, `co-eco-2`); carrier IDs existentes
- Produces: IDs `pk-b2b-1`, `pk-eco-1`, `pk-eco-2`; shipments `sh-b2b-1`, `sh-eco-1`, `sh-eco-2`; manifests `lm-ruta1`, `lm-ruta2`

- [ ] **Step 1: Reemplazar `packingOrders`**

Localizar `export const packingOrders: PackingOrder[] = [` y reemplazar todo el bloque:

```typescript
export const packingOrders: PackingOrder[] = [
  {
    id: 'pk-b2b-1',
    orderId: 'co-b2b-1',
    orderNumber: 'PED-B2B-001',
    customerName: 'Alkosto S.A.',
    channel: 'b2b',
    status: 'labelled',
    expectedItems: 4,
    scannedItems: 4,
    verificationStatus: 'verified',
    suggestedBox: 'Pallet',
    boxTypeId: 'box-pallet',
    weightKg: 206,
    volumeM3: 1.66,
    appliedRuleIds: ['pr-3'],
    labelGenerated: true,
    labelCode: 'LBL-SHP-B2B-001',
    packerName: 'Paula Vega',
    createdAt: '2026-06-28T14:00:00.000Z',
    verifiedAt: '2026-06-28T15:30:00.000Z',
    items: [
      { productId: 'p-nevera', productName: 'Nevera No Frost 320L', requestedQuantity: 2, scannedQuantity: 2 },
      { productId: 'p-estufa', productName: 'Estufa 4 Puestos Gas', requestedQuantity: 2, scannedQuantity: 2 },
    ],
  },
  {
    id: 'pk-eco-1',
    orderId: 'co-eco-1',
    orderNumber: 'PED-ECO-001',
    customerName: 'Laura Méndez',
    channel: 'ecommerce',
    status: 'labelled',
    expectedItems: 1,
    scannedItems: 1,
    verificationStatus: 'verified',
    suggestedBox: 'Caja M',
    boxTypeId: 'box-m',
    weightKg: 12,
    volumeM3: 0.06,
    appliedRuleIds: [],
    labelGenerated: true,
    labelCode: 'LBL-SHP-ECO-001',
    packerName: 'Diana López',
    createdAt: '2026-06-27T09:00:00.000Z',
    verifiedAt: '2026-06-27T10:00:00.000Z',
    items: [
      { productId: 'p-microondas', productName: 'Microondas 28L Digital', requestedQuantity: 1, scannedQuantity: 1 },
    ],
  },
  {
    id: 'pk-eco-2',
    orderId: 'co-eco-2',
    orderNumber: 'PED-ECO-002',
    customerName: 'Andrés Castro',
    channel: 'marketplace',
    status: 'in_progress',
    expectedItems: 1,
    scannedItems: 0,
    verificationStatus: 'pending',
    suggestedBox: 'Caja S',
    boxTypeId: 'box-s',
    weightKg: 2.1,
    volumeM3: 0.007,
    appliedRuleIds: [],
    labelGenerated: false,
    packerName: 'Diana López',
    createdAt: '2026-06-30T08:00:00.000Z',
    items: [
      { productId: 'p-cafetera', productName: 'Cafetera Espresso Automática', requestedQuantity: 1, scannedQuantity: 0 },
    ],
  },
]
```

- [ ] **Step 2: Reemplazar `shipments`**

Localizar `export const shipments: Shipment[] = [` y reemplazar todo el bloque:

```typescript
export const shipments: Shipment[] = [
  {
    id: 'sh-b2b-1',
    orderId: 'co-b2b-1',
    carrierId: 'ca-1',
    customerName: 'Alkosto S.A.',
    carrierName: 'Coordinadora',
    sapRouteId: 'sap-rt-001',
    serviceLevel: 'ground',
    quotedCostUsd: 45.00,
    destinationCity: 'Bogotá',
    zone: 'ZONA-BOG-NORTE',
    trackingNumber: 'COO-2026-B2B-001',
    status: 'delivered',
    promisedDate: '2026-06-28',
    estimatedDate: '2026-06-28',
    actualDate: '2026-06-28',
    otifStatus: 'on_time',
    createdAt: '2026-06-28T16:00:00.000Z',
  },
  {
    id: 'sh-eco-1',
    orderId: 'co-eco-1',
    carrierId: 'ca-1',
    customerName: 'Laura Méndez',
    carrierName: 'Coordinadora',
    serviceLevel: 'express',
    quotedCostUsd: 12.50,
    destinationCity: 'Bogotá',
    zone: 'ZONA-BOG-SUR',
    trackingNumber: 'COO-2026-ECO-001',
    status: 'delivered',
    promisedDate: '2026-06-27',
    estimatedDate: '2026-06-27',
    actualDate: '2026-06-27',
    otifStatus: 'on_time',
    createdAt: '2026-06-27T11:00:00.000Z',
  },
  {
    id: 'sh-eco-2',
    orderId: 'co-eco-2',
    carrierId: 'ca-2',
    customerName: 'Andrés Castro',
    carrierName: 'Servientrega',
    serviceLevel: 'ground',
    quotedCostUsd: 9.80,
    destinationCity: 'Medellín',
    zone: 'ZONA-MED-CENTRO',
    trackingNumber: 'SRV-2026-ECO-002',
    status: 'in_transit',
    promisedDate: '2026-07-02',
    estimatedDate: '2026-07-02',
    otifStatus: 'on_time',
    createdAt: '2026-06-30T09:00:00.000Z',
  },
]
```

- [ ] **Step 3: Reemplazar `loadManifests`**

Localizar `export const loadManifests: LoadManifest[] = [` y reemplazar todo el bloque:

```typescript
export const loadManifests: LoadManifest[] = [
  {
    id: 'lm-ruta1',
    code: 'MAN-2406-001',
    sapRouteId: 'sap-rt-001',
    truckPlate: 'BJK-412',
    driverName: 'Luis Hernández',
    carrierName: 'Coordinadora',
    manifestDate: '2026-06-28',
    status: 'dispatched',
    orderIds: ['co-b2b-1'],
    transferIds: [],
    returnIds: [],
    totalUnits: 4,
    totalPackages: 1,
    totalWeightKg: 206,
    totalVolumeM3: 1.66,
    stops: [
      {
        id: 'st-ruta1-1',
        sequence: 1,
        destinationId: 'wh-andino',
        orderIds: [],
        transferIds: [],
        returnIds: [],
      },
      {
        id: 'st-ruta1-2',
        sequence: 2,
        destinationId: 'wh-unicentro',
        orderIds: ['co-b2b-1'],
        transferIds: [],
        returnIds: [],
      },
    ],
  },
  {
    id: 'lm-ruta2',
    code: 'MAN-2406-002',
    sapRouteId: 'sap-rt-002',
    truckPlate: 'RTP-887',
    driverName: 'Carlos Medina',
    carrierName: 'TCC',
    manifestDate: '2026-06-30',
    status: 'in_progress',
    orderIds: ['co-b2b-2'],
    transferIds: ['tr-andino-1'],
    returnIds: [],
    totalUnits: 12,
    totalPackages: 4,
    totalWeightKg: 318,
    totalVolumeM3: 2.1,
    stops: [
      {
        id: 'st-ruta2-1',
        sequence: 1,
        destinationId: 'wh-santafe',
        orderIds: ['co-b2b-2'],
        transferIds: [],
        returnIds: [],
      },
      {
        id: 'st-ruta2-2',
        sequence: 2,
        destinationId: 'wh-andino',
        orderIds: [],
        transferIds: ['tr-andino-1'],
        returnIds: [],
      },
    ],
  },
  {
    id: 'lm-ruta3',
    code: 'MAN-2406-003',
    sapRouteId: 'sap-rt-001',
    truckPlate: 'BJK-412',
    driverName: 'Luis Hernández',
    carrierName: 'Coordinadora',
    manifestDate: '2026-07-03',
    status: 'pending',
    orderIds: [],
    transferIds: [],
    returnIds: [],
    totalUnits: 0,
    totalPackages: 0,
    totalWeightKg: 0,
    totalVolumeM3: 0,
    stops: [
      { id: 'st-ruta3-1', sequence: 1, destinationId: 'wh-andino', orderIds: [], transferIds: [], returnIds: [] },
      { id: 'st-ruta3-2', sequence: 2, destinationId: 'wh-unicentro', orderIds: [], transferIds: [], returnIds: [] },
    ],
  },
]
```

- [ ] **Step 4: Commit**

```bash
git add src/data/seed.ts
git commit -m "feat(seed): add packing orders, shipments and load manifests for demo routes"
```

---

## Task 7: Flujo C & D — `transferOrders[]`, `putToStoreTasks[]`, `returnOrders[]`, `returnInspections[]`

**Files:**
- Modify: `src/data/seed.ts` — bloques `returnOrders`, `returnInspections`, y las secciones de `putToStoreTasks` y (si existe) `transferOrders`

**Interfaces:**
- Consumes: IDs productos Task 1; location IDs existentes; `co-pts-1` de Task 5; `pt-pts-1`, `pt-pts-2` de Task 5
- Produces: `ret-1` (ReturnOrder nevera), `ri-1` (ReturnInspection), `pts-andino-1` (PutToStoreTask), `tr-andino-1` (TransferOrder si existe en el seed)

- [ ] **Step 1: Reemplazar `returnOrders`**

Localizar `export const returnOrders: ReturnOrder[] = [` y reemplazar todo el bloque:

```typescript
export const returnOrders: ReturnOrder[] = [
  // ─── Flujo D: Nevera devuelta — en QC → reparación ───────────────────────────
  {
    id: 'ret-1',
    rmaCode: 'RMA-2406-001',
    customerName: 'Carlos Nieto',
    type: 'customer_store_to_dc',
    originId: 'wh-andino',
    destinationId: 'wh-bog',
    status: 'under_validation',
    reasonId: 'rs-1',
    disposition: 'repair',
    items: [{ id: 'retl-1', productId: 'p-nevera', requestedQuantity: 1 }],
    createdAt: '2026-06-28T09:00:00.000Z',
    inspectionId: 'ri-1',
  },
  // ─── Devolución adicional: lavadora reingresada exitosamente ─────────────────
  {
    id: 'ret-2',
    rmaCode: 'RMA-2406-002',
    customerName: 'Almacenes Jumbo',
    type: 'store_to_dc',
    originId: 'wh-santafe',
    destinationId: 'wh-bog',
    status: 'reentered',
    reasonId: 'rs-2',
    disposition: 'restock',
    items: [{ id: 'retl-2', productId: 'p-lavadora', requestedQuantity: 1 }],
    createdAt: '2026-06-25T10:00:00.000Z',
  },
  // ─── Microondas dañado en tránsito — enviado a scrap ─────────────────────────
  {
    id: 'ret-3',
    rmaCode: 'RMA-2406-003',
    customerName: 'Éxito Kennedy',
    type: 'customer_store_to_dc',
    originId: 'wh-bog',
    destinationId: 'wh-bog',
    status: 'sent_to_scrap',
    reasonId: 'rs-3',
    disposition: 'scrap',
    items: [{ id: 'retl-3', productId: 'p-microondas', requestedQuantity: 1 }],
    createdAt: '2026-06-20T14:00:00.000Z',
  },
  // ─── Extractor en control de calidad ─────────────────────────────────────────
  {
    id: 'ret-4',
    rmaCode: 'RMA-2406-004',
    customerName: 'Distribuidora Norte',
    type: 'store_to_dc',
    originId: 'wh-med',
    destinationId: 'wh-bog',
    status: 'sent_to_quality_control',
    reasonId: 'rs-1',
    disposition: 'quality_control',
    items: [{ id: 'retl-4', productId: 'p-extractor', requestedQuantity: 2 }],
    createdAt: '2026-06-27T08:30:00.000Z',
  },
]
```

- [ ] **Step 2: Reemplazar `returnInspections`**

Localizar `export const returnInspections: ReturnInspection[] = [` y reemplazar todo el bloque:

```typescript
export const returnInspections: ReturnInspection[] = [
  {
    id: 'ri-1',
    returnOrderId: 'ret-1',
    inspectorName: 'Carlos Mora',
    inspectedAt: '2026-06-29T09:30:00.000Z',
    overallResult: 'fail',
    notes: 'Compresor con falla de refrigeración. No apto para reingreso directo. Se envía a reparación autorizada.',
    items: [
      {
        returnLineId: 'retl-1',
        productId: 'p-nevera',
        inspectedQuantity: 1,
        conditionRating: 'damaged',
        notes: 'Falla en compresor. Temperatura interna no alcanza -4°C.',
        recommendedDisposition: 'repair',
      },
    ],
  },
]
```

- [ ] **Step 3: Reemplazar `putToStoreTasks`**

Localizar `export const putToStoreTasks: PutToStoreTask[] = [` y reemplazar todo el bloque:

```typescript
export const putToStoreTasks: PutToStoreTask[] = [
  {
    id: 'pts-andino-1',
    code: 'PTS-001',
    orderId: 'co-pts-1',
    productId: 'p-licuadora',
    totalPickedQuantity: 5,
    status: 'in_progress',
    operatorName: 'Carlos Ramírez',
    createdAt: '2026-06-29T07:30:00.000Z',
    allocations: [
      { storeId: 'wh-andino', storeName: 'Tienda Andino', requestedQuantity: 3, distributedQuantity: 3 },
      { storeId: 'wh-santafe', storeName: 'Tienda Santa Fe', requestedQuantity: 2, distributedQuantity: 0 },
    ],
  },
  {
    id: 'pts-andino-2',
    code: 'PTS-002',
    orderId: 'co-pts-1',
    productId: 'p-cafetera',
    totalPickedQuantity: 3,
    status: 'completed',
    operatorName: 'Carlos Ramírez',
    createdAt: '2026-06-29T07:30:00.000Z',
    allocations: [
      { storeId: 'wh-andino', storeName: 'Tienda Andino', requestedQuantity: 2, distributedQuantity: 2 },
      { storeId: 'wh-santafe', storeName: 'Tienda Santa Fe', requestedQuantity: 1, distributedQuantity: 1 },
    ],
  },
]
```

- [ ] **Step 4: Verificar que `transferOrders` en el seed referencia IDs válidos**

Buscar en seed.ts:
```bash
grep -n "transferOrders\|tr-andino-1\|tr-1" /Users/carlosgranados/Documents/develop/wms/src/data/seed.ts | head -20
```

Si existe un array `transferOrders`, actualizar la referencia `tr-andino-1` con productIds de electrodomésticos (licuadora/cafetera). Si no existe, continuar.

- [ ] **Step 5: Commit**

```bash
git add src/data/seed.ts
git commit -m "feat(seed): add return orders, inspections and put-to-store tasks for demo flows C and D"
```

---

## Task 8: Actualizar `batchTasks[]`, `clusterTasks[]`, `wavelessOrders[]`, `replenishmentTasks[]`

**Files:**
- Modify: `src/data/seed.ts` — bloques `batchTasks`, `clusterTasks`, `wavelessOrders`, `replenishmentTasks`

**Interfaces:**
- Consumes: IDs productos Task 1; location IDs existentes; picking task IDs de Task 5
- Produces: arrays limpios con referencias a electrodomésticos — sin referencias a IDs de ropa

- [ ] **Step 1: Reemplazar `batchTasks`**

Localizar `export const batchTasks: BatchTask[] = [` y reemplazar todo el bloque:

```typescript
export const batchTasks: BatchTask[] = [
  {
    id: 'bt-1',
    code: 'BATCH-001',
    productId: 'p-microondas',
    locationId: 'loc-a0101',
    pickingTaskIds: ['pt-b2b-5', 'pt-eco-1'],
    totalRequestedQuantity: 3,
    totalPickedQuantity: 1,
    status: 'in_progress',
    operatorName: 'Andrés Gómez',
    priority: 'high',
    createdAt: '2026-06-30T07:30:00.000Z',
  },
  {
    id: 'bt-2',
    code: 'BATCH-002',
    productId: 'p-sanduchera',
    locationId: 'loc-a0101',
    pickingTaskIds: ['pt-eco-3'],
    totalRequestedQuantity: 2,
    totalPickedQuantity: 0,
    status: 'pending',
    priority: 'medium',
    createdAt: '2026-06-30T07:35:00.000Z',
  },
  {
    id: 'bt-3',
    code: 'BATCH-003',
    productId: 'p-nevera',
    locationId: 'loc-reserve',
    pickingTaskIds: ['pt-b2b-1', 'pt-b2b-3'],
    totalRequestedQuantity: 3,
    totalPickedQuantity: 3,
    status: 'completed',
    operatorName: 'Andrés Gómez',
    priority: 'high',
    createdAt: '2026-06-28T08:00:00.000Z',
  },
]
```

- [ ] **Step 2: Reemplazar `clusterTasks`**

Localizar `export const clusterTasks: ClusterTask[] = [` y reemplazar todo el bloque:

```typescript
export const clusterTasks: ClusterTask[] = [
  {
    id: 'cl-1',
    code: 'CLUST-001',
    operatorName: 'Paula Vega',
    status: 'in_progress',
    priority: 'high',
    route: ['loc-reserve', 'loc-a0101', 'loc-pickfast1'],
    createdAt: '2026-06-30T08:00:00.000Z',
    slots: [
      {
        orderId: 'co-b2b-2',
        orderNumber: 'PED-B2B-002',
        containerLabel: 'Bin A',
        completed: false,
        items: [
          { productId: 'p-nevera', requested: 1, deposited: 1 },
          { productId: 'p-estufa', requested: 1, deposited: 0 },
        ],
      },
      {
        orderId: 'co-eco-2',
        orderNumber: 'PED-ECO-002',
        containerLabel: 'Bin B',
        completed: false,
        items: [{ productId: 'p-cafetera', requested: 1, deposited: 1 }],
      },
      {
        orderId: 'co-eco-3',
        orderNumber: 'PED-ECO-003',
        containerLabel: 'Bin C',
        completed: false,
        items: [{ productId: 'p-sanduchera', requested: 2, deposited: 0 }],
      },
    ],
  },
  {
    id: 'cl-2',
    code: 'CLUST-002',
    status: 'pending',
    priority: 'medium',
    route: ['loc-pickfast1', 'loc-pickfast2', 'loc-a0102'],
    createdAt: '2026-06-30T08:30:00.000Z',
    slots: [
      {
        orderId: 'co-b2b-2',
        orderNumber: 'PED-B2B-002',
        containerLabel: 'Bin A',
        completed: false,
        items: [{ productId: 'p-microondas', requested: 2, deposited: 0 }],
      },
    ],
  },
]
```

- [ ] **Step 3: Reemplazar `wavelessOrders`**

Localizar `export const wavelessOrders: WavelessOrder[] = [` y reemplazar todo el bloque:

```typescript
export const wavelessOrders: WavelessOrder[] = [
  {
    id: 'wl-1',
    orderId: 'co-eco-3',
    orderNumber: 'PED-ECO-003',
    customerName: 'Sofía Rincón',
    channel: 'ecommerce',
    fulfillmentType: 'ship_from_dc',
    pickingTaskIds: ['pt-eco-3'],
    status: 'in_progress',
    priority: 'medium',
    createdAt: '2026-06-29T10:00:00.000Z',
  },
]
```

- [ ] **Step 4: Reemplazar `replenishmentTasks`**

Localizar `export const replenishmentTasks: ReplenishmentTask[] = [` y reemplazar todo el bloque:

```typescript
export const replenishmentTasks: ReplenishmentTask[] = [
  {
    id: 'rp-1',
    productId: 'p-licuadora',
    fromLocationId: 'loc-reserve',
    toLocationId: 'loc-pickfast1',
    warehouseId: 'wh-bog',
    requestedQuantity: 10,
    completedQuantity: 0,
    status: 'pending',
    priority: 'high',
    createdAt: '2026-06-30T06:00:00.000Z',
  },
  {
    id: 'rp-2',
    productId: 'p-cafetera',
    fromLocationId: 'loc-reserve',
    toLocationId: 'loc-pickfast1',
    warehouseId: 'wh-bog',
    requestedQuantity: 8,
    completedQuantity: 8,
    status: 'completed',
    operatorName: 'Paula Vega',
    priority: 'medium',
    createdAt: '2026-06-29T06:00:00.000Z',
  },
]
```

- [ ] **Step 5: Commit**

```bash
git add src/data/seed.ts
git commit -m "feat(seed): update batch, cluster, waveless and replenishment tasks for electrodomesticos"
```

---

## Task 9: Validación final y TypeScript check

**Files:**
- Read: `src/data/seed.ts`
- Read: `src/store/wms-store.ts` (verificar que las exportaciones del seed coinciden con los imports)

**Interfaces:**
- Consumes: seed.ts completo actualizado de Tasks 1–8

- [ ] **Step 1: Compilación TypeScript completa**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1
```

Esperado: 0 errores.

Si hay errores de tipo: identificar qué campo es incorrecto, localizar en seed.ts, corregir el valor al tipo exacto del error.

- [ ] **Step 2: Verificar que no quedan IDs de ropa**

```bash
grep -n "p-tshirt\|p-jeans\|p-sneakers\|p-jacket\|p-bag\|p-cap\|p-socks\|p-dress\|p-cargo\|p-hoodie\|p-shorts\|p-coat" /Users/carlosgranados/Documents/develop/wms/src/data/seed.ts
```

Esperado: 0 resultados. Si aparecen líneas, corregirlas reemplazando el ID por el ID de electrodoméstico correspondiente.

- [ ] **Step 3: Verificar cobertura de criterios de éxito**

```bash
grep -c "p-nevera\|p-estufa\|p-lavadora\|p-microondas\|p-cafetera\|p-sanduchera" /Users/carlosgranados/Documents/develop/wms/src/data/seed.ts
```

Esperado: número > 30 (múltiples referencias a través de todos los flujos).

- [ ] **Step 4: Iniciar el servidor de desarrollo y navegar rutas clave**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npm run dev
```

Navegar y verificar:
- `/inventory` → debe mostrar 12 productos electrodomésticos
- `/picking` → waves `wv-1` (in_progress), `wv-2` (draft), `wv-3` (released)
- `/load-manifests` → manifesto `lm-ruta1` (dispatched), `lm-ruta2` (in_progress)
- `/commerce` → 6 órdenes con clientes Alkosto, Éxito Kennedy, Laura Méndez, etc.
- `/returns` → nevera `ret-1` en `under_validation` con inspección de reparación
- `/slotting` → nevera y estufa clasificadas A-X

- [ ] **Step 5: Commit final**

```bash
git add src/data/seed.ts
git commit -m "feat(seed): complete electrodomesticos demo data — validation clean"
```
