# Bodegas Transitorias y Traslados Multi-Tramo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend TransferOrder with multi-leg itineraries and transit warehouse support so stock can flow through intermediate physical nodes (hubs, cross-docks) with full receiving at each stop.

**Architecture:** `TransferOrder` grows a `legs: TransferLeg[]` array; `Warehouse.type` gains `'transit'`; `advanceTransfer` is replaced with `dispatchLeg` + `receiveLeg` actions; the `/transfers` UI adds an itinerary stepper, a receive dialog, and a create dialog. Existing single-leg transfers are migrated in `seed.ts` with backward-compatible fields.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript 5 · Zustand 5 · TailwindCSS 4 · shadcn/Radix UI · Vitest

## Global Constraints

- All UI labels in Spanish (es-CO).
- Arrow functions everywhere — no `function` declarations in components or hooks.
- `cn()` from `@/lib/utils` for all conditional class merging.
- Import domain types from `src/types/wms.ts` — never redefine inline.
- shadcn components from `@/components/ui/` — never modify those files.
- `useDialogState()` from `@/hooks/use-dialog-state` for all modal open/close state.
- react-hook-form + zod for all forms — no raw `useState` for form state.
- `<StatusBadge>` + `STATUS_MAP` for all status display.
- date-fns with `es` locale — never native `.toLocaleDateString()`.
- Pages (`app/`) are the only place `default export` is allowed.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/wms.ts` | Modify | Add `TransferLeg`, `TransferLegStatus`, `TransitWarehouseRole`; extend `Warehouse` and `TransferOrder` |
| `src/lib/state-machines.ts` | Modify | Add `partial_received` to `transferTransitions`; add `legTransitions` map |
| `src/lib/status.ts` | Modify | Add `partial_received` to `STATUS_MAP` |
| `src/data/seed.ts` | Modify | Migrate existing transfers to leg format; add one transit warehouse; add one multi-leg transfer |
| `src/store/wms-store.ts` | Modify | Replace `advanceTransfer` with `dispatchLeg` + `receiveLeg`; add `createTransferOrder` |
| `src/app/(app)/transfers/columns.tsx` | Modify | Add `currentNodeName` and `legsProgress` columns to `TransferRow` and column defs |
| `src/app/(app)/transfers/_components/transfer-itinerary.tsx` | Create | Visual itinerary stepper component |
| `src/app/(app)/transfers/_components/receive-leg-dialog.tsx` | Create | Dialog for receiving a leg at destination |
| `src/app/(app)/transfers/_components/create-transfer-dialog.tsx` | Create | Dialog for creating single or multi-leg transfers |
| `src/app/(app)/transfers/_components/transfer-detail-sheet.tsx` | Modify | Add itinerary section; replace advance button with dispatch/receive actions |
| `src/app/(app)/transfers/page.tsx` | Modify | Add 2 new KPIs; add create button; add `partial_received` to status filter |
| `src/app/(app)/admin/page.tsx` | Modify | Show transit badge on warehouse list; no form changes needed (out of scope for MVP) |

---

## Task 1: Types — TransferLeg, TransitWarehouseRole, extend Warehouse and TransferOrder

**Files:**
- Modify: `src/types/wms.ts`

**Interfaces:**
- Produces: `TransferLegStatus`, `TransitWarehouseRole`, `TransferLeg`, updated `Warehouse`, updated `TransferOrder` — consumed by every subsequent task

- [ ] **Step 1: Add new types after the `TransferOrder` interface**

Open `src/types/wms.ts`. After line ~230 (end of `TransferOrder`), insert:

```ts
export type TransitWarehouseRole = 'hub' | 'cross_dock' | 'consolidation'

export type TransferLegStatus = 'pending' | 'in_transit' | 'received' | 'cancelled'

