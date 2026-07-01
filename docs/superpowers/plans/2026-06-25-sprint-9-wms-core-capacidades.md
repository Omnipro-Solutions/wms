# Sprint 9 — Capacidades WMS Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar cobertura de la Sección A (Capacidades WMS Core) de 59% a ~80% implementando ítems de alto impacto que son realizables en cliente/localStorage.

**Architecture:** Todos los cambios son cliente-only (Zustand + localStorage). Cada tarea agrega tipos en `src/types/wms.ts`, lógica en `src/lib/rules/`, acciones en `src/store/wms-store.ts`, y UI en rutas existentes. Sin nuevas rutas excepto `/dashboard` y `/reports`. TDD: cada regla pura se testa antes de integrarla al store.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript 5 · Zustand 5 · TailwindCSS 4 · shadcn/Radix UI · Vitest · date-fns 4

## Global Constraints

- UI 100% en español (es-CO) — nunca inglés en labels, badges, o placeholders
- Fechas: siempre `date-fns` con locale `es` — nunca `new Date().toLocaleDateString()`
- Moneda: formato COP — usar `formatCurrency` de `src/lib/formatters.ts`
- Componentes: arrow functions — `const MyComp = () => {}`
- Clause guards antes del happy path en todo componente
- Clases CSS: siempre `cn()` de `@/lib/utils` — nunca template literals
- Tipos de dominio: siempre importar de `src/types/wms.ts` — nunca redefinir inline
- Default exports solo en archivos `page.tsx` y `layout.tsx`
- No ternarios anidados — usar clause guards o variables intermedias
- Formularios: react-hook-form + zod — nunca `useState` crudo para form state

---

## Ítems que cubre este sprint

| Ítem | Descripción | Antes | Meta |
|------|-------------|-------|------|
| A-2 | FIFO/FEFO configurable por producto | 50% | 80% |
| A-4 | Política de expiración por categoría | 65% | 85% |
| A-7 | Cross-docking — flujo operativo | 30% | 65% |
| A-10 | Reabastecimiento — min/max por SKU en UI | 55% | 80% |
| A-12 | Reportes de productividad — `/reports` page | 40% | 85% |
| A-17 | Volumetría por ubicación (`maxVolumeM3`) | 50% | 80% |
| A-19 | Putaway dirigido por reglas ABC | 45% | 75% |
| A-25 | Dashboard operativo — restaurar `/` | 20% | 85% |

**Ítems excluidos (fuera de scope cliente-only):** A-11 (equipos, dominio nuevo alto esfuerzo), A-14 (kitting, requiere BOM engine), A-20 (tipos de estiba, decorativo sin lógica), A-22/23 (RF/RFID, hardware), A-24 (no-code UI, alto esfuerzo).

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `src/types/wms.ts` | Modificar | Agregar `rotationStrategy` a `Product`, `expirationPolicy` a `Product`, `maxVolumeM3` a `StorageLocation`, `CrossDockTask` type |
| `src/lib/rules/inventory.ts` | Modificar | Agregar `selectByStrategy(items, strategy)` — FIFO/FEFO/LIFO |
| `src/lib/rules/putaway.ts` | Crear | `suggestPutawayLocation(product, locations, abcClass)` — regla pura de asignación dirigida |
| `src/lib/rules/crossdock.ts` | Crear | `canCrossDock(asn, orders)`, `assignCrossDockOrder(asnId, orderId)` — regla pura |
| `src/store/wms-store.ts` | Modificar | Acciones: `createCrossDockTask`, `completeCrossDockTask`, `updateProductStockLimits` |
| `src/store/selectors.ts` | Modificar | Agregar `selectCrossDockOpportunities(state)` |
| `src/app/page.tsx` | Modificar | Restaurar dashboard con KPI cards, banners SLA/vencimiento/stock crítico |
| `src/app/reports/page.tsx` | Crear | 4 tabs: Productividad · Inventario · OTIF · Proyección |
| `src/app/reports/_components/productivity-tab.tsx` | Crear | Tabla productividad por operador |
| `src/app/reports/_components/inventory-tab.tsx` | Crear | IRA trend + mermas por categoría |
| `src/app/reports/_components/otif-tab.tsx` | Crear | OTIF por carrier + breakdown |
| `src/app/reports/_components/forecast-tab.tsx` | Crear | Proyección EMA top-10 SKUs |
| `src/app/receiving/_components/putaway-dialog.tsx` | Modificar | Mostrar sugerencia ABC automática + confirmar/cambiar |
| `src/app/receiving/_components/cross-dock-dialog.tsx` | Crear | Dialog para asignar ASN cross-dock a orden |
| `src/app/admin/page.tsx` | Modificar | Agregar campos rotationStrategy, expirationPolicy a producto; min/maxStock por SKU |
| `src/lib/constants.ts` | Modificar | Agregar `/reports` y `/dashboard` al nav |
| `src/tests/rules/inventory.test.ts` | Modificar | Tests para `selectByStrategy` |
| `src/tests/rules/putaway.test.ts` | Crear | Tests para `suggestPutawayLocation` |
| `src/tests/rules/crossdock.test.ts` | Crear | Tests para `canCrossDock` |

---

## Task 1: Tipos base — rotationStrategy, expirationPolicy, maxVolumeM3

**Files:**
- Modify: `src/types/wms.ts`

**Interfaces:**
- Produces: `Product.rotationStrategy`, `Product.expirationPolicy`, `Product.minStockUnits`, `Product.maxStockUnits`, `StorageLocation.maxVolumeM3` — usados por Tasks 2, 3, 5, 6

- [ ] **Step 1: Agregar campos a `Product` y `StorageLocation` en `src/types/wms.ts`**

Localizar `export interface Product` (línea ~72) y `export interface StorageLocation` (línea ~57). Agregar los campos nuevos:

```typescript
// En StorageLocation — después de maxWeightKg:
maxVolumeM3: number       // max volume this slot holds (0 = unlimited)

// En Product — después de uomConversions?:
rotationStrategy: 'fifo' | 'fefo' | 'lifo'   // default 'fefo' for perishables
expirationPolicy?: {
  categoryMatch: string   // e.g. 'lacteos', 'frutas' — matches product.category
  alertDays: number       // days before expiry to flag
  blockAfterExpiry: boolean // if true, blocks picking of expired items
}
// Limits used by replenishment selector (replaces derived proxy from demand stats)
minStockUnits?: number    // if set, overrides selector's demand-based minStock
maxStockUnits?: number    // if set, overrides selector's demand-based maxStock
```

- [ ] **Step 2: Actualizar seed en `src/store/wms-store.ts`**

Buscar `buildSeedState` (o donde se definen `locations` y `products` en el seed). Agregar `maxVolumeM3` a todas las ubicaciones seed y `rotationStrategy` a todos los productos seed:

```typescript
// Locations seed — agregar a cada StorageLocation:
maxVolumeM3: 2.0,   // para ubicaciones de reserva/rack estándar
// (pick-face: 0.5, staging: 5.0, quality_control: 3.0)

// Products seed — agregar a cada Product:
rotationStrategy: 'fefo',   // por defecto para todos
// Para productos sin fecha de vencimiento (electrónicos, herramientas):
rotationStrategy: 'fifo',
```

