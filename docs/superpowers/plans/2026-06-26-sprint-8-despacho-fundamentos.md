# Sprint 8 — Despacho y Transporte: Fix + Fundamentos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir cobertura de Sección F (Gestión de Despacho y Transporte) de 28% a ~55% corrigiendo el crash de `/sap-routes` y agregando fundamentos de tipos que habilitan sprints futuros.

**Architecture:** Cliente-only (Zustand + localStorage). 4 tareas independientes: tipos → seed → store → UI. Cada tarea produce código compilable antes de pasar a la siguiente. Sin nuevas rutas. Sin tests unitarios (lógica de store, no reglas puras).

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript 5 · Zustand 5 · TailwindCSS 4 · shadcn/Radix UI · react-hook-form + zod · TanStack React Table 8

## Global Constraints

- UI 100% español (es-CO) — nunca inglés en labels, badges, placeholders
- Fechas: siempre `date-fns` con locale `es` — nunca `new Date().toLocaleDateString()`
- Componentes: arrow functions — `const MyComp = () => {}`
- Clause guards antes del happy path en todo componente
- Clases CSS: siempre `cn()` de `@/lib/utils` — nunca template literals para clases condicionales
- Tipos de dominio: siempre importar de `src/types/wms.ts` — nunca redefinir inline
- Default exports solo en `page.tsx` y `layout.tsx`
- No ternarios anidados — usar clause guards o variables intermedias
- Formularios: react-hook-form + zod — nunca `useState` crudo para form state

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `src/types/wms.ts` | Modificar | `SapRoute`, `SapRouteStatus`, `DeliveryWindow`, campos en `Asn`/`Carrier`/`Warehouse` |
| `src/data/seed.ts` | Modificar | 6 `SapRoute` seed, `modalityType` en 4 carriers, `deliveryWindows` en 4 tiendas |
| `src/store/wms-store.ts` | Modificar | Slice `sapRoutes[]`, acciones `updateSapRouteStatus`, `updateAsnAppointment`, `updateWarehouseDeliveryWindows` |
| `src/app/sap-routes/columns.tsx` | Modificar | Reemplazar tipo inline `SapRouteRow` con `SapRoute` de `@/types/wms` |
| `src/app/sap-routes/page.tsx` | Modificar | Botón avance de estado (DropdownMenu) por fila |
| `src/app/receiving/_columns/columns-appointments.tsx` | Modificar | Columnas muelle/ventana/confirmado + botón "Asignar cita" |
| `src/app/receiving/_components/appointment-dialog.tsx` | Crear | Dialog con Select muelle, Select ventana horaria, Switch confirmación |
| `src/app/receiving/columns.tsx` | Modificar | Agregar `dockId`, `timeSlot`, `carrierConfirmed` a `AsnRow` |
| `src/app/receiving/page.tsx` | Modificar | Montar `AppointmentDialog` + `useDialogState` |
| `src/app/shipping/columns.tsx` | Modificar | Columna "Modalidad" con badge + `modalityType` en `ShippingRow` |
| `src/app/shipping/page.tsx` | Modificar | Filtro `modalityType` en tab "Envíos", join con `carriers[]` del store |
| `src/app/admin/page.tsx` | Modificar | Tab "Almacenes" nuevo + sección `deliveryWindows` editable |

---

## Task 1: Tipos base en `src/types/wms.ts`

**Files:**
- Modify: `src/types/wms.ts`

**Interfaces:**
- Produces: `SapRoute`, `SapRouteStatus`, `DeliveryWindow` — usados por Tasks 2, 3, 4, 5
- Produces: `Asn.dockId?`, `Asn.timeSlot?`, `Asn.carrierConfirmed?` — usados por Tasks 3, 6
- Produces: `Carrier.modalityType` — usado por Tasks 2, 3, 7
- Produces: `Warehouse.deliveryWindows?` — usado por Tasks 2, 3, 8

- [ ] **Step 1: Agregar `DeliveryWindow` antes de `interface Warehouse` (línea ~39)**

Abrir `src/types/wms.ts`. Localizar `export interface Warehouse` (línea 40). Insertar antes:

```ts
export interface DeliveryWindow {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0=domingo, 1=lunes, …, 6=sábado
  openTime: string  // 'HH:mm' — hora apertura recepción
  closeTime: string // 'HH:mm' — hora cierre recepción
}
```

- [ ] **Step 2: Agregar `deliveryWindows?` a `interface Warehouse`**

Localizar `interface Warehouse` (línea 40). Agregar campo al final:

```ts
export interface Warehouse {
  id: string
  code: string
  name: string
  city: string
  type: 'distribution_center' | 'store'
  deliveryWindows?: DeliveryWindow[]
}
```

- [ ] **Step 3: Agregar `dockId?`, `timeSlot?`, `carrierConfirmed?` a `interface Asn`**

Localizar `interface Asn` (línea 183). Agregar después de `receptionNotes?`:

```ts
  dockId?: string           // muelle asignado, e.g. 'dock-1'
  timeSlot?: string         // ventana horaria, e.g. '08:00-10:00'
  carrierConfirmed?: boolean // transportista confirmó la cita
```

- [ ] **Step 4: Agregar `modalityType` a `interface Carrier`**

Localizar `interface Carrier` (línea 747). Agregar después de `apiIntegration`:

```ts
  modalityType: 'own' | 'third_party' | 'courier' | 'last_mile'
```

