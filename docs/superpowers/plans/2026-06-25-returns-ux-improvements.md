# Returns UX Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mejorar la vista de devoluciones con 5 cambios quirúrgicos: días en estado actual + fecha creación en cards, búsqueda por cliente, detail sheet para RMAs históricas, y estado vacío con "Limpiar filtros".

**Architecture:** Todos los cambios están en `src/app/returns/page.tsx` y `src/app/returns/columns.tsx`. Se añade un nuevo componente `_components/return-detail-sheet.tsx` para el detail sheet. No se tocan store, tipos ni otros módulos.

**Tech Stack:** Next.js 16 App Router · React 19 · Zustand 5 · TanStack React Table 8 · shadcn/Radix UI · date-fns 4 · TypeScript 5

## Global Constraints

- Todos los textos en español (es-CO)
- Fechas con date-fns + locale `es` — nunca `.toLocaleDateString()` nativo
- Clases condicionales siempre con `cn()` de `@/lib/utils`
- Arrow functions para todos los componentes y handlers
- No modificar archivos en `components/ui/`
- Importar tipos desde `src/types/wms.ts` — nunca redefinir inline

---

## File Map

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `src/app/returns/page.tsx` | Modificar | Días en estado, fecha creación en cards; búsqueda multi-columna; estado vacío con limpiar filtros; abrir detail sheet al click en fila |
| `src/app/returns/columns.tsx` | Modificar | Recibir callback `onRowClick` para click en fila |
| `src/app/returns/_components/return-detail-sheet.tsx` | Crear | Sheet lateral con info completa del RMA + timeline de estados |

---

## Task 1: Días en estado actual y fecha de creación en cards activas

**Files:**
- Modify: `src/app/returns/page.tsx`

**Interfaces:**
- Consumes: `ReturnOrder.createdAt` (string ISO), `ReturnOrder.status`
- Produces: nada externo — cambio visual en cards

- [ ] **Step 1: Importar helpers de date-fns**

En `src/app/returns/page.tsx`, añadir a los imports existentes:

```tsx
import { formatDistanceToNow, parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
```

- [ ] **Step 2: Añadir helper `daysInStatus`**

Justo antes de `export default function ReturnsPage()`, añadir:

```tsx
const daysInStatus = (ret: ReturnOrder): string =>
  formatDistanceToNow(parseISO(ret.createdAt), { locale: es, addSuffix: false })
```

> Nota: `createdAt` es la fecha de creación del RMA, no de entrada al estado actual. El modelo no almacena `statusChangedAt`, así que usamos createdAt como proxy razonable — muestra antigüedad del RMA, no del estado puntual.

- [ ] **Step 3: Añadir fecha creación + días en cada card activa**

Dentro del `.map((ret) => { ... })` de `activeReturns`, localizar el bloque de metadata (donde están `User`, `MapPin`, `Tag`):

```tsx
<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
  <span className="flex items-center gap-1">
    <User className="size-3" /> {ret.customerName}
  </span>
  <span className="flex items-center gap-1">
    <MapPin className="size-3" />
    {warehouseName(ret.originId)}
    <ChevronRight className="size-3" />
    {warehouseName(ret.destinationId)}
  </span>
  <span className="flex items-center gap-1">
    <Tag className="size-3" /> {TYPE_LABELS[ret.type]}
  </span>
  {reason && (
    <span className="flex items-center gap-1">
      <TriangleAlert className="size-3" /> {reason.label}
    </span>
  )}
</div>
```

Reemplazar con:

```tsx
import { Calendar, Clock } from 'lucide-react' // añadir a imports de lucide
```

```tsx
<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
  <span className="flex items-center gap-1">
    <User className="size-3" /> {ret.customerName}
  </span>
  <span className="flex items-center gap-1">
    <MapPin className="size-3" />
    {warehouseName(ret.originId)}
    <ChevronRight className="size-3" />
    {warehouseName(ret.destinationId)}
  </span>
  <span className="flex items-center gap-1">
    <Tag className="size-3" /> {TYPE_LABELS[ret.type]}
  </span>
  {reason && (
    <span className="flex items-center gap-1">
      <TriangleAlert className="size-3" /> {reason.label}
    </span>
  )}
  <span className="flex items-center gap-1">
    <Calendar className="size-3" />
    {format(parseISO(ret.createdAt), 'dd MMM yyyy', { locale: es })}
  </span>
  <span className="flex items-center gap-1 font-medium text-foreground/70">
    <Clock className="size-3" />
    {daysInStatus(ret)}
  </span>
</div>
```