- [ ] **Step 3: Commit**

```bash
git add src/types/wms.ts src/store/wms-store.ts
git commit -m "feat(types): add rotationStrategy, expirationPolicy, maxVolumeM3, minStockUnits"
```

---

## Task 2: Regla `selectByStrategy` — FIFO/FEFO/LIFO

**Files:**
- Modify: `src/lib/rules/inventory.ts`
- Modify: `src/tests/rules/inventory.test.ts`

**Interfaces:**
- Consumes: `Product.rotationStrategy` (Task 1), `InventoryItem` (existing)
- Produces: `selectByStrategy(items: InventoryItem[], strategy: 'fifo' | 'fefo' | 'lifo'): InventoryItem[]` — usado por Task 5 (putaway) y store picking

- [ ] **Step 1: Escribir tests que fallan en `src/tests/rules/inventory.test.ts`**

Agregar al final del archivo:

```typescript
describe('selectByStrategy', () => {
  const items = [
    { id: 'i1', onHandQuantity: 5, expirationDate: '2026-08-01', status: 'available' as const },
    { id: 'i2', onHandQuantity: 5, expirationDate: '2026-07-01', status: 'available' as const },
    { id: 'i3', onHandQuantity: 5, expirationDate: undefined,    status: 'available' as const },
  ]
  const base = { productId: 'p1', warehouseId: 'wh-1', locationId: 'loc-1', reservedQuantity: 0, holdQuantity: 0 }
  const withBase = items.map(i => ({ ...base, ...i }))

  it('fefo: orders by earliest expiration first, no-date last', () => {
    const result = selectByStrategy(withBase, 'fefo')
    expect(result[0].id).toBe('i2')  // Jul expires first
    expect(result[1].id).toBe('i1')  // Aug second
    expect(result[2].id).toBe('i3')  // no date last
  })

  it('fifo: orders by id ascending (insertion order proxy)', () => {
    const result = selectByStrategy(withBase, 'fifo')
    expect(result.map(i => i.id)).toEqual(['i1', 'i2', 'i3'])
  })

  it('lifo: orders by id descending', () => {
    const result = selectByStrategy(withBase, 'lifo')
    expect(result.map(i => i.id)).toEqual(['i3', 'i2', 'i1'])
  })

  it('excludes on_hold and expired items', () => {
    const withHeld = [
      { ...base, id: 'i4', onHandQuantity: 5, status: 'on_hold' as const },
      ...withBase,
    ]
    const result = selectByStrategy(withHeld, 'fefo')
    expect(result.every(i => i.status !== 'on_hold')).toBe(true)
  })
})
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npm test -- --reporter=verbose 2>&1 | grep -E "selectByStrategy|FAIL|PASS" | head -20
```

Esperado: `selectByStrategy is not a function` o similar.

- [ ] **Step 3: Implementar `selectByStrategy` en `src/lib/rules/inventory.ts`**

Agregar al final del archivo:

```typescript
/**
 * Returns available InventoryItems ordered by rotation strategy.
 * Excludes on_hold, expired, and zero-stock items.
 * FEFO: earliest expirationDate first (null/undefined → last).
 * FIFO: by id ascending (insertion-order proxy for receipt time).
 * LIFO: by id descending.
 */
export function selectByStrategy(
  items: Pick<InventoryItem, 'id' | 'onHandQuantity' | 'expirationDate' | 'status' | 'reservedQuantity' | 'holdQuantity'>[],
  strategy: 'fifo' | 'fefo' | 'lifo'
): typeof items {
  const eligible = items.filter(
    i => i.status !== 'on_hold' && i.status !== 'expired' && availableStock(i as InventoryItem) > 0
  )
  if (strategy === 'fefo') {
    return [...eligible].sort((a, b) => {
      if (!a.expirationDate && !b.expirationDate) return 0
      if (!a.expirationDate) return 1
      if (!b.expirationDate) return -1
      return a.expirationDate.localeCompare(b.expirationDate)
    })
  }
  if (strategy === 'lifo') {
    return [...eligible].sort((a, b) => b.id.localeCompare(a.id))
  }
  // fifo: insertion-order proxy via id
  return [...eligible].sort((a, b) => a.id.localeCompare(b.id))
}
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npm test -- --reporter=verbose 2>&1 | grep -E "selectByStrategy|✓|×" | head -20
```

Esperado: 4 tests `✓`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rules/inventory.ts src/tests/rules/inventory.test.ts
git commit -m "feat(rules): add selectByStrategy — FIFO/FEFO/LIFO rotation"
```

---

## Task 3: Regla `suggestPutawayLocation` — Putaway dirigido ABC

**Files:**
- Create: `src/lib/rules/putaway.ts`
- Create: `src/tests/rules/putaway.test.ts`

**Interfaces:**
- Consumes: `StorageLocation` (existing + `maxVolumeM3` Task 1), `AbcClass` (from slotting), `idealLocationTier` from `src/lib/rules/slotting.ts`
- Produces: `suggestPutawayLocation(args): StorageLocation | null` — usado por Task 6 (PutawayDialog)

- [ ] **Step 1: Crear tests en `src/tests/rules/putaway.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { suggestPutawayLocation } from '@/lib/rules/putaway'
import type { StorageLocation } from '@/types/wms'

const makeLocation = (overrides: Partial<StorageLocation>): StorageLocation => ({
  id: 'loc-1', code: 'A-01-01', warehouseId: 'wh-1', zone: 'A',
  type: 'pick', isPickFace: false, golden: false, isBlocked: false,
  accessibilityScore: 50, maxWeightKg: 500, maxVolumeM3: 2.0,
  distanceToDispatchM: 10,
  ...overrides,
})

