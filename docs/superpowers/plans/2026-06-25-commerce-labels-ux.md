# Commerce & Labels UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Commerce and Labels pages so urgent actions surface immediately, key info is visible without opening modals, and the label printing flow is simplified for both operators and supervisors.

**Architecture:** Commerce gets expandable rows (inline detail + actions, no extra modal) plus urgency coloring on rows with overdue/today delivery promises; KPI cards upgrade to `KpiCard` component. Labels replaces the 6 type-cards with compact clickable chips in the filter bar, and the ZPL dialog hides the raw code behind an accordion so operators see only print action.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript 5 · Zustand 5 · TailwindCSS 4 · shadcn/Radix UI · date-fns 4

## Global Constraints

- All UI labels in Spanish (es-CO)
- Arrow functions everywhere — no `function` declarations in components
- `cn()` from `@/lib/utils` for all conditional classes — no template literals
- Types imported from `src/types/wms.ts` — never redefined inline
- `formatDate` / `formatNumber` from `src/lib/formatters.ts` — never native `.toLocaleDateString()`
- `<KpiCard>` from `src/components/shared/kpi-card.tsx` for metric cards
- `<StatusBadge>` from `src/components/shared/status-badge.tsx` for status display
- No new npm dependencies

---

### Task 1: Commerce — upgrade KPI cards + add urgency helpers

**Files:**
- Modify: `src/app/commerce/page.tsx`

**Interfaces:**
- Produces: `isUrgent(promisedDeliveryDate: string): boolean` — inline helper used in Task 2
- Produces: `isOverdue(promisedDeliveryDate: string): boolean` — inline helper used in Task 2

- [ ] **Step 1: Add date-fns urgency helpers at top of file**

Replace the existing imports block to add `isToday`, `isBefore`, `parseISO` from date-fns and `KpiCard` from shared:

```tsx
'use client'

import React, { useState } from 'react'
import { isToday, isBefore, parseISO } from 'date-fns'
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  PackageCheck,
  ShoppingBag,
  ShoppingCart,
  TriangleAlert,
} from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { useDialogState } from '@/hooks/use-dialog-state'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
```

- [ ] **Step 2: Add inline urgency helpers just before `CommercePage` component**

```tsx
const isOverdue = (promisedDeliveryDate: string) =>
  isBefore(parseISO(promisedDeliveryDate), new Date()) &&
  !isToday(parseISO(promisedDeliveryDate))

const isUrgent = (promisedDeliveryDate: string) =>
  isToday(parseISO(promisedDeliveryDate))
```

- [ ] **Step 3: Replace the 4 plain `<Card>` KPI blocks with `<KpiCard>` components**

Find the `<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">` block and replace it entirely:

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <KpiCard
    icon={TriangleAlert}
    value={pendingCount}
    label="Pendientes de reserva"
    tone="amber"
    alert={pendingCount > 0}
  />
  <KpiCard
    icon={ShoppingCart}
    value={inProgressCount}
    label="En operación"
    tone="blue"
  />
  <KpiCard
    icon={ShoppingBag}
    value={readyForPickupCount}
    label="Listos para recoger"
    tone="green"
  />
  <KpiCard
    icon={CheckCircle2}
    value={completedCount}
    label="Completados"
    tone="neutral"
  />
</div>
```

- [ ] **Step 4: Verify page renders without errors**

Run: `npm run build 2>&1 | tail -20`
Expected: no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/app/commerce/page.tsx
git commit -m "feat(commerce): upgrade KPI cards to KpiCard, add urgency helpers"
```

---

### Task 2: Commerce — expandable rows with inline detail + urgency row styling

**Files:**
- Modify: `src/app/commerce/page.tsx`

**Interfaces:**
- Consumes: `isOverdue`, `isUrgent` from Task 1
- Consumes: `productName(productId: string): string` from `useStoreHelpers`

- [ ] **Step 1: Add `expandedRow` state inside `CommercePage`**