- [ ] **Step 4: Verificar visualmente**

Arrancar dev server (`npm run dev`) y navegar a `/returns`. Cada card activa debe mostrar fecha de creación y antigüedad relativa (ej. "hace 3 días") en la fila de metadata.

- [ ] **Step 5: Commit**

```bash
git add src/app/returns/page.tsx
git commit -m "feat(returns): add creation date and age to active RMA cards"
```

---

## Task 2: Búsqueda multi-columna por RMA y cliente

**Files:**
- Modify: `src/app/returns/page.tsx`

**Interfaces:**
- Consumes: `DataTable` props — `searchColumn`, `searchPlaceholder`
- Produces: nada externo

> El componente `DataTable` acepta `searchColumn` como string single-column. Para búsqueda multi-columna necesitamos un estado local de búsqueda y filtrar `filteredRows` manualmente.

- [ ] **Step 1: Añadir estado de búsqueda**

En `ReturnsPage`, junto a los estados existentes de filtro:

```tsx
const [search, setSearch] = useState('')
```

- [ ] **Step 2: Añadir búsqueda al pipeline de filtrado**

Modificar `filteredRows` para incluir búsqueda por rmaCode Y customerName:

```tsx
const filteredRows = useMemo(
  () =>
    rows.filter((r) => {
      if (dispositionFilter !== 'all' && r.disposition !== dispositionFilter) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!r.rmaCode.toLowerCase().includes(q) && !r.customerName.toLowerCase().includes(q))
          return false
      }
      return true
    }),
  [rows, dispositionFilter, statusFilter, search]
)
```

- [ ] **Step 3: Reemplazar searchColumn de DataTable por Input controlado**

El `DataTable` actual usa `searchColumn="rmaCode"` internamente. Para control externo, pasar `search` y `onSearchChange` — pero si `DataTable` no soporta eso, añadir un `Input` propio encima de la tabla y quitar `searchColumn` del DataTable.

Primero verificar la interfaz de DataTable:

```bash
grep -n "searchColumn\|onSearchChange\|searchValue" src/components/data-table/index.tsx
```

Si `DataTable` no tiene prop `searchValue`/`onSearchChange`, usar Input externo:

```tsx
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
```

En el JSX, antes del `<DataTable>` dentro del `<Card>`:

```tsx
<div className="mb-3 flex items-center gap-2">
  <div className="relative flex-1 max-w-sm">
    <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
    <Input
      placeholder="Buscar por RMA o cliente..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="h-8 pl-8 text-sm"
    />
  </div>
</div>
```

Y en `<DataTable>` eliminar props `searchColumn` y `searchPlaceholder` (ya no las necesita).

- [ ] **Step 4: Verificar**

En `/returns`, buscar "Juan" → solo filas donde customerName contenga "juan". Buscar "RMA-" → solo filas donde rmaCode contenga "RMA-".

- [ ] **Step 5: Commit**

```bash
git add src/app/returns/page.tsx
git commit -m "feat(returns): multi-column search by RMA code and customer name"
```

---

## Task 3: Estado vacío con botón "Limpiar filtros"

**Files:**
- Modify: `src/app/returns/page.tsx`

**Interfaces:**
- Consumes: `filteredRows`, `dispositionFilter`, `statusFilter`, `search`
- Produces: nada externo

- [ ] **Step 1: Añadir helper `hasActiveFilters`**

```tsx
const hasActiveFilters = dispositionFilter !== 'all' || statusFilter !== 'all' || search.trim() !== ''
```

Añadir dentro de `ReturnsPage`, después de `filteredRows`.

- [ ] **Step 2: Añadir handler `handleClearFilters`**