- [ ] **Step 5: Agregar `SapRouteStatus` y `SapRoute` al final del archivo**

Al final de `src/types/wms.ts`, antes de la última línea, agregar:

```ts
// Sprint 8: SAP Routes (F-85)
export type SapRouteStatus =
  | 'pending'
  | 'in_progress'
  | 'in_transit'
  | 'completed'
  | 'synced'
  | 'error'

export interface SapRoute {
  id: string
  code: string             // e.g. 'SAP-RT-001'
  name: string             // e.g. 'Ruta Bogotá Norte'
  originId: string         // warehouseId del CD origen
  destinationIds: string[] // warehouseIds de tiendas destino
  carrierName: string
  driverName: string
  truckPlate: string       // formato colombiano 'ABC-123'
  routeDate: string        // ISO date 'YYYY-MM-DD'
  currentLoadKg: number
  capacityKg: number
  status: SapRouteStatus
}
```

- [ ] **Step 6: Verificar que el proyecto compila**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores. Si hay errores de `modalityType` faltante, es normal — se resuelven en Task 2 (seed).

- [ ] **Step 7: Commit**

```bash
git add src/types/wms.ts
git commit -m "feat(types): add SapRoute, DeliveryWindow, modalityType, Asn dock fields (Sprint 8)"
```

---

## Task 2: Seed — SapRoute + modalityType + deliveryWindows

**Files:**
- Modify: `src/data/seed.ts`

**Interfaces:**
- Consumes: `SapRoute`, `SapRouteStatus`, `DeliveryWindow`, `Carrier.modalityType`, `Warehouse.deliveryWindows` (Task 1)
- Produces: `seed.sapRoutes` — consumido por Task 3 (store)

- [ ] **Step 1: Agregar `modalityType` a los 4 carriers existentes**

Localizar `export const carriers: Carrier[]` (línea 2016). Los 4 carriers son `ca-1` (Coordinadora), `ca-2` (Servientrega), `ca-3` (TCC), `ca-4` (Envia.com). Agregar `modalityType` a cada uno:

```ts
// ca-1 Coordinadora — después de apiIntegration: true
modalityType: 'courier',

// ca-2 Servientrega — después de apiIntegration: true
modalityType: 'courier',

// ca-3 TCC — después de apiIntegration: false
modalityType: 'third_party',

// ca-4 Envia.com — después de apiIntegration: true
modalityType: 'last_mile',
```

- [ ] **Step 2: Agregar `deliveryWindows` a las 4 tiendas en `warehouses`**

Localizar `export const warehouses: Warehouse[]` (línea 36). Las tiendas son `wh-andino`, `wh-santafe`, `wh-viva`, `wh-unicentro`. Agregar `deliveryWindows` a cada una (lunes a sábado, 08:00–18:00):

```ts
{ id: 'wh-andino', code: 'ST-AND', name: 'Tienda Andino', city: 'Bogotá', type: 'store',
  deliveryWindows: [
    { dayOfWeek: 1, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 2, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 3, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 4, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 5, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 6, openTime: '08:00', closeTime: '14:00' },
  ],
},
{ id: 'wh-santafe', code: 'ST-SFE', name: 'Tienda Santa Fe', city: 'Bogotá', type: 'store',
  deliveryWindows: [
    { dayOfWeek: 1, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 2, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 3, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 4, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 5, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 6, openTime: '08:00', closeTime: '14:00' },
  ],
},
{ id: 'wh-viva', code: 'ST-VIV', name: 'Tienda Viva Envigado', city: 'Envigado', type: 'store',
  deliveryWindows: [
    { dayOfWeek: 1, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 2, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 3, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 4, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 5, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 6, openTime: '08:00', closeTime: '14:00' },
  ],
},
{ id: 'wh-unicentro', code: 'ST-UNI', name: 'Tienda Unicentro', city: 'Bogotá', type: 'store',
  deliveryWindows: [
    { dayOfWeek: 1, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 2, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 3, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 4, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 5, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 6, openTime: '08:00', closeTime: '14:00' },
  ],
},
```

- [ ] **Step 3: Agregar `export const sapRoutes: SapRoute[]` al final de `seed.ts`**

Después de `export const dashboardHistory` (última exportación), agregar:

```ts
export const sapRoutes: SapRoute[] = [
  {
    id: 'sap-rt-001',
    code: 'SAP-RT-001',
    name: 'Ruta Bogotá Norte',
    originId: 'wh-bog',
    destinationIds: ['wh-andino', 'wh-unicentro'],
    carrierName: 'Coordinadora',
    driverName: 'Luis Hernández',
    truckPlate: 'BJK-412',
    routeDate: '2026-06-26',
    currentLoadKg: 4200,
    capacityKg: 6000,
    status: 'in_transit',
  },
  {
    id: 'sap-rt-002',
    code: 'SAP-RT-002',
    name: 'Ruta Bogotá Sur',
    originId: 'wh-bog',
    destinationIds: ['wh-santafe'],
    carrierName: 'Servientrega',
    driverName: 'Carlos Medina',
    truckPlate: 'RTP-887',
    routeDate: '2026-06-25',
    currentLoadKg: 5800,
    capacityKg: 6000,
    status: 'synced',
  },
  {
    id: 'sap-rt-003',
    code: 'SAP-RT-003',
    name: 'Ruta Medellín Norte',
    originId: 'wh-med',
    destinationIds: ['wh-viva'],
    carrierName: 'TCC',
    driverName: 'Andrés Restrepo',
    truckPlate: 'CDF-221',
    routeDate: '2026-06-24',
    currentLoadKg: 7100,
    capacityKg: 8000,
    status: 'completed',
  },
  {
    id: 'sap-rt-004',
    code: 'SAP-RT-004',
    name: 'Ruta Medellín Sur',
    originId: 'wh-med',
    destinationIds: ['wh-viva', 'wh-unicentro'],
    carrierName: 'Coordinadora',
    driverName: 'Juliana Torres',
    truckPlate: 'MNP-543',
    routeDate: '2026-06-26',
    currentLoadKg: 3900,
    capacityKg: 7000,
    status: 'in_transit',
  },
  {
    id: 'sap-rt-005',
    code: 'SAP-RT-005',
    name: 'Ruta Nacional Caribe',
    originId: 'wh-bog',
    destinationIds: [],
    carrierName: 'TCC',
    driverName: 'Hernando Suárez',
    truckPlate: 'QWE-119',
    routeDate: '2026-06-27',
    currentLoadKg: 0,
    capacityKg: 8000,
    status: 'pending',
  },
  {
    id: 'sap-rt-006',
    code: 'SAP-RT-006',
    name: 'Ruta Nacional Eje Cafetero',
    originId: 'wh-bog',
    destinationIds: [],
    carrierName: 'Servientrega',
    driverName: 'Mauricio Gómez',
    truckPlate: 'ZXC-774',
    routeDate: '2026-06-26',
    currentLoadKg: 2100,
    capacityKg: 5000,
    status: 'error',
  },
]
```

Agregar también el import de `SapRoute` al inicio del archivo si no está:

```ts
import type { ..., SapRoute } from '@/types/wms'
```

- [ ] **Step 4: Verificar que el proyecto compila**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/data/seed.ts
git commit -m "feat(seed): add sapRoutes, modalityType on carriers, deliveryWindows on stores (Sprint 8)"
```

---

## Task 3: Store — slice `sapRoutes[]` + 3 acciones nuevas

**Files:**
- Modify: `src/store/wms-store.ts`

**Interfaces:**
- Consumes: `SapRoute`, `SapRouteStatus`, `DeliveryWindow` (Task 1), `seed.sapRoutes` (Task 2)
- Produces:
  - `state.sapRoutes: SapRoute[]`
  - `updateSapRouteStatus(id: string, status: SapRouteStatus): void`
  - `updateAsnAppointment(id: string, data: { dockId?: string; timeSlot?: string; carrierConfirmed?: boolean }): void`
  - `updateWarehouseDeliveryWindows(id: string, windows: DeliveryWindow[]): void`

- [ ] **Step 1: Agregar `SapRoute`, `SapRouteStatus`, `DeliveryWindow` a los imports de `wms-store.ts`**

Localizar la línea de import de `@/types/wms` al inicio del archivo. Agregar `SapRoute`, `SapRouteStatus`, `DeliveryWindow` a la lista de tipos importados.

- [ ] **Step 2: Agregar `sapRoutes: SapRoute[]` a `WmsState` (línea ~84)**

Localizar `export interface WmsState` (línea 84). Después de `loadManifests: LoadManifest[]` (línea ~110), agregar:

```ts
  sapRoutes: SapRoute[]
```

- [ ] **Step 3: Agregar las 3 firmas de acción a `WmsState`**

Después de `completeCrossDockTask` (línea ~310, última acción de Sprint 9), agregar:

```ts
  // Sprint 8: Despacho y transporte (F-85, F-82, F-91)
  updateSapRouteStatus: (id: string, status: SapRouteStatus) => void
  updateAsnAppointment: (id: string, data: { dockId?: string; timeSlot?: string; carrierConfirmed?: boolean }) => void
  updateWarehouseDeliveryWindows: (id: string, windows: DeliveryWindow[]) => void