Add after existing `useState` declarations:

```tsx
const [expandedRow, setExpandedRow] = useState<string | null>(null)

const toggleRow = (id: string) =>
  setExpandedRow((prev) => (prev === id ? null : id))
```

- [ ] **Step 2: Replace the table body rows with expandable rows**

Replace the entire `<TableBody>` content. The expanded panel shows order lines + total items + delivery date formatted, plus the action buttons. The collapsed row shows urgency coloring via `cn()`.

```tsx
<TableBody>
  {sorted.map((order) => {
    const overdue = isOverdue(order.promisedDeliveryDate)
    const urgent = isUrgent(order.promisedDeliveryDate)
    const isExpanded = expandedRow === order.id

    return (
      <React.Fragment key={order.id}>
        <TableRow
          className={cn(
            'cursor-pointer',
            overdue && 'bg-red-50 hover:bg-red-100',
            urgent && !overdue && 'bg-amber-50 hover:bg-amber-100'
          )}
          onClick={() => toggleRow(order.id)}
        >
          <TableCell className="font-medium">
            <div className="flex items-center gap-1.5">
              {overdue && <TriangleAlert className="size-3 shrink-0 text-red-500" />}
              {urgent && !overdue && <Clock className="size-3 shrink-0 text-amber-500" />}
              {order.orderNumber}
            </div>
          </TableCell>
          <TableCell>{order.customerName}</TableCell>
          <TableCell>
            <div className="flex flex-wrap items-center gap-1">
              <Badge variant="outline" className="text-xs">
                {CHANNEL_LABELS[order.channel] ?? order.channel}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {FULFILLMENT_LABELS[order.fulfillmentType] ?? order.fulfillmentType}
              </Badge>
            </div>
          </TableCell>
          <TableCell className="tabular-nums">{order.items.length}</TableCell>
          <TableCell
            className={cn(
              'text-sm',
              overdue && 'font-semibold text-red-600',
              urgent && !overdue && 'font-semibold text-amber-600'
            )}
          >
            {formatDate(order.promisedDeliveryDate)}
            {overdue && <span className="ml-1 text-xs">(vencida)</span>}
            {urgent && !overdue && <span className="ml-1 text-xs">(hoy)</span>}
          </TableCell>
          <TableCell>
            <StatusBadge status={order.status} />
          </TableCell>
          <TableCell>
            {isExpanded ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </TableCell>
        </TableRow>

        {isExpanded && (
          <TableRow key={`${order.id}-detail`} className={cn(
            overdue && 'bg-red-50',
            urgent && !overdue && 'bg-amber-50'
          )}>
            <TableCell colSpan={7} className="pb-4 pt-2">
              <div className="rounded-lg border bg-white p-4 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Líneas del pedido</p>
                <div className="divide-y rounded-md border">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm">{productName(item.productId)}</span>
                      <span className="tabular-nums text-sm font-medium">
                        {item.requestedQuantity} uds.
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  {order.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        openReserveDialog(order.id)
                      }}
                    >
                      <PackageCheck className="mr-1 size-3" /> Reservar inventario
                    </Button>
                  )}
                  {order.status === 'in_progress' &&
                    (order.fulfillmentType === 'pickup_in_store' ||
                      order.fulfillmentType === 'ship_from_store') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          markReadyForPickup(order.id, operatorName)
                        }}
                      >
                        <ShoppingBag className="mr-1 size-3" /> Listo para recoger
                      </Button>
                    )}
                  {order.status === 'ready_for_pickup' && (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={(e) => {
                        e.stopPropagation()
                        confirmPickup(order.id, operatorName)
                      }}
                    >
                      <CheckCircle2 className="mr-1 size-3" /> Confirmar recogida
                    </Button>
                  )}
                </div>
              </div>
            </TableCell>
          </TableRow>
        )}
      </React.Fragment>
    )
  })}
</TableBody>
```

