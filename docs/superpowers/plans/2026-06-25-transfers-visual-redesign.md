# Transfers Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve visual hierarchy and UX of the transfers page by upgrading KPI cards, restructuring the table columns, adding a side sheet for transfer detail, and removing the redundant active-transfer cards.

**Architecture:** Replace raw `Card` KPIs with `KpiCard`, merge the type badge into the code column, add ETA urgency signal, move line detail + advance action into a right-side `Sheet` triggered by row click, and delete the `activeTransfers.map(...)` card section.

**Tech Stack:** Next.js 16 App Router, React 19, Zustand 5, shadcn/ui Sheet, KpiCard, StatusBadge, date-fns 4 (es locale), TailwindCSS 4

## Global Constraints

- All labels in Spanish (es-CO)
- Arrow functions for all components and handlers
- `cn()` for all conditional class merging — no template literals
- Import types from `src/types/wms.ts` — never redefine inline
- `formatDate` from `src/lib/formatters.ts` for all date display
- `StatusBadge` for all status display
- `useDialogState<T>()` for all modal/sheet state management
- No `default export` except page files
- Keep components under 150 lines — split to `_components/` if larger

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/transfers/page.tsx` | Modify | Replace Card KPIs → KpiCard; remove activeTransfers cards; add Sheet open on row click; wire TransferDetailSheet |
| `src/app/transfers/columns.tsx` | Modify | Merge type badge into code cell; add ETA urgency; remove Avanzar action column |
| `src/app/transfers/_components/transfer-detail-sheet.tsx` | Create | Sheet with route info, status timeline, lines table, and advance action |

---

### Task 1: Upgrade KPI Cards

**Files:**
- Modify: `src/app/transfers/page.tsx`

**Interfaces:**
- Consumes: `KpiCard` from `@/components/shared/kpi-card` — props: `icon: LucideIcon, value: number|string, label: string, tone: 'blue'|'amber'|'green'|'neutral'|'red'`
- Produces: three styled KPI cards replacing the raw `Card` + `CardContent` blocks

- [ ] **Step 1: Replace the three raw Card KPI blocks**

In `src/app/transfers/page.tsx`, replace the grid section (lines 173–198):

```tsx
// Remove these imports if no longer used after all tasks:
// Card, CardContent, CardHeader, CardTitle (keep CardContent/Card for the table card below)

// Add imports at top:
import { Truck, Clock, CheckCircle2 } from 'lucide-react'
import { KpiCard } from '@/components/shared/kpi-card'

// Replace the <div className="grid gap-4 sm:grid-cols-3"> block:
<div className="grid gap-4 sm:grid-cols-3">
  <KpiCard
    icon={Truck}
    value={formatNumber(inTransitCount)}
    label="En tránsito"
    tone="blue"
  />
  <KpiCard
    icon={Clock}
    value={formatNumber(pendingCount)}
    label="Pendientes / en preparación"
    tone="amber"
  />
  <KpiCard
    icon={CheckCircle2}
    value={formatNumber(completedCount)}
    label="Completados"
    tone="green"
  />
</div>
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep transfers
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/app/transfers/page.tsx
git commit -m "feat(transfers): upgrade KPI cards to KpiCard with icons and tone colors"
```

---

### Task 2: Improve Table Columns

**Files:**
- Modify: `src/app/transfers/columns.tsx`

**Interfaces:**
- Consumes: `TransferRow` (same shape, no changes needed)
- Produces: updated column definitions — type merged into code cell, ETA with urgency, no Avanzar action column

- [ ] **Step 1: Update columns.tsx**

Replace the entire file content:

```tsx
'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { ArrowRight, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { TransferOrder } from '@/types/wms'

export interface TransferRow {
  id: string
  code: string
  type: TransferOrder['type']
  originName: string
  destinationName: string
  linesCount: number
  estimatedArrivalDate: string
  status: string
  canAdvance: boolean
}

export const TYPE_LABELS: Record<TransferOrder['type'], string> = {
  dc_to_store: 'DC → Tienda',
  store_to_store: 'Tienda → Tienda',
  store_to_dc: 'Tienda → DC',
  dc_to_dc: 'DC → DC',
}

const TERMINAL_STATUSES = new Set(['completed', 'cancelled'])

const isOverdue = (eta: string, status: string) =>
  !TERMINAL_STATUSES.has(status) && new Date(eta) < new Date()