export interface TransferLeg {
  id: string
  sequence: number
  originId: string
  destinationId: string
  status: TransferLegStatus
  estimatedArrivalDate: string
  dispatchedAt?: string
  receivedAt?: string
  operatorName?: string
  notes?: string
}
```

- [ ] **Step 2: Extend `Warehouse` interface**

Find the `Warehouse` interface (line ~46). Add optional fields:

```ts
export interface Warehouse {
  id: string
  code: string
  name: string
  city: string
  type: 'distribution_center' | 'store' | 'transit'
  deliveryWindows?: DeliveryWindow[]
  transitRole?: TransitWarehouseRole
  maxTransitDays?: number
}
```

- [ ] **Step 3: Extend `TransferOrder` interface**

Find `TransferOrder` (line ~219). Add three fields while keeping all existing fields:

```ts
export interface TransferOrder {
  id: string
  code: string
  type: 'dc_to_store' | 'store_to_store' | 'store_to_dc' | 'dc_to_dc' | 'multi_leg'
  originId: string
  destinationId: string
  status: OperationalStatus
  createdAt: string
  estimatedArrivalDate: string
  routeId?: string
  items: OrderLine[]
  legs: TransferLeg[]
  isMultiLeg: boolean
  currentLegIndex: number
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only in files that use `TransferOrder` without `legs` (seed.ts, store) — those get fixed in later tasks. Zero errors in `types/wms.ts` itself.

- [ ] **Step 5: Commit**

```bash
git add src/types/wms.ts
git commit -m "feat(types): add TransferLeg, TransitWarehouseRole, extend Warehouse and TransferOrder"
```

---

## Task 2: State machines and status map

**Files:**
- Modify: `src/lib/state-machines.ts`
- Modify: `src/lib/status.ts`

**Interfaces:**
- Consumes: `TransferLegStatus` from Task 1
- Produces: `legTransitions` map; `partial_received` in `transferTransitions` and `STATUS_MAP`

- [ ] **Step 1: Add `partial_received` to `transferTransitions` and add `legTransitions`**

Open `src/lib/state-machines.ts`. Replace the `transferTransitions` block and add `legTransitions` after it:

```ts
export const transferTransitions: Record<string, OperationalStatus[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['in_progress', 'cancelled'],
  in_progress: ['in_transit'],
  in_transit: ['partial_received', 'completed', 'cancelled'],
  partial_received: ['in_transit', 'completed', 'cancelled'],
  partial: ['completed'],
  completed: [],
  cancelled: [],
}

export const legTransitions: Record<string, string[]> = {
  pending: ['in_transit', 'cancelled'],
  in_transit: ['received', 'cancelled'],
  received: [],
  cancelled: [],
}
```

- [ ] **Step 2: Add `partial_received` to STATUS_MAP**

Open `src/lib/status.ts`. In `STATUS_MAP`, add after the `in_transit` entry:

```ts
partial_received: { label: 'Recibido parcial', variant: 'warning' },
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "state-machines\|status.ts"
```

Expected: no errors in these files.

- [ ] **Step 4: Commit**

```bash
git add src/lib/state-machines.ts src/lib/status.ts
git commit -m "feat(fsm): add partial_received to transfer FSM and legTransitions map"
```

---

## Task 3: Seed data migration

**Files:**
- Modify: `src/data/seed.ts`

**Interfaces:**
- Consumes: `TransferLeg`, updated `TransferOrder`, updated `Warehouse` from Task 1

- [ ] **Step 1: Add a transit warehouse**

Find the `warehouses` array (line ~37). Add after the last warehouse entry:

```ts
{
  id: 'wh-hub-bog',
  code: 'HUB-BOG',
  name: 'Hub Bogotá Norte',
  city: 'Bogotá',
  type: 'transit' as const,
  transitRole: 'hub' as const,
  maxTransitDays: 2,
},
```

- [ ] **Step 2: Migrate existing transfers to leg format**

Find the `transfers` array (line ~916). Replace the three existing transfers with leg-aware versions:

```ts
export const transfers: TransferOrder[] = [
  {
    id: 'tr-1',
    code: 'TR-2406-001',
    type: 'dc_to_store',
    originId: 'wh-bog',
    destinationId: 'wh-andino',
    status: 'in_transit',
    createdAt: '2026-06-07T08:00:00.000Z',
    estimatedArrivalDate: '2026-06-11',
    routeId: 'route-1',
    items: [
      { id: 'trl-1', productId: 'p-socks', requestedQuantity: 100 },
      { id: 'trl-2', productId: 'p-cap', requestedQuantity: 50 },
    ],
    legs: [
      {
        id: 'leg-tr1-1',
        sequence: 1,
        originId: 'wh-bog',
        destinationId: 'wh-andino',
        status: 'in_transit',
        estimatedArrivalDate: '2026-06-11',
        dispatchedAt: '2026-06-07T08:00:00.000Z',
      },
    ],
    isMultiLeg: false,
    currentLegIndex: 0,
  },
  {
    id: 'tr-2',
    code: 'TR-2406-002',
    type: 'store_to_store',
    originId: 'wh-andino',
    destinationId: 'wh-unicentro',
    status: 'draft',
    createdAt: '2026-06-09T08:00:00.000Z',
    estimatedArrivalDate: '2026-06-13',
    items: [{ id: 'trl-3', productId: 'p-tshirt', requestedQuantity: 30 }],
    legs: [
      {
        id: 'leg-tr2-1',
        sequence: 1,
        originId: 'wh-andino',
        destinationId: 'wh-unicentro',
        status: 'pending',
        estimatedArrivalDate: '2026-06-13',
      },
    ],
    isMultiLeg: false,
    currentLegIndex: 0,
  },
  {
    id: 'tr-3',
    code: 'TR-2406-003',
    type: 'store_to_dc',
    originId: 'wh-viva',
    destinationId: 'wh-med',
    status: 'completed',
    createdAt: '2026-06-04T08:00:00.000Z',
    estimatedArrivalDate: '2026-06-08',
    items: [{ id: 'trl-4', productId: 'p-jeans', requestedQuantity: 20 }],
    legs: [
      {
        id: 'leg-tr3-1',
        sequence: 1,
        originId: 'wh-viva',
        destinationId: 'wh-med',
        status: 'received',
        estimatedArrivalDate: '2026-06-08',
        dispatchedAt: '2026-06-04T08:00:00.000Z',
        receivedAt: '2026-06-08T14:00:00.000Z',
        operatorName: 'Operador Demo',
      },
    ],
    isMultiLeg: false,
    currentLegIndex: 0,
  },
  {
    id: 'tr-4',
    code: 'TR-2406-004',
    type: 'multi_leg',
    originId: 'wh-bog',
    destinationId: 'wh-santafe',
    status: 'partial_received',
    createdAt: '2026-06-15T08:00:00.000Z',
    estimatedArrivalDate: '2026-06-20',
    items: [
      { id: 'trl-5', productId: 'p-sneakers', requestedQuantity: 40 },
    ],
    legs: [
      {
        id: 'leg-tr4-1',
        sequence: 1,
        originId: 'wh-bog',
        destinationId: 'wh-hub-bog',
        status: 'received',
        estimatedArrivalDate: '2026-06-17',
        dispatchedAt: '2026-06-15T08:00:00.000Z',
        receivedAt: '2026-06-17T10:00:00.000Z',
        operatorName: 'Operador Hub',
      },
      {
        id: 'leg-tr4-2',
        sequence: 2,
        originId: 'wh-hub-bog',
        destinationId: 'wh-santafe',
        status: 'in_transit',
        estimatedArrivalDate: '2026-06-20',
        dispatchedAt: '2026-06-17T14:00:00.000Z',
      },
    ],
    isMultiLeg: true,
    currentLegIndex: 1,
  },
]
```

- [ ] **Step 3: Verify TypeScript compiles cleanly on seed.ts**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "seed.ts"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/data/seed.ts
git commit -m "feat(seed): migrate transfers to leg format, add transit warehouse wh-hub-bog, add multi-leg tr-4"
```

---

## Task 4: Store actions — dispatchLeg, receiveLeg, createTransferOrder

**Files:**
- Modify: `src/store/wms-store.ts`

**Interfaces:**
- Consumes: `TransferLeg`, `TransferLegStatus`, `legTransitions` from Tasks 1–2
- Produces:
  - `dispatchLeg(transferId: string, legId: string, operatorName: string): TransferOrder`
  - `receiveLeg(transferId: string, legId: string, operatorName: string, notes?: string): TransferOrder`
  - `createTransferOrder(payload: { legs: Array<{originId: string; destinationId: string; estimatedArrivalDate: string}>; items: OrderLine[]; operatorName: string }): TransferOrder`

- [ ] **Step 1: Add `dispatchLeg` and `receiveLeg` to the store interface**

Find the store interface section (around line 226 where `advanceTransfer` is declared). Replace `advanceTransfer`'s declaration and add the new ones:

```ts
dispatchLeg: (transferId: string, legId: string, operatorName: string) => TransferOrder
receiveLeg: (transferId: string, legId: string, operatorName: string, notes?: string) => TransferOrder
createTransferOrder: (payload: {
  legs: Array<{ originId: string; destinationId: string; estimatedArrivalDate: string }>
  items: OrderLine[]
  operatorName: string
}) => TransferOrder
```

Keep `advanceTransfer` in the interface for now — it will be updated in step 2.

- [ ] **Step 2: Implement `dispatchLeg`**

Find the `advanceTransfer` implementation (~line 1803). After its closing brace, add:

```ts
dispatchLeg: (transferId, legId, operatorName) => {
  const state = get()
  const transfer = state.transfers.find((t) => t.id === transferId)
  if (!transfer) throw new Error('Traslado no encontrado')

  const legIdx = transfer.legs.findIndex((l) => l.id === legId)
  if (legIdx === -1) throw new Error('Tramo no encontrado')

  const leg = transfer.legs[legIdx]
  if (!legTransitions[leg.status]?.includes('in_transit')) {
    throw new Error(`No se puede despachar desde el estado ${leg.status}`)
  }

  const now = new Date().toISOString()
  const updatedLeg: TransferLeg = {
    ...leg,
    status: 'in_transit',
    dispatchedAt: now,
    operatorName,
  }

  const updatedLegs = transfer.legs.map((l) => (l.id === legId ? updatedLeg : l))

  const orderStatus: OperationalStatus =
    transfer.status === 'partial_received' ? 'in_transit' : transfer.status === 'in_progress' ? 'in_transit' : transfer.status

  const updatedTransfer: TransferOrder = {
    ...transfer,
    legs: updatedLegs,
    status: orderStatus,
  }

  set({
    transfers: state.transfers.map((t) => (t.id === transferId ? updatedTransfer : t)),
  })

  return updatedTransfer
},
```

- [ ] **Step 3: Implement `receiveLeg`**

Immediately after `dispatchLeg`, add:

```ts
receiveLeg: (transferId, legId, operatorName, notes) => {
  const state = get()
  const transfer = state.transfers.find((t) => t.id === transferId)
  if (!transfer) throw new Error('Traslado no encontrado')

  const legIdx = transfer.legs.findIndex((l) => l.id === legId)
  if (legIdx === -1) throw new Error('Tramo no encontrado')

  const leg = transfer.legs[legIdx]
  if (!legTransitions[leg.status]?.includes('received')) {
    throw new Error(`No se puede recepcionar desde el estado ${leg.status}`)
  }

  const now = new Date().toISOString()
  const updatedLeg: TransferLeg = {
    ...leg,
    status: 'received',
    receivedAt: now,
    operatorName,
    notes,
  }

  const updatedLegs = transfer.legs.map((l) => (l.id === legId ? updatedLeg : l))

  const isLastLeg = legIdx === transfer.legs.length - 1
  const newCurrentLegIndex = isLastLeg ? transfer.currentLegIndex : legIdx + 1
  const newOrderStatus: OperationalStatus = isLastLeg ? 'completed' : 'partial_received'

  // Create inventory movement: stock arrives at destination
  const movement = recordMovement({
    productId: transfer.items[0]?.productId ?? '',
    warehouseId: leg.destinationId,
    type: 'transfer',
    quantity: transfer.items.reduce((s, i) => s + i.requestedQuantity, 0),
    referenceType: 'transfer',
    referenceId: transferId,
    operatorName,
  })

  const updatedTransfer: TransferOrder = {
    ...transfer,
    legs: updatedLegs,
    currentLegIndex: newCurrentLegIndex,
    status: newOrderStatus,
  }

  set({
    transfers: state.transfers.map((t) => (t.id === transferId ? updatedTransfer : t)),
    stockMovements: [...state.stockMovements, movement],
  })

  return updatedTransfer
},
```

- [ ] **Step 4: Implement `createTransferOrder`**

After `receiveLeg`, add:

```ts
createTransferOrder: (payload) => {
  const state = get()
  const id = `tr-${Date.now()}`
  const now = new Date().toISOString()

  const legs: TransferLeg[] = payload.legs.map((l, i) => ({
    id: `leg-${id}-${i + 1}`,
    sequence: i + 1,
    originId: l.originId,
    destinationId: l.destinationId,
    status: 'pending' as TransferLegStatus,
    estimatedArrivalDate: l.estimatedArrivalDate,
  }))

  const firstLeg = legs[0]
  const lastLeg = legs[legs.length - 1]
  const isMultiLeg = legs.length > 1

  const transfer: TransferOrder = {
    id,
    code: `TR-${now.slice(0, 7).replace('-', '')}-${String(state.transfers.length + 1).padStart(3, '0')}`,
    type: isMultiLeg ? 'multi_leg' : (
      // derive type from leg endpoints
      'dc_to_store' // simplified — UI passes type explicitly if needed
    ),
    originId: firstLeg.originId,
    destinationId: lastLeg.destinationId,
    status: 'draft',
    createdAt: now,
    estimatedArrivalDate: lastLeg.estimatedArrivalDate,
    items: payload.items,
    legs,
    isMultiLeg,
    currentLegIndex: 0,
  }

  set({ transfers: [...state.transfers, transfer] })
  return transfer
},
```

- [ ] **Step 5: Update `advanceTransfer` to delegate to leg actions**

The existing `advanceTransfer` is still called by `TransferDetailSheet` (will be replaced in Task 7, but keep it working for now). Replace its implementation body so it delegates to `dispatchLeg` for the current leg's next step:

```ts
advanceTransfer: (transferId, operatorName) => {
  const state = get()
  const transfer = state.transfers.find((t) => t.id === transferId)
  if (!transfer) throw new Error('transfer not found')

  const currentLeg = transfer.legs[transfer.currentLegIndex]
  if (!currentLeg) throw new Error('No hay tramo activo')

  if (currentLeg.status === 'pending') {
    return state.dispatchLeg(transferId, currentLeg.id, operatorName)
  }
  if (currentLeg.status === 'in_transit') {
    return state.receiveLeg(transferId, currentLeg.id, operatorName)
  }

  throw new Error(`No se puede avanzar traslado desde el estado del tramo ${currentLeg.status}`)
},
```

- [ ] **Step 6: Add import for `legTransitions` and `TransferLeg` at top of store**

Find the imports at the top of `wms-store.ts`. Add:

```ts
import { legTransitions } from '@/lib/state-machines'
import type { ..., TransferLeg, TransferLegStatus } from '@/types/wms'
```

(Add to the existing import lines — don't duplicate what's already imported.)

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -40
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/store/wms-store.ts
git commit -m "feat(store): add dispatchLeg, receiveLeg, createTransferOrder; refactor advanceTransfer to delegate to leg actions"
```

---

## Task 5: TransferRow columns — add currentNodeName and legsProgress

**Files:**
- Modify: `src/app/(app)/transfers/columns.tsx`

**Interfaces:**
- Consumes: updated `TransferOrder` from Task 1
- Produces: `TransferRow` with `currentNodeName: string` and `legsProgress: string`; updated `buildTransferColumns()`

- [ ] **Step 1: Extend `TransferRow`**

Open `src/app/(app)/transfers/columns.tsx`. Update the `TransferRow` interface:

```ts
export interface TransferRow {
  id: string
  code: string
  type: TransferOrder['type']
  originName: string
  destinationName: string
  currentNodeName: string
  legsProgress: string
  isMultiLeg: boolean
  linesCount: number
  estimatedArrivalDate: string
  status: string
}
```

- [ ] **Step 2: Add new column defs**

In `buildTransferColumns()`, add these two columns after the `route` column and before `linesCount`:

```ts
{
  id: 'currentNode',
  header: 'Nodo actual',
  cell: ({ row }) => (
    <div className="flex items-center gap-1.5 text-sm">
      {row.original.isMultiLeg && (
        <Badge variant="outline" className="text-[10px]">
          {row.original.legsProgress}
        </Badge>
      )}
      <span className="truncate max-w-[140px]">{row.original.currentNodeName}</span>
    </div>
  ),
  enableSorting: false,
},
```

- [ ] **Step 3: Add `multi_leg` to `TYPE_LABELS`**

```ts
export const TYPE_LABELS: Record<TransferOrder['type'], string> = {
  dc_to_store: 'DC → Tienda',
  store_to_store: 'Tienda → Tienda',
  store_to_dc: 'Tienda → DC',
  dc_to_dc: 'DC → DC',
  multi_leg: 'Multi-tramo',
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "columns.tsx"
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/transfers/columns.tsx
git commit -m "feat(transfers): add currentNodeName and legsProgress columns to TransferRow"
```

---

## Task 6: TransferItinerary component

**Files:**
- Create: `src/app/(app)/transfers/_components/transfer-itinerary.tsx`

**Interfaces:**
- Consumes: `TransferLeg[]`, `TransferLegStatus`, `warehouseName(id: string): string` helper
- Produces: `<TransferItinerary legs={legs} getWarehouseName={fn} />` — used in Task 7

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { Check, ArrowRight, Clock, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/formatters'
import { StatusBadge } from '@/components/shared/status-badge'
import type { TransferLeg } from '@/types/wms'

interface Props {
  legs: TransferLeg[]
  getWarehouseName: (id: string) => string
  currentLegIndex: number
}

export const TransferItinerary = ({ legs, getWarehouseName, currentLegIndex }: Props) => {
  return (
    <section className="space-y-3">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Itinerario ({legs.length} {legs.length === 1 ? 'tramo' : 'tramos'})
      </h3>

      {/* Node dots timeline */}
      <div className="flex items-start">
        {legs.map((leg, i) => {
          const isReceived = leg.status === 'received'
          const isActive = i === currentLegIndex && leg.status === 'in_transit'
          const isPending = leg.status === 'pending'
          const isLast = i === legs.length - 1

          return (
            <div key={leg.id} className="flex flex-1 flex-col items-start">
              <div className="flex w-full items-center">
                {/* Origin node */}
                <div
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
                    isReceived && 'border-emerald-500 bg-emerald-500 text-white',
                    isActive && 'border-amber-500 bg-amber-500 text-white',
                    isPending && 'border-zinc-300 bg-white text-zinc-400'
                  )}
                >
                  {isReceived ? <Check className="size-3" /> : isActive ? <Truck className="size-3" /> : <Clock className="size-3" />}
                </div>
                {/* Connector line */}
                <div
                  className={cn(
                    'h-0.5 flex-1',
                    isReceived ? 'bg-emerald-400' : isActive ? 'bg-amber-300' : 'bg-zinc-200'
                  )}
                />
                {/* Destination node (only for last leg) */}
                {isLast && (
                  <div
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
                      leg.status === 'received' && 'border-emerald-500 bg-emerald-500 text-white',
                      leg.status !== 'received' && 'border-zinc-300 bg-white text-zinc-400'
                    )}
                  >
                    {leg.status === 'received' ? <Check className="size-3" /> : <Clock className="size-3" />}
                  </div>
                )}
              </div>
              {/* Origin label */}
              <p className={cn(
                'mt-1 text-[10px] leading-tight max-w-[80px]',
                isActive ? 'font-semibold text-amber-600' : 'text-muted-foreground'
              )}>
                {getWarehouseName(leg.originId)}
              </p>
            </div>
          )
        })}
      </div>

      {/* Last destination label */}
      <p className="text-muted-foreground text-[10px]">
        → {getWarehouseName(legs[legs.length - 1]?.destinationId ?? '')}
      </p>

      {/* Leg detail rows */}
      <div className="space-y-2">
        {legs.map((leg, i) => (
          <div
            key={leg.id}
            className={cn(
              'rounded-md border p-3 text-sm',
              i === currentLegIndex && leg.status !== 'received' && 'border-amber-200 bg-amber-50'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-medium">
                <span className="text-muted-foreground text-xs">Tramo {leg.sequence}</span>
                <ArrowRight className="text-muted-foreground size-3" />
                <span className="text-xs">{getWarehouseName(leg.originId)}</span>
                <ArrowRight className="text-muted-foreground size-3" />
                <span className="text-xs">{getWarehouseName(leg.destinationId)}</span>
              </div>
              <StatusBadge status={leg.status} />
            </div>
            <div className="text-muted-foreground mt-1 flex gap-4 text-[11px]">
              <span>ETA: {formatDate(leg.estimatedArrivalDate)}</span>
              {leg.dispatchedAt && <span>Despachado: {formatDate(leg.dispatchedAt)}</span>}
              {leg.receivedAt && <span>Recibido: {formatDate(leg.receivedAt)}</span>}
              {leg.operatorName && <span>Op: {leg.operatorName}</span>}
            </div>
            {leg.notes && (
              <p className="text-muted-foreground mt-1 text-[11px] italic">{leg.notes}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "transfer-itinerary"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/transfers/_components/transfer-itinerary.tsx
git commit -m "feat(transfers): add TransferItinerary component with leg stepper"
```

---

## Task 7: ReceiveLegDialog component

**Files:**
- Create: `src/app/(app)/transfers/_components/receive-leg-dialog.tsx`

**Interfaces:**
- Consumes: `receiveLeg(transferId, legId, operatorName, notes?)` from Task 4; `TransferLeg` from Task 1
- Produces: `<ReceiveLegDialog transfer={...} leg={...} open={...} onClose={fn} />`

- [ ] **Step 1: Create the dialog**

```tsx
'use client'

import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { PackageCheck } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatNumber } from '@/lib/formatters'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { TransferLeg, TransferOrder } from '@/types/wms'

const schema = z.object({
  operatorName: z.string().min(1, 'Requerido'),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  transfer: TransferOrder
  leg: TransferLeg
  open: boolean
  onClose: () => void
}

export const ReceiveLegDialog = ({ transfer, leg, open, onClose }: Props) => {
  const { receiveLeg } = useWmsStore()
  const { getProduct, warehouseName } = useStoreHelpers()
  const { operators } = useWmsStore()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { operatorName: '', notes: '' },
  })

  const handleSubmit = (values: FormValues) => {
    try {
      receiveLeg(transfer.id, leg.id, values.operatorName, values.notes || undefined)
      form.reset()
      onClose()
    } catch (e: unknown) {
      form.setError('root', {
        message: e instanceof Error ? e.message : 'Error al recepcionar tramo',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="size-4" />
            Recepcionar Tramo {leg.sequence}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Confirmando llegada a <strong>{warehouseName(leg.destinationId)}</strong>
          </p>

          {/* Items summary */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Esperado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfer.items.map((line) => {
                  const product = getProduct(line.productId)
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="text-sm">{product?.name ?? line.productId}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(line.requestedQuantity)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="operatorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Operario que recibe</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar operario" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {operators.map((op) => (
                          <SelectItem key={op.id} value={op.name}>
                            {op.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas / discrepancias (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ej: 3 unidades con embalaje dañado..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.formState.errors.root && (
                <p className="text-destructive text-xs">{form.formState.errors.root.message}</p>
              )}

              <DialogFooter>
                <Button variant="outline" type="button" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit">
                  <PackageCheck className="mr-1.5 size-4" />
                  Confirmar recepción
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "receive-leg-dialog"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/transfers/_components/receive-leg-dialog.tsx
git commit -m "feat(transfers): add ReceiveLegDialog for confirming leg arrival"
```

---

## Task 8: CreateTransferDialog component

**Files:**
- Create: `src/app/(app)/transfers/_components/create-transfer-dialog.tsx`

**Interfaces:**
- Consumes: `createTransferOrder(payload)` from Task 4; `Warehouse[]` and `Product[]` from store
- Produces: `<CreateTransferDialog open={...} onClose={fn} />`

- [ ] **Step 1: Create the dialog**

```tsx
'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2, ArrowRight } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

const lineSchema = z.object({
  productId: z.string().min(1, 'Requerido'),
  requestedQuantity: z.coerce.number().int().positive('Debe ser > 0'),
})

const schema = z.object({
  originId: z.string().min(1, 'Requerido'),
  destinationId: z.string().min(1, 'Requerido'),
  estimatedArrivalDate: z.string().min(1, 'Requerido'),
  transitStops: z.array(z.object({
    warehouseId: z.string().min(1, 'Requerido'),
    estimatedArrivalDate: z.string().min(1, 'Requerido'),
  })),
  items: z.array(lineSchema).min(1, 'Agrega al menos un producto'),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
}

export const CreateTransferDialog = ({ open, onClose }: Props) => {
  const { warehouses, products, createTransferOrder } = useWmsStore()
  const [multiLeg, setMultiLeg] = useState(false)

  const transitWarehouses = warehouses.filter((w) => w.type === 'transit')
  const regularWarehouses = warehouses.filter((w) => w.type !== 'transit')

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      originId: '',
      destinationId: '',
      estimatedArrivalDate: '',
      transitStops: [],
      items: [{ productId: '', requestedQuantity: 1 }],
    },
  })

  const stopsArray = useFieldArray({ control: form.control, name: 'transitStops' })
  const itemsArray = useFieldArray({ control: form.control, name: 'items' })

  const handleMultiLegToggle = (checked: boolean) => {
    setMultiLeg(checked)
    if (!checked) form.setValue('transitStops', [])
  }

  const handleSubmit = (values: FormValues) => {
    try {
      const legs = [
        // first leg: origin → first stop (or final destination)
        {
          originId: values.originId,
          destinationId: multiLeg && values.transitStops[0]
            ? values.transitStops[0].warehouseId
            : values.destinationId,
          estimatedArrivalDate: multiLeg && values.transitStops[0]
            ? values.transitStops[0].estimatedArrivalDate
            : values.estimatedArrivalDate,
        },
        // intermediate legs
        ...values.transitStops.slice(1).map((stop, i) => ({
          originId: values.transitStops[i].warehouseId,
          destinationId: stop.warehouseId,
          estimatedArrivalDate: stop.estimatedArrivalDate,
        })),
        // last leg (if multi-leg): last stop → final destination
        ...(multiLeg && values.transitStops.length > 0 ? [{
          originId: values.transitStops[values.transitStops.length - 1].warehouseId,
          destinationId: values.destinationId,
          estimatedArrivalDate: values.estimatedArrivalDate,
        }] : []),
      ]

      const items = values.items.map((item, i) => ({
        id: `item-new-${i}`,
        productId: item.productId,
        requestedQuantity: item.requestedQuantity,
      }))

      createTransferOrder({ legs, items, operatorName: 'Sistema' })
      form.reset()
      setMultiLeg(false)
      onClose()
    } catch (e: unknown) {
      form.setError('root', {
        message: e instanceof Error ? e.message : 'Error al crear traslado',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo traslado</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
            {/* Origin */}
            <FormField
              control={form.control}
              name="originId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Origen</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar bodega origen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {regularWarehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Multi-leg toggle */}
            {transitWarehouses.length > 0 && (
              <div className="flex items-center gap-3">
                <Switch
                  id="multi-leg"
                  checked={multiLeg}
                  onCheckedChange={handleMultiLegToggle}
                />
                <Label htmlFor="multi-leg" className="text-sm">
                  Agregar parada intermedia
                </Label>
              </div>
            )}

            {/* Transit stops */}
            {multiLeg && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-muted-foreground text-xs font-medium uppercase">Paradas intermedias</p>
                {stopsArray.fields.map((field, i) => (
                  <div key={field.id} className="flex items-end gap-2">
                    <FormField
                      control={form.control}
                      name={`transitStops.${i}.warehouseId`}
                      render={({ field: f }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="text-xs">Bodega transitoria</FormLabel>
                          <Select onValueChange={f.onChange} value={f.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Hub / cross-dock" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {transitWarehouses.map((w) => (
                                <SelectItem key={w.id} value={w.id}>
                                  <div className="flex items-center gap-2">
                                    {w.name}
                                    <Badge variant="outline" className="text-[10px]">
                                      {w.transitRole ?? 'hub'}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`transitStops.${i}.estimatedArrivalDate`}
                      render={({ field: f }) => (
                        <FormItem className="w-36">
                          <FormLabel className="text-xs">ETA</FormLabel>
                          <FormControl>
                            <Input type="date" {...f} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mb-0.5"
                      onClick={() => stopsArray.remove(i)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => stopsArray.append({ warehouseId: '', estimatedArrivalDate: '' })}
                >
                  <Plus className="mr-1.5 size-3.5" />
                  Agregar parada
                </Button>
              </div>
            )}

            {/* Destination */}
            <FormField
              control={form.control}
              name="destinationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destino final</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar bodega destino" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {regularWarehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="estimatedArrivalDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha estimada de llegada al destino final</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Items */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Productos</p>
              {itemsArray.fields.map((field, i) => (
                <div key={field.id} className="flex items-end gap-2">
                  <FormField
                    control={form.control}
                    name={`items.${i}.productId`}
                    render={({ field: f }) => (
                      <FormItem className="flex-1">
                        <Select onValueChange={f.onChange} value={f.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Producto" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`items.${i}.requestedQuantity`}
                    render={({ field: f }) => (
                      <FormItem className="w-24">
                        <FormControl>
                          <Input type="number" min={1} placeholder="Cant." {...f} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {itemsArray.fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mb-0.5"
                      onClick={() => itemsArray.remove(i)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => itemsArray.append({ productId: '', requestedQuantity: 1 })}
              >
                <Plus className="mr-1.5 size-3.5" />
                Agregar producto
              </Button>
            </div>

            {form.formState.errors.root && (
              <p className="text-destructive text-xs">{form.formState.errors.root.message}</p>
            )}

            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit">
                <ArrowRight className="mr-1.5 size-4" />
                Crear traslado
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "create-transfer-dialog"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/transfers/_components/create-transfer-dialog.tsx
git commit -m "feat(transfers): add CreateTransferDialog with multi-leg itinerary builder"
```

---

## Task 9: Update TransferDetailSheet with itinerary and leg actions

**Files:**
- Modify: `src/app/(app)/transfers/_components/transfer-detail-sheet.tsx`

**Interfaces:**
- Consumes: `<TransferItinerary>` from Task 6; `<ReceiveLegDialog>` from Task 7; `dispatchLeg` and `receiveLeg` from Task 4

- [ ] **Step 1: Replace the sheet content**

Replace the entire file content with:

```tsx
'use client'

import { useState } from 'react'
import { ArrowRight, CheckCircle2, PackageCheck, Truck, TriangleAlert } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { useDialogState } from '@/hooks/use-dialog-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { TransferItinerary } from './transfer-itinerary'
import { ReceiveLegDialog } from './receive-leg-dialog'
import type { TransferLeg, TransferOrder } from '@/types/wms'

interface Props {
  transfer: TransferOrder | null
  originName: string
  destinationName: string
  getProduct: (id: string) => { name: string; imageUrl?: string } | undefined
  getWarehouseName: (id: string) => string
  open: boolean
  onClose: () => void
}

export const TransferDetailSheet = ({
  transfer,
  originName,
  destinationName,
  getProduct,
  getWarehouseName,
  open,
  onClose,
}: Props) => {
  const { dispatchLeg } = useWmsStore()
  const [error, setError] = useState('')
  const receiveLegDialog = useDialogState<TransferLeg>()

  if (!transfer) return null

  const currentLeg = transfer.legs[transfer.currentLegIndex]
  const isTerminal = transfer.status === 'completed' || transfer.status === 'cancelled'

  const canDispatch = currentLeg?.status === 'pending'
  const canReceive = currentLeg?.status === 'in_transit'

  const handleDispatch = () => {
    if (!currentLeg) return
    try {
      dispatchLeg(transfer.id, currentLeg.id, 'Operador')
      setError('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al despachar tramo')
    }
  }

  const isOverdue =
    !isTerminal && new Date(transfer.estimatedArrivalDate) < new Date()

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-140!">
          <SheetHeader className="border-b px-6 pb-4">
            <SheetTitle className="flex items-center gap-2">
              {transfer.code}
              <StatusBadge status={transfer.status} />
              {transfer.isMultiLeg && (
                <span className="text-muted-foreground text-xs font-normal">
                  Multi-tramo · {transfer.currentLegIndex + 1}/{transfer.legs.length}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-6 py-6">
            {/* Ruta resumen */}
            <section className="space-y-2">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Ruta
              </h3>
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>{originName}</span>
                <ArrowRight className="text-muted-foreground size-4 shrink-0" />
                <span>{destinationName}</span>
              </div>
              <div className="text-muted-foreground flex gap-4 text-xs">
                <span>Creado: {formatDate(transfer.createdAt)}</span>
                <span className={cn('flex items-center gap-1', isOverdue && 'font-medium text-red-600')}>
                  ETA: {formatDate(transfer.estimatedArrivalDate)}
                  {isOverdue && ' · Atrasado'}
                </span>
              </div>
            </section>

            {/* Itinerary stepper */}
            <TransferItinerary
              legs={transfer.legs}
              getWarehouseName={getWarehouseName}
              currentLegIndex={transfer.currentLegIndex}
            />

            {/* Product lines */}
            <section className="space-y-2">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Líneas ({transfer.items.length})
              </h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Solicitado</TableHead>
                      <TableHead className="text-right">Pickeado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfer.items.map((line) => {
                      const product = getProduct(line.productId)
                      return (
                        <TableRow key={line.id}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              {product?.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="size-9 rounded-md border object-cover"
                                />
                              ) : (
                                <div className="bg-muted size-9 rounded-md border" />
                              )}
                              <span className="text-sm">{product?.name ?? line.productId}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(line.requestedQuantity)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-right tabular-nums">
                            {line.pickedQuantity != null ? formatNumber(line.pickedQuantity) : '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>

          {/* Footer actions */}
          <div className="border-t px-6 pt-4 pb-4">
            {!isTerminal && currentLeg ? (
              <div className="flex w-full flex-col gap-2">
                {error && (
                  <p className="text-destructive flex items-center gap-1 text-xs">
                    <TriangleAlert className="size-3" /> {error}
                  </p>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="text-muted-foreground text-xs">
                    Tramo {currentLeg.sequence}: {getWarehouseName(currentLeg.originId)} → {getWarehouseName(currentLeg.destinationId)}
                  </div>
                  {canDispatch && (
                    <Button size="sm" onClick={handleDispatch}>
                      <Truck className="mr-1.5 size-4" />
                      Despachar tramo {currentLeg.sequence}
                    </Button>
                  )}
                  {canReceive && (
                    <Button size="sm" onClick={() => receiveLegDialog.open(currentLeg)}>
                      <PackageCheck className="mr-1.5 size-4" />
                      Recepcionar en {getWarehouseName(currentLeg.destinationId)}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                {transfer.status === 'completed' && 'Traslado completado.'}
                {transfer.status === 'cancelled' && 'Traslado cancelado.'}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {receiveLegDialog.data && (
        <ReceiveLegDialog
          transfer={transfer}
          leg={receiveLegDialog.data}
          open={!!receiveLegDialog.data}
          onClose={receiveLegDialog.close}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "transfer-detail-sheet"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/transfers/_components/transfer-detail-sheet.tsx
git commit -m "feat(transfers): replace TransferDetailSheet with itinerary stepper and dispatch/receive leg actions"
```

---

## Task 10: Update /transfers page — new KPIs, create button, row mapping, status filter

**Files:**
- Modify: `src/app/(app)/transfers/page.tsx`

**Interfaces:**
- Consumes: updated `TransferRow` from Task 5; `<CreateTransferDialog>` from Task 8; updated `TransferDetailSheet` Props (adds `getWarehouseName`)

- [ ] **Step 1: Replace the page content**

Replace the full file:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { ArrowRightLeft, CheckCircle2, Clock, Plus, Truck, Warehouse } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { useDialogState } from '@/hooks/use-dialog-state'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatNumber } from '@/lib/formatters'
import { buildTransferColumns, type TransferRow } from './columns'
import { TransferDetailSheet } from './_components/transfer-detail-sheet'
import { CreateTransferDialog } from './_components/create-transfer-dialog'
import type { TransferOrder } from '@/types/wms'

const TERMINAL_STATUSES = new Set(['completed', 'cancelled'])

export default function TransfersPage() {
  const state = useWmsStore()
  const { warehouseName, getProduct } = useStoreHelpers()

  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const detailSheet = useDialogState<{ id: string }>()
  const createDialog = useDialogState()

  const rows = useMemo<TransferRow[]>(
    () =>
      state.transfers.map((t) => {
        const currentLeg = t.legs[t.currentLegIndex]
        return {
          id: t.id,
          code: t.code,
          type: t.type,
          originName: warehouseName(t.originId),
          destinationName: warehouseName(t.destinationId),
          currentNodeName: currentLeg
            ? warehouseName(currentLeg.destinationId)
            : warehouseName(t.destinationId),
          legsProgress: `${t.currentLegIndex + 1}/${t.legs.length}`,
          isMultiLeg: t.isMultiLeg,
          linesCount: t.items.length,
          estimatedArrivalDate: t.estimatedArrivalDate,
          status: t.status,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.transfers]
  )

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (typeFilter !== 'all' && r.type !== typeFilter) return false
        if (statusFilter !== 'all' && r.status !== statusFilter) return false
        return true
      }),
    [rows, typeFilter, statusFilter]
  )

  const inTransitCount = state.transfers.filter((t) => t.status === 'in_transit').length
  const pendingCount = state.transfers.filter(
    (t) => t.status === 'draft' || t.status === 'pending'
  ).length
  const completedCount = state.transfers.filter((t) => t.status === 'completed').length
  const inTransitWarehouseCount = state.transfers.filter(
    (t) => t.status === 'partial_received'
  ).length
  const multiLegActiveCount = state.transfers.filter(
    (t) => t.isMultiLeg && !TERMINAL_STATUSES.has(t.status)
  ).length

  const handleRowClick = (row: TransferRow) => {
    detailSheet.open({ id: row.id })
  }

  const selectedTransfer = detailSheet.data
    ? state.transfers.find((t) => t.id === detailSheet.data!.id) ?? null
    : null

  const columns = useMemo(() => buildTransferColumns(), [])

  const filtersNode = (
    <>
      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="h-8 w-44">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los tipos</SelectItem>
          <SelectItem value="dc_to_store">DC → Tienda</SelectItem>
          <SelectItem value="store_to_store">Tienda → Tienda</SelectItem>
          <SelectItem value="store_to_dc">Tienda → DC</SelectItem>
          <SelectItem value="dc_to_dc">DC → DC</SelectItem>
          <SelectItem value="multi_leg">Multi-tramo</SelectItem>
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="h-8 w-44">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="draft">Borrador</SelectItem>
          <SelectItem value="pending">Pendiente</SelectItem>
          <SelectItem value="in_progress">En preparación</SelectItem>
          <SelectItem value="in_transit">En tránsito</SelectItem>
          <SelectItem value="partial_received">Recibido parcial</SelectItem>
          <SelectItem value="completed">Completado</SelectItem>
          <SelectItem value="cancelled">Cancelado</SelectItem>
        </SelectContent>
      </Select>
    </>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Traslados"
        description="Movimientos entre bodegas y tiendas. Soporta itinerarios multi-tramo con bodegas transitorias."
        actions={
          <Button size="sm" onClick={() => createDialog.open(undefined)}>
            <Plus className="mr-1.5 size-4" />
            Nuevo traslado
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-5">
        <KpiCard icon={Truck} value={formatNumber(inTransitCount)} label="En tránsito" tone="blue" />
        <KpiCard
          icon={Clock}
          value={formatNumber(pendingCount)}
          label="Pendientes / preparación"
          tone="amber"
        />
        <KpiCard
          icon={CheckCircle2}
          value={formatNumber(completedCount)}
          label="Completados"
          tone="green"
        />
        <KpiCard
          icon={Warehouse}
          value={formatNumber(inTransitWarehouseCount)}
          label="En bodega transitoria"
          tone={inTransitWarehouseCount > 0 ? 'amber' : 'neutral'}
          sublabel="Esperando re-despacho"
        />
        <KpiCard
          icon={ArrowRightLeft}
          value={formatNumber(multiLegActiveCount)}
          label="Multi-tramo activos"
          tone={multiLegActiveCount > 0 ? 'blue' : 'neutral'}
        />
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="mb-1 flex items-center gap-2 text-base font-semibold">
            <ArrowRightLeft className="size-4" /> Órdenes de traslado
          </div>
          <DataTable
            columns={columns}
            data={filteredRows}
            searchColumn="code"
            searchPlaceholder="Buscar código..."
            filters={filtersNode}
            emptyMessage="No hay traslados con los filtros seleccionados."
            onRowClick={handleRowClick}
          />
        </CardContent>
      </Card>

      <TransferDetailSheet
        transfer={selectedTransfer}
        originName={selectedTransfer ? warehouseName(selectedTransfer.originId) : ''}
        destinationName={selectedTransfer ? warehouseName(selectedTransfer.destinationId) : ''}
        getProduct={getProduct}
        getWarehouseName={warehouseName}
        open={!!detailSheet.data}
        onClose={detailSheet.close}
      />

      <CreateTransferDialog
        open={createDialog.isOpen}
        onClose={createDialog.close}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "transfers/page"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/transfers/page.tsx
git commit -m "feat(transfers): add transit KPIs, create button, multi_leg filter, updated row mapping"
```

---

## Task 11: Admin — transit warehouse badge

**Files:**
- Modify: `src/app/(app)/admin/page.tsx`

**Interfaces:**
- Consumes: `Warehouse.type === 'transit'` from Task 1

- [ ] **Step 1: Find and update the warehouse type badge**

Open `src/app/(app)/admin/page.tsx`. Find lines ~1080–1081 where the warehouse type badge is rendered:

```tsx
<Badge variant={wh.type === 'distribution_center' ? 'default' : 'secondary'}>
  {wh.type === 'distribution_center' ? 'CD' : 'Tienda'}
</Badge>
```

Replace with:

```tsx
<Badge
  variant={
    wh.type === 'distribution_center'
      ? 'default'
      : wh.type === 'transit'
      ? 'outline'
      : 'secondary'
  }
  className={cn(wh.type === 'transit' && 'border-amber-400 text-amber-700')}
>
  {wh.type === 'distribution_center'
    ? 'CD'
    : wh.type === 'transit'
    ? 'Transitoria'
    : 'Tienda'}
</Badge>
```

Ensure `cn` is already imported (`import { cn } from '@/lib/utils'`) — add if missing.

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/admin/page.tsx
git commit -m "feat(admin): add transit warehouse badge in amber"
```

---

## Task 12: Smoke test end-to-end

**Files:** none (manual verification)

- [ ] **Step 1: Run the dev server**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npm run dev
```

- [ ] **Step 2: Verify seed data**

Navigate to `/transfers`. Confirm:
- TR-2406-004 appears with type "Multi-tramo", status "Recibido parcial", legsProgress "2/2"
- KPI "En bodega transitoria" shows 1
- KPI "Multi-tramo activos" shows 1

- [ ] **Step 3: Verify itinerary stepper**

Click TR-2406-004. Confirm:
- Itinerary shows: CD Bogotá (✓ recibido) → Hub Bogotá Norte (→ en tránsito) → Santa Fe
- Footer shows "Recepcionar en Tienda Santa Fe" button

- [ ] **Step 4: Verify receive leg flow**

Click "Recepcionar en Tienda Santa Fe". Select an operator, add notes. Submit. Confirm:
- TR-2406-004 status changes to "Completado"
- Both legs show `received` in itinerary

- [ ] **Step 5: Verify create dialog**

Click "Nuevo traslado". Toggle "Agregar parada intermedia". Confirm:
- Only "Hub Bogotá Norte" appears in the transit stop selector
- Can add product lines and submit

- [ ] **Step 6: Verify admin badge**

Navigate to `/admin`. Find "Hub Bogotá Norte" in the warehouse list. Confirm amber "Transitoria" badge.

- [ ] **Step 7: Final TypeScript check**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: address smoke test findings"
```