- [ ] **Step 3: Update the `<TableHeader>` to remove the standalone "Tipo despacho" column (now merged into Canal chip) and add expand chevron column**

Replace the `<TableHeader>` block:

```tsx
<TableHeader>
  <TableRow>
    <TableHead className="cursor-pointer" onClick={() => toggleSort('orderNumber')}>
      Pedido <SortIcon field="orderNumber" active={sortField} dir={sortDir} />
    </TableHead>
    <TableHead className="cursor-pointer" onClick={() => toggleSort('customer')}>
      Cliente <SortIcon field="customer" active={sortField} dir={sortDir} />
    </TableHead>
    <TableHead className="cursor-pointer" onClick={() => toggleSort('channel')}>
      Canal / Tipo <SortIcon field="channel" active={sortField} dir={sortDir} />
    </TableHead>
    <TableHead>Líneas</TableHead>
    <TableHead className="cursor-pointer" onClick={() => toggleSort('delivery')}>
      Promesa <SortIcon field="delivery" active={sortField} dir={sortDir} />
    </TableHead>
    <TableHead className="cursor-pointer" onClick={() => toggleSort('status')}>
      Estado <SortIcon field="status" active={sortField} dir={sortDir} />
    </TableHead>
    <TableHead />
  </TableRow>
</TableHeader>
```

- [ ] **Step 4: Verify TypeScript compiles clean**

Run: `npm run build 2>&1 | tail -20`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/commerce/page.tsx
git commit -m "feat(commerce): expandable rows with urgency coloring and inline order detail"
```

---

### Task 3: Labels — replace type-cards with filter chips in toolbar

**Files:**
- Modify: `src/app/labels/page.tsx`

**Interfaces:**
- Consumes: `TYPE_LABELS`, `TYPE_COLORS` from `./columns`
- Produces: compact chip-based type filter replacing the 6-card grid

- [ ] **Step 1: Remove the 6-card type grid and add chips into the filter bar**

The `byType` variable and the `<div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">` block get replaced. The filter chips go inside the `filtersNode` alongside the existing selects.

Replace the `filtersNode` and the card grid. First remove the card grid section entirely (the `<div className="grid gap-3 ...">` block).

Then update `filtersNode` to include type chips above the selects:

```tsx
const filtersNode = (
  <div className="flex flex-wrap items-center gap-2">
    {/* Type chips */}
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        className={cn(
          'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
          typeFilter === 'all'
            ? 'bg-foreground text-background border-foreground'
            : 'bg-background text-muted-foreground hover:border-foreground/40'
        )}
        onClick={() => setTypeFilter('all')}
      >
        Todos
      </button>
      {Object.entries(TYPE_LABELS).map(([val, label]) => {
        const count = state.labels.filter((l) => l.type === val).length
        return (
          <button
            key={val}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              typeFilter === val
                ? cn('border-transparent', TYPE_COLORS[val as WmsLabel['type']])
                : 'bg-background text-muted-foreground hover:border-foreground/40'
            )}
            onClick={() => setTypeFilter(typeFilter === val ? 'all' : val)}
          >
            {label}
            <span className="ml-1 tabular-nums opacity-60">{count}</span>
          </button>
        )
      })}
    </div>

    {/* Status filter */}
    <Select value={statusFilter} onValueChange={setStatusFilter}>
      <SelectTrigger className="h-8 w-40">
        <SelectValue placeholder="Estado" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos los estados</SelectItem>
        <SelectItem value="pending">Pendiente</SelectItem>
        <SelectItem value="completed">Completada</SelectItem>
        <SelectItem value="cancelled">Cancelada</SelectItem>
      </SelectContent>
    </Select>
  </div>
)
```

- [ ] **Step 2: Add `WmsLabel` import to labels page if not already present**

Check line 20 of `src/app/labels/page.tsx` — `import type { WmsLabel } from '@/types/wms'` should already exist. If missing, add it.