export const buildTransferColumns = (): ColumnDef<TransferRow>[] => [
  {
    accessorKey: 'code',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Código / Tipo" />,
    cell: ({ row }) => (
      <div className="space-y-0.5">
        <p className="font-medium">{row.getValue('code')}</p>
        <Badge variant="outline" className="text-xs">
          {TYPE_LABELS[row.original.type]}
        </Badge>
      </div>
    ),
  },
  {
    id: 'route',
    header: 'Ruta',
    cell: ({ row }) => (
      <div className="flex max-w-[220px] items-center gap-1 text-sm">
        <span className="truncate">{row.original.originName}</span>
        <ArrowRight className="text-muted-foreground size-3.5 shrink-0" />
        <span className="truncate">{row.original.destinationName}</span>
      </div>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'linesCount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Líneas" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{row.getValue('linesCount')}</div>
    ),
  },
  {
    accessorKey: 'estimatedArrivalDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="ETA" />,
    cell: ({ row }) => {
      const eta = row.getValue<string>('estimatedArrivalDate')
      const overdue = isOverdue(eta, row.original.status)
      return (
        <div className={cn('flex items-center gap-1 text-sm', overdue && 'text-red-600')}>
          {overdue && <AlertCircle className="size-3.5 shrink-0" />}
          {formatDate(eta)}
        </div>
      )
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
  },
]
```

- [ ] **Step 2: Update page.tsx — remove onAdvance from buildTransferColumns call**

In `src/app/transfers/page.tsx`, update the `columns` memo and remove the `openAdvanceDialog` argument:

```tsx
// Change from:
const columns = useMemo(
  () => buildTransferColumns(openAdvanceDialog),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []
)

// Change to:
const columns = useMemo(() => buildTransferColumns(), [])
```

Also remove the `openAdvanceDialog` function from `page.tsx` (it will be replaced by row-click handler in Task 3).

Remove the `AdvanceDialogData` interface and `NEXT_MAP`/`TERMINAL_STATUSES` consts from page.tsx (they move to the sheet component in Task 3, or NEXT_MAP stays in page for now — keep TERMINAL_STATUSES in page for the `activeTransfers` filter until Task 3 removes it).

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep transfers
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/transfers/columns.tsx src/app/transfers/page.tsx
git commit -m "feat(transfers): merge type into code cell, add ETA urgency signal, remove inline advance button"
```

---

### Task 3: Create TransferDetailSheet Component

**Files:**
- Create: `src/app/transfers/_components/transfer-detail-sheet.tsx`

**Interfaces:**
- Consumes:
  - `TransferOrder` from `@/types/wms`
  - `Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter` from `@/components/ui/sheet`
  - `StatusBadge` from `@/components/shared/status-badge`
  - `formatDate` from `@/lib/formatters`
  - `advanceTransfer` action from `useWmsStore`
  - Props: `transfer: TransferOrder | null, originName: string, destinationName: string, productName: (id: string) => string, open: boolean, onClose: () => void`
- Produces: `TransferDetailSheet` named export

- [ ] **Step 1: Create the _components directory and sheet file**

```bash
mkdir -p /Users/carlosgranados/Documents/develop/wms/src/app/transfers/_components
```

- [ ] **Step 2: Write the component**

Create `src/app/transfers/_components/transfer-detail-sheet.tsx`:

```tsx
'use client'

import { ArrowRight, CheckCircle2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import { useWmsStore } from '@/store/wms-store'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import type { TransferOrder } from '@/types/wms'

const STEPS: Array<{ key: TransferOrder['status']; label: string }> = [
  { key: 'draft', label: 'Borrador' },
  { key: 'pending', label: 'Pendiente' },
  { key: 'in_progress', label: 'En preparación' },
  { key: 'in_transit', label: 'En tránsito' },
  { key: 'completed', label: 'Completado' },
]

const NEXT_MAP: Partial<Record<string, string>> = {
  draft: 'pending',
  pending: 'in_progress',
  in_progress: 'in_transit',
  in_transit: 'completed',
  partial: 'completed',
}

const NEXT_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En preparación',
  in_transit: 'En tránsito',
  completed: 'Completado',
}

interface Props {
  transfer: TransferOrder | null
  originName: string
  destinationName: string
  productName: (id: string) => string
  open: boolean
  onClose: () => void
}

export const TransferDetailSheet = ({
  transfer,
  originName,
  destinationName,
  productName,
  open,
  onClose,
}: Props) => {
  const { advanceTransfer } = useWmsStore()
  const [error, setError] = useState('')

  if (!transfer) return null

  const nextStatus = NEXT_MAP[transfer.status]
  const canAdvance = !!nextStatus

  const currentStepIndex = STEPS.findIndex((s) => s.key === transfer.status)

  const handleAdvance = () => {
    try {
      advanceTransfer(transfer.id, 'Operador')
      setError('')
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al avanzar traslado')
    }
  }

  const isOverdue =
    transfer.status !== 'completed' &&
    transfer.status !== 'cancelled' &&
    new Date(transfer.estimatedArrivalDate) < new Date()

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-[480px]">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="flex items-center gap-2">
            {transfer.code}
            <StatusBadge status={transfer.status} />
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-6 py-6">
          {/* Route & dates */}
          <section className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Ruta
            </h3>
            <div className="flex items-center gap-2 text-sm font-medium">
              <span>{originName}</span>
              <ArrowRight className="text-muted-foreground size-4 shrink-0" />
              <span>{destinationName}</span>
            </div>
            <div className="text-muted-foreground flex gap-4 text-xs">
              <span>Creado: {formatDate(transfer.createdAt)}</span>
              <span className={cn('flex items-center gap-1', isOverdue && 'text-red-600 font-medium')}>
                ETA: {formatDate(transfer.estimatedArrivalDate)}
                {isOverdue && ' · Atrasado'}
              </span>
            </div>
          </section>

          {/* Status timeline */}
          <section className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Estado del ciclo
            </h3>
            <div className="flex items-start gap-0">
              {STEPS.map((step, i) => {
                const isDone = i < currentStepIndex
                const isCurrent = i === currentStepIndex
                const isLast = i === STEPS.length - 1
                return (
                  <div key={step.key} className="flex flex-1 flex-col items-center">
                    <div className="flex w-full items-center">
                      <div
                        className={cn(
                          'flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
                          isDone && 'border-emerald-500 bg-emerald-500 text-white',
                          isCurrent && 'border-blue-500 bg-blue-500 text-white',
                          !isDone && !isCurrent && 'border-zinc-300 bg-white text-zinc-400'
                        )}
                      >
                        {isDone ? '✓' : i + 1}
                      </div>
                      {!isLast && (
                        <div
                          className={cn(
                            'h-0.5 flex-1',
                            isDone ? 'bg-emerald-400' : 'bg-zinc-200'
                          )}
                        />
                      )}
                    </div>
                    <p
                      className={cn(
                        'mt-1 text-center text-[10px] leading-tight',
                        isCurrent ? 'font-semibold text-blue-600' : 'text-muted-foreground'
                      )}
                    >
                      {step.label}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Lines table */}
          <section className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
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
                  {transfer.items.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="text-sm">{productName(line.productId)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(line.requestedQuantity)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right tabular-nums">
                        {line.pickedQuantity != null ? formatNumber(line.pickedQuantity) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>

        {/* Footer with advance action */}
        <SheetFooter className="border-t pt-4">
          {canAdvance ? (
            <div className="flex w-full flex-col gap-2">
              {nextStatus === 'completed' && (
                <p className="text-muted-foreground text-xs">
                  Al completar se registrarán movimientos de inventario de tipo <strong>transfer</strong> por cada línea.
                </p>
              )}
              {error && (
                <p className="text-destructive flex items-center gap-1 text-xs">
                  <TriangleAlert className="size-3" /> {error}
                </p>
              )}
              <div className="flex items-center justify-between gap-2">
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <span>Siguiente:</span>
                  <StatusBadge status={nextStatus} />
                </div>
                <Button size="sm" onClick={handleAdvance}>
                  <CheckCircle2 className="mr-1.5 size-4" />
                  Avanzar a {NEXT_LABELS[nextStatus] ?? nextStatus}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              {transfer.status === 'completed' && 'Traslado completado.'}
              {transfer.status === 'cancelled' && 'Traslado cancelado.'}
            </p>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep transfers
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/transfers/_components/transfer-detail-sheet.tsx
git commit -m "feat(transfers): add TransferDetailSheet with route, timeline, lines, and advance action"
```

---

### Task 4: Wire Sheet into Page and Remove Legacy Cards

**Files:**
- Modify: `src/app/transfers/page.tsx`

**Interfaces:**
- Consumes:
  - `TransferDetailSheet` from `./_components/transfer-detail-sheet`
  - `TransferOrder` from `@/types/wms`
  - `useDialogState<TransferOrder>()` for sheet open/close state
  - `buildTransferColumns()` (no-arg, from Task 2)
- Produces: final page with row-click → sheet, no legacy active-transfer cards, no advance dialog

- [ ] **Step 1: Rewrite page.tsx**

Replace the entire file with:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { ArrowRightLeft, CheckCircle2, Clock, Truck } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { useDialogState } from '@/hooks/use-dialog-state'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/data-table'
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
import type { TransferOrder } from '@/types/wms'

const TERMINAL_STATUSES = new Set(['completed', 'cancelled'])

export default function TransfersPage() {
  const state = useWmsStore()
  const { warehouseName, productName } = useStoreHelpers()

  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const detailSheet = useDialogState<TransferOrder>()

  const rows = useMemo<TransferRow[]>(
    () =>
      state.transfers.map((t) => ({
        id: t.id,
        code: t.code,
        type: t.type,
        originName: warehouseName(t.originId),
        destinationName: warehouseName(t.destinationId),
        linesCount: t.items.length,
        estimatedArrivalDate: t.estimatedArrivalDate,
        status: t.status,
        canAdvance: !TERMINAL_STATUSES.has(t.status),
      })),
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

  const handleRowClick = (row: TransferRow) => {
    const transfer = state.transfers.find((t) => t.id === row.id)
    if (transfer) detailSheet.open(transfer)
  }

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
          <SelectItem value="completed">Completado</SelectItem>
          <SelectItem value="cancelled">Cancelado</SelectItem>
        </SelectContent>
      </Select>
    </>
  )

  return (
    <>
      <PageHeader
        title="Traslados"
        description="Movimientos entre bodegas y tiendas. Avanza el estado del traslado a lo largo del ciclo DC↔Tienda."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard icon={Truck} value={formatNumber(inTransitCount)} label="En tránsito" tone="blue" />
        <KpiCard
          icon={Clock}
          value={formatNumber(pendingCount)}
          label="Pendientes / en preparación"
          tone="amber"
        />
        <KpiCard
          icon={CheckCircle2}
          value={formatNumber(completedCount)}
          label="Completados"
          tone="green"
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
        transfer={detailSheet.data}
        originName={detailSheet.data ? warehouseName(detailSheet.data.originId) : ''}
        destinationName={detailSheet.data ? warehouseName(detailSheet.data.destinationId) : ''}
        productName={productName}
        open={!!detailSheet.data}
        onClose={detailSheet.close}
      />
    </>
  )
}
```

- [ ] **Step 2: Check if DataTable supports onRowClick**

```bash
grep -n "onRowClick\|rowClick\|onRow" /Users/carlosgranados/Documents/develop/wms/src/components/data-table/index.tsx 2>/dev/null || grep -rn "onRowClick" /Users/carlosgranados/Documents/develop/wms/src/components/data-table/
```

If `onRowClick` is not supported, add it in the next step. If it is supported, skip to Step 4.

- [ ] **Step 3: Add onRowClick to DataTable (only if missing from Step 2)**

Find the DataTable component file and add the prop. Typical pattern — add to the interface and the `<TableRow>`:

```tsx
// In DataTable props interface, add:
onRowClick?: (row: TData) => void

// On the <TableRow> element, add:
onClick={() => onRowClick?.(row.original)}
className={cn(onRowClick && 'cursor-pointer')}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep -E "transfers|data-table"
```

Expected: no output.

- [ ] **Step 5: Verify the page renders without runtime errors**

Start the dev server and open `/transfers`:

```bash
cd /Users/carlosgranados/Documents/develop/wms && npm run dev
```

Check:
- 3 KPI cards show with icons and correct colors
- Table has no "Avanzar" column
- ETA column shows formatted dates; overdue rows show red text + icon
- Click any row → Sheet opens from the right
- Sheet shows code + StatusBadge, route, timeline (current step highlighted blue), lines table
- Non-terminal transfers show the "Avanzar" button in sheet footer
- Clicking Avanzar advances status and closes sheet
- Completed/cancelled transfers show no action in footer
- No legacy cards below the table

- [ ] **Step 6: Commit**

```bash
git add src/app/transfers/page.tsx src/components/data-table/
git commit -m "feat(transfers): wire detail sheet with row click, remove legacy active-transfer cards"
```

---

## Self-Review Checklist

- [x] KPI cards — Task 1 covers `Truck/Clock/CheckCircle2` icons + `KpiCard` tones
- [x] Type merged into code cell — Task 2, columns.tsx
- [x] ETA urgency signal — Task 2, `isOverdue` helper in columns
- [x] Side sheet with route, timeline, lines, advance — Task 3, `TransferDetailSheet`
- [x] Row click opens sheet — Task 4, `handleRowClick` + `onRowClick` prop
- [x] Legacy active-transfer cards removed — Task 4, page rewrite
- [x] Advance dialog removed — replaced by sheet footer in Task 3/4
- [x] `formatDate` used for all dates — Task 2 ETA cell + Task 3 sheet
- [x] `useDialogState<TransferOrder>()` for sheet state — Task 4
- [x] All labels in Spanish — confirmed throughout
- [x] Arrow functions for all components/handlers — confirmed throughout
- [x] `cn()` for all conditional classes — confirmed throughout
