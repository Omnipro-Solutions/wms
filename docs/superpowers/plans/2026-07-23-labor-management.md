# Labor Management (LMS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Labor Management module (#9 in `docs/funcionalidades_base_wms.md`) — a unified cross-module task queue with real operator assignment, interleaving suggestions, productivity dashboards, and a dedicated settings page — covering the 🟢 Base and 🔵 Estándar tiers only.

**Architecture:** A read-only projection layer (`src/lib/rules/labor.ts`) maps existing `PickingTask`, `ReplenishmentTask`, and `Asn` (putaway) records into a common `LaborQueueItem[]` view-model on every render — no new source-of-truth entity is created. Real assignment writes back to the existing per-domain store actions (`startPicking`, `startReplenishment`) plus one new action (`assignPutaway`) for the one domain that currently has no pre-assignment step. A new `/labor` page (SubNav pattern, 3 tabs) and `/labor-settings` page (settings pattern) consume this layer. Everything persists automatically through the existing Zustand + IndexedDB store — no new persistence mechanism.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Zustand 5 (with `persist`/`idbStorage`), TanStack React Table 8 via the shared `DataTable`, TailwindCSS 4, shadcn/ui, Vitest.

## Global Constraints

- Arrow functions everywhere (components, hooks, store actions, handlers) — never `function` declarations.
- Clause guards (early returns) before the happy-path render — loading/error/empty first.
- Named exports everywhere except `src/app/**/page.tsx` (default export required there).
- Import all domain types from `src/types/wms.ts` — never redefine inline.
- `cn()` from `@/lib/utils` for all conditional classes — never template-literal class strings.
- Store actions are arrow functions inside `create()`, validated via FSM/status checks before mutating, always via `set((state) => ...)` spreads (never direct mutation).
- Dates formatted with `date-fns` + `es` locale (only if a task needs date formatting — this plan does not add new date fields).
- Tables: shadcn `<Table>` (via `DataTable`) with clause guards for empty/loading/error before rendering rows.
- Any new `WmsSettings` field needs a matching default added to `src/data/seed.ts`'s `settings` object, or every page reading it breaks on first load.
- No new dependencies — everything required already exists in `package.json`.

---

## Task 1: `LaborQueueItem` type + `WmsSettings` fields + `Asn.assignedOperatorName`

**Files:**
- Modify: `src/types/wms.ts` (add `LaborQueueItem` type near `ProductivityRow` at line 1251; add fields to `Asn` interface at line 246-273; add fields to `WmsSettings` interface at line 1086-1176)
- Modify: `src/data/seed.ts` (add matching defaults to the `settings` object, line 3541-3600+)

**Interfaces:**
- Produces: `LaborQueueItem` type, extended `Asn.assignedOperatorName?: string`, six new `WmsSettings` fields (`laborFreezeActive`, `laborSlaHighPriorityHours`, `laborSlaMediumPriorityHours`, `laborInterleavingEnabled`, `laborInterleavingMaxDistanceM`, `laborTargetPicksPerHour`, `laborTargetUnitsPerHour`).

- [ ] **Step 1: Add `assignedOperatorName` to `Asn`**

In `src/types/wms.ts`, find the `Asn` interface (starts at line 246). Add the field right after `suggestedPutawayLocationId`:

```ts
export interface Asn {
  id: string
  code: string
  supplierName: string
  appointmentDate: string
  expectedQuantity: number
  receivedQuantity: number
  damagedQuantity: number
  status: OperationalStatus
  requiresQualityControl: boolean
  crossDocking: boolean
  productId: string
  suggestedPutawayLocationId?: string
  // Labor module (#9) — operator assigned to putaway before it's executed via putawayItem().
  // Display-only until putawayItem() runs; does not gate the action.
  assignedOperatorName?: string
  closeReason?: string
  deliveryCount: number
  purchaseOrderId?: string
  sourceType: 'purchase' | 'internal_transfer' | 'adjustment'
  receptionNotes?: string
  dockId?: string
  timeSlot?: string
  carrierConfirmed?: boolean
}
```

- [ ] **Step 2: Add `LaborQueueItem` type**

In `src/types/wms.ts`, find `ProductivityRow` (line 1251-1257). Add the new type directly above it:

```ts
// --- Labor Management domain (#9) — read-only projection, never persisted ---

export type LaborSourceType = 'picking' | 'putaway' | 'replenishment'

export interface LaborQueueItem {
  id: string // id of the source task/ASN
  sourceType: LaborSourceType
  code: string // human-visible reference: PickingTask.code, Asn.code, or ReplenishmentTask.id
  productId?: string
  locationId: string
  zone?: string
  priority: 'low' | 'medium' | 'high'
  status: string // raw status from the source record (renders fine via existing StatusBadge)
  operatorName?: string
  suggestedRouteId?: string // set when suggestInterleavedRoutes() groups this item with others
}
```

- [ ] **Step 3: Add `WmsSettings` fields**

In `src/types/wms.ts`, find the end of the `WmsSettings` interface (the `yardAllowOverbooking: boolean` line, currently line 1175, right before the closing `}` at line 1176). Add before the closing brace:

```ts
  // Labor module (#9) — task queue, productivity, interleaving. Configured in /labor-settings.
  // Congela asignación/reasignación de tareas desde /labor (no afecta acciones nativas de cada módulo).
  laborFreezeActive: boolean
  // Horas desde creación de la tarea fuente por encima de las cuales la cola la marca prioridad ALTA / MEDIA.
  laborSlaHighPriorityHours: number
  laborSlaMediumPriorityHours: number
  // Si está activo, la cola agrupa tareas de distinto tipo del mismo operario dentro de laborInterleavingMaxDistanceM.
  laborInterleavingEnabled: boolean
  laborInterleavingMaxDistanceM: number
  // Metas usadas solo para colorear KPIs en /labor (Productividad) — sin lógica de incentivos.
  laborTargetPicksPerHour: number
  laborTargetUnitsPerHour: number
```

- [ ] **Step 4: Add matching defaults to seed.ts**

In `src/data/seed.ts`, find the end of the `settings` object (after `yardAllowOverbooking: false,`, before the `slaConfigs: [` block, around line 3597). Add:

```ts
  // Labor module (#9)
  laborFreezeActive: false,
  laborSlaHighPriorityHours: 4,
  laborSlaMediumPriorityHours: 12,
  laborInterleavingEnabled: true,
  laborInterleavingMaxDistanceM: 20,
  laborTargetPicksPerHour: 40,
  laborTargetUnitsPerHour: 60,
```

- [ ] **Step 5: Verify the project still typechecks**