```tsx
const handleClearFilters = () => {
  setDispositionFilter('all')
  setStatusFilter('all')
  setSearch('')
}
```

- [ ] **Step 3: Pasar `emptyState` custom al DataTable**

Verificar si `DataTable` acepta prop `emptyState?: React.ReactNode`. Si sí:

```tsx
<DataTable
  columns={columns}
  data={filteredRows}
  emptyState={
    hasActiveFilters ? (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          No hay devoluciones con los filtros seleccionados.
        </p>
        <Button variant="outline" size="sm" onClick={handleClearFilters}>
          Limpiar filtros
        </Button>
      </div>
    ) : undefined
  }
  emptyMessage="No hay devoluciones registradas."
/>
```

Si `DataTable` no acepta `emptyState`, verificar su código y añadir la prop:

```bash
grep -n "emptyMessage\|emptyState\|data.length" src/components/data-table/index.tsx | head -20
```

Adaptar según lo que encuentre.

- [ ] **Step 4: Verificar**

Seleccionar disposición "Desecho" y estado "Cerrada" simultáneamente sin resultados → debe aparecer mensaje + botón "Limpiar filtros". Click en botón → filtros se resetean.

- [ ] **Step 5: Commit**

```bash
git add src/app/returns/page.tsx
git commit -m "feat(returns): show clear-filters button on empty filtered state"
```

---

## Task 4: Detail sheet para RMAs (click en fila de tabla)

**Files:**
- Create: `src/app/returns/_components/return-detail-sheet.tsx`
- Modify: `src/app/returns/columns.tsx`
- Modify: `src/app/returns/page.tsx`

**Interfaces:**
- Consumes: `ReturnOrder`, `ReturnInspection | undefined`, `RepairTicket[]`, `ScrapRecord | undefined`, `ReentryBatch | undefined`; helpers `warehouseName`, `productName`
- Produces: `<ReturnDetailSheet>` con props definidas abajo

### Step 4.1 — Crear `return-detail-sheet.tsx`

- [ ] **Step 4.1: Crear el componente**