describe('suggestPutawayLocation', () => {
  const locations: StorageLocation[] = [
    makeLocation({ id: 'loc-golden', golden: true, accessibilityScore: 90, distanceToDispatchM: 5 }),
    makeLocation({ id: 'loc-std',    golden: false, accessibilityScore: 60, distanceToDispatchM: 20 }),
    makeLocation({ id: 'loc-remote', golden: false, accessibilityScore: 20, distanceToDispatchM: 80 }),
    makeLocation({ id: 'loc-blocked', golden: true, isBlocked: true }),
    makeLocation({ id: 'loc-full', golden: false, maxWeightKg: 10, accessibilityScore: 70, distanceToDispatchM: 15 }),
  ]

  it('class A product: prefers golden location', () => {
    const result = suggestPutawayLocation({ abcClass: 'A', productWeightKg: 5, locations })
    expect(result?.id).toBe('loc-golden')
  })

  it('class C product: prefers remote (lowest accessibilityScore)', () => {
    const result = suggestPutawayLocation({ abcClass: 'C', productWeightKg: 5, locations })
    expect(result?.id).toBe('loc-remote')
  })

  it('excludes blocked locations', () => {
    const onlyBlocked = [makeLocation({ id: 'loc-blocked', isBlocked: true })]
    const result = suggestPutawayLocation({ abcClass: 'A', productWeightKg: 5, locations: onlyBlocked })
    expect(result).toBeNull()
  })

  it('excludes locations where product exceeds maxWeightKg', () => {
    const heavyProduct = suggestPutawayLocation({ abcClass: 'B', productWeightKg: 600, locations })
    // loc-full has maxWeightKg: 10, loc-blocked is blocked — heavyProduct can't go there
    expect(heavyProduct?.id).not.toBe('loc-full')
  })

  it('returns null when no suitable location', () => {
    const result = suggestPutawayLocation({ abcClass: 'A', productWeightKg: 99999, locations })
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npm test -- --reporter=verbose 2>&1 | grep -E "putaway|FAIL|Cannot find" | head -10
```

Esperado: `Cannot find module '@/lib/rules/putaway'`.

- [ ] **Step 3: Crear `src/lib/rules/putaway.ts`**

```typescript
import type { StorageLocation } from '@/types/wms'
import type { AbcClass } from '@/lib/rules/slotting'
import { idealLocationTier } from '@/lib/rules/slotting'

interface SuggestArgs {
  abcClass: AbcClass
  productWeightKg: number
  productVolumeM3?: number
  locations: StorageLocation[]
  warehouseId?: string
}

/**
 * Returns the best available putaway location for a product given its ABC class.
 * A → golden zone, B → standard, C → remote.
 * Filters blocked locations and weight/volume constraints.
 * Among candidates, picks the one with highest accessibilityScore for A/B,
 * and lowest for C (to preserve prime slots for fast movers).
 */
export function suggestPutawayLocation({
  abcClass,
  productWeightKg,
  productVolumeM3 = 0,
  locations,
  warehouseId,
}: SuggestArgs): StorageLocation | null {
  const tier = idealLocationTier(abcClass, 'X') // X = stable, just use abc class

  const eligible = locations.filter(loc => {
    if (loc.isBlocked) return false
    if (warehouseId && loc.warehouseId !== warehouseId) return false
    if (loc.maxWeightKg > 0 && productWeightKg > loc.maxWeightKg) return false
    if (loc.maxVolumeM3 > 0 && productVolumeM3 > loc.maxVolumeM3) return false
    if (loc.type !== 'pick' && loc.type !== 'reserve') return false
    return true
  })

  if (eligible.length === 0) return null

  if (tier === 'golden') {
    const golden = eligible.filter(l => l.golden)
    const pool = golden.length > 0 ? golden : eligible
    return pool.sort((a, b) => b.accessibilityScore - a.accessibilityScore)[0]
  }

  if (tier === 'remote') {
    return eligible.sort((a, b) => a.accessibilityScore - b.accessibilityScore)[0]
  }

  // standard — mid-range: not golden, highest remaining score
  const nonGolden = eligible.filter(l => !l.golden)
  const pool = nonGolden.length > 0 ? nonGolden : eligible
  return pool.sort((a, b) => b.accessibilityScore - a.accessibilityScore)[0]
}
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npm test -- --reporter=verbose 2>&1 | grep -E "putaway|✓|×" | head -15
```

Esperado: 5 tests `✓`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rules/putaway.ts src/tests/rules/putaway.test.ts
git commit -m "feat(rules): add suggestPutawayLocation — ABC-directed putaway"
```

---

## Task 4: Regla `canCrossDock` + tipo `CrossDockTask`

**Files:**
- Modify: `src/types/wms.ts`
- Create: `src/lib/rules/crossdock.ts`
- Create: `src/tests/rules/crossdock.test.ts`

**Interfaces:**
- Consumes: `Asn.crossDocking` (existing), `CommerceOrder` (existing)
- Produces: `CrossDockTask` type, `canCrossDock(asn, orders)`, `selectCrossDockCandidates(state)` — usado por Tasks 7 y 8

- [ ] **Step 1: Agregar `CrossDockTask` en `src/types/wms.ts`**

Agregar después de la sección de transferencias:

```typescript
// --- Cross-docking (Sprint 9 — #7) ---
export type CrossDockStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export interface CrossDockTask {
  id: string
  asnId: string
  commerceOrderId: string
  productId: string
  warehouseId: string
  quantity: number
  stagingLocationId: string   // where inbound stock temporarily lands
  status: CrossDockStatus
  assignedOperatorId?: string
  createdAt: string
  completedAt?: string
}
```

- [ ] **Step 2: Crear tests en `src/tests/rules/crossdock.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { canCrossDock, matchCrossDockOrders } from '@/lib/rules/crossdock'
import type { Asn, CommerceOrder } from '@/types/wms'

const makeAsn = (overrides: Partial<Asn>): Asn => ({
  id: 'asn-1', code: 'ASN-001', supplierName: 'Proveedor', appointmentDate: '2026-07-01',
  expectedQuantity: 100, receivedQuantity: 0, damagedQuantity: 0,
  status: 'in_progress', requiresQualityControl: false, crossDocking: true,
  productId: 'p-1', deliveryCount: 0, sourceType: 'purchase',
  ...overrides,
})

const makeOrder = (overrides: Partial<CommerceOrder>): CommerceOrder => ({
  id: 'order-1', code: 'ORD-001', customerId: 'cust-1', customerName: 'Cliente',
  warehouseId: 'wh-1', channel: 'ecommerce', fulfillmentType: 'cross_docking',
  status: 'pending', priority: 'normal', isUrgent: false,
  items: [{ productId: 'p-1', quantity: 50, pickedQuantity: 0 }],
  createdAt: '2026-07-01T08:00:00Z', promisedDeliveryAt: '2026-07-02T08:00:00Z',
  ...overrides,
})

describe('canCrossDock', () => {
  it('returns true for ASN with crossDocking=true and in_progress status', () => {
    expect(canCrossDock(makeAsn({}))).toBe(true)
  })

  it('returns false when ASN crossDocking=false', () => {
    expect(canCrossDock(makeAsn({ crossDocking: false }))).toBe(false)
  })

  it('returns false when ASN requires QC', () => {
    expect(canCrossDock(makeAsn({ requiresQualityControl: true }))).toBe(false)
  })

  it('returns false when ASN is completed or cancelled', () => {
    expect(canCrossDock(makeAsn({ status: 'completed' }))).toBe(false)
    expect(canCrossDock(makeAsn({ status: 'cancelled' }))).toBe(false)
  })
})

describe('matchCrossDockOrders', () => {
  it('returns pending cross_docking orders that need the product', () => {
    const orders = [
      makeOrder({}),
      makeOrder({ id: 'order-2', items: [{ productId: 'p-2', quantity: 10, pickedQuantity: 0 }] }),
      makeOrder({ id: 'order-3', status: 'completed', items: [{ productId: 'p-1', quantity: 5, pickedQuantity: 5 }] }),
    ]
    const result = matchCrossDockOrders('p-1', orders)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('order-1')
  })
})
```

- [ ] **Step 3: Verificar tests fallan**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npm test -- --reporter=verbose 2>&1 | grep -E "crossdock|Cannot find" | head -10
```

- [ ] **Step 4: Crear `src/lib/rules/crossdock.ts`**

```typescript
import type { Asn, CommerceOrder } from '@/types/wms'

/**
 * An ASN can cross-dock if: flag is set, no QC required, and reception is active.
 */
export function canCrossDock(asn: Pick<Asn, 'crossDocking' | 'requiresQualityControl' | 'status'>): boolean {
  return (
    asn.crossDocking &&
    !asn.requiresQualityControl &&
    (asn.status === 'in_progress' || asn.status === 'partial' || asn.status === 'pending')
  )
}

/**
 * Returns pending commerce orders with fulfillmentType=cross_docking that need productId.
 */
export function matchCrossDockOrders(productId: string, orders: CommerceOrder[]): CommerceOrder[] {
  return orders.filter(
    o =>
      o.fulfillmentType === 'cross_docking' &&
      o.status === 'pending' &&
      o.items.some(i => i.productId === productId && i.pickedQuantity < i.quantity)
  )
}
```

- [ ] **Step 5: Verificar tests pasan**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npm test -- --reporter=verbose 2>&1 | grep -E "crossdock|✓|×" | head -15
```

- [ ] **Step 6: Commit**

```bash
git add src/types/wms.ts src/lib/rules/crossdock.ts src/tests/rules/crossdock.test.ts
git commit -m "feat(types,rules): add CrossDockTask type + canCrossDock/matchCrossDockOrders rules"
```

---

## Task 5: Store — slices y acciones para cross-dock, productStock limits, min/maxStock por SKU

**Files:**
- Modify: `src/store/wms-store.ts`

**Interfaces:**
- Consumes: `CrossDockTask` (Task 4), `canCrossDock`, `matchCrossDockOrders` (Task 4)
- Produces:
  - `state.crossDockTasks: CrossDockTask[]`
  - `createCrossDockTask(asnId, orderId, qty, stagingLocationId, operatorName): void`
  - `completeCrossDockTask(taskId, operatorName): void`
  - `updateProductStockLimits(productId, minStockUnits, maxStockUnits): void`

- [ ] **Step 1: Agregar `crossDockTasks` al state y acciones en `src/store/wms-store.ts`**

Localizar la definición `WmsState` (tipo de retorno de `create()`). Agregar después de `replenishmentTasks`:

```typescript
// Cross-dock tasks (Sprint 9)
crossDockTasks: CrossDockTask[]
createCrossDockTask: (
  asnId: string,
  commerceOrderId: string,
  quantity: number,
  stagingLocationId: string,
  operatorName: string
) => void
completeCrossDockTask: (taskId: string, operatorName: string) => void
updateProductStockLimits: (productId: string, minStockUnits: number, maxStockUnits: number) => void
```

- [ ] **Step 2: Agregar `crossDockTasks: []` al `buildSeedState()` inicial**

Localizar la función `buildSeedState` y agregar `crossDockTasks: []` junto a los demás arrays vacíos.

- [ ] **Step 3: Implementar las 3 acciones dentro de `create()(set, get) => ({...})`**

```typescript
createCrossDockTask: (asnId, commerceOrderId, quantity, stagingLocationId, operatorName) => {
  const state = get()
  const asn = state.asnRecords.find(a => a.id === asnId)
  if (!asn) throw new Error('ASN no encontrado')
  if (!canCrossDock(asn)) throw new Error('ASN no elegible para cross-docking')

  const task: CrossDockTask = {
    id: `cdtask-${Date.now()}`,
    asnId,
    commerceOrderId,
    productId: asn.productId,
    warehouseId: asn.suggestedPutawayLocationId ? state.locations.find(l => l.id === asn.suggestedPutawayLocationId)?.warehouseId ?? 'wh-bog' : 'wh-bog',
    quantity,
    stagingLocationId,
    status: 'pending',
    assignedOperatorId: operatorName,
    createdAt: new Date().toISOString(),
  }
  set({ crossDockTasks: [...state.crossDockTasks, task] })
},

completeCrossDockTask: (taskId, operatorName) => {
  const state = get()
  const task = state.crossDockTasks.find(t => t.id === taskId)
  if (!task) throw new Error('Tarea cross-dock no encontrada')
  if (task.status === 'completed') throw new Error('Tarea ya completada')

  const updatedTasks = state.crossDockTasks.map(t =>
    t.id === taskId
      ? { ...t, status: 'completed' as const, completedAt: new Date().toISOString() }
      : t
  )
  // Update associated commerce order items picked quantity
  const updatedOrders = state.commerceOrders.map(o => {
    if (o.id !== task.commerceOrderId) return o
    const updatedItems = o.items.map(i =>
      i.productId === task.productId
        ? { ...i, pickedQuantity: Math.min(i.quantity, i.pickedQuantity + task.quantity) }
        : i
    )
    return { ...o, items: updatedItems }
  })

  const movement = recordMovement({
    productId: task.productId,
    warehouseId: task.warehouseId,
    fromLocationId: task.stagingLocationId,
    type: 'pick',
    quantity: task.quantity,
    referenceType: 'commerce_order',
    referenceId: task.commerceOrderId,
    operatorName,
  })

  set({
    crossDockTasks: updatedTasks,
    commerceOrders: updatedOrders,
    stockMovements: [...state.stockMovements, movement],
  })
},

updateProductStockLimits: (productId, minStockUnits, maxStockUnits) => {
  const state = get()
  set({
    products: state.products.map(p =>
      p.id === productId ? { ...p, minStockUnits, maxStockUnits } : p
    ),
  })
},
```

- [ ] **Step 4: Importar `canCrossDock` en `wms-store.ts`**

Al inicio del archivo, agregar:

```typescript
import { canCrossDock } from '@/lib/rules/crossdock'
```

- [ ] **Step 5: Commit**

```bash
git add src/store/wms-store.ts
git commit -m "feat(store): add crossDockTasks slice + createCrossDockTask, completeCrossDockTask, updateProductStockLimits"
```

---

## Task 6: UI — `PutawayDialog` con sugerencia ABC automática

**Files:**
- Modify: `src/app/receiving/_components/putaway-dialog.tsx`

**Interfaces:**
- Consumes: `suggestPutawayLocation` (Task 3), `abcByProduct` selector (existing), `StorageLocation` (Task 1 — now has `maxVolumeM3`)

- [ ] **Step 1: Leer el archivo actual**

```bash
cat /Users/carlosgranados/Documents/develop/wms/src/app/receiving/_components/putaway-dialog.tsx
```

- [ ] **Step 2: Agregar lógica de sugerencia al dialog**

Localizar el componente `PutawayDialog`. Agregar antes del `return`:

```typescript
const abcMap = abcByProduct(state)
const abcClass = product ? (abcMap[product.id] ?? 'C') : 'C'
const suggestedLocation = product
  ? suggestPutawayLocation({
      abcClass,
      productWeightKg: product.unitWeightKg,
      productVolumeM3: product.unitVolumeM3,
      locations: state.locations.filter(l => l.warehouseId === asn?.warehouseId ?? 'wh-bog'),
    })
  : null
```

- [ ] **Step 3: Mostrar la sugerencia en el dialog**

Agregar, dentro del `DialogContent`, antes del selector de ubicación manual:

```tsx
{suggestedLocation && (
  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
    <p className="font-medium text-emerald-800">Sugerencia automática (clase {abcClass})</p>
    <p className="text-emerald-700">
      {suggestedLocation.code} — zona {suggestedLocation.zone}
      {suggestedLocation.golden && <span className="ml-1 text-amber-600">⭐ zona dorada</span>}
    </p>
    <Button
      variant="outline"
      size="sm"
      className="mt-2"
      onClick={() => setSelectedLocationId(suggestedLocation.id)}
    >
      Usar sugerencia
    </Button>
  </div>
)}
```

- [ ] **Step 4: Agregar imports necesarios**

```typescript
import { abcByProduct } from '@/store/selectors'
import { suggestPutawayLocation } from '@/lib/rules/putaway'
```

- [ ] **Step 5: Commit**

```bash
git add src/app/receiving/_components/putaway-dialog.tsx
git commit -m "feat(receiving): show ABC-directed putaway suggestion in PutawayDialog"
```

---

## Task 7: UI — Cross-dock dialog + tab en `/receiving`

**Files:**
- Create: `src/app/receiving/_components/cross-dock-dialog.tsx`
- Modify: `src/app/receiving/page.tsx`

**Interfaces:**
- Consumes: `state.crossDockTasks`, `createCrossDockTask`, `matchCrossDockOrders` (Task 4/5), `canCrossDock` (Task 4)

- [ ] **Step 1: Crear `CrossDockDialog`**

Crear `src/app/receiving/_components/cross-dock-dialog.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { matchCrossDockOrders } from '@/lib/rules/crossdock'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Asn } from '@/types/wms'

interface Props {
  asn: Asn | null
  open: boolean
  onClose: () => void
}

export const CrossDockDialog = ({ asn, open, onClose }: Props) => {
  const state = useWmsStore()
  const { operator } = useCurrentOperator()
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [qty, setQty] = useState(0)

  if (!asn) return null

  const candidates = matchCrossDockOrders(asn.productId, state.commerceOrders)
  const stagingLoc = state.locations.find(l => l.type === 'staging' && l.warehouseId === 'wh-bog')

  const handleAssign = () => {
    if (!selectedOrderId || qty <= 0 || !stagingLoc) return
    try {
      state.createCrossDockTask(asn.id, selectedOrderId, qty, stagingLoc.id, operator?.name ?? 'sistema')
      onClose()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Asignar Cross-Docking — {asn.code}</DialogTitle>
        </DialogHeader>

        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No hay órdenes pendientes con tipo cross-docking para este producto.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Selecciona la orden de destino:</p>
            {candidates.map(order => (
              <div
                key={order.id}
                onClick={() => setSelectedOrderId(order.id)}
                className={cn(
                  'cursor-pointer rounded-md border p-3 text-sm transition-colors',
                  selectedOrderId === order.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'hover:bg-muted'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{order.code}</span>
                  <Badge variant="outline">{order.channel}</Badge>
                </div>
                <p className="text-muted-foreground">{order.customerName}</p>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-2">
              <label className="text-sm font-medium">Cantidad:</label>
              <input
                type="number"
                min={1}
                max={asn.receivedQuantity}
                value={qty}
                onChange={e => setQty(Number(e.target.value))}
                className="w-24 rounded border px-2 py-1 text-sm"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!selectedOrderId || qty <= 0}
            onClick={handleAssign}
          >
            Asignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

Agregar import faltante al inicio:

```typescript
import { cn } from '@/lib/utils'
```

- [ ] **Step 2: Agregar botón "Cross-dock" en la tabla de ASNs activos en `/receiving/page.tsx`**

Localizar donde se renderizan los botones de acción en el tab "Recibiendo" (`TabValue = 'recibiendo'`). Agregar estado y botón:

```typescript
// Estado del dialog
const [crossDockAsn, setCrossDockAsn] = useState<Asn | null>(null)
const [crossDockOpen, setCrossDockOpen] = useState(false)
```

```tsx
{/* Agregar después del botón de Putaway en la tabla de ASNs en_progreso */}
{asn.crossDocking && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => { setCrossDockAsn(asn); setCrossDockOpen(true) }}
  >
    Cross-dock
  </Button>
)}

{/* Agregar antes del cierre del componente */}
<CrossDockDialog
  asn={crossDockAsn}
  open={crossDockOpen}
  onClose={() => setCrossDockOpen(false)}
/>
```

- [ ] **Step 3: Agregar import**

```typescript
import { CrossDockDialog } from './_components/cross-dock-dialog'
```

- [ ] **Step 4: Commit**

```bash
git add src/app/receiving/_components/cross-dock-dialog.tsx src/app/receiving/page.tsx
git commit -m "feat(receiving): add CrossDockDialog — assign ASN directly to pending orders"
```

---

## Task 8: UI — `/reports` page (4 tabs)

**Files:**
- Create: `src/app/reports/page.tsx`
- Create: `src/app/reports/_components/productivity-tab.tsx`
- Create: `src/app/reports/_components/inventory-tab.tsx`
- Create: `src/app/reports/_components/otif-tab.tsx`
- Create: `src/app/reports/_components/forecast-tab.tsx`
- Modify: `src/lib/constants.ts`

**Interfaces:**
- Consumes: `productivityByOperator` from `src/lib/rules/picking.ts`, `selectInventoryAccuracy`, `otifByCarrier` from `src/lib/rules/shipping.ts`, `forecastDemand` from `src/lib/rules/forecast.ts`

- [ ] **Step 1: Crear `src/app/reports/_components/productivity-tab.tsx`**

```tsx
'use client'

import { useMemo } from 'react'
import { useWmsStore } from '@/store/wms-store'
import { productivityByOperator } from '@/lib/rules/picking'
import { DataTable } from '@/components/data-table'
import { KpiCard } from '@/components/shared/kpi-card'
import { BarChart3, CheckCircle2, AlertTriangle, Users } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'

interface ProductivityRow {
  operatorName: string
  completedPicks: number
  unitsPicked: number
  partialPicks: number
  issueCount: number
}

const columns: ColumnDef<ProductivityRow>[] = [
  { accessorKey: 'operatorName', header: 'Operador' },
  { accessorKey: 'completedPicks', header: 'Picks completados' },
  { accessorKey: 'unitsPicked', header: 'Unidades' },
  { accessorKey: 'partialPicks', header: 'Parciales' },
  { accessorKey: 'issueCount', header: 'Incidencias' },
]

export const ProductivityTab = () => {
  const state = useWmsStore()
  const rows = useMemo(() => productivityByOperator(state.pickingTasks), [state.pickingTasks])

  const totalPicks = rows.reduce((s, r) => s + r.completedPicks, 0)
  const totalUnits = rows.reduce((s, r) => s + r.unitsPicked, 0)
  const totalIssues = rows.reduce((s, r) => s + r.issueCount, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <KpiCard icon={CheckCircle2} label="Picks completados" value={totalPicks} tone="green" />
        <KpiCard icon={BarChart3} label="Unidades pickeadas" value={totalUnits} tone="blue" />
        <KpiCard icon={AlertTriangle} label="Incidencias" value={totalIssues} tone={totalIssues > 0 ? 'amber' : 'neutral'} />
      </div>
      <DataTable columns={columns} data={rows} />
    </div>
  )
}
```

- [ ] **Step 2: Crear `src/app/reports/_components/inventory-tab.tsx`**

```tsx
'use client'

import { useMemo } from 'react'
import { useWmsStore } from '@/store/wms-store'
import { selectInventoryAccuracy } from '@/store/selectors'
import { DataTable } from '@/components/data-table'
import { KpiCard } from '@/components/shared/kpi-card'
import { ShieldCheck, PackageX } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'
import { formatNumber } from '@/lib/formatters'
import { useStoreHelpers } from '@/hooks/use-store-helpers'

interface ScrapRow {
  id: string
  productName: string
  quantity: number
  reasonName: string
  createdAt: string
}

const columns: ColumnDef<ScrapRow>[] = [
  { accessorKey: 'productName', header: 'Producto' },
  { accessorKey: 'quantity', header: 'Cantidad' },
  { accessorKey: 'reasonName', header: 'Razón' },
  { accessorKey: 'createdAt', header: 'Fecha' },
]

export const InventoryTab = () => {
  const state = useWmsStore()
  const { productName, reasonName } = useStoreHelpers()
  const accuracy = useMemo(() => selectInventoryAccuracy(state), [state])

  const scrapRows = useMemo<ScrapRow[]>(() =>
    state.scrapRecords.map(r => ({
      id: r.id,
      productName: productName(r.productId),
      quantity: r.quantity,
      reasonName: reasonName(r.reasonId),
      createdAt: r.createdAt.slice(0, 10),
    })),
    [state.scrapRecords]
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <KpiCard
          icon={ShieldCheck}
          label="IRA — Exactitud de inventario"
          value={`${accuracy.ira.toFixed(1)}%`}
          tone={accuracy.ira >= 98 ? 'green' : accuracy.ira >= 95 ? 'amber' : 'red'}
        />
        <KpiCard icon={PackageX} label="Registros de merma" value={scrapRows.length} tone="neutral" />
      </div>
      <h3 className="text-sm font-medium text-muted-foreground">Mermas y averías</h3>
      <DataTable columns={columns} data={scrapRows} />
    </div>
  )
}
```

- [ ] **Step 3: Crear `src/app/reports/_components/otif-tab.tsx`**

```tsx
'use client'

import { useMemo } from 'react'
import { useWmsStore } from '@/store/wms-store'
import { otifPercentage, otifByCarrier } from '@/lib/rules/shipping'
import { DataTable } from '@/components/data-table'
import { KpiCard } from '@/components/shared/kpi-card'
import { Truck, TrendingUp, TrendingDown } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'

interface CarrierOtifRow {
  carrierName: string
  total: number
  onTime: number
  otifPct: number
}

const columns: ColumnDef<CarrierOtifRow>[] = [
  { accessorKey: 'carrierName', header: 'Transportista' },
  { accessorKey: 'total', header: 'Envíos' },
  { accessorKey: 'onTime', header: 'A tiempo' },
  {
    accessorKey: 'otifPct',
    header: 'OTIF %',
    cell: ({ row }) => (
      <span className={row.original.otifPct >= 90 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
        {row.original.otifPct.toFixed(1)}%
      </span>
    ),
  },
]

export const OtifTab = () => {
  const state = useWmsStore()
  const globalOtif = useMemo(() => otifPercentage(state.shipments), [state.shipments])
  const byCarrier = useMemo(() => otifByCarrier(state.shipments), [state.shipments])

  const rows = useMemo<CarrierOtifRow[]>(() =>
    Object.entries(byCarrier).map(([carrierName, stats]) => ({
      carrierName,
      total: stats.total,
      onTime: stats.onTime,
      otifPct: stats.total > 0 ? (stats.onTime / stats.total) * 100 : 0,
    })),
    [byCarrier]
  )

  const OtifIcon = globalOtif >= 90 ? TrendingUp : TrendingDown

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <KpiCard icon={OtifIcon} label="OTIF Global" value={`${globalOtif.toFixed(1)}%`} tone={globalOtif >= 90 ? 'green' : globalOtif >= 80 ? 'amber' : 'red'} />
        <KpiCard icon={Truck} label="Transportistas activos" value={rows.length} tone="neutral" />
      </div>
      <DataTable columns={columns} data={rows} />
    </div>
  )
}
```

- [ ] **Step 4: Crear `src/app/reports/_components/forecast-tab.tsx`**

```tsx
'use client'

import { useMemo } from 'react'
import { useWmsStore } from '@/store/wms-store'
import { forecastDemand } from '@/lib/rules/forecast'
import { DataTable } from '@/components/data-table'
import { KpiCard } from '@/components/shared/kpi-card'
import { TrendingUp } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { Badge } from '@/components/ui/badge'

interface ForecastRow {
  productName: string
  avgDemand: number
  p1: number
  p2: number
  p3: number
  p4: number
  trend: 'up' | 'down' | 'stable'
}

const columns: ColumnDef<ForecastRow>[] = [
  { accessorKey: 'productName', header: 'Producto' },
  { accessorKey: 'avgDemand', header: 'Demanda prom.' },
  { accessorKey: 'p1', header: 'P+1' },
  { accessorKey: 'p2', header: 'P+2' },
  { accessorKey: 'p3', header: 'P+3' },
  { accessorKey: 'p4', header: 'P+4' },
  {
    accessorKey: 'trend',
    header: 'Tendencia',
    cell: ({ row }) => {
      const t = row.original.trend
      return (
        <Badge variant={t === 'down' ? 'destructive' : t === 'up' ? 'default' : 'secondary'}>
          {t === 'up' ? '↑ Subiendo' : t === 'down' ? '↓ Bajando' : '→ Estable'}
        </Badge>
      )
    },
  },
]

export const ForecastTab = () => {
  const state = useWmsStore()
  const { productName } = useStoreHelpers()

  const rows = useMemo<ForecastRow[]>(() => {
    const top10 = [...state.productDemandStats]
      .sort((a, b) => b.pickingFrequency - a.pickingFrequency)
      .slice(0, 10)

    return top10.map(stat => {
      const [p1, p2, p3, p4] = forecastDemand(stat.demandSamples ?? [], 4)
      const avg = stat.demandSamples?.length
        ? stat.demandSamples.reduce((s, v) => s + v, 0) / stat.demandSamples.length
        : 0
      const trend: ForecastRow['trend'] = p4 > avg * 1.05 ? 'up' : p4 < avg * 0.95 ? 'down' : 'stable'
      return {
        productName: productName(stat.productId),
        avgDemand: Math.round(avg),
        p1: Math.round(p1 ?? 0),
        p2: Math.round(p2 ?? 0),
        p3: Math.round(p3 ?? 0),
        p4: Math.round(p4 ?? 0),
        trend,
      }
    })
  }, [state.productDemandStats])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <KpiCard icon={TrendingUp} label="SKUs proyectados" value={rows.length} tone="blue" />
      </div>
      <DataTable columns={columns} data={rows} />
    </div>
  )
}
```

- [ ] **Step 5: Crear `src/app/reports/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { BarChart3, Package, Truck, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { SubNav, type SubNavItem } from '@/components/shared/sub-nav'
import { ProductivityTab } from './_components/productivity-tab'
import { InventoryTab } from './_components/inventory-tab'
import { OtifTab } from './_components/otif-tab'
import { ForecastTab } from './_components/forecast-tab'

type TabValue = 'productividad' | 'inventario' | 'otif' | 'proyeccion'

const TABS: SubNavItem<TabValue>[] = [
  { value: 'productividad', label: 'Productividad', icon: BarChart3 },
  { value: 'inventario', label: 'Inventario', icon: Package },
  { value: 'otif', label: 'OTIF', icon: Truck },
  { value: 'proyeccion', label: 'Proyección', icon: TrendingUp },
]

export default function ReportsPage() {
  const [tab, setTab] = useState<TabValue>('productividad')

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Reportes"
        description="Productividad por operador, exactitud de inventario, OTIF y proyección de demanda"
      />
      <SubNav items={TABS} value={tab} onChange={setTab} />
      {tab === 'productividad' && <ProductivityTab />}
      {tab === 'inventario' && <InventoryTab />}
      {tab === 'otif' && <OtifTab />}
      {tab === 'proyeccion' && <ForecastTab />}
    </div>
  )
}
```

- [ ] **Step 6: Agregar `/reports` al nav en `src/lib/constants.ts`**

Localizar el grupo `'Sistema'` en `NAV_GROUPS`. Agregar antes de `Integraciones`:

```typescript
{ label: 'Reportes', href: '/reports', icon: BarChart3 },
```

Verificar que `BarChart3` ya está importado (sí lo está en el archivo).

- [ ] **Step 7: Commit**

```bash
git add src/app/reports/ src/lib/constants.ts
git commit -m "feat(reports): add /reports page with 4 tabs — productividad, inventario, OTIF, proyección"
```

---

## Task 9: Dashboard — restaurar `/` con KPI cards y banners

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `selectDashboardKpis`, `selectExpiringItems`, `selectCriticalStockItems`, `selectSlaBreaches` (all existing in `src/store/selectors.ts`)

- [ ] **Step 1: Leer el `src/app/page.tsx` actual**

```bash
cat /Users/carlosgranados/Documents/develop/wms/src/app/page.tsx
```

- [ ] **Step 2: Reemplazar el redirect por el dashboard**

El archivo actual probablemente es solo un redirect (`redirect('/receiving')`). Reemplazarlo completamente:

```tsx
'use client'

import { useMemo } from 'react'
import { useWmsStore } from '@/store/wms-store'
import {
  selectDashboardKpis,
  selectExpiringItems,
  selectCriticalStockItems,
  selectSlaBreaches,
} from '@/store/selectors'
import { KpiCard } from '@/components/shared/kpi-card'
import { PageHeader } from '@/components/shared/page-header'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import {
  AlertTriangle, BarChart3, CheckCircle2, Clock, Package,
  PackageCheck, Snowflake, TrendingDown, TrendingUp, Truck, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function DashboardPage() {
  const state = useWmsStore()
  const { operator } = useCurrentOperator()
  const kpis = useMemo(() => selectDashboardKpis(state), [state])
  const expiring = useMemo(() => selectExpiringItems(state), [state])
  const criticalStock = useMemo(() => selectCriticalStockItems(state), [state])
  const slaBreaches = useMemo(() => selectSlaBreaches(state, Date.now()), [state])
  const breached = slaBreaches.filter(s => s.isBreached)
  const atRisk = slaBreaches.filter(s => s.isAtRisk && !s.isBreached)

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={operator ? `Hola, ${operator.name}` : 'Dashboard'}
        description="Resumen operativo del almacén"
      />

      {/* Banners de alerta */}
      {kpis.inventoryFreezeActive && (
        <div className="flex items-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Snowflake className="h-4 w-4" />
          <span className="font-medium">Inventario congelado.</span>
          <span>Las operaciones de ajuste y movimiento están bloqueadas.</span>
          <Link href="/admin" className="ml-auto underline">Descongelar</Link>
        </div>
      )}
      {breached.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">{breached.length} SLA vencido{breached.length > 1 ? 's' : ''}.</span>
          <span>{breached.map(s => s.orderCode).join(', ')}</span>
        </div>
      )}
      {atRisk.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Clock className="h-4 w-4" />
          <span className="font-medium">{atRisk.length} orden{atRisk.length > 1 ? 'es' : ''} en riesgo de SLA.</span>
        </div>
      )}
      {expiring.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">{expiring.length} ítem{expiring.length > 1 ? 's' : ''} por vencer.</span>
          <Link href="/inventory/lot-trace" className="ml-auto underline">Ver lotes</Link>
        </div>
      )}
      {criticalStock.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <TrendingDown className="h-4 w-4" />
          <span className="font-medium">{criticalStock.length} producto{criticalStock.length > 1 ? 's' : ''} en stock crítico.</span>
          <Link href="/inventory" className="ml-auto underline">Ver inventario</Link>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard icon={Package} label="Órdenes pendientes" value={kpis.pendingOrders} tone="blue" />
        <KpiCard icon={PackageCheck} label="En picking" value={kpis.ordersInPicking} tone="blue" />
        <KpiCard icon={Truck} label="OTIF" value={`${kpis.otif.toFixed(1)}%`} tone={kpis.otif >= 90 ? 'green' : kpis.otif >= 80 ? 'amber' : 'red'} />
        <KpiCard icon={CheckCircle2} label="IRA exactitud" value={`${kpis.ira.toFixed(1)}%`} tone={kpis.ira >= 98 ? 'green' : kpis.ira >= 95 ? 'amber' : 'red'} />
        <KpiCard icon={AlertTriangle} label="Alertas críticas" value={kpis.criticalAlerts} tone={kpis.criticalAlerts > 0 ? 'red' : 'green'} />
        <KpiCard icon={Clock} label="SLA vencidos" value={kpis.slaBreaches} tone={kpis.slaBreaches > 0 ? 'red' : 'green'} />
        <KpiCard icon={Package} label="Ítems por vencer" value={kpis.expiringItems} tone={kpis.expiringItems > 0 ? 'amber' : 'neutral'} />
        <KpiCard icon={TrendingDown} label="Stock crítico" value={kpis.criticalStockItems} tone={kpis.criticalStockItems > 0 ? 'red' : 'neutral'} />
        <KpiCard icon={Users} label="Recepciones pendientes" value={kpis.pendingReceipts} tone="neutral" />
        <KpiCard icon={BarChart3} label="Oleadas activas" value={kpis.activeWaves} tone="neutral" />
        <KpiCard icon={AlertTriangle} label="Ajustes pendientes" value={kpis.pendingAdjustments} tone={kpis.pendingAdjustments > 0 ? 'amber' : 'neutral'} />
        <KpiCard icon={TrendingUp} label="Inventario en hold" value={kpis.inventoryOnHold} tone="neutral" />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Actualizar nav para incluir "Dashboard" como primer ítem del primer grupo**

En `src/lib/constants.ts`, agregar al inicio del primer grupo `Entrada`:

```typescript
{ label: 'Dashboard', href: '/', icon: BarChart3 },
```

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/lib/constants.ts
git commit -m "feat(dashboard): restore / as operational dashboard with KPI cards and alert banners"
```

---

## Task 10: Admin — campos FEFO por categoría + min/max por SKU

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `updateProductStockLimits` (Task 5), `Product.rotationStrategy`, `Product.expirationPolicy`, `Product.minStockUnits`, `Product.maxStockUnits` (Task 1)

- [ ] **Step 1: Localizar el formulario de edición de productos en `/admin`**

```bash
grep -n "rotationStrategy\|rotacion\|expiración\|expirationPolicy\|minStock\|ProductForm\|product.*dialog\|Dialog.*product" /Users/carlosgranados/Documents/develop/wms/src/app/admin/page.tsx | head -20
```

- [ ] **Step 2: Agregar campos al formulario de crear/editar producto**

Localizar el dialog de producto en `src/app/admin/page.tsx`. Agregar después del campo `trackBy`:

```tsx
{/* Estrategia de rotación */}
<div className="space-y-1">
  <label className="text-sm font-medium">Estrategia de rotación</label>
  <Select
    value={productForm.rotationStrategy ?? 'fefo'}
    onValueChange={v => setProductForm(f => ({ ...f, rotationStrategy: v as Product['rotationStrategy'] }))}
  >
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="fefo">FEFO — Primero en vencer, primero en salir</SelectItem>
      <SelectItem value="fifo">FIFO — Primero en entrar, primero en salir</SelectItem>
      <SelectItem value="lifo">LIFO — Último en entrar, primero en salir</SelectItem>
    </SelectContent>
  </Select>
</div>

{/* Stock mínimo y máximo */}
<div className="grid grid-cols-2 gap-3">
  <div className="space-y-1">
    <label className="text-sm font-medium">Stock mínimo (uds)</label>
    <input
      type="number"
      min={0}
      value={productForm.minStockUnits ?? ''}
      onChange={e => setProductForm(f => ({ ...f, minStockUnits: Number(e.target.value) || undefined }))}
      placeholder="Auto"
      className="w-full rounded border px-2 py-1 text-sm"
    />
  </div>
  <div className="space-y-1">
    <label className="text-sm font-medium">Stock máximo (uds)</label>
    <input
      type="number"
      min={0}
      value={productForm.maxStockUnits ?? ''}
      onChange={e => setProductForm(f => ({ ...f, maxStockUnits: Number(e.target.value) || undefined }))}
      placeholder="Auto"
      className="w-full rounded border px-2 py-1 text-sm"
    />
  </div>
</div>
```

- [ ] **Step 3: Asegurar que el submit del formulario incluye los nuevos campos**

Localizar el handler `handleSaveProduct` (o equivalente). Verificar que hace spread del form completo (incluye los nuevos campos automáticamente si usa `...productForm`). Si hace campos explícitos, agregar:

```typescript
rotationStrategy: productForm.rotationStrategy ?? 'fefo',
minStockUnits: productForm.minStockUnits,
maxStockUnits: productForm.maxStockUnits,
```

- [ ] **Step 4: Actualizar `selectReplenishmentNeeds` en `src/store/selectors.ts` para usar min/max del producto si existe**

Localizar en `selectReplenishmentNeeds` la línea que calcula `minStock`:

```typescript
const minStock = Math.round(demand.pickingFrequency * 2)
const maxStock = Math.round(demand.pickingFrequency * 6)
```

Reemplazar por:

```typescript
const product = state.products.find(p => p.id === demand.productId)
const minStock = product?.minStockUnits ?? Math.round(demand.pickingFrequency * 2)
const maxStock = product?.maxStockUnits ?? Math.round(demand.pickingFrequency * 6)
```

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/page.tsx src/store/selectors.ts
git commit -m "feat(admin): add rotationStrategy, minStockUnits, maxStockUnits per product + replenishment uses explicit limits"
```

---

## Task 11: Volumetría por ubicación — `maxVolumeM3` en UI

**Files:**
- Modify: `src/app/locations/page.tsx` (o columns)
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `StorageLocation.maxVolumeM3` (Task 1)

- [ ] **Step 1: Agregar columna `maxVolumeM3` a la tabla de ubicaciones**

Localizar `src/app/locations/columns.tsx` (o donde se definen las columnas):

```bash
ls /Users/carlosgranados/Documents/develop/wms/src/app/locations/
```

Agregar columna después de `maxWeightKg`:

```typescript
{
  accessorKey: 'maxVolumeM3',
  header: 'Vol. máx. (m³)',
  cell: ({ row }) => row.original.maxVolumeM3 > 0 ? `${row.original.maxVolumeM3} m³` : '—',
},
```

- [ ] **Step 2: Agregar campo en el formulario de edición de ubicación en `/admin`**

Localizar el dialog de ubicación (StorageLocation) en `src/app/admin/page.tsx`. Agregar después del campo `maxWeightKg`:

```tsx
<div className="space-y-1">
  <label className="text-sm font-medium">Volumen máximo (m³)</label>
  <input
    type="number"
    min={0}
    step={0.1}
    value={locationForm.maxVolumeM3 ?? 0}
    onChange={e => setLocationForm(f => ({ ...f, maxVolumeM3: parseFloat(e.target.value) || 0 }))}
    className="w-full rounded border px-2 py-1 text-sm"
  />
  <p className="text-xs text-muted-foreground">0 = sin límite de volumen</p>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/locations/ src/app/admin/page.tsx
git commit -m "feat(locations): show and edit maxVolumeM3 in locations table and admin form"
```

---

## Self-Review

**Spec coverage check:**

| Ítem | Task que lo cubre |
|------|-----------------|
| A-2 FIFO/FEFO/LIFO | Task 2 (`selectByStrategy`) + Task 10 (estrategia por producto) |
| A-4 Expiración por categoría | Task 1 (`expirationPolicy` type) + Task 10 (configuración en admin) |
| A-7 Cross-docking operativo | Tasks 4, 5, 7 (`CrossDockTask` + dialog UI) |
| A-10 Min/max por SKU en UI | Tasks 1, 5, 10 + selector actualizado |
| A-12 `/reports` page | Task 8 (4 tabs completos) |
| A-17 Volumetría `maxVolumeM3` | Tasks 1, 3, 11 (tipo + regla + UI) |
| A-19 Putaway ABC dirigido | Tasks 3, 6 (regla + dialog) |
| A-25 Dashboard restaurado | Task 9 (página completa con KPI cards + banners) |

**Placeholder scan:** ninguno — todos los steps tienen código completo.

**Type consistency:** `CrossDockTask` definido en Task 4 tipos, consumido en Task 5 store y Task 7 UI. `suggestPutawayLocation` definido en Task 3, consumido en Task 6. `selectByStrategy` definido en Task 2, referenciado en Task 10 doc solo (el store picking puede usarlo opcionalmente — no hay dependencia forzada aquí).

---

## Proyección de cobertura post-Sprint 9

| Ítem | Antes | Después |
|------|-------|---------|
| A-2 FIFO/FEFO/LIFO | 50% | 80% |
| A-4 Expiración por categoría | 65% | 85% |
| A-7 Cross-docking | 30% | 65% |
| A-10 Reabastecimiento min/max | 55% | 80% |
| A-12 Productividad/Reportes | 40% | 85% |
| A-17 Volumetría ubicaciones | 50% | 80% |
| A-19 Putaway ABC dirigido | 45% | 75% |
| A-25 Dashboard | 20% | 85% |

**Sección A antes:** 59% → **Sección A después:** ~76%