Run: `npx tsc --noEmit`
Expected: no new errors (existing errors, if any, are unrelated — confirm the count doesn't increase because of this change; if `tsc --noEmit` was already clean before this task, it must stay clean).

- [ ] **Step 6: Commit**

```bash
git add src/types/wms.ts src/data/seed.ts
git commit -m "feat(labor): add LaborQueueItem type, Asn.assignedOperatorName, and WmsSettings fields"
```

---

## Task 2: `buildLaborQueue` projection function

**Files:**
- Create: `src/lib/rules/labor.ts`
- Create: `src/lib/rules/labor.test.ts`

**Interfaces:**
- Consumes: `PickingTask` (`status`, `code`, `productId`, `locationId`, `zone`, `priority`, `operatorName`), `ReplenishmentTask` (`id`, `productId`, `destinationLocationId`, `priority`, `status`, `operatorName`), `Asn` (`id`, `code`, `productId`, `suggestedPutawayLocationId`, `status`, `assignedOperatorName`) — all from `src/types/wms.ts`.
- Produces: `buildLaborQueue(pickingTasks: PickingTask[], replenishmentTasks: ReplenishmentTask[], asns: Asn[]): LaborQueueItem[]` — consumed by Task 5 (page) and Task 4 (productivity).

- [ ] **Step 1: Write the failing test**

Create `src/lib/rules/labor.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildLaborQueue } from './labor'
import type { PickingTask, ReplenishmentTask, Asn } from '@/types/wms'

const pickingTask = (overrides: Partial<PickingTask> = {}): PickingTask => ({
  id: 'pt-1',
  code: 'PICK-001',
  orderId: 'order-1',
  productId: 'prod-1',
  locationId: 'loc-1',
  zone: 'A',
  requestedQuantity: 10,
  pickedQuantity: 0,
  pendingQuantity: 10,
  status: 'pending',
  priority: 'high',
  ...overrides,
})

const replenishmentTask = (overrides: Partial<ReplenishmentTask> = {}): ReplenishmentTask => ({
  id: 'rt-1',
  productId: 'prod-2',
  originLocationId: 'loc-reserve-1',
  destinationLocationId: 'loc-2',
  currentStock: 5,
  minStock: 10,
  maxStock: 40,
  suggestedQuantity: 20,
  priority: 'medium',
  status: 'pending',
  ...overrides,
})

const asn = (overrides: Partial<Asn> = {}): Asn => ({
  id: 'asn-1',
  code: 'ASN-001',
  supplierName: 'Proveedor X',
  appointmentDate: '2026-07-20T10:00:00.000Z',
  expectedQuantity: 100,
  receivedQuantity: 100,
  damagedQuantity: 0,
  status: 'completed',
  requiresQualityControl: false,
  crossDocking: false,
  productId: 'prod-3',
  deliveryCount: 1,
  sourceType: 'purchase',
  ...overrides,
})

describe('buildLaborQueue', () => {
  it('returns an empty array when there are no source tasks', () => {
    expect(buildLaborQueue([], [], [])).toEqual([])
  })

  it('maps a pending picking task to a queue item', () => {
    const result = buildLaborQueue([pickingTask()], [], [])
    expect(result).toEqual([
      {
        id: 'pt-1',
        sourceType: 'picking',
        code: 'PICK-001',
        productId: 'prod-1',
        locationId: 'loc-1',
        zone: 'A',
        priority: 'high',
        status: 'pending',
        operatorName: undefined,
      },
    ])
  })

  it('maps a pending replenishment task to a queue item using destinationLocationId', () => {
    const result = buildLaborQueue([], [replenishmentTask()], [])
    expect(result).toEqual([
      {
        id: 'rt-1',
        sourceType: 'replenishment',
        code: 'rt-1',
        productId: 'prod-2',
        locationId: 'loc-2',
        zone: undefined,
        priority: 'medium',
        status: 'pending',
        operatorName: undefined,
      },
    ])
  })

  it('maps a completed ASN (pending putaway) to a queue item using suggestedPutawayLocationId', () => {
    const result = buildLaborQueue([], [], [asn({ suggestedPutawayLocationId: 'loc-3' })])
    expect(result).toEqual([
      {
        id: 'asn-1',
        sourceType: 'putaway',
        code: 'ASN-001',
        productId: 'prod-3',
        locationId: 'loc-3',
        zone: undefined,
        priority: 'medium',
        status: 'completed',
        operatorName: undefined,
      },
    ])
  })

  it('excludes ASNs not yet ready for putaway (still in_progress) and already put away (putaway_done)', () => {
    const result = buildLaborQueue(
      [],
      [],
      [asn({ id: 'asn-2', status: 'in_progress' }), asn({ id: 'asn-3', status: 'putaway_done' })]
    )
    expect(result).toEqual([])
  })

  it('excludes completed picking tasks and completed replenishment tasks', () => {
    const result = buildLaborQueue(
      [pickingTask({ status: 'completed' })],
      [replenishmentTask({ status: 'completed' })],
      []
    )
    expect(result).toEqual([])
  })

  it('carries operatorName and assignedOperatorName through as operatorName', () => {
    const result = buildLaborQueue(
      [pickingTask({ operatorName: 'Juan' })],
      [],
      [asn({ assignedOperatorName: 'Ana', id: 'asn-4' })]
    )
    expect(result.find((i) => i.sourceType === 'picking')?.operatorName).toBe('Juan')
    expect(result.find((i) => i.sourceType === 'putaway')?.operatorName).toBe('Ana')
  })

  it('mixes all three source types into one array', () => {
    const result = buildLaborQueue([pickingTask()], [replenishmentTask()], [asn()])
    expect(result).toHaveLength(3)
    expect(result.map((i) => i.sourceType).sort()).toEqual(['picking', 'putaway', 'replenishment'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rules/labor.test.ts`
Expected: FAIL — `Cannot find module './labor'` (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/rules/labor.ts`:

```ts
import type { Asn, LaborQueueItem, PickingTask, ReplenishmentTask } from '@/types/wms'

const PICKING_ACTIVE_STATUSES: PickingTask['status'][] = [
  'pending',
  'assigned',
  'in_progress',
  'partially_picked',
  'partial_with_shortage',
  'with_issue',
]

const REPLENISHMENT_ACTIVE_STATUSES = ['pending', 'assigned', 'in_progress']

// An ASN is ready for putaway once receiving is done (`completed` / `short_received`)
// and hasn't been put away yet (`putaway_done` excluded).
const ASN_READY_FOR_PUTAWAY_STATUSES = ['completed', 'short_received']

export function buildLaborQueue(
  pickingTasks: PickingTask[],
  replenishmentTasks: ReplenishmentTask[],
  asns: Asn[]
): LaborQueueItem[] {
  const pickingItems: LaborQueueItem[] = pickingTasks
    .filter((t) => PICKING_ACTIVE_STATUSES.includes(t.status))
    .map((t) => ({
      id: t.id,
      sourceType: 'picking',
      code: t.code,
      productId: t.productId,
      locationId: t.locationId,
      zone: t.zone,
      priority: t.priority,
      status: t.status,
      operatorName: t.operatorName,
    }))

  const replenishmentItems: LaborQueueItem[] = replenishmentTasks
    .filter((t) => REPLENISHMENT_ACTIVE_STATUSES.includes(t.status))
    .map((t) => ({
      id: t.id,
      sourceType: 'replenishment',
      code: t.id,
      productId: t.productId,
      locationId: t.destinationLocationId,
      priority: t.priority,
      status: t.status,
      operatorName: t.operatorName,
    }))

  const putawayItems: LaborQueueItem[] = asns
    .filter((a) => ASN_READY_FOR_PUTAWAY_STATUSES.includes(a.status))
    .map((a) => ({
      id: a.id,
      sourceType: 'putaway',
      code: a.code,
      productId: a.productId,
      locationId: a.suggestedPutawayLocationId ?? '',
      priority: 'medium' as const,
      status: a.status,
      operatorName: a.assignedOperatorName,
    }))

  return [...pickingItems, ...replenishmentItems, ...putawayItems]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rules/labor.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rules/labor.ts src/lib/rules/labor.test.ts
git commit -m "feat(labor): add buildLaborQueue projection over picking/putaway/replenishment"
```

---

## Task 3: `suggestInterleavedRoutes` grouping function

**Files:**
- Modify: `src/lib/rules/labor.ts`
- Modify: `src/lib/rules/labor.test.ts`

**Interfaces:**
- Consumes: `LaborQueueItem[]` (from Task 2), a `getLocation: (id: string) => { distanceToDispatchM: number } | undefined` lookup (mirrors the existing `useStoreHelpers` pattern — passed in by the caller, not imported from the store, to keep this file store-free), and `maxDistanceM: number`.
- Produces: `suggestInterleavedRoutes(items: LaborQueueItem[], getLocation: (id: string) => { distanceToDispatchM: number } | undefined, maxDistanceM: number): LaborQueueItem[]` — same array, with `suggestedRouteId` populated on grouped items. Consumed by Task 5 (page).

- [ ] **Step 1: Write the failing test**

Append to `src/lib/rules/labor.test.ts` (add the import and a new `describe` block):

```ts
import { suggestInterleavedRoutes } from './labor'

describe('suggestInterleavedRoutes', () => {
  const locations: Record<string, { distanceToDispatchM: number }> = {
    'loc-1': { distanceToDispatchM: 10 },
    'loc-2': { distanceToDispatchM: 15 },
    'loc-far': { distanceToDispatchM: 200 },
  }
  const getLocation = (id: string) => locations[id]

  it('does not group items for different operators', () => {
    const items = [
      { ...pickingTask(), id: 'a', sourceType: 'picking' as const, code: 'a', locationId: 'loc-1', operatorName: 'Juan', priority: 'high' as const, status: 'pending' },
      { ...pickingTask(), id: 'b', sourceType: 'replenishment' as const, code: 'b', locationId: 'loc-2', operatorName: 'Ana', priority: 'medium' as const, status: 'pending' },
    ]
    const result = suggestInterleavedRoutes(items, getLocation, 20)
    expect(result.every((i) => i.suggestedRouteId === undefined)).toBe(true)
  })

  it('does not group items of the same operator if distance exceeds maxDistanceM', () => {
    const items = [
      { id: 'a', sourceType: 'picking' as const, code: 'a', locationId: 'loc-1', priority: 'high' as const, status: 'pending', operatorName: 'Juan' },
      { id: 'b', sourceType: 'replenishment' as const, code: 'b', locationId: 'loc-far', priority: 'medium' as const, status: 'pending', operatorName: 'Juan' },
    ]
    const result = suggestInterleavedRoutes(items, getLocation, 20)
    expect(result.every((i) => i.suggestedRouteId === undefined)).toBe(true)
  })

  it('groups two different-type items for the same operator within maxDistanceM', () => {
    const items = [
      { id: 'a', sourceType: 'picking' as const, code: 'a', locationId: 'loc-1', priority: 'high' as const, status: 'pending', operatorName: 'Juan' },
      { id: 'b', sourceType: 'replenishment' as const, code: 'b', locationId: 'loc-2', priority: 'medium' as const, status: 'pending', operatorName: 'Juan' },
    ]
    const result = suggestInterleavedRoutes(items, getLocation, 20)
    expect(result[0].suggestedRouteId).toBeDefined()
    expect(result[0].suggestedRouteId).toBe(result[1].suggestedRouteId)
  })

  it('does not group two items of the same sourceType even for the same operator nearby', () => {
    const items = [
      { id: 'a', sourceType: 'picking' as const, code: 'a', locationId: 'loc-1', priority: 'high' as const, status: 'pending', operatorName: 'Juan' },
      { id: 'b', sourceType: 'picking' as const, code: 'b', locationId: 'loc-2', priority: 'medium' as const, status: 'pending', operatorName: 'Juan' },
    ]
    const result = suggestInterleavedRoutes(items, getLocation, 20)
    expect(result.every((i) => i.suggestedRouteId === undefined)).toBe(true)
  })

  it('does not group unassigned items (no operatorName)', () => {
    const items = [
      { id: 'a', sourceType: 'picking' as const, code: 'a', locationId: 'loc-1', priority: 'high' as const, status: 'pending' },
      { id: 'b', sourceType: 'replenishment' as const, code: 'b', locationId: 'loc-2', priority: 'medium' as const, status: 'pending' },
    ]
    const result = suggestInterleavedRoutes(items, getLocation, 20)
    expect(result.every((i) => i.suggestedRouteId === undefined)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rules/labor.test.ts`
Expected: FAIL — `suggestInterleavedRoutes is not a function` (not exported yet).

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/rules/labor.ts`:

```ts
export function suggestInterleavedRoutes(
  items: LaborQueueItem[],
  getLocation: (id: string) => { distanceToDispatchM: number } | undefined,
  maxDistanceM: number
): LaborQueueItem[] {
  const byOperator = new Map<string, LaborQueueItem[]>()
  for (const item of items) {
    if (!item.operatorName) continue
    const bucket = byOperator.get(item.operatorName) ?? []
    bucket.push(item)
    byOperator.set(item.operatorName, bucket)
  }

  const routeIdByItemId = new Map<string, string>()
  let routeCounter = 0

  for (const [operatorName, bucket] of byOperator) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i]
        const b = bucket[j]
        if (a.sourceType === b.sourceType) continue
        if (routeIdByItemId.has(a.id) && routeIdByItemId.has(b.id)) continue

        const locA = getLocation(a.locationId)
        const locB = getLocation(b.locationId)
        if (!locA || !locB) continue

        const distance = Math.abs(locA.distanceToDispatchM - locB.distanceToDispatchM)
        if (distance > maxDistanceM) continue

        const existingRouteId = routeIdByItemId.get(a.id) ?? routeIdByItemId.get(b.id)
        const routeId = existingRouteId ?? `route-${operatorName}-${routeCounter++}`
        routeIdByItemId.set(a.id, routeId)
        routeIdByItemId.set(b.id, routeId)
      }
    }
  }

  return items.map((item) =>
    routeIdByItemId.has(item.id) ? { ...item, suggestedRouteId: routeIdByItemId.get(item.id) } : item
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rules/labor.test.ts`
Expected: PASS (all 14 tests: 9 from Task 2 + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rules/labor.ts src/lib/rules/labor.test.ts
git commit -m "feat(labor): add suggestInterleavedRoutes grouping by operator/zone proximity"
```

---

## Task 4: `assignPutaway` store action + productivity extension

**Files:**
- Modify: `src/store/wms-store.ts` (add action type declaration near `putawayItem` at line 260, add implementation near `putawayItem` impl at line 1211-1327)
- Modify: `src/lib/rules/labor.ts` (add `productivityByAllSources`)
- Modify: `src/lib/rules/labor.test.ts`

**Interfaces:**
- Consumes: `Operator`, `Asn` from `src/types/wms.ts`; existing `state.asns` array in the store.
- Produces: `assignPutaway(asnId: string, operatorName: string): void` store action — consumed by Task 5 (page assign button). `productivityByAllSources(pickingTasks: PickingTask[], replenishmentTasks: ReplenishmentTask[], asns: Asn[]): ProductivityRow[]` — consumed by Task 6 (Productivity tab).

- [ ] **Step 1: Write the failing test for `productivityByAllSources`**

Append to `src/lib/rules/labor.test.ts`:

```ts
import { productivityByAllSources } from './labor'

describe('productivityByAllSources', () => {
  it('returns an empty array when nothing is completed', () => {
    expect(productivityByAllSources([], [], [])).toEqual([])
  })

  it('counts completed picking tasks per operator', () => {
    const tasks = [
      pickingTask({ id: 'p1', status: 'completed', operatorName: 'Juan', pickedQuantity: 10 }),
      pickingTask({ id: 'p2', status: 'completed', operatorName: 'Juan', pickedQuantity: 5 }),
    ]
    const result = productivityByAllSources(tasks, [], [])
    expect(result).toEqual([
      { operatorName: 'Juan', picksCompleted: 2, unitsPicked: 15, partialCount: 0, issueCount: 0 },
    ])
  })

  it('adds completed replenishment and putaway counts to the same operator row as extra units', () => {
    const tasks = [pickingTask({ id: 'p1', status: 'completed', operatorName: 'Juan', pickedQuantity: 10 })]
    const repl = [
      replenishmentTask({ id: 'r1', status: 'completed', operatorName: 'Juan', suggestedQuantity: 20 }),
    ]
    const asnsCompleted = [asn({ id: 'a1', status: 'putaway_done', assignedOperatorName: 'Juan', receivedQuantity: 30 })]
    const result = productivityByAllSources(tasks, repl, asnsCompleted)
    expect(result).toEqual([
      { operatorName: 'Juan', picksCompleted: 2, unitsPicked: 60, partialCount: 0, issueCount: 0 },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rules/labor.test.ts`
Expected: FAIL — `productivityByAllSources is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/rules/labor.ts` (add the import at the top of the file, next to the existing `Asn, LaborQueueItem, PickingTask, ReplenishmentTask` import):

```ts
import type { ProductivityRow } from '@/types/wms'
```

Then append the function:

```ts
export function productivityByAllSources(
  pickingTasks: PickingTask[],
  replenishmentTasks: ReplenishmentTask[],
  asns: Asn[]
): ProductivityRow[] {
  const byOperator = new Map<string, ProductivityRow>()

  const getRow = (operatorName: string): ProductivityRow => {
    const existing = byOperator.get(operatorName)
    if (existing) return existing
    const row: ProductivityRow = { operatorName, picksCompleted: 0, unitsPicked: 0, partialCount: 0, issueCount: 0 }
    byOperator.set(operatorName, row)
    return row
  }

  for (const t of pickingTasks) {
    if (t.status !== 'completed' || !t.operatorName) continue
    const row = getRow(t.operatorName)
    row.picksCompleted += 1
    row.unitsPicked += t.pickedQuantity
  }

  for (const t of replenishmentTasks) {
    if (t.status !== 'completed' || !t.operatorName) continue
    const row = getRow(t.operatorName)
    row.unitsPicked += t.suggestedQuantity
  }

  for (const a of asns) {
    if (a.status !== 'putaway_done' || !a.assignedOperatorName) continue
    const row = getRow(a.assignedOperatorName)
    row.unitsPicked += a.receivedQuantity
  }

  return Array.from(byOperator.values())
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rules/labor.test.ts`
Expected: PASS (all 17 tests).

- [ ] **Step 5: Add the `assignPutaway` store action type declaration**

In `src/store/wms-store.ts`, find the `putawayItem` type declaration (line 260: `putawayItem: (asnId: string, locationId: string, operatorName: string) => void`). Add directly after it:

```ts
  // Labor module (#9) — stamps the operator assigned to a putaway before putawayItem() executes it.
  assignPutaway: (asnId: string, operatorName: string) => void
```

- [ ] **Step 6: Add the `assignPutaway` implementation**

In `src/store/wms-store.ts`, find the `putawayItem` implementation (starts at line 1211). Add a new action directly after the closing of `putawayItem`'s implementation block (after its matching closing `},` — read the surrounding 20 lines first with the Read tool to find the exact closing brace before inserting, since the function body spans line 1211-1327 per the earlier research). Insert:

```ts
  assignPutaway: (asnId, operatorName) => {
    set((state) => ({
      asns: state.asns.map((a) => (a.id === asnId ? { ...a, assignedOperatorName: operatorName } : a)),
    }))
  },
```

- [ ] **Step 7: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add src/store/wms-store.ts src/lib/rules/labor.ts src/lib/rules/labor.test.ts
git commit -m "feat(labor): add assignPutaway action and productivityByAllSources aggregation"
```

---

## Task 5: `/labor` page shell — Cola de tareas tab

**Files:**
- Create: `src/app/(app)/labor/page.tsx`
- Create: `src/app/(app)/labor/_components/QueueTab.tsx`
- Create: `src/app/(app)/labor/_columns/columns-queue.tsx`
- Create: `src/app/(app)/labor/columns.tsx`
- Modify: `src/lib/constants.ts` (register nav item)

**Interfaces:**
- Consumes: `buildLaborQueue`, `suggestInterleavedRoutes` (Task 2/3), `useWmsStore`, `useStoreHelpers` (`productName`, `locationCode`), `startPicking(taskId, operatorName)`, `startReplenishment(taskId, operatorName)`, `assignPutaway(asnId, operatorName)` (Task 4), `state.operators: Operator[]`, `state.settings.laborInterleavingEnabled`, `state.settings.laborInterleavingMaxDistanceM`.
- Produces: `/labor` route rendering the "Cola de tareas" tab (Productividad and Turnos tabs are stubbed as not-yet-implemented placeholders inside the same page shell, filled in by Tasks 6 and 7).

- [ ] **Step 1: Add the nav entry**

In `src/lib/constants.ts`, add `Users` to the lucide-react import list (alphabetically, after `Truck` and before the closing of the import — the list is already alphabetized: `Cable, ClipboardCheck, ClipboardList, Grid3x3, Layers, ListChecks, MapPinned, Package, PackageCheck, Route, Settings2, ShoppingCart, ScanLine, Shuffle, SlidersHorizontal, Tags, Truck, Undo2` — insert `Users` after `Undo2`):

```ts
  Undo2,
  Users,
} from 'lucide-react'
```

Then add the route to the `'Operación'` group's `items` array, after `{ label: 'Etiquetas', href: '/labels', icon: Tags }`:

```ts
      { label: 'Mano de obra', href: '/labor', icon: Users },
```

- [ ] **Step 2: Build the queue columns**

Create `src/app/(app)/labor/_columns/columns-queue.tsx`:

```tsx
'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { ProductAvatar } from '@/app/(app)/receiving/_components/product-avatar'
import { PRIORITY_COLORS, PRIORITY_LABELS, operatorCol } from '@/app/(app)/picking/_columns/shared'
import { cn } from '@/lib/utils'
import type { LaborQueueItem } from '@/types/wms'

const SOURCE_TYPE_LABELS: Record<LaborQueueItem['sourceType'], string> = {
  picking: 'Picking',
  putaway: 'Putaway',
  replenishment: 'Reposición',
}

const SOURCE_TYPE_COLORS: Record<LaborQueueItem['sourceType'], string> = {
  picking: 'border-blue-200 bg-blue-100 text-blue-700',
  putaway: 'border-purple-200 bg-purple-100 text-purple-700',
  replenishment: 'border-amber-200 bg-amber-100 text-amber-700',
}

export const buildQueueColumns = (
  getProductName: (id: string) => string,
  getLocationCode: (id: string) => string,
  onAssign: (item: LaborQueueItem) => void
): ColumnDef<LaborQueueItem>[] => [
  {
    accessorKey: 'sourceType',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
    cell: ({ row }) => (
      <Badge variant="outline" className={cn('text-xs', SOURCE_TYPE_COLORS[row.original.sourceType])}>
        {SOURCE_TYPE_LABELS[row.original.sourceType]}
      </Badge>
    ),
  },
  {
    accessorKey: 'code',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
    cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.code}</span>,
  },
  {
    accessorKey: 'productId',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
    cell: ({ row }) =>
      row.original.productId ? (
        <ProductAvatar productId={row.original.productId} name={getProductName(row.original.productId)} />
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      ),
  },
  {
    accessorKey: 'locationId',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Ubicación" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {row.original.locationId ? getLocationCode(row.original.locationId) : '—'}
      </span>
    ),
  },
  {
    accessorKey: 'priority',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Prioridad" />,
    cell: ({ row }) => (
      <Badge variant="outline" className={cn('text-xs', PRIORITY_COLORS[row.original.priority])}>
        {PRIORITY_LABELS[row.original.priority]}
      </Badge>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  operatorCol<LaborQueueItem>(),
  {
    id: 'suggestedRoute',
    header: 'Ruta combinada',
    enableSorting: false,
    cell: ({ row }) =>
      row.original.suggestedRouteId ? (
        <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-xs text-emerald-700">
          Sugerida
        </Badge>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      ),
  },
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <Button size="sm" variant="outline" onClick={() => onAssign(row.original)}>
        <Play className="mr-1 size-3" />
        {row.original.operatorName ? 'Reasignar' : 'Asignar'}
      </Button>
    ),
  },
]
```

- [ ] **Step 3: Create the columns re-export**

Create `src/app/(app)/labor/columns.tsx`:

```tsx
'use client'

export { buildQueueColumns } from './_columns/columns-queue'
```

- [ ] **Step 4: Build the QueueTab component**

Create `src/app/(app)/labor/_components/QueueTab.tsx`:

```tsx
'use client'

import { ClipboardList, Route, UserX, Users } from 'lucide-react'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/data-table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TabPanel } from '@/app/(app)/receiving/_components/tab-panel'
import { EmptyState } from '@/app/(app)/receiving/_components/empty-state'
import type { ColumnDef } from '@tanstack/react-table'
import type { LaborQueueItem } from '@/types/wms'

interface Props {
  allItems: LaborQueueItem[]
  filteredItems: LaborQueueItem[]
  sourceTypeFilter: string
  onSourceTypeFilterChange: (value: string) => void
  activeOperatorCount: number
  queueCols: ColumnDef<LaborQueueItem>[]
}

export const QueueTab = ({
  allItems,
  filteredItems,
  sourceTypeFilter,
  onSourceTypeFilterChange,
  activeOperatorCount,
  queueCols,
}: Props) => {
  const unassignedCount = allItems.filter((i) => !i.operatorName).length
  const withRouteCount = allItems.filter((i) => i.suggestedRouteId).length

  return (
    <TabPanel
      icon={ClipboardList}
      iconClass="text-blue-500"
      title="Cola de tareas"
      description="Vista unificada de tareas de picking, putaway y reposición pendientes de completar. Asigna o reasigna un operario sin salir de esta vista."
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <KpiCard icon={ClipboardList} value={allItems.length} label="Total pendientes" tone="blue" />
        <KpiCard icon={UserX} value={unassignedCount} label="Sin asignar" tone="amber" />
        <KpiCard icon={Route} value={withRouteCount} label="Ruta combinada sugerida" tone="green" />
        <KpiCard icon={Users} value={activeOperatorCount} label="Operarios activos" tone="neutral" />
      </div>
      {allItems.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Sin tareas pendientes"
          description="Las tareas de picking, putaway y reposición pendientes aparecerán aquí."
        />
      ) : (
        <DataTable
          columns={queueCols}
          data={filteredItems}
          searchColumn="code"
          searchPlaceholder="Buscar por código o producto…"
          emptyMessage="Sin tareas para el filtro seleccionado."
          filters={
            <Select value={sourceTypeFilter} onValueChange={onSourceTypeFilterChange}>
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="picking">Picking</SelectItem>
                <SelectItem value="putaway">Putaway</SelectItem>
                <SelectItem value="replenishment">Reposición</SelectItem>
              </SelectContent>
            </Select>
          }
        />
      )}
    </TabPanel>
  )
}
```

- [ ] **Step 5: Build the page shell with assign dialog**

Create `src/app/(app)/labor/page.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ClipboardList, BarChart3, Users } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { SubNav, type SubNavItem } from '@/components/shared/sub-nav'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { buildLaborQueue, suggestInterleavedRoutes } from '@/lib/rules/labor'
import { buildQueueColumns } from './columns'
import { QueueTab } from './_components/QueueTab'
import type { LaborQueueItem } from '@/types/wms'

const ASSIGNABLE_ROLES: Record<LaborQueueItem['sourceType'], string[]> = {
  picking: ['picker'],
  putaway: ['receiver'],
  replenishment: ['picker'],
}

export default function LaborPage() {
  const state = useWmsStore()
  const { productName, locationCode, getProduct } = useStoreHelpers()
  const { startPicking, startReplenishment, assignPutaway, locations, operators } = state

  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'queue'

  const [sourceTypeFilter, setSourceTypeFilter] = useState('all')
  const [assignItem, setAssignItem] = useState<LaborQueueItem | null>(null)
  const [assignOperatorName, setAssignOperatorName] = useState('')

  const rawQueue = useMemo(
    () => buildLaborQueue(state.pickingTasks, state.replenishmentTasks, state.asns),
    [state.pickingTasks, state.replenishmentTasks, state.asns]
  )

  const getLocationForInterleaving = (id: string) => locations.find((l) => l.id === id)

  const queue = useMemo(
    () =>
      state.settings.laborInterleavingEnabled
        ? suggestInterleavedRoutes(rawQueue, getLocationForInterleaving, state.settings.laborInterleavingMaxDistanceM)
        : rawQueue,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawQueue, state.settings.laborInterleavingEnabled, state.settings.laborInterleavingMaxDistanceM]
  )

  const filteredQueue = useMemo(
    () => (sourceTypeFilter === 'all' ? queue : queue.filter((i) => i.sourceType === sourceTypeFilter)),
    [queue, sourceTypeFilter]
  )

  const activeOperatorCount = useMemo(
    () => new Set(queue.filter((i) => i.operatorName).map((i) => i.operatorName)).size,
    [queue]
  )

  const assignableOperators = useMemo(() => {
    if (!assignItem) return []
    const roles = ASSIGNABLE_ROLES[assignItem.sourceType]
    return operators.filter((o) => o.active && roles.includes(o.role))
  }, [assignItem, operators])

  const handleOpenAssign = (item: LaborQueueItem) => {
    setAssignItem(item)
    setAssignOperatorName(item.operatorName ?? '')
  }

  const handleConfirmAssign = () => {
    if (!assignItem || !assignOperatorName) return
    if (assignItem.sourceType === 'picking') startPicking(assignItem.id, assignOperatorName)
    if (assignItem.sourceType === 'replenishment') startReplenishment(assignItem.id, assignOperatorName)
    if (assignItem.sourceType === 'putaway') assignPutaway(assignItem.id, assignOperatorName)
    setAssignItem(null)
  }

  const queueCols = useMemo(
    () => buildQueueColumns(productName, locationCode, handleOpenAssign),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productName, locationCode]
  )

  const laborTabs: SubNavItem[] = [
    { value: 'queue', label: 'Cola de tareas', icon: ClipboardList, count: queue.length || undefined },
    { value: 'productivity', label: 'Productividad', icon: BarChart3 },
    { value: 'operators', label: 'Turnos y operarios', icon: Users },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Mano de obra"
        description="Cola unificada de tareas de picking, putaway y reposición, productividad por operario y visibilidad de carga de trabajo."
      />

      <SubNav items={laborTabs} defaultValue="queue" />

      {activeTab === 'queue' && (
        <QueueTab
          allItems={queue}
          filteredItems={filteredQueue}
          sourceTypeFilter={sourceTypeFilter}
          onSourceTypeFilterChange={setSourceTypeFilter}
          activeOperatorCount={activeOperatorCount}
          queueCols={queueCols}
        />
      )}

      <Dialog open={!!assignItem} onOpenChange={(o) => { if (!o) setAssignItem(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Asignar operario</DialogTitle>
            <DialogDescription>
              {assignItem ? `Tarea ${assignItem.code} (${assignItem.sourceType})` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={assignOperatorName} onValueChange={setAssignOperatorName}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un operario" />
              </SelectTrigger>
              <SelectContent>
                {assignableOperators.map((op) => (
                  <SelectItem key={op.id} value={op.name}>
                    {op.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {getProduct && assignItem?.productId && (
              <p className="text-muted-foreground mt-2 text-xs">
                Producto: {productName(assignItem.productId)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignItem(null)}>Cancelar</Button>
            <Button disabled={!assignOperatorName} onClick={handleConfirmAssign}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 6: Verify typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/app/\(app\)/labor src/lib/constants.ts`
Expected: no errors. If ESLint flags the `react-hooks/exhaustive-deps` disables, that matches the existing convention already used in `inventory-settings/page.tsx:218` and `picking/page.tsx` — leave as-is.

- [ ] **Step 7: Manual verification**

Run: `npm run dev`
Open `http://localhost:3000/labor` in a browser. Confirm:
- Page loads with "Cola de tareas" tab active by default.
- KPI cards render with real counts from seed data.
- Table shows a mix of picking/putaway/replenishment rows (if seed data has pending tasks of each kind — if not, note which are empty in your report).
- Clicking "Asignar" opens the dialog, selecting an operator and confirming updates the row's "Operador" column and the "Sin asignar" KPI decrements.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/labor src/lib/constants.ts
git commit -m "feat(labor): add /labor page with unified task queue and assignment dialog"
```

---

## Task 6: Productividad tab

**Files:**
- Create: `src/app/(app)/labor/_components/ProductivityTab.tsx`
- Create: `src/app/(app)/labor/_columns/columns-productivity.tsx`
- Modify: `src/app/(app)/labor/columns.tsx` (add re-export)
- Modify: `src/app/(app)/labor/page.tsx` (wire up the tab)

**Interfaces:**
- Consumes: `productivityByAllSources` (Task 4), `state.settings.laborTargetPicksPerHour`, `state.operators` (for role grouping).
- Produces: rendered "Productividad" tab, no new exports consumed elsewhere.

- [ ] **Step 1: Build productivity columns**

Create `src/app/(app)/labor/_columns/columns-productivity.tsx`:

```tsx
'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/data-table'
import { cn } from '@/lib/utils'
import type { ProductivityRow } from '@/types/wms'

export const buildProductivityColumns = (targetUnitsPerHour: number): ColumnDef<ProductivityRow>[] => [
  {
    accessorKey: 'operatorName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Operario" />,
    cell: ({ row }) => <span className="text-sm font-medium">{row.original.operatorName}</span>,
  },
  {
    accessorKey: 'picksCompleted',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Picks completados" />,
    cell: ({ row }) => <div className="text-right tabular-nums">{row.original.picksCompleted}</div>,
  },
  {
    accessorKey: 'unitsPicked',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Unidades" />,
    cell: ({ row }) => {
      const pct = targetUnitsPerHour > 0 ? (row.original.unitsPicked / targetUnitsPerHour) * 100 : 0
      const tone = pct >= 100 ? 'text-emerald-600' : pct >= 80 ? 'text-amber-600' : 'text-red-600'
      return <div className={cn('text-right font-semibold tabular-nums', tone)}>{row.original.unitsPicked}</div>
    },
  },
  {
    accessorKey: 'partialCount',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Parciales" />,
    cell: ({ row }) => <div className="text-right tabular-nums">{row.original.partialCount}</div>,
  },
  {
    accessorKey: 'issueCount',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Incidencias" />,
    cell: ({ row }) => <div className="text-right tabular-nums">{row.original.issueCount}</div>,
  },
]
```

- [ ] **Step 2: Add the re-export**

In `src/app/(app)/labor/columns.tsx`, add:

```tsx
export { buildProductivityColumns } from './_columns/columns-productivity'
```

- [ ] **Step 3: Build the ProductivityTab component**

Create `src/app/(app)/labor/_components/ProductivityTab.tsx`:

```tsx
'use client'

import { BarChart3, Gauge, Trophy, Zap } from 'lucide-react'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/data-table'
import { TabPanel } from '@/app/(app)/receiving/_components/tab-panel'
import { EmptyState } from '@/app/(app)/receiving/_components/empty-state'
import type { ColumnDef } from '@tanstack/react-table'
import type { ProductivityRow } from '@/types/wms'

interface Props {
  rows: ProductivityRow[]
  productivityCols: ColumnDef<ProductivityRow>[]
}

export const ProductivityTab = ({ rows, productivityCols }: Props) => {
  const totalPicks = rows.reduce((sum, r) => sum + r.picksCompleted, 0)
  const totalUnits = rows.reduce((sum, r) => sum + r.unitsPicked, 0)
  const topPerformer = [...rows].sort((a, b) => b.unitsPicked - a.unitsPicked)[0]

  return (
    <TabPanel
      icon={BarChart3}
      iconClass="text-emerald-500"
      title="Productividad"
      description="Desempeño por operario a través de picking, putaway y reposición. El color de las unidades refleja la meta configurada en Config. Mano de obra."
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <KpiCard icon={Zap} value={totalPicks} label="Picks completados" tone="blue" />
        <KpiCard icon={Gauge} value={totalUnits} label="Unidades procesadas" tone="green" />
        <KpiCard
          icon={Trophy}
          value={topPerformer?.operatorName ?? '—'}
          label="Top performer"
          tone="amber"
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Sin datos de productividad"
          description="Completa tareas de picking, putaway o reposición para ver la productividad por operario."
        />
      ) : (
        <DataTable columns={productivityCols} data={rows} searchColumn="operatorName" searchPlaceholder="Buscar operario…" />
      )}
    </TabPanel>
  )
}
```

- [ ] **Step 4: Wire the tab into the page**

In `src/app/(app)/labor/page.tsx`:

Add to the imports:

```tsx
import { buildLaborQueue, suggestInterleavedRoutes, productivityByAllSources } from '@/lib/rules/labor'
import { buildQueueColumns, buildProductivityColumns } from './columns'
import { ProductivityTab } from './_components/ProductivityTab'
```

(Replace the existing single-import line for `buildLaborQueue, suggestInterleavedRoutes` and the existing `import { buildQueueColumns } from './columns'` with these merged versions.)

Add after the `queueCols` `useMemo` block:

```tsx
  const productivityRows = useMemo(
    () => productivityByAllSources(state.pickingTasks, state.replenishmentTasks, state.asns),
    [state.pickingTasks, state.replenishmentTasks, state.asns]
  )

  const productivityCols = useMemo(
    () => buildProductivityColumns(state.settings.laborTargetUnitsPerHour),
    [state.settings.laborTargetUnitsPerHour]
  )
```

Add after the `{activeTab === 'queue' && ...}` block:

```tsx
      {activeTab === 'productivity' && (
        <ProductivityTab rows={productivityRows} productivityCols={productivityCols} />
      )}
```

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Run: `npm run dev` (if not already running from Task 5).
Open `http://localhost:3000/labor?tab=productivity`. Confirm KPI cards and table render (empty state if no completed tasks in seed data — note this in your report).

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/labor
git commit -m "feat(labor): add Productividad tab to /labor"
```

---

## Task 7: Turnos y operarios tab

**Files:**
- Create: `src/app/(app)/labor/_components/OperatorsTab.tsx`
- Create: `src/app/(app)/labor/_columns/columns-operators.tsx`
- Modify: `src/app/(app)/labor/columns.tsx` (add re-export)
- Modify: `src/app/(app)/labor/page.tsx` (wire up the tab)

**Interfaces:**
- Consumes: `state.operators: Operator[]`, `queue: LaborQueueItem[]` (from Task 5's `useMemo`, to compute current load per operator).
- Produces: rendered "Turnos y operarios" tab. No exports consumed elsewhere — this is the final tab.

- [ ] **Step 1: Define the row shape and build operator columns**

Create `src/app/(app)/labor/_columns/columns-operators.tsx`:

```tsx
'use client'

import { type ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { cn } from '@/lib/utils'

const ROLE_LABELS: Record<string, string> = {
  picker: 'Picker',
  packer: 'Packer',
  receiver: 'Recepcionista',
  driver: 'Conductor',
  supervisor: 'Supervisor',
}

export interface OperatorLoadRow {
  id: string
  name: string
  role: string
  active: boolean
  currentLoad: number
}

export const buildOperatorColumns = (): ColumnDef<OperatorLoadRow>[] => [
  {
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Operario" />,
    cell: ({ row }) => <span className="text-sm font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'role',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Rol" />,
    cell: ({ row }) => <Badge variant="outline" className="text-xs">{ROLE_LABELS[row.original.role] ?? row.original.role}</Badge>,
  },
  {
    accessorKey: 'active',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={cn(
          'text-xs',
          row.original.active
            ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
            : 'border-zinc-200 bg-zinc-100 text-zinc-500'
        )}
      >
        {row.original.active ? 'Activo' : 'Inactivo'}
      </Badge>
    ),
  },
  {
    accessorKey: 'currentLoad',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Carga actual" />,
    cell: ({ row }) => <div className="text-right tabular-nums">{row.original.currentLoad} tareas</div>,
  },
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    cell: () => (
      <Button asChild size="sm" variant="outline">
        <Link href="/admin">Editar</Link>
      </Button>
    ),
  },
]
```

- [ ] **Step 2: Add the re-export**

In `src/app/(app)/labor/columns.tsx`, add:

```tsx
export { buildOperatorColumns } from './_columns/columns-operators'
export type { OperatorLoadRow } from './_columns/columns-operators'
```

- [ ] **Step 3: Build the OperatorsTab component**

Create `src/app/(app)/labor/_components/OperatorsTab.tsx`:

```tsx
'use client'

import { Users } from 'lucide-react'
import { DataTable } from '@/components/data-table'
import { TabPanel } from '@/app/(app)/receiving/_components/tab-panel'
import { EmptyState } from '@/app/(app)/receiving/_components/empty-state'
import type { ColumnDef } from '@tanstack/react-table'
import type { OperatorLoadRow } from '../columns'

interface Props {
  rows: OperatorLoadRow[]
  operatorCols: ColumnDef<OperatorLoadRow>[]
}

export const OperatorsTab = ({ rows, operatorCols }: Props) => (
  <TabPanel
    icon={Users}
    iconClass="text-indigo-500"
    title="Turnos y operarios"
    description="Operarios registrados y su carga de trabajo actual. Edita datos del operario desde Administración."
  >
    {rows.length === 0 ? (
      <EmptyState icon={Users} title="Sin operarios registrados" description="Registra operarios en Administración." />
    ) : (
      <DataTable columns={operatorCols} data={rows} searchColumn="name" searchPlaceholder="Buscar operario…" />
    )}
  </TabPanel>
)
```

- [ ] **Step 4: Wire the tab into the page**

In `src/app/(app)/labor/page.tsx`:

Update the columns import to add the new builders:

```tsx
import { buildQueueColumns, buildProductivityColumns, buildOperatorColumns } from './columns'
import { OperatorsTab } from './_components/OperatorsTab'
```

Add after the `productivityCols` `useMemo` block:

```tsx
  const operatorRows = useMemo(
    () =>
      operators.map((op) => ({
        id: op.id,
        name: op.name,
        role: op.role,
        active: op.active,
        currentLoad: queue.filter((i) => i.operatorName === op.name).length,
      })),
    [operators, queue]
  )

  const operatorCols = useMemo(() => buildOperatorColumns(), [])
```

Add after the `{activeTab === 'productivity' && ...}` block:

```tsx
      {activeTab === 'operators' && (
        <OperatorsTab rows={operatorRows} operatorCols={operatorCols} />
      )}
```

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Open `http://localhost:3000/labor?tab=operators`. Confirm the operators table renders with roles, active/inactive badges, and current load counts that match the queue tab.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/labor
git commit -m "feat(labor): add Turnos y operarios tab to /labor"
```

---

## Task 8: `/labor-settings` page

**Files:**
- Create: `src/app/(app)/labor-settings/page.tsx`
- Modify: `src/lib/constants.ts` (register nav item in 'Sistema' group)

**Interfaces:**
- Consumes: `useWmsStore` (`settings`, `updateSettings`), `buildLaborQueue`, `productivityByAllSources` (Task 2/4), same KPI/section pattern as `inventory-settings/page.tsx`.
- Produces: `/labor-settings` route. Terminal task — nothing downstream consumes this.

- [ ] **Step 1: Register the nav entry**

In `src/lib/constants.ts`, add the route to the `'Sistema'` group, after `{ label: 'Config. Conteo cíclico', href: '/cycle-count-settings', icon: ClipboardCheck }`:

```ts
      { label: 'Config. Mano de obra', href: '/labor-settings', icon: Users },
```

(`Users` is already imported from Task 5, Step 1.)

- [ ] **Step 2: Build the settings page**

Create `src/app/(app)/labor-settings/page.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { Gauge, Route, Timer, Users } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { buildLaborQueue, productivityByAllSources } from '@/lib/rules/labor'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

const SectionHeading = ({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Gauge
  title: string
  description: string
}) => (
  <div>
    <h3 className="flex items-center gap-2 text-sm font-semibold">
      <Icon className="size-4 text-muted-foreground" />
      {title}
    </h3>
    <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
  </div>
)

const SettingRow = ({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}) => (
  <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="sm:max-w-[60%]">
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
)

const InlineSlider = ({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) => (
  <div className="flex items-center gap-3">
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="h-1.5 w-40 cursor-pointer accent-zinc-800 sm:w-48 dark:accent-zinc-300"
    />
    <span className="w-14 shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-right text-sm font-semibold tabular-nums dark:bg-zinc-800">
      {value}
    </span>
  </div>
)

export default function LaborSettingsPage() {
  const state = useWmsStore()
  const { settings, updateSettings } = state

  const [localSettings, setLocalSettings] = useState({ ...settings })
  const [settingsChanged, setSettingsChanged] = useState(false)

  const handleSettingChange = (key: keyof typeof settings, value: number | boolean) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
    setSettingsChanged(true)
  }

  const handleSaveSettings = () => {
    updateSettings(localSettings)
    setSettingsChanged(false)
  }

  const queue = useMemo(
    () => buildLaborQueue(state.pickingTasks, state.replenishmentTasks, state.asns),
    [state.pickingTasks, state.replenishmentTasks, state.asns]
  )
  const unassignedPct = queue.length > 0 ? Math.round((queue.filter((i) => !i.operatorName).length / queue.length) * 100) : 0

  const productivityRows = useMemo(
    () => productivityByAllSources(state.pickingTasks, state.replenishmentTasks, state.asns),
    [state.pickingTasks, state.replenishmentTasks, state.asns]
  )
  const avgUnitsPerOperator =
    productivityRows.length > 0
      ? Math.round(productivityRows.reduce((sum, r) => sum + r.unitsPicked, 0) / productivityRows.length)
      : 0

  const activeOperatorCount = state.operators.filter((o) => o.active).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración de Mano de obra"
        description="Parámetros de la cola de tareas, interleaving y metas de productividad usados en /labor."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Unidades promedio / operario</p>
            <p className="mt-1 text-4xl font-bold tabular-nums">{avgUnitsPerOperator}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Tareas sin asignar</p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-amber-600">{unassignedPct}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Operarios activos</p>
            <p className="mt-1 text-4xl font-bold tabular-nums">{activeOperatorCount}</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-sm">Parámetros del módulo</CardTitle>
              <CardDescription>Umbrales de prioridad, interleaving y metas de productividad.</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {settingsChanged && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  Cambios sin guardar
                </span>
              )}
              <Button size="sm" disabled={!settingsChanged} onClick={handleSaveSettings}>
                Guardar cambios
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="divide-y divide-zinc-200 dark:divide-zinc-800">
          <section className="pb-5">
            <SectionHeading icon={Timer} title="Cola y prioridad" description="Umbrales de SLA que determinan la prioridad mostrada en la cola de /labor." />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow label="SLA prioridad alta (horas)" description="Tareas con más de esta antigüedad se marcan prioridad alta.">
                <InlineSlider value={localSettings.laborSlaHighPriorityHours} min={1} max={48} step={1} onChange={(v) => handleSettingChange('laborSlaHighPriorityHours', v)} />
              </SettingRow>
              <SettingRow label="SLA prioridad media (horas)" description="Tareas con más de esta antigüedad (y menos que la alta) se marcan prioridad media.">
                <InlineSlider value={localSettings.laborSlaMediumPriorityHours} min={1} max={72} step={1} onChange={(v) => handleSettingChange('laborSlaMediumPriorityHours', v)} />
              </SettingRow>
            </div>
          </section>

          <section className="py-5">
            <SectionHeading icon={Route} title="Interleaving" description="Sugerencia de ruta combinada cuando un operario tiene tareas de distinto tipo cerca entre sí." />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow label="Habilitar sugerencia de ruta combinada" description="Agrupa tareas de picking/putaway/reposición del mismo operario cuando están cerca.">
                <Switch
                  checked={localSettings.laborInterleavingEnabled}
                  onCheckedChange={(v) => handleSettingChange('laborInterleavingEnabled', v)}
                />
              </SettingRow>
              {localSettings.laborInterleavingEnabled && (
                <SettingRow label="Distancia máxima (m)" description="Distancia entre ubicaciones por debajo de la cual se agrupan como ruta combinada.">
                  <InlineSlider value={localSettings.laborInterleavingMaxDistanceM} min={5} max={100} step={5} onChange={(v) => handleSettingChange('laborInterleavingMaxDistanceM', v)} />
                </SettingRow>
              )}
            </div>
          </section>

          <section className="pt-5">
            <SectionHeading icon={Gauge} title="Metas de productividad" description="Solo colorean los KPIs de la pestaña Productividad — no generan incentivos reales." />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow label="Picks/hora objetivo (picker)" description="Meta usada para colorear la fila de cada picker.">
                <InlineSlider value={localSettings.laborTargetPicksPerHour} min={5} max={150} step={5} onChange={(v) => handleSettingChange('laborTargetPicksPerHour', v)} />
              </SettingRow>
              <SettingRow label="Unidades/hora objetivo (packer)" description="Meta usada para colorear la fila de cada packer.">
                <InlineSlider value={localSettings.laborTargetUnitsPerHour} min={5} max={200} step={5} onChange={(v) => handleSettingChange('laborTargetUnitsPerHour', v)} />
              </SettingRow>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Open `http://localhost:3000/labor-settings`. Confirm KPI cards render, sliders/switch work, "Guardar cambios" enables on change and persists (reload the page — values should stick, confirming IndexedDB persistence via the existing store `persist` middleware).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/labor-settings src/lib/constants.ts
git commit -m "feat(labor): add /labor-settings configuration page"
```

---

## Task 9: Full verification pass

**Files:** None (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the 17 new tests in `src/lib/rules/labor.test.ts`.

- [ ] **Step 2: Run the full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run lint across the whole project**

Run: `npx eslint src`
Expected: no new errors introduced by this feature (pre-existing warnings elsewhere are out of scope).

- [ ] **Step 4: Manual smoke test of all three tabs + settings**

Run: `npm run dev`. Walk through:
- `/labor` (queue tab) — assign an operator to a picking task, a putaway ASN, and a replenishment task; confirm each writes back (check `/picking`, `/receiving`, and the replenishment view in `/slotting` or wherever replenishment tasks are surfaced, to confirm the operator name now shows there too).
- `/labor?tab=productivity` — confirm the operator just assigned appears once their task is completed.
- `/labor?tab=operators` — confirm current load reflects the assignments made above.
- `/labor-settings` — toggle interleaving off, return to `/labor`, confirm the "Ruta combinada" column goes empty; toggle back on.

- [ ] **Step 5: Final commit (only if smoke testing surfaced fixes)**

If Step 4 required any code fixes, commit them individually with descriptive messages before proceeding. If no fixes were needed, this task produces no commit.

---

## Task 10: Module functionality document

**Files:**
- Create: `docs/modulo_gestion_labor.md`

**Interfaces:** None — documentation only, no code interfaces.

- [ ] **Step 1: Read the reference structure**

Read `docs/funcionalidades_base_wms.md` section "## 9. Gestión de tareas y mano de obra (Labor Management — LMS)" (lines 226-243) again to ground the document in the same maturity-tier framing (🟢/🔵/🟣) used across the project's module docs.

- [ ] **Step 2: Write the module document**

Create `docs/modulo_gestion_labor.md` following the same structure pattern as other per-module docs in this repo (title, purpose, what was built, tiers covered, page-by-page walkthrough, data model, out-of-scope). Content:

```markdown
# Módulo: Gestión de tareas y mano de obra (Labor Management — LMS)

**Fecha:** 2026-07-23
**Estado:** Implementado — 🟢 Base + 🔵 Estándar (referencia: `docs/funcionalidades_base_wms.md` §9)

## Para qué sirve

Mide, asigna y optimiza el trabajo humano del almacén. Unifica en una sola cola las tareas de picking, putaway y reposición — hoy repartidas en tres módulos distintos — para que un supervisor pueda ver de un vistazo qué falta por asignar, quién tiene qué carga, y sugerir rutas combinadas quie ahorren desplazamiento.

## Alcance implementado

### 🟢 Base
- Asignación de tareas a operarios desde una vista central (`/labor`), que escribe directamente a las acciones reales de cada módulo (`startPicking`, `startReplenishment`, `assignPutaway`).
- Productividad por operario (picks completados, unidades procesadas, parciales, incidencias) agregando las tres fuentes.

### 🔵 Estándar
- Cola de tareas priorizada y filtrable por tipo/zona/prioridad/operario.
- Interleaving: sugerencia visual de "ruta combinada" cuando un mismo operario tiene tareas de distinto tipo en ubicaciones cercanas (configurable por distancia máxima).
- Dashboards de productividad individual y por rol/equipo, con coloreado contra metas configurables.

### 🟣 Avanzado — no incluido en esta iteración
- Engineered Labor Standards (tiempo esperado por tarea vs. real, incentivos).
- Balanceo dinámico de carga con IA.
- Planificación de personal por pronóstico de demanda.

## Páginas

### `/labor` — Cola de tareas, Productividad, Turnos y operarios
- **Cola de tareas:** tabla unificada de tareas pendientes de picking, putaway y reposición. KPIs de total pendientes, sin asignar, con ruta combinada sugerida, y operarios activos. Asignación/reasignación vía diálogo, filtrado por tipo de operario compatible con cada tarea (picker → picking/reposición, receiver → putaway).
- **Productividad:** picks/hora y unidades/hora por operario, coloreado contra la meta configurada, y vista agregada por rol.
- **Turnos y operarios:** operarios activos/inactivos con su carga actual (# de tareas asignadas ahora mismo). Edición de datos del operario redirige a `/admin`.

### `/labor-settings` — Sistema → Configuraciones
- Umbrales de SLA para prioridad alta/media de la cola.
- Habilitar/deshabilitar interleaving y su distancia máxima de agrupación.
- Metas de productividad (picks/hora, unidades/hora) usadas para colorear KPIs.

## Modelo de datos

No se creó ninguna tabla/entidad nueva de "tarea de labor". `/labor` es una **proyección de solo lectura** (`src/lib/rules/labor.ts`) sobre `PickingTask`, `ReplenishmentTask` y `Asn` (putaway) ya existentes — la fuente de verdad de cada tarea sigue viviendo en su módulo original. Se añadió:
- `Asn.assignedOperatorName?: string` — el único de los tres dominios sin paso de pre-asignación.
- Seis campos nuevos en `WmsSettings` (prefijo `labor*`) para gobernar prioridad, interleaving y metas.

## Persistencia

Vía el store Zustand + IndexedDB ya usado en todo el proyecto (`idbStorage`) — sin backend ni almacenamiento adicional. Los datos de la cola no se persisten (se recalculan en cada render); solo la configuración (`WmsSettings`) y el campo `assignedOperatorName` persisten.
```

- [ ] **Step 3: Commit**

```bash
git add docs/modulo_gestion_labor.md
git commit -m "docs(labor): add module functionality document for Labor Management"
```

---

## Plan Self-Review Notes

- **Spec coverage:** all sections of the design spec (`docs/superpowers/specs/2026-07-23-labor-management-design.md`) are covered — `LaborQueueItem` (Task 1), projection + interleaving (Tasks 2-3), assignment write-back (Task 4), all three `/labor` tabs (Tasks 5-7), `/labor-settings` (Task 8), tests (Tasks 2-4), module doc (Task 10).
- **Type consistency:** `LaborQueueItem`, `assignPutaway`, `buildLaborQueue`, `suggestInterleavedRoutes`, `productivityByAllSources` are defined once (Tasks 1-4) and referenced with identical names/signatures in every later task.
- **No placeholders:** every step has complete, runnable code — no "add appropriate X" language.