```tsx
// src/app/returns/_components/return-detail-sheet.tsx
'use client'

import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Hash,
  MapPin,
  PackageCheck,
  Tag,
  Trash2,
  User,
  Wrench,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { StatusBadge } from '@/components/shared/status-badge'
import { cn } from '@/lib/utils'
import type { ReentryBatch, RepairTicket, ReturnInspection, ReturnOrder, ScrapRecord } from '@/types/wms'
import {
  DISPOSITION_COLORS,
  DISPOSITION_LABELS,
  TYPE_LABELS,
} from '../columns'

interface Props {
  open: boolean
  returnOrder: ReturnOrder | null
  inspection: ReturnInspection | undefined
  repairTickets: RepairTicket[]
  scrapRecord: ScrapRecord | undefined
  reentryBatch: ReentryBatch | undefined
  warehouseName: (id: string) => string
  productName: (id: string) => string
  onClose: () => void
}

const CONDITION_LABELS: Record<string, string> = {
  new: 'Nuevo',
  like_new: 'Como nuevo',
  good: 'Buen estado',
  fair: 'Aceptable',
  defective: 'Defectuoso',
}

const CONDITION_COLORS: Record<string, string> = {
  new: 'bg-green-100 text-green-800',
  like_new: 'bg-emerald-100 text-emerald-800',
  good: 'bg-blue-100 text-blue-800',
  fair: 'bg-amber-100 text-amber-800',
  defective: 'bg-red-100 text-red-800',
}

const RESULT_LABELS: Record<string, string> = {
  pass: 'Aprobada',
  partial_pass: 'Aprobación parcial',
  fail: 'Rechazada',
}

const RESULT_STYLES: Record<string, string> = {
  pass: 'bg-green-100 text-green-800 border-green-200',
  partial_pass: 'bg-amber-100 text-amber-800 border-amber-200',
  fail: 'bg-red-100 text-red-800 border-red-200',
}

const REPAIR_TYPE_LABELS: Record<string, string> = {
  cosmetic: 'Cosmética',
  functional: 'Funcional',
  warranty: 'Garantía',
}

const REPAIR_STATUS_LABELS: Record<string, string> = {
  open: 'Abierto',
  in_progress: 'En proceso',
  ready_to_receive: 'Listo para recibir',
  received: 'Recibido',
  completed: 'Completado',
  failed: 'Fallido',
}

const SCRAP_METHOD_LABELS: Record<string, string> = {
  incinerate: 'Incineración',
  landfill: 'Relleno sanitario',
  donate: 'Donación',
  liquidate: 'Liquidación',
  recycle: 'Reciclaje',
}

const InfoRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-4 py-1.5">
    <span className="text-xs text-muted-foreground shrink-0">{label}</span>
    <span className="text-xs text-right">{children}</span>
  </div>
)

export const ReturnDetailSheet = ({
  open,
  returnOrder,
  inspection,
  repairTickets,
  scrapRecord,
  reentryBatch,
  warehouseName,
  productName,
  onClose,
}: Props) => {
  if (!returnOrder) return null

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            {returnOrder.rmaCode}
            <StatusBadge status={returnOrder.status} />
          </SheetTitle>
          <SheetDescription className="sr-only">
            Detalle de la devolución {returnOrder.rmaCode}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Identidad */}
          <section className="space-y-0.5">
            <InfoRow label="Cliente">
              <span className="flex items-center gap-1 font-medium">
                <User className="size-3" /> {returnOrder.customerName}
              </span>
            </InfoRow>
            <InfoRow label="Tipo">
              <Badge variant="outline" className="text-xs">
                {TYPE_LABELS[returnOrder.type]}
              </Badge>
            </InfoRow>
            <InfoRow label="Disposición">
              <Badge
                variant="outline"
                className={cn('text-xs', DISPOSITION_COLORS[returnOrder.disposition])}
              >
                {DISPOSITION_LABELS[returnOrder.disposition]}
              </Badge>
            </InfoRow>
            <InfoRow label="Ruta">
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                {warehouseName(returnOrder.originId)}
                <ArrowRight className="size-3" />
                {warehouseName(returnOrder.destinationId)}
              </span>
            </InfoRow>
            <InfoRow label="Creada">
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {format(parseISO(returnOrder.createdAt), 'dd MMM yyyy', { locale: es })}
              </span>
            </InfoRow>
          </section>

          <Separator />

          {/* Ítems */}
          <section>
            <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
              Ítems
            </p>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Producto</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground w-16">Uds.</th>
                    {inspection && (
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-28">Condición</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {returnOrder.items.map((line) => {
                    const itemInspection = inspection?.items.find(
                      (i) => i.returnLineId === line.id
                    )
                    return (
                      <tr key={line.id}>
                        <td className="px-3 py-2">{productName(line.productId)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{line.requestedQuantity}</td>
                        {inspection && (
                          <td className="px-3 py-2">
                            {itemInspection ? (
                              <Badge
                                className={CONDITION_COLORS[itemInspection.conditionRating]}
                                variant="outline"
                              >
                                {CONDITION_LABELS[itemInspection.conditionRating]}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Inspección */}
          {inspection && (
            <>
              <Separator />
              <section>
                <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <ClipboardCheck className="size-3" /> Inspección
                </p>
                <div
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs space-y-1',
                    RESULT_STYLES[inspection.overallResult]
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span>Inspector: <strong>{inspection.inspectorName}</strong></span>
                    <Badge
                      variant="outline"
                      className={cn('text-xs font-semibold', RESULT_STYLES[inspection.overallResult])}
                    >
                      {RESULT_LABELS[inspection.overallResult]}
                    </Badge>
                  </div>
                  <p className="text-xs opacity-80">
                    {format(parseISO(inspection.inspectedAt), 'dd MMM yyyy HH:mm', { locale: es })}
                  </p>
                  {inspection.notes && (
                    <p className="text-xs opacity-80 italic">{inspection.notes}</p>
                  )}
                </div>
                {inspection.items.some((i) => i.serial) && (
                  <div className="mt-2 space-y-1">
                    {inspection.items.filter((i) => i.serial).map((item) => (
                      <div
                        key={item.returnLineId}
                        className={cn(
                          'flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs',
                          item.serialMatchesDispatch === false
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : item.serialMatchesDispatch === true
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-border bg-muted/30 text-muted-foreground'
                        )}
                      >
                        <Hash className="size-3 shrink-0" />
                        <span className="font-mono font-semibold">{item.serial}</span>
                        <span className="text-[10px]">
                          {item.serialMatchesDispatch === true && '✓ Verificado'}
                          {item.serialMatchesDispatch === false && '⚠ No encontrado'}
                          {item.serialMatchesDispatch === undefined && '— Sin verificación'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {/* Tickets de reparación */}
          {repairTickets.length > 0 && (
            <>
              <Separator />
              <section>
                <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Wrench className="size-3" /> Reparaciones
                </p>
                <div className="space-y-2">
                  {repairTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{ticket.vendorName}</span>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-700">
                            {REPAIR_TYPE_LABELS[ticket.repairType]}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {REPAIR_STATUS_LABELS[ticket.status]}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs opacity-80">
                        Retorno esperado: {format(parseISO(ticket.expectedReturnDate), 'dd MMM yyyy', { locale: es })}
                      </p>
                      {ticket.finalCostUsd !== undefined && (
                        <p className="text-xs opacity-80">Costo final: USD {ticket.finalCostUsd}</p>
                      )}
                      {ticket.outcomeNotes && (
                        <p className="text-xs opacity-70 italic">{ticket.outcomeNotes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Reingreso */}
          {reentryBatch && (
            <>
              <Separator />
              <section>
                <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <PackageCheck className="size-3" /> Reingreso
                </p>
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Operador: <strong>{reentryBatch.operatorName}</strong></span>
                    <Badge variant="outline" className="text-[10px] border-green-300 text-green-700">
                      {reentryBatch.status === 'executed' ? 'Ejecutado' : 'Pendiente'}
                    </Badge>
                  </div>
                  <p className="opacity-80">
                    {format(parseISO(reentryBatch.createdAt), 'dd MMM yyyy HH:mm', { locale: es })}
                  </p>
                </div>
              </section>
            </>
          )}

          {/* Scrap */}
          {scrapRecord && (
            <>
              <Separator />
              <section>
                <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Trash2 className="size-3" /> Baja (Scrap)
                </p>
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Operador: <strong>{scrapRecord.operatorName}</strong></span>
                    <Badge variant="outline" className="text-[10px] border-red-300 text-red-700">
                      {SCRAP_METHOD_LABELS[scrapRecord.disposalMethod]}
                    </Badge>
                  </div>
                  <p className="opacity-80">
                    {format(parseISO(scrapRecord.createdAt), 'dd MMM yyyy HH:mm', { locale: es })}
                  </p>
                  {scrapRecord.referenceDoc && (
                    <p className="opacity-80">Ref: {scrapRecord.referenceDoc}</p>
                  )}
                  {scrapRecord.notes && (
                    <p className="opacity-70 italic">{scrapRecord.notes}</p>
                  )}
                </div>
              </section>
            </>
          )}

          {/* Estado terminal */}
          {(returnOrder.status === 'closed' || returnOrder.status === 'rejected') && (
            <>
              <Separator />
              <div className="flex items-center gap-2 rounded-lg border border-muted px-3 py-2 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 shrink-0" />
                <span>
                  {returnOrder.status === 'closed' ? 'Devolución cerrada.' : 'Devolución rechazada.'}
                </span>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

### Step 4.2 — Añadir `onRowClick` a columns

- [ ] **Step 4.2: Modificar `columns.tsx`**

Cambiar la firma de `buildReturnColumns`:

```tsx
export const buildReturnColumns = (
  onAdvance: (row: ReturnRow) => void,
  onRowClick: (row: ReturnRow) => void,
): ColumnDef<ReturnRow>[] => [
  {
    accessorKey: 'rmaCode',
    header: ({ column }) => <DataTableColumnHeader column={column} title="RMA" />,
    cell: ({ row }) => (
      <button
        onClick={() => onRowClick(row.original)}
        className="font-medium hover:underline text-left"
      >
        {row.getValue('rmaCode')}
      </button>
    ),
  },
  // ... resto de columnas sin cambios ...
]
```

> Usar `<button>` en la celda de RMA como punto de click explícito, más accesible que click en fila completa.

### Step 4.3 — Integrar en page.tsx

- [ ] **Step 4.3: Integrar detail sheet en page.tsx**

Añadir imports:

```tsx
import { ReturnDetailSheet } from './_components/return-detail-sheet'
import type { ScrapRecord, ReentryBatch } from '@/types/wms'
```

Añadir estado del sheet junto a los demás `useDialogState`:

```tsx
const [detailReturnId, setDetailReturnId] = useState<string | null>(null)
```

Añadir datos derivados del RMA seleccionado (en el bloque de `useMemo`s):

```tsx
const detailReturn = useMemo(
  () => state.returnOrders.find((r) => r.id === detailReturnId) ?? null,
  [state.returnOrders, detailReturnId]
)