- [ ] **Step 3: Remove the now-unused `byType` variable**

Delete these lines from `LabelsPage`:

```tsx
const byType = Object.keys(TYPE_LABELS).map((t) => ({
  type: t as WmsLabel['type'],
  count: state.labels.filter((l) => l.type === t).length,
}))
```

- [ ] **Step 4: Verify TypeScript compiles clean**

Run: `npm run build 2>&1 | tail -20`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/labels/page.tsx
git commit -m "feat(labels): replace type-card grid with compact filter chips in toolbar"
```

---

### Task 4: Labels — simplify ZPL dialog (hide raw ZPL behind accordion)

**Files:**
- Modify: `src/app/labels/_components/zpl-preview-dialog.tsx`

**Interfaces:**
- No interface changes — internal dialog refactor only

- [ ] **Step 1: Add `showZpl` state and replace ZPL code block with accordion**

Add `useState` for `showZpl` and wrap the raw ZPL `<pre>` block in a collapsible section. Operators see only print action by default; advanced users can expand ZPL.

Full updated `ZplPreviewDialog` component (replace file contents from line 34 onward):

```tsx
export const ZplPreviewDialog = ({ label, open, onClose }: ZplPreviewDialogProps) => {
  const [printerIp, setPrinterIp] = useState('')
  const [copied, setCopied] = useState(false)
  const [showZpl, setShowZpl] = useState(false)

  if (!label) return null

  const zpl = buildZpl({
    code: label.code,
    type: label.type,
    reference: label.reference,
    createdAt: label.createdAt,
    createdBy: label.createdBy,
  })

  const handleCopy = async () => {
    await navigator.clipboard.writeText(zpl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    printZpl(zpl, printerIp.trim() || undefined)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="size-4" />
            Etiqueta — {label.code}
            <Badge variant="secondary" className="ml-1 text-xs">
              {TYPE_ES[label.type]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Visual label preview */}
          <LabelPreview label={label} />

          {/* Printer IP */}
          <div className="space-y-1">
            <Label htmlFor="printer-ip" className="text-sm">
              IP de impresora Zebra{' '}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="printer-ip"
              value={printerIp}
              onChange={(e) => setPrinterIp(e.target.value)}
              placeholder="192.168.1.100"
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-xs">
              Sin IP, el ZPL se copia al portapapeles para enviarlo manualmente.
            </p>
          </div>

          {/* ZPL accordion */}
          <div className="rounded-md border">
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowZpl((v) => !v)}
            >
              <span>Ver código ZPL</span>
              {showZpl ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </button>
            {showZpl && (
              <div className="border-t px-3 pb-3 pt-2 space-y-2">
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5 text-xs">
                    {copied ? (
                      <>
                        <Check className="size-3 text-green-600" /> Copiado
                      </>
                    ) : (
                      <>
                        <Clipboard className="size-3" /> Copiar ZPL
                      </>
                    )}
                  </Button>
                </div>
                <pre className="bg-muted max-h-40 overflow-auto rounded-md p-3 font-mono text-xs leading-relaxed whitespace-pre">
                  {zpl}
                </pre>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="mr-1.5 size-3.5" /> Cerrar
          </Button>
          <Button onClick={handlePrint} className="gap-1.5">
            <Printer className="size-3.5" />
            {printerIp ? 'Enviar a impresora' : 'Copiar ZPL'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Add missing imports to zpl-preview-dialog.tsx**

The file needs `ChevronUp` and `ChevronDown` from lucide-react. Update the import line:

```tsx
import { Check, ChevronDown, ChevronUp, Clipboard, Printer, X } from 'lucide-react'
```

- [ ] **Step 3: Verify TypeScript compiles clean**

Run: `npm run build 2>&1 | tail -20`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/labels/_components/zpl-preview-dialog.tsx
git commit -m "feat(labels): hide ZPL code behind accordion in print dialog for cleaner operator UX"
```