```

- [ ] **Step 4: Agregar `sapRoutes: seed.sapRoutes` a `buildSeedState()`**

Localizar `const buildSeedState = () => ({` (línea ~320). Después de `loadManifests: seed.loadManifests`, agregar:

```ts
  sapRoutes: seed.sapRoutes,
```

- [ ] **Step 5: Implementar las 3 acciones en el cuerpo del store**

Localizar el bloque `completeCrossDockTask` (última acción implementada, ~línea 2800). Después de su cierre `},`, agregar:

```ts
  updateSapRouteStatus: (id, status) => {
    const state = get()
    const route = state.sapRoutes.find((r) => r.id === id)
    if (!route) throw new Error('sapRoute not found')
    set({ sapRoutes: state.sapRoutes.map((r) => (r.id === id ? { ...r, status } : r)) })
  },

  updateAsnAppointment: (id, data) => {
    const state = get()
    const asn = state.asnRecords.find((a) => a.id === id)
    if (!asn) throw new Error('ASN not found')
    const updated = { ...asn, ...data }
    set({ asnRecords: state.asnRecords.map((a) => (a.id === id ? updated : a)) })
  },

  updateWarehouseDeliveryWindows: (id, windows) => {
    const state = get()
    const wh = state.warehouses.find((w) => w.id === id)
    if (!wh) throw new Error('warehouse not found')
    set({ warehouses: state.warehouses.map((w) => (w.id === id ? { ...w, deliveryWindows: windows } : w)) })
  },
```

- [ ] **Step 6: Verificar que el proyecto compila**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/store/wms-store.ts
git commit -m "feat(store): add sapRoutes slice + updateSapRouteStatus, updateAsnAppointment, updateWarehouseDeliveryWindows (Sprint 8)"
```

---

## Task 4: Fix `/sap-routes` — eliminar crash (F-85)

**Files:**
- Modify: `src/app/sap-routes/columns.tsx`
- Modify: `src/app/sap-routes/page.tsx`

**Interfaces:**
- Consumes: `SapRoute`, `SapRouteStatus` (Task 1), `state.sapRoutes` (Task 3), `updateSapRouteStatus` (Task 3)
- Consumes: `useStoreHelpers().warehouseName` (existing hook)

- [ ] **Step 1: Reescribir `src/app/sap-routes/columns.tsx`**

Reemplazar el contenido completo del archivo:

```tsx
'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { ChevronDown, Truck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { formatNumber } from '@/lib/formatters'
import type { SapRoute, SapRouteStatus } from '@/types/wms'

// Valid next states from each status
const NEXT_STATES: Record<SapRouteStatus, SapRouteStatus[]> = {
  pending:     ['in_progress', 'error'],
  in_progress: ['in_transit', 'error'],
  in_transit:  ['completed', 'synced', 'error'],
  completed:   ['synced'],
  synced:      [],
  error:       ['pending', 'synced'],
}

const STATUS_LABELS: Record<SapRouteStatus, string> = {
  pending:     'Pendiente',
  in_progress: 'En preparación',
  in_transit:  'En tránsito',
  completed:   'Completado',
  synced:      'Sincronizado',
  error:       'Error',
}

interface ColumnActions {
  onStatusChange: (id: string, status: SapRouteStatus) => void
  warehouseName: (id: string) => string
}

export const buildSapRouteColumns = ({ onStatusChange, warehouseName }: ColumnActions): ColumnDef<SapRoute>[] => [
  {
    accessorKey: 'code',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
    cell: ({ row }) => (
      <span className="font-mono text-sm font-medium">{row.getValue('code')}</span>
    ),
  },
  {
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
    cell: ({ row }) => <span className="font-medium">{row.getValue('name')}</span>,
  },
  {
    id: 'origin',
    header: 'Origen',
    cell: ({ row }) => (
      <span className="text-sm">{warehouseName(row.original.originId)}</span>
    ),
    enableSorting: false,
  },
  {
    id: 'destinations',
    header: 'Destinos',
    cell: ({ row }) => {
      const names = row.original.destinationIds.map(warehouseName)
      if (!names.length) return <span className="text-muted-foreground text-sm">—</span>
      return (
        <div className="flex flex-wrap gap-1">
          {names.map((d) => (
            <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
          ))}
        </div>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'carrierName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Transportadora" />,
    cell: ({ row }) => <span className="text-sm">{row.getValue('carrierName')}</span>,
  },
  {
    id: 'driver',
    header: () => (
      <div className="flex items-center gap-1">
        <Truck className="size-3" /> Conductor / Placa
      </div>
    ),
    cell: ({ row }) => (
      <div>
        <p className="text-sm font-medium">{row.original.driverName}</p>
        <p className="text-muted-foreground font-mono text-xs">{row.original.truckPlate}</p>
      </div>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'routeDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha ruta" />,
    cell: ({ row }) => <span className="text-sm">{row.getValue('routeDate')}</span>,
  },
  {
    id: 'load',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Ocupación" />,
    cell: ({ row }) => {
      const { currentLoadKg, capacityKg } = row.original
      const pct = capacityKg > 0 ? Math.round((currentLoadKg / capacityKg) * 100) : 0
      const colorClass = pct >= 90 ? '[&>div]:bg-red-500' : pct >= 70 ? '[&>div]:bg-amber-500' : ''
      return (
        <div className="flex items-center gap-2">
          <Progress value={pct} className={`h-2 w-20 ${colorClass}`} />
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatNumber(currentLoadKg)}/{formatNumber(capacityKg)} kg
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
  },
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const nextStates = NEXT_STATES[row.original.status as SapRouteStatus] ?? []
      if (!nextStates.length) return null
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
              Avanzar <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {nextStates.map((s) => (
              <DropdownMenuItem
                key={s}
                onClick={() => onStatusChange(row.original.id, s)}
              >
                {STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
```

- [ ] **Step 2: Actualizar `src/app/sap-routes/page.tsx`**

Reemplazar el contenido completo:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { Route } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { PageHeader } from '@/components/shared/page-header'
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
import { buildSapRouteColumns } from './columns'
import type { SapRouteStatus } from '@/types/wms'

export default function SapRoutesPage() {
  const state = useWmsStore()
  const { warehouseName } = useStoreHelpers()

  const [statusFilter, setStatusFilter] = useState('all')
  const [carrierFilter, setCarrierFilter] = useState('all')

  const carriers = useMemo(
    () => [...new Set(state.sapRoutes.map((r) => r.carrierName))],
    [state.sapRoutes]
  )

  const filteredRoutes = useMemo(
    () =>
      state.sapRoutes.filter((r) => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false
        if (carrierFilter !== 'all' && r.carrierName !== carrierFilter) return false
        return true
      }),
    [state.sapRoutes, statusFilter, carrierFilter]
  )

  const inTransitCount = state.sapRoutes.filter((r) => r.status === 'in_transit').length
  const syncedCount = state.sapRoutes.filter((r) => r.status === 'synced').length
  const totalLoad = state.sapRoutes.reduce((s, r) => s + r.currentLoadKg, 0)

  const columns = useMemo(
    () =>
      buildSapRouteColumns({
        onStatusChange: (id, status) => state.updateSapRouteStatus(id, status as SapRouteStatus),
        warehouseName,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [warehouseName]
  )

  const filtersNode = (
    <>
      <Select value={carrierFilter} onValueChange={setCarrierFilter}>
        <SelectTrigger className="h-8 w-44">
          <SelectValue placeholder="Transportadora" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {carriers.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="h-8 w-40">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="pending">Pendiente</SelectItem>
          <SelectItem value="in_progress">En preparación</SelectItem>
          <SelectItem value="in_transit">En tránsito</SelectItem>
          <SelectItem value="completed">Completado</SelectItem>
          <SelectItem value="synced">Sincronizado</SelectItem>
          <SelectItem value="error">Error</SelectItem>
        </SelectContent>
      </Select>
    </>
  )

  return (
    <>
      <PageHeader
        title="Rutas SAP"
        description="Rutas de transporte sincronizadas desde SAP. Seguimiento de carga, conductor y estado por ruta."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">En tránsito</p>
            <p className="text-2xl font-bold text-blue-600 tabular-nums">
              {formatNumber(inTransitCount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Sincronizadas</p>
            <p className="text-2xl font-bold text-green-700 tabular-nums">
              {formatNumber(syncedCount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Carga total activa (kg)</p>
            <p className="text-2xl font-bold tabular-nums">{formatNumber(totalLoad)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="mb-1 flex items-center gap-2 text-base font-semibold">
            <Route className="size-4" /> Rutas SAP
          </div>
          <DataTable
            columns={columns}
            data={filteredRoutes}
            searchColumn="name"
            searchPlaceholder="Buscar ruta..."
            filters={filtersNode}
            emptyMessage="No hay rutas con los filtros seleccionados."
          />
        </CardContent>
      </Card>
    </>
  )
}
```

- [ ] **Step 3: Verificar que `/sap-routes` compila y no crashea**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -20
```

Esperado: sin errores de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add src/app/sap-routes/columns.tsx src/app/sap-routes/page.tsx
git commit -m "fix(sap-routes): resolve runtime crash — use real SapRoute type + add status advance dropdown (F-85)"
```

---

## Task 5: `/receiving` — Citas con muelle y ventana horaria (F-82)

**Files:**
- Create: `src/app/receiving/_components/appointment-dialog.tsx`
- Modify: `src/app/receiving/columns.tsx`
- Modify: `src/app/receiving/_columns/columns-appointments.tsx`
- Modify: `src/app/receiving/page.tsx`

**Interfaces:**
- Consumes: `updateAsnAppointment(id, data)` (Task 3), `useDialogState<Asn>` (existing hook), `Asn.dockId?`, `Asn.timeSlot?`, `Asn.carrierConfirmed?` (Task 1)
- Produces: `<AppointmentDialog asn={Asn|null} open={boolean} onClose={() => void} />` (named export)

- [ ] **Step 1: Crear `src/app/receiving/_components/appointment-dialog.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useWmsStore } from '@/store/wms-store'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import type { Asn } from '@/types/wms'

const DOCKS = [
  { value: 'dock-1', label: 'Muelle 1' },
  { value: 'dock-2', label: 'Muelle 2' },
  { value: 'dock-3', label: 'Muelle 3' },
  { value: 'dock-4', label: 'Muelle 4' },
]

const TIME_SLOTS = [
  '06:00-08:00',
  '08:00-10:00',
  '10:00-12:00',
  '12:00-14:00',
  '14:00-16:00',
  '16:00-18:00',
]

const schema = z.object({
  dockId: z.string().min(1, 'Selecciona un muelle'),
  timeSlot: z.string().min(1, 'Selecciona una ventana'),
  carrierConfirmed: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  asn: Asn | null
  open: boolean
  onClose: () => void
}

export const AppointmentDialog = ({ asn, open, onClose }: Props) => {
  const { updateAsnAppointment } = useWmsStore()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { dockId: '', timeSlot: '', carrierConfirmed: false },
  })

  useEffect(() => {
    if (asn) {
      form.reset({
        dockId: asn.dockId ?? '',
        timeSlot: asn.timeSlot ?? '',
        carrierConfirmed: asn.carrierConfirmed ?? false,
      })
    }
  }, [asn, form])

  if (!asn) return null

  const handleSubmit = (values: FormValues) => {
    updateAsnAppointment(asn.id, values)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar cita — {asn.code}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="dockId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Muelle</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar muelle" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DOCKS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timeSlot"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ventana horaria</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar ventana" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TIME_SLOTS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="carrierConfirmed"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <Label>Confirmado por transportista</Label>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Agregar `dockId`, `timeSlot`, `carrierConfirmed` a `AsnRow` en `src/app/receiving/columns.tsx`**

Localizar `interface AsnRow`. Agregar los 3 campos opcionales:

```ts
  dockId?: string
  timeSlot?: string
  carrierConfirmed?: boolean
```

- [ ] **Step 3: Actualizar `src/app/receiving/_columns/columns-appointments.tsx`**

Reemplazar el contenido completo:

```tsx
import { type ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, Check, Clock, Truck, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { DataTableColumnHeader } from '@/components/data-table'
import { formatNumber } from '@/lib/formatters'
import type { AsnRow } from '../columns'
import { codeCol, supplierCol, productCol, abcCol, flagsCol, type ActionHandler } from './shared'
import type { Asn } from '@/types/wms'

interface AppointmentActionHandler {
  onAction: ActionHandler
  onAssignAppointment: (asn: Asn) => void
}

export const buildAppointmentColumns = (
  { onAction, onAssignAppointment }: AppointmentActionHandler,
  asnRecords: Asn[]
): ColumnDef<AsnRow>[] => [
  codeCol,
  supplierCol,
  productCol,
  abcCol,
  {
    accessorKey: 'appointmentDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha de cita" />,
    cell: ({ row }) => {
      const { appointmentDate, isOverdue } = row.original
      return (
        <div className="flex items-center gap-1.5">
          {isOverdue ? (
            <AlertTriangle className="size-3.5 shrink-0 text-red-500" />
          ) : (
            <Clock className="text-muted-foreground size-3.5 shrink-0" />
          )}
          <span className={isOverdue ? 'text-sm font-semibold text-red-600' : 'text-sm'}>
            {appointmentDate}
          </span>
          {isOverdue && (
            <Badge variant="destructive" className="ml-1 text-xs">Atrasada</Badge>
          )}
        </div>
      )
    },
  },
  {
    id: 'dock',
    header: 'Muelle',
    enableSorting: false,
    cell: ({ row }) => {
      const dock = row.original.dockId
      if (!dock) return <span className="text-muted-foreground text-sm">—</span>
      return <Badge variant="outline" className="font-mono text-xs">{dock.replace('dock-', 'M-')}</Badge>
    },
  },
  {
    id: 'timeSlot',
    header: 'Ventana',
    enableSorting: false,
    cell: ({ row }) => {
      const slot = row.original.timeSlot
      if (!slot) return <span className="text-muted-foreground text-sm">—</span>
      return <Badge variant="secondary" className="text-xs">{slot}</Badge>
    },
  },
  {
    id: 'carrierConfirmed',
    header: 'Confirmado',
    enableSorting: false,
    cell: ({ row }) => {
      const confirmed = row.original.carrierConfirmed
      if (confirmed === undefined) return <span className="text-muted-foreground text-sm">—</span>
      return confirmed
        ? <Check className="size-4 text-green-600" />
        : <X className="text-muted-foreground size-4" />
    },
  },
  {
    id: 'deliveryProgress',
    header: 'Entregas',
    enableSorting: false,
    cell: ({ row }) => {
      const { status, deliveryCount, receivedQuantity, expectedQuantity } = row.original
      const pct = Math.round((receivedQuantity / expectedQuantity) * 100)
      const pending = expectedQuantity - receivedQuantity

      if (status === 'pending') {
        return (
          <div className="min-w-36 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs tabular-nums">
                {formatNumber(expectedQuantity)} uds esperadas
              </span>
              <span className="text-muted-foreground text-xs">0%</span>
            </div>
            <Progress value={0} />
          </div>
        )
      }

      return (
        <div className="min-w-36 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold tabular-nums">
              {formatNumber(receivedQuantity)}
              <span className="text-muted-foreground font-normal">
                {' '}/ {formatNumber(expectedQuantity)} uds
              </span>
            </span>
            <span className="text-xs font-bold text-blue-600">{pct}%</span>
          </div>
          <Progress value={pct} className="*:data-[slot=progress-indicator]:bg-blue-500" />
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              -{formatNumber(pending)} pendiente
            </span>
            <span className="text-muted-foreground text-[10px]">
              · {deliveryCount} {deliveryCount === 1 ? 'entrega' : 'entregas'}
            </span>
          </div>
        </div>
      )
    },
  },
  flagsCol,
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const asn = asnRecords.find((a) => a.id === row.original.id)
      return (
        <div className="flex items-center gap-2">
          {asn && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                onAssignAppointment(asn)
              }}
            >
              Asignar cita
            </Button>
          )}
          {row.original.canReceive && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onAction('confirm', row.original)
              }}
            >
              <Truck className="mr-1.5 size-3.5" />
              Confirmar llegada
            </Button>
          )}
        </div>
      )
    },
  },
]
```

- [ ] **Step 4: Actualizar la exportación de `buildAppointmentColumns` en `src/app/receiving/columns.tsx`**

La línea de re-export ya existe:
```ts
export { buildAppointmentColumns } from './_columns/columns-appointments'
```
No cambia — la firma nueva es compatible vía el objeto de parámetros.

- [ ] **Step 5: Actualizar `src/app/receiving/page.tsx` — montar `AppointmentDialog`**

Buscar la sección de imports y añadir:
```ts
import { AppointmentDialog } from './_components/appointment-dialog'
import { useDialogState } from '@/hooks/use-dialog-state'
import type { Asn } from '@/types/wms'
```

Dentro de `const ReceivingPage = () => {`, antes del primer `useMemo`, agregar:
```ts
const appointmentDialog = useDialogState<Asn>()
```

Buscar donde se llama `buildAppointmentColumns` (tab "citas"). Actualizar la llamada pasando el objeto con `onAction` y `onAssignAppointment`:

```ts
// Dentro del useMemo de columns del tab 'citas':
buildAppointmentColumns(
  {
    onAction: handleAction,
    onAssignAppointment: (asn) => appointmentDialog.open(asn),
  },
  state.asnRecords
)
```

Al final del JSX, antes del cierre del fragmento, agregar:
```tsx
<AppointmentDialog
  asn={appointmentDialog.data}
  open={!!appointmentDialog.data}
  onClose={appointmentDialog.close}
/>
```

También actualizar el `AsnRow` mapeado en la sección "citas" para incluir los nuevos campos. Localizar donde se mapea `asnRows` para el tab de citas y agregar:
```ts
dockId: asn.dockId,
timeSlot: asn.timeSlot,
carrierConfirmed: asn.carrierConfirmed,
```

- [ ] **Step 6: Verificar compilación**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/app/receiving/_components/appointment-dialog.tsx \
        src/app/receiving/columns.tsx \
        src/app/receiving/_columns/columns-appointments.tsx \
        src/app/receiving/page.tsx
git commit -m "feat(receiving): add dock/time-slot appointment assignment dialog (F-82)"
```

---

## Task 6: `/shipping` — Columna y filtro de modalidad de carrier (F-86)

**Files:**
- Modify: `src/app/shipping/columns.tsx`
- Modify: `src/app/shipping/page.tsx`

**Interfaces:**
- Consumes: `Carrier.modalityType` (Task 1), `state.carriers[]` (existing)
- Consumes: `ShippingRow` (existing interface in `columns.tsx`)

- [ ] **Step 1: Agregar `modalityType` a `ShippingRow` en `src/app/shipping/columns.tsx`**

Localizar `interface ShippingRow`. Agregar:
```ts
  modalityType: 'own' | 'third_party' | 'courier' | 'last_mile' | undefined
```

- [ ] **Step 2: Agregar columna "Modalidad" a `buildShippingColumns`**

Localizar `export const buildShippingColumns`. Después de la columna `carrierName`, insertar la nueva columna:

```tsx
  {
    id: 'modalityType',
    accessorKey: 'modalityType',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Modalidad" />,
    cell: ({ row }) => {
      const modality = row.original.modalityType
      if (!modality) return <span className="text-muted-foreground text-sm">—</span>
      const config: Record<string, { label: string; className: string }> = {
        own:         { label: 'Flota propia', className: 'bg-green-100 text-green-700 border-green-200' },
        third_party: { label: 'Tercero',      className: 'bg-blue-100 text-blue-700 border-blue-200' },
        courier:     { label: 'Courier',      className: 'bg-violet-100 text-violet-700 border-violet-200' },
        last_mile:   { label: 'Última milla', className: 'bg-orange-100 text-orange-700 border-orange-200' },
      }
      const { label, className } = config[modality] ?? { label: modality, className: '' }
      return (
        <span className={cn('rounded border px-2 py-0.5 text-xs font-medium', className)}>
          {label}
        </span>
      )
    },
    enableSorting: false,
  },
```

Asegurarse de que `cn` está importado: `import { cn } from '@/lib/utils'`.

- [ ] **Step 3: Actualizar `src/app/shipping/page.tsx` — resolver `modalityType` en el mapeo de filas**

Localizar donde se construye el array de `ShippingRow[]` (dentro de `useMemo`). Agregar al store:
```ts
const { carriers } = useWmsStore()
```

En el mapeo de cada shipment a `ShippingRow`, agregar:
```ts
const carrier = carriers.find((c) => c.id === s.carrierId)
// ...dentro del objeto ShippingRow:
modalityType: carrier?.modalityType,
```

- [ ] **Step 4: Agregar filtro `modalityType` en tab "Envíos"**

Localizar el estado de filtros del tab "Envíos". Agregar:
```ts
const [modalityFilter, setModalityFilter] = useState<string>('all')
```

En la lógica de filtrado de `filteredRows`, agregar condición:
```ts
if (modalityFilter !== 'all' && row.modalityType !== modalityFilter) return false
```

En el JSX de filtros del tab "Envíos", agregar el Select:
```tsx
<Select value={modalityFilter} onValueChange={setModalityFilter}>
  <SelectTrigger className="h-8 w-40">
    <SelectValue placeholder="Modalidad" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">Todas</SelectItem>
    <SelectItem value="own">Flota propia</SelectItem>
    <SelectItem value="third_party">Tercero</SelectItem>
    <SelectItem value="courier">Courier</SelectItem>
    <SelectItem value="last_mile">Última milla</SelectItem>
  </SelectContent>
</Select>
```

- [ ] **Step 5: Verificar compilación**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -20
```

Esperado: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/app/shipping/columns.tsx src/app/shipping/page.tsx
git commit -m "feat(shipping): add carrier modalityType column and filter (F-86)"
```

---

## Task 7: `/admin` tab "Almacenes" — Ventanas de entrega (F-91)

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `updateWarehouseDeliveryWindows(id, windows)` (Task 3), `DeliveryWindow` (Task 1), `Warehouse.deliveryWindows?` (Task 1)

- [ ] **Step 1: Agregar `Warehouse` y `DeliveryWindow` a los imports de `admin/page.tsx`**

Localizar el import de `@/types/wms`. Agregar `Warehouse` y `DeliveryWindow` a la lista.

- [ ] **Step 2: Agregar tab "Almacenes" a `ADMIN_TABS`**

Localizar `const ADMIN_TABS: SubNavItem[]`. Agregar al array:
```ts
{ value: 'almacenes', label: 'Almacenes' },
```

- [ ] **Step 3: Agregar estado local para edición de ventanas**

Dentro de `const AdminPage = () => {`, agregar:
```ts
const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(null)
const [windowsForm, setWindowsForm] = useState<DeliveryWindow[]>([])

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const handleOpenWarehouse = (wh: Warehouse) => {
  setEditingWarehouseId(wh.id)
  setWindowsForm(wh.deliveryWindows ?? [])
}

const handleAddWindow = () => {
  setWindowsForm((prev) => [...prev, { dayOfWeek: 1, openTime: '08:00', closeTime: '18:00' }])
}

const handleRemoveWindow = (idx: number) => {
  setWindowsForm((prev) => prev.filter((_, i) => i !== idx))
}

const handleSaveWindows = () => {
  if (!editingWarehouseId) return
  state.updateWarehouseDeliveryWindows(editingWarehouseId, windowsForm)
  setEditingWarehouseId(null)
}
```

- [ ] **Step 4: Agregar sección JSX del tab "almacenes"**

Localizar la sección que renderiza los tabs (donde está `activeTab === 'operators'`, etc.). Agregar al final, antes del cierre del contenedor principal:

```tsx
{activeTab === 'almacenes' && (
  <Card>
    <CardHeader>
      <CardTitle>Almacenes y ventanas de entrega</CardTitle>
      <CardDescription>
        Configura las ventanas horarias de recepción por tienda.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Ciudad</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Ventanas</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {warehouses.map((wh) => (
            <TableRow key={wh.id}>
              <TableCell className="font-mono text-sm">{wh.code}</TableCell>
              <TableCell className="font-medium">{wh.name}</TableCell>
              <TableCell>{wh.city}</TableCell>
              <TableCell>
                <Badge variant={wh.type === 'distribution_center' ? 'default' : 'secondary'}>
                  {wh.type === 'distribution_center' ? 'CD' : 'Tienda'}
                </Badge>
              </TableCell>
              <TableCell>
                {wh.deliveryWindows?.length ? (
                  <span className="text-sm">{wh.deliveryWindows.length} ventanas</span>
                ) : (
                  <span className="text-muted-foreground text-sm">Sin ventanas</span>
                )}
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => handleOpenWarehouse(wh)}
                >
                  <Pencil className="mr-1 size-3" /> Editar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
)}
```

- [ ] **Step 5: Agregar Dialog de edición de ventanas**

Antes del cierre del `return` del componente, agregar:

```tsx
<Dialog open={!!editingWarehouseId} onOpenChange={(o) => !o && setEditingWarehouseId(null)}>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>
        Ventanas de entrega — {warehouses.find((w) => w.id === editingWarehouseId)?.name}
      </DialogTitle>
    </DialogHeader>
    <div className="space-y-3 py-2">
      {windowsForm.map((win, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Select
            value={String(win.dayOfWeek)}
            onValueChange={(v) =>
              setWindowsForm((prev) =>
                prev.map((w, i) => (i === idx ? { ...w, dayOfWeek: Number(v) as DeliveryWindow['dayOfWeek'] } : w))
              )
            }
          >
            <SelectTrigger className="h-8 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_LABELS.map((d, i) => (
                <SelectItem key={i} value={String(i)}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="h-8 w-24"
            type="time"
            value={win.openTime}
            onChange={(e) =>
              setWindowsForm((prev) =>
                prev.map((w, i) => (i === idx ? { ...w, openTime: e.target.value } : w))
              )
            }
          />
          <span className="text-muted-foreground text-sm">–</span>
          <Input
            className="h-8 w-24"
            type="time"
            value={win.closeTime}
            onChange={(e) =>
              setWindowsForm((prev) =>
                prev.map((w, i) => (i === idx ? { ...w, closeTime: e.target.value } : w))
              )
            }
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 shrink-0 text-red-500 hover:text-red-700"
            onClick={() => handleRemoveWindow(idx)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={handleAddWindow}>
        + Agregar ventana
      </Button>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setEditingWarehouseId(null)}>Cancelar</Button>
      <Button onClick={handleSaveWindows}>Guardar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Asegurarse de que `X` está en los imports de `lucide-react` (ya existe en el archivo).

- [ ] **Step 6: Verificar compilación**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -20
```

Esperado: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat(admin): add Almacenes tab with delivery windows editor (F-91)"
```

---

## Self-Review del Plan

**Cobertura del spec:**
- ✅ F-85: Task 4 — fix crash, tipo real, botón avance estado
- ✅ F-82: Task 5 — dialog muelle/ventana/confirmado, columnas nuevas, montaje en page
- ✅ F-86: Task 6 — columna modalidad badge, filtro Select, join via carrierId
- ✅ F-91: Task 7 — tab Almacenes, dialog edición ventanas, acción store
- ✅ Tipos: Task 1 — todos los tipos del spec cubiertos
- ✅ Seed: Task 2 — 6 SapRoute, 4 carriers con modalityType, 4 tiendas con deliveryWindows

**Consistencia de tipos:**
- `buildAppointmentColumns` cambia de `(onAction: ActionHandler)` a `({ onAction, onAssignAppointment }, asnRecords)`. Cualquier caller en `page.tsx` debe actualizarse (cubierto en Task 5 Step 5).
- `buildSapRouteColumns` cambia de `()` a `({ onStatusChange, warehouseName })`. Cubierto en Task 4 Step 2.

**Sin placeholders:** Todos los steps tienen código completo.