const detailInspection = useMemo(
  () =>
    detailReturn?.inspectionId
      ? state.returnInspections.find((i) => i.id === detailReturn.inspectionId)
      : undefined,
  [detailReturn, state.returnInspections]
)

const detailRepairTickets = useMemo(
  () => state.repairTickets.filter((t) => t.returnOrderId === detailReturnId),
  [state.repairTickets, detailReturnId]
)

const detailScrapRecord = useMemo(
  () => state.scrapRecords?.find((s: ScrapRecord) => s.returnOrderId === detailReturnId),
  [state.scrapRecords, detailReturnId]
)

const detailReentryBatch = useMemo(
  () => state.reentryBatches?.find((b: ReentryBatch) => b.returnOrderId === detailReturnId),
  [state.reentryBatches, detailReturnId]
)
```

> **Nota:** verificar que `state.scrapRecords` y `state.reentryBatches` existan en el store. Si no, ajustar los nombres según la estructura real del store.

Actualizar `columns`:

```tsx
const columns = useMemo(
  () => buildReturnColumns(handleOpenAdvance, (row) => setDetailReturnId(row.id)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []
)
```

Añadir el `<ReturnDetailSheet>` al final del JSX (antes del último `</>`):

```tsx
<ReturnDetailSheet
  open={!!detailReturnId}
  returnOrder={detailReturn}
  inspection={detailInspection}
  repairTickets={detailRepairTickets}
  scrapRecord={detailScrapRecord}
  reentryBatch={detailReentryBatch}
  warehouseName={warehouseName}
  productName={productName}
  onClose={() => setDetailReturnId(null)}
/>
```

- [ ] **Step 4.4: Verificar nombres en el store**

```bash
grep -n "scrapRecord\|reentryBatch\|scrapRecords\|reentryBatches" src/store/wms-store.ts | head -20
```

Ajustar los nombres en `page.tsx` según lo que devuelva este grep.

- [ ] **Step 4.5: Verificar visualmente**

En `/returns`, click en cualquier código RMA de la tabla → debe abrirse el sheet lateral con info completa. Para RMAs con inspección, scrap, reparación o reingreso, debe mostrar las secciones correspondientes.

- [ ] **Step 4.6: Commit**

```bash
git add src/app/returns/_components/return-detail-sheet.tsx src/app/returns/columns.tsx src/app/returns/page.tsx
git commit -m "feat(returns): add detail sheet with full RMA info on row click"
```

---

## Self-Review

**Spec coverage:**
- ✅ Días en estado + fecha creación → Task 1
- ✅ Búsqueda multi-columna → Task 2
- ✅ Estado vacío + limpiar filtros → Task 3
- ✅ Detail sheet + click en fila → Task 4

**Placeholder scan:**
- Task 4.3 tiene nota sobre verificar nombres del store — es una instrucción concreta, no un TBD.
- Task 2 Step 3 tiene bifurcación condicional según DataTable — ambas ramas tienen código.

**Type consistency:**
- `ReturnDetailSheet` Props usan tipos importados de `@/types/wms` y labels re-exportados de `columns.tsx`.
- `buildReturnColumns` en columns.tsx y su llamada en page.tsx tienen la misma firma `(onAdvance, onRowClick)`.
