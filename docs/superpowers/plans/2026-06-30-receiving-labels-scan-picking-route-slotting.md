# Etiquetado en Recepción · Picking Móvil · Slotting por Ruta — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar 3 funcionalidades independientes: etiquetado ZPL obligatorio en recepción de ASNs, picking guiado por barcode en ruta móvil `/picking/scan/[taskId]`, y recomendaciones de slotting basadas en afinidad de rutas de manifiesto.

**Architecture:** F1 extiende el store action `receiveAsn` para auto-generar `WmsLabel` tipo `receipt` y agrega estado `labels_pending` al FSM de ASN. F2 crea una ruta Next.js nueva mobile-first que orquesta fases de escaneo usando acciones de store existentes. F3 agrega un selector puro `selectRouteSlottingRecommendations` y un tab nuevo en `/slotting`, sin tocar la lógica existente.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript 5 · Zustand 5 · TailwindCSS 4 · shadcn/Radix UI · Vitest

## Global Constraints

- Todos los textos visibles al usuario en español (es-CO)
- Arrow functions para todos los componentes y hooks: `const MyComponent = () => {}`
- Clause guards antes del happy path en todo componente
- `cn()` de `@/lib/utils` para clases condicionales — nunca template literals
- Tipos de dominio importados de `src/types/wms.ts` — nunca redefinir inline
- `default export` solo en page components de Next.js
- Columnas de tablas en archivo separado `columns.tsx` de la ruta correspondiente
- Dialogs domain-specific en `[route]/_components/`, no inline en page

---

## Mapa de archivos

### F1 — Etiquetado en recepción
| Archivo | Acción | Responsabilidad |
|---------|--------|----------------|
| `src/types/wms.ts` | Modificar | Agregar `'receipt'` a `WmsLabel.type`; campos opcionales `asnId`, `lot`, `expirationDate`, `receivedQty`, `poNumber` en `WmsLabel`; agregar `'labels_pending'` y `'putaway_ready'` a `OperationalStatus` |
| `src/lib/state-machines.ts` | Modificar | Agregar `labels_pending` y `putaway_ready` al FSM `asnTransitions` |
| `src/lib/rules/zpl.ts` | Modificar | Agregar `'receipt'` a `ZplLabelType`; actualizar `TYPE_ES`; agregar lógica de líneas extra de lot/PO/fecha |
| `src/store/wms-store.ts` | Modificar | `receiveAsn`: generar labels automáticamente; nueva acción `printReceiptLabel(labelId)` |
| `src/app/(app)/receiving/_columns/columns-receiving.tsx` | Modificar | Agregar columna "Etiquetas" con badge N/N impresas |
| `src/app/(app)/receiving/_components/reception-sheet.tsx` | Modificar | Botón "Imprimir etiqueta" por línea recibida |
| `src/app/(app)/receiving/_components/receipt-label-dialog.tsx` | Crear | Wrapper de `ZplPreviewDialog` para etiquetas de recepción |
| `src/app/(app)/receiving/page.tsx` | Modificar | Clause guard en tab Putaway para `labels_pending` |
| `src/data/seed.ts` | Modificar | Labels tipo `receipt` para ASNs completados |

### F2 — Picking móvil por barcode
| Archivo | Acción | Responsabilidad |
|---------|--------|----------------|
| `src/types/wms.ts` | Modificar | Agregar `barcode: string` a `StorageLocation` |
| `src/app/(app)/picking/scan/[taskId]/page.tsx` | Crear | Page mobile-first, orquesta fases de scan |
| `src/app/(app)/picking/scan/[taskId]/_components/scan-step.tsx` | Crear | Input autoFocus + feedback overlay para scan bluetooth |
| `src/app/(app)/picking/scan/[taskId]/_components/scan-feedback.tsx` | Crear | Overlay fullscreen verde/rojo 800ms |
| `src/app/(app)/picking/scan/[taskId]/_components/quantity-step.tsx` | Crear | Input numérico grande + confirmación |
| `src/app/(app)/picking/columns.tsx` | Modificar | Acción "Escanear" en columna de acciones para tareas assigned/in_progress |
| `src/data/seed.ts` | Modificar | Agregar `barcode` a todas las `StorageLocation` |

### F3 — Slotting por ruta
| Archivo | Acción | Responsabilidad |
|---------|--------|----------------|
| `src/types/wms.ts` | Modificar | Agregar `routeCode?: string` a `StorageLocation`; nueva interface `RouteSlottingRecommendation` |
| `src/store/selectors.ts` | Modificar | Nueva función `selectRouteSlottingRecommendations` |
| `src/app/(app)/slotting/page.tsx` | Modificar | Agregar tab `'rutas'` al `TabValue` y su panel |
| `src/app/(app)/slotting/_columns/columns-route-slotting.tsx` | Crear | Columnas para tabla de recomendaciones por ruta |
| `src/data/seed.ts` | Modificar | Agregar `routeCode` a ubicaciones de staging; agregar `routeCode` a `LoadManifest` |

---

## F1 — Etiquetado obligatorio en recepción

### Task 1: Extender tipos — WmsLabel, OperationalStatus, ZplLabelType

**Files:**
- Modify: `src/types/wms.ts`
- Modify: `src/lib/rules/zpl.ts`
- Test: (verificación de TypeScript — no test unitario requerido para tipos puros)

**Interfaces:**
- Produces: `WmsLabel` con campos opcionales `asnId?`, `lot?`, `expirationDate?`, `receivedQty?`, `poNumber?`; `OperationalStatus` incluye `'labels_pending'` y `'putaway_ready'`; `ZplLabelType` incluye `'receipt'`

- [ ] **Step 1: Agregar `'labels_pending'` y `'putaway_ready'` a `OperationalStatus`**

En `src/types/wms.ts`, línea ~6, dentro del union `OperationalStatus`:

```ts
export type OperationalStatus =
  | 'draft'
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'partial'
  | 'partial_received'
  | 'completed'
  | 'putaway_done'
  | 'cancelled'
  | 'in_transit'
  | 'on_hold'
  | 'error'
  | 'synced'
  | 'short_received'
  | 'labels_pending'
  | 'putaway_ready'
```

- [ ] **Step 2: Agregar `'receipt'` a `WmsLabel.type` y campos opcionales**

En `src/types/wms.ts`, interface `WmsLabel` (~línea 532):

```ts
export interface WmsLabel {
  id: string
  code: string
  type: 'product' | 'location' | 'box' | 'pallet' | 'shipping' | 'return' | 'receipt'
  reference: string
  status: OperationalStatus
  createdAt: string
  createdBy: string
  // Solo para type === 'receipt'
  asnId?: string
  lot?: string
  expirationDate?: string
  receivedQty?: number
  poNumber?: string
}
```

- [ ] **Step 3: Actualizar `ZplLabelType` y `TYPE_ES` en `src/lib/rules/zpl.ts`**

```ts
export type ZplLabelType = 'product' | 'location' | 'box' | 'pallet' | 'shipping' | 'return' | 'receipt'

const TYPE_ES: Record<ZplLabelType, string> = {
  product: 'PRODUCTO',
  location: 'UBICACIÓN',
  box: 'CAJA',
  pallet: 'PALLET',
  shipping: 'DESPACHO',
  return: 'DEVOLUCIÓN',
  receipt: 'RECEPCIÓN',
}
```

- [ ] **Step 4: Actualizar `TYPE_ES` en `ZplPreviewDialog` para incluir `'receipt'`**

En `src/app/(app)/labels/_components/zpl-preview-dialog.tsx`, el `TYPE_ES` local:

```ts
const TYPE_ES: Record<WmsLabel['type'], string> = {
  product: 'Producto',
  location: 'Ubicación',
  box: 'Caja',
  pallet: 'Pallet',
  shipping: 'Despacho',
  return: 'Devolución',
  receipt: 'Recepción',
}
```

- [ ] **Step 5: Verificar que TypeScript compila sin errores**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores relacionados con `WmsLabel.type` o `OperationalStatus`.

- [ ] **Step 6: Commit**

```bash
git add src/types/wms.ts src/lib/rules/zpl.ts src/app/\(app\)/labels/_components/zpl-preview-dialog.tsx
git commit -m "feat(types): add receipt label type and labels_pending/putaway_ready ASN statuses"
```

---

### Task 2: Actualizar FSM de ASN para estados de etiquetado

**Files:**
- Modify: `src/lib/state-machines.ts`

**Interfaces:**
- Consumes: `OperationalStatus` con `'labels_pending'` y `'putaway_ready'` (Task 1)
- Produces: `asnTransitions` con rutas hacia/desde `labels_pending` y `putaway_ready`

- [ ] **Step 1: Escribir test del FSM**

En `src/lib/__tests__/state-machines.test.ts` (crear si no existe):

```ts
import { describe, it, expect } from 'vitest'
import { canTransition, asnTransitions } from '../state-machines'

describe('asnTransitions — etiquetado', () => {
  it('in_progress puede ir a labels_pending', () => {
    expect(canTransition(asnTransitions, 'in_progress', 'labels_pending')).toBe(true)
  })
  it('partial puede ir a labels_pending', () => {
    expect(canTransition(asnTransitions, 'partial', 'labels_pending')).toBe(true)
  })
  it('labels_pending puede ir a putaway_ready', () => {
    expect(canTransition(asnTransitions, 'labels_pending', 'putaway_ready')).toBe(true)
  })
  it('putaway_ready puede ir a completed', () => {
    expect(canTransition(asnTransitions, 'putaway_ready', 'completed')).toBe(true)
  })
  it('labels_pending NO puede ir directamente a completed', () => {
    expect(canTransition(asnTransitions, 'labels_pending', 'completed')).toBe(false)
  })
})
```

- [ ] **Step 2: Ejecutar test para verificar que falla**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx vitest run src/lib/__tests__/state-machines.test.ts 2>&1 | tail -20
```

Esperado: FAIL — `labels_pending` no existe en `asnTransitions`.

- [ ] **Step 3: Actualizar `asnTransitions` en `src/lib/state-machines.ts`**

```ts
export const asnTransitions: Record<string, OperationalStatus[]> = {
  pending: ['in_progress', 'partial', 'completed', 'cancelled'],
  in_progress: ['partial', 'completed', 'cancelled', 'short_received', 'labels_pending'],
  partial: ['in_progress', 'completed', 'cancelled', 'short_received', 'labels_pending'],
  labels_pending: ['putaway_ready', 'cancelled'],
  putaway_ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  short_received: [],
}
```

- [ ] **Step 4: Ejecutar test para verificar que pasa**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx vitest run src/lib/__tests__/state-machines.test.ts 2>&1 | tail -20
```

Esperado: PASS — 5 tests verde.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state-machines.ts src/lib/__tests__/state-machines.test.ts
git commit -m "feat(fsm): add labels_pending and putaway_ready to ASN transitions"
```

---

### Task 3: Modificar `receiveAsn` y agregar `printReceiptLabel` en store

**Files:**
- Modify: `src/store/wms-store.ts` (líneas ~158-175 para interface; ~679-815 para implementación)

**Interfaces:**
- Consumes: `WmsLabel` con tipo `receipt` (Task 1); `asnTransitions` con `labels_pending` (Task 2)
- Produces: `receiveAsn` genera `WmsLabel[]` tipo `receipt` y avanza ASN a `labels_pending`; nueva acción `printReceiptLabel(labelId: string): WmsLabel`

- [ ] **Step 1: Escribir test de `receiveAsn` con generación de labels**

En `src/store/__tests__/wms-store-receipt-labels.test.ts` (crear):

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { create } from 'zustand'
import { useWmsStore } from '../wms-store'
import * as seed from '@/data/seed'

describe('receiveAsn — generación de labels', () => {
  it('genera WmsLabel tipo receipt al recibir un ASN', () => {
    const store = useWmsStore.getState()
    const asnId = 'asn-4' // status in_progress en seed
    store.receiveAsn(asnId, 1, 'Operador')
    const state = useWmsStore.getState()
    const receiptLabels = state.labels.filter(
      (l) => l.type === 'receipt' && l.asnId === asnId
    )
    expect(receiptLabels.length).toBeGreaterThan(0)
    expect(receiptLabels[0].status).toBe('pending')
  })

  it('avanza ASN a labels_pending después de receiveAsn', () => {
    const store = useWmsStore.getState()
    const asnId = 'asn-4'
    store.receiveAsn(asnId, 1, 'Operador')
    const asn = useWmsStore.getState().asnRecords.find((a) => a.id === asnId)
    expect(asn?.status).toBe('labels_pending')
  })
})

describe('printReceiptLabel', () => {
  it('marca label como printed y avanza ASN a putaway_ready si todas impresas', () => {
    const store = useWmsStore.getState()
    const asnId = 'asn-4'
    store.receiveAsn(asnId, 1, 'Operador')
    const labels = useWmsStore.getState().labels.filter(
      (l) => l.type === 'receipt' && l.asnId === asnId && l.status === 'pending'
    )
    labels.forEach((l) => store.printReceiptLabel(l.id))
    const asn = useWmsStore.getState().asnRecords.find((a) => a.id === asnId)
    expect(asn?.status).toBe('putaway_ready')
  })
})
```

- [ ] **Step 2: Ejecutar test para verificar que falla**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx vitest run src/store/__tests__/wms-store-receipt-labels.test.ts 2>&1 | tail -20
```

Esperado: FAIL — `printReceiptLabel` no existe; `receiveAsn` no genera labels.

- [ ] **Step 3: Agregar `printReceiptLabel` a la interface del store**

En `src/store/wms-store.ts`, después de la línea que declara `receiveAsn` (~línea 158):

```ts
printReceiptLabel: (labelId: string) => WmsLabel
```

- [ ] **Step 4: Modificar `receiveAsn` para generar labels automáticamente**

En `src/store/wms-store.ts`, al final de `receiveAsn`, antes del `set({...})` final, agregar la generación de labels. Reemplazar el bloque `set({...})` final de `receiveAsn` con:

```ts
    // Generar receipt labels
    const receiptLabels: WmsLabel[] = []
    const labelSeq = state.labels.length
    if (requiresSerial && serials && serials.length > 0) {
      serials.map((s) => s.trim()).forEach((serial, i) => {
        const seq = labelSeq + i + 1
        receiptLabels.push({
          id: `lb-rcpt-${asnId}-${serial.replace(/\s/g, '_')}`,
          code: `LBL-RCP-${String(seq).padStart(4, '0')}`,
          type: 'receipt',
          reference: asnId,
          status: 'pending',
          createdAt: new Date().toISOString(),
          createdBy: operatorName,
          asnId,
          lot: undefined,
          receivedQty: 1,
          poNumber: asn.purchaseOrderId,
        })
      })
    } else {
      const seq = labelSeq + 1
      receiptLabels.push({
        id: `lb-rcpt-${asnId}-${Date.now()}`,
        code: `LBL-RCP-${String(seq).padStart(4, '0')}`,
        type: 'receipt',
        reference: asnId,
        status: 'pending',
        createdAt: new Date().toISOString(),
        createdBy: operatorName,
        asnId,
        receivedQty: goodQty,
        poNumber: asn.purchaseOrderId,
      })
    }

    // ASN avanza a labels_pending (no directamente a partial/completed)
    const updatedAsnWithLabels: Asn = { ...updatedAsn, status: 'labels_pending' }

    set({
      asnRecords: state.asnRecords.map((a) => (a.id === asnId ? updatedAsnWithLabels : a)),
      inventoryItems: updatedItems,
      stockMovements: [...state.stockMovements, ...movements],
      labels: [...state.labels, ...receiptLabels],
    })
    return updatedAsnWithLabels
```

**Nota:** eliminar el `set({...})` original de `receiveAsn` que no incluye labels.

- [ ] **Step 5: Agregar acción `printReceiptLabel` al store**

Después de `receiveAsn`, agregar:

```ts
  printReceiptLabel: (labelId) => {
    const state = get()
    const label = state.labels.find((l) => l.id === labelId)
    if (!label) throw new Error('Label no encontrada')
    if (label.type !== 'receipt') throw new Error('Solo se pueden imprimir receipt labels aquí')

    const updated: WmsLabel = { ...label, status: 'completed' }
    const updatedLabels = state.labels.map((l) => (l.id === labelId ? updated : l))

    // Verificar si todas las receipt labels del ASN están impresas
    const asnId = label.asnId
    if (asnId) {
      const asnLabels = updatedLabels.filter(
        (l) => l.type === 'receipt' && l.asnId === asnId
      )
      const allPrinted = asnLabels.every((l) => l.status === 'completed')
      if (allPrinted) {
        const asn = state.asnRecords.find((a) => a.id === asnId)
        if (asn && asn.status === 'labels_pending') {
          const updatedAsn: Asn = { ...asn, status: 'putaway_ready' }
          set({
            labels: updatedLabels,
            asnRecords: state.asnRecords.map((a) => (a.id === asnId ? updatedAsn : a)),
          })
          return updated
        }
      }
    }

    set({ labels: updatedLabels })
    return updated
  },
```

- [ ] **Step 6: Ejecutar tests para verificar que pasan**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx vitest run src/store/__tests__/wms-store-receipt-labels.test.ts 2>&1 | tail -20
```

Esperado: PASS — 3 tests verde.

- [ ] **Step 7: Verificar TypeScript**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores nuevos.

- [ ] **Step 8: Commit**

```bash
git add src/store/wms-store.ts src/store/__tests__/wms-store-receipt-labels.test.ts
git commit -m "feat(store): receiveAsn auto-generates receipt labels, add printReceiptLabel action"
```

---

### Task 4: UI — columna etiquetas en tab "Recibiendo" y botón en ReceptionSheet

**Files:**
- Modify: `src/app/(app)/receiving/_columns/columns-receiving.tsx`
- Modify: `src/app/(app)/receiving/_components/reception-sheet.tsx`
- Create: `src/app/(app)/receiving/_components/receipt-label-dialog.tsx`
- Modify: `src/app/(app)/receiving/page.tsx`

**Interfaces:**
- Consumes: `printReceiptLabel(labelId)` del store (Task 3); `ZplPreviewDialog` de `/labels/_components/`
- Produces: columna "Etiquetas" visible en tabla de ASNs recibiendo; botón "Imprimir" en sheet; banner bloqueo en tab putaway

- [ ] **Step 1: Crear `ReceiptLabelDialog`**

Crear `src/app/(app)/receiving/_components/receipt-label-dialog.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWmsStore } from '@/store/wms-store'
import type { WmsLabel } from '@/types/wms'

// Importación dinámica para no depender de la ruta /labels
import dynamic from 'next/dynamic'
const ZplPreviewDialog = dynamic(
  () =>
    import('@/app/(app)/labels/_components/zpl-preview-dialog').then(
      (m) => m.ZplPreviewDialog
    ),
  { ssr: false }
)

interface Props {
  label: WmsLabel
}

export const ReceiptLabelButton = ({ label }: Props) => {
  const [open, setOpen] = useState(false)
  const { printReceiptLabel } = useWmsStore()

  const handleClose = () => {
    setOpen(false)
    if (label.status === 'pending') {
      printReceiptLabel(label.id)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant={label.status === 'completed' ? 'outline' : 'default'}
        onClick={() => setOpen(true)}
        className="h-7 gap-1 text-xs"
      >
        <Printer className="size-3" />
        {label.status === 'completed' ? 'Reimprimir' : 'Imprimir'}
      </Button>
      <ZplPreviewDialog label={label} open={open} onClose={handleClose} />
    </>
  )
}
```

- [ ] **Step 2: Agregar columna "Etiquetas" en `columns-receiving.tsx`**

En `src/app/(app)/receiving/_columns/columns-receiving.tsx`, en el array de columnas, agregar antes de la columna de acciones:

```tsx
{
  id: 'etiquetas',
  header: 'Etiquetas',
  cell: ({ row }) => {
    const asnId = row.original.id
    // Esta columna recibe labels como prop desde la página
    const labels = row.original.receiptLabels ?? []
    const printed = labels.filter((l: WmsLabel) => l.status === 'completed').length
    const total = labels.length
    if (total === 0) return <span className="text-muted-foreground text-xs">—</span>
    return (
      <span className={cn(
        'text-xs font-medium',
        printed < total ? 'text-red-600' : 'text-emerald-600'
      )}>
        {printed}/{total} impresas
      </span>
    )
  },
},
```

**Nota:** La fila del ASN necesita `receiptLabels` — ver Step 3.

- [ ] **Step 3: Inyectar `receiptLabels` en las filas de la tabla de recibiendo**

En `src/app/(app)/receiving/page.tsx`, donde se construyen las filas del tab "Recibiendo", enriquecer cada fila con sus labels:

```tsx
// Dentro del useMemo que construye receivingRows o AsnRow[]
const receivingRows = useMemo(() =>
  asnRecords
    .filter((a) => ['in_progress', 'partial', 'labels_pending', 'putaway_ready'].includes(a.status))
    .map((a) => ({
      ...a,
      receiptLabels: labels.filter((l) => l.type === 'receipt' && l.asnId === a.id),
    })),
  [asnRecords, labels]
)
```

- [ ] **Step 4: Agregar banner de bloqueo en tab Putaway**

En `src/app/(app)/receiving/page.tsx`, en el panel del tab "Putaway staging" (tab `putaway`), agregar clause guard al principio del panel:

```tsx
{activeTab === 'putaway' && (
  <>
    {asnRecords.some((a) => a.status === 'labels_pending') && (
      <div className="mb-4 flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <AlertTriangle className="size-4 shrink-0" />
        <span>
          {asnRecords.filter((a) => a.status === 'labels_pending').length} ASN(s) con etiquetas pendientes de imprimir. El putaway está bloqueado hasta imprimir todas las etiquetas.
        </span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto shrink-0"
          onClick={() => router.push('?tab=recibiendo')}
        >
          Ir a imprimir
        </Button>
      </div>
    )}
    {/* tabla putaway existente */}
  </>
)}
```

- [ ] **Step 5: Verificar TypeScript y build**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/receiving/
git commit -m "feat(receiving): add receipt label column, print button, and putaway blocking banner"
```

---

### Task 5: Seed data — receipt labels para ASNs completados

**Files:**
- Modify: `src/data/seed.ts`

**Interfaces:**
- Consumes: `WmsLabel` con tipo `receipt` (Task 1); ASNs existentes `asn-1` (completed), `asn-2` (partial)

- [ ] **Step 1: Agregar receipt labels al array `labels` en `seed.ts`**

Al final del array `labels` en `src/data/seed.ts`, antes del `]` de cierre:

```ts
  // Receipt labels — F1: etiquetado en recepción
  {
    id: 'lb-rcpt-asn1-1',
    code: 'LBL-RCP-0004',
    type: 'receipt' as const,
    reference: 'asn-1',
    status: 'completed',
    createdAt: '2026-06-20T09:00:00.000Z',
    createdBy: 'Carlos Ríos',
    asnId: 'asn-1',
    receivedQty: 9,
    poNumber: 'po-1',
  },
  {
    id: 'lb-rcpt-asn2-1',
    code: 'LBL-RCP-0005',
    type: 'receipt' as const,
    reference: 'asn-2',
    status: 'pending',
    createdAt: '2026-06-22T10:30:00.000Z',
    createdBy: 'Ana Ruiz',
    asnId: 'asn-2',
    receivedQty: 6,
    poNumber: 'po-2',
  },
```

- [ ] **Step 2: Actualizar `asn-2` a status `labels_pending`**

`asn-2` tiene `status: 'partial'` pero tiene una receipt label `pending`. Actualizar:

```ts
  {
    id: 'asn-2',
    // ...
    status: 'labels_pending',  // era 'partial'
    // resto igual
  },
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/data/seed.ts
git commit -m "feat(seed): add receipt labels for completed ASNs, set asn-2 to labels_pending"
```

---

## F2 — Picking móvil BYOD por barcode

### Task 6: Agregar `barcode` a `StorageLocation` y seed data

**Files:**
- Modify: `src/types/wms.ts`
- Modify: `src/data/seed.ts`

**Interfaces:**
- Produces: `StorageLocation.barcode: string` disponible para validación en fases de scan

- [ ] **Step 1: Agregar `barcode` a `StorageLocation` en `src/types/wms.ts`**

En la interface `StorageLocation` (buscar `isPickFace`), agregar campo:

```ts
  barcode: string  // ej. "LOC-A-A-01-01" — escaneado por lector bluetooth en picking
```

- [ ] **Step 2: Agregar `barcode` a cada ubicación en `src/data/seed.ts`**

En el array `locations`, agregar `barcode` a cada entrada. Formato: `LOC-{zone}-{id}`:

```ts
{ id: 'loc-a0101', barcode: 'LOC-A-A0101', /* resto igual */ },
{ id: 'loc-a0102', barcode: 'LOC-A-A0102', /* resto igual */ },
{ id: 'loc-pickfast1', barcode: 'LOC-A-PICKFAST1', /* resto igual */ },
{ id: 'loc-pickfast2', barcode: 'LOC-A-PICKFAST2', /* resto igual */ },
{ id: 'loc-b0204', barcode: 'LOC-B-B0204', /* resto igual */ },
{ id: 'loc-reserve', barcode: 'LOC-R-RESERVE', /* resto igual */ },
{ id: 'loc-qc', barcode: 'LOC-QC-QC01', /* resto igual */ },
{ id: 'loc-stageout', barcode: 'LOC-S-STAGEOUT', /* resto igual */ },
{ id: 'loc-returns', barcode: 'LOC-RT-RETURNS', /* resto igual */ },
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -20
```

Esperado: errores en seed.ts si falta `barcode` en alguna ubicación — corregir.

- [ ] **Step 4: Commit**

```bash
git add src/types/wms.ts src/data/seed.ts
git commit -m "feat(types): add barcode field to StorageLocation, populate seed data"
```

---

### Task 7: Componentes base — `ScanFeedback` y `ScanStep`

**Files:**
- Create: `src/app/(app)/picking/scan/[taskId]/_components/scan-feedback.tsx`
- Create: `src/app/(app)/picking/scan/[taskId]/_components/scan-step.tsx`

**Interfaces:**
- Produces:
  - `ScanFeedback`: `({ show, success }: { show: boolean; success: boolean }) => JSX.Element` — overlay fullscreen 800ms
  - `ScanStep`: `({ title, hint, expectedCode, onMatch, onError }: ScanStepProps) => JSX.Element`

- [ ] **Step 1: Crear `ScanFeedback`**

```tsx
// src/app/(app)/picking/scan/[taskId]/_components/scan-feedback.tsx
'use client'

import { cn } from '@/lib/utils'

interface Props {
  show: boolean
  success: boolean
}

export const ScanFeedback = ({ show, success }: Props) => {
  if (!show) return null
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        success ? 'bg-emerald-500/90' : 'bg-red-500/90'
      )}
    >
      <span className="text-6xl text-white">{success ? '✓' : '✗'}</span>
    </div>
  )
}
```

- [ ] **Step 2: Crear `ScanStep`**

```tsx
// src/app/(app)/picking/scan/[taskId]/_components/scan-step.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { ScanFeedback } from './scan-feedback'

interface Props {
  title: string
  hint: string
  expectedCode: string
  onMatch: () => void
  onError?: (scanned: string) => void
  children?: React.ReactNode
}

export const ScanStep = ({ title, hint, expectedCode, onMatch, onError, children }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [buffer, setBuffer] = useState('')
  const [feedback, setFeedback] = useState<{ show: boolean; success: boolean }>({
    show: false,
    success: false,
  })

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleScan = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    const success = trimmed === expectedCode
    setFeedback({ show: true, success })
    setTimeout(() => {
      setFeedback({ show: false, success: false })
      if (success) onMatch()
      else onError?.(trimmed)
    }, 800)
    setBuffer('')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <ScanFeedback show={feedback.show} success={feedback.success} />
      <p className="text-muted-foreground text-sm uppercase tracking-widest">{title}</p>
      {children}
      <p className="text-center text-sm text-gray-500">{hint}</p>
      <input
        ref={inputRef}
        value={buffer}
        onChange={(e) => setBuffer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleScan(buffer)
        }}
        // inputMode="none" oculta teclado en móvil — el lector bluetooth envía Enter
        inputMode="none"
        className="sr-only"
        aria-label="Escanear código"
      />
      <p className="text-muted-foreground text-xs">Escanea el código o escribe y presiona Enter</p>
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "scan" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/picking/scan/
git commit -m "feat(picking): add ScanFeedback and ScanStep base components for mobile scan flow"
```

---

### Task 8: Componente `QuantityStep`

**Files:**
- Create: `src/app/(app)/picking/scan/[taskId]/_components/quantity-step.tsx`

**Interfaces:**
- Produces: `QuantityStep({ requestedQty, onConfirm }: { requestedQty: number; onConfirm: (qty: number) => void }) => JSX.Element`

- [ ] **Step 1: Crear `QuantityStep`**

```tsx
// src/app/(app)/picking/scan/[taskId]/_components/quantity-step.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  requestedQty: number
  onConfirm: (qty: number) => void
}

export const QuantityStep = ({ requestedQty, onConfirm }: Props) => {
  const [value, setValue] = useState(String(requestedQty))
  const parsed = parseInt(value, 10)
  const isPartial = !isNaN(parsed) && parsed > 0 && parsed < requestedQty
  const isValid = !isNaN(parsed) && parsed > 0 && parsed <= requestedQty

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <p className="text-muted-foreground text-sm uppercase tracking-widest">Cantidad</p>
      <p className="text-5xl font-bold">{requestedQty}</p>
      <p className="text-sm text-gray-500">unidades solicitadas</p>
      <Input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-32 text-center text-2xl"
        min={1}
        max={requestedQty}
      />
      {isPartial && (
        <p className="text-sm text-amber-600">
          Pick parcial: {parsed} de {requestedQty} unidades
        </p>
      )}
      <Button
        size="lg"
        className="w-full max-w-xs"
        disabled={!isValid}
        onClick={() => onConfirm(parsed)}
      >
        Confirmar
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/picking/scan/\[taskId\]/_components/quantity-step.tsx
git commit -m "feat(picking): add QuantityStep component for mobile scan picking"
```

---

### Task 9: Page `/picking/scan/[taskId]`

**Files:**
- Create: `src/app/(app)/picking/scan/[taskId]/page.tsx`

**Interfaces:**
- Consumes: `ScanStep` (Task 7), `QuantityStep` (Task 8); store actions `startPicking`, `completePick`, `approvePart`; `StorageLocation.barcode` (Task 6); `Product.barcode`
- Produces: ruta funcional `/picking/scan/[taskId]`

- [ ] **Step 1: Crear page component**

```tsx
// src/app/(app)/picking/scan/[taskId]/page.tsx
'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { Button } from '@/components/ui/button'
import { ScanStep } from './_components/scan-step'
import { QuantityStep } from './_components/quantity-step'

type ScanPhase = 'location' | 'product' | 'quantity' | 'done'

export default function ScanPickingPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const router = useRouter()
  const { pickingTasks, locations, products, startPicking, completePick, approvePart } =
    useWmsStore()

  const task = pickingTasks.find((t) => t.id === taskId)
  const location = locations.find((l) => l.id === task?.locationId)
  const product = products.find((p) => p.id === task?.productId)

  const [phase, setPhase] = useState<ScanPhase>('location')
  const [scanError, setScanError] = useState<string | null>(null)

  if (!task) return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <p className="text-muted-foreground">Tarea no encontrada.</p>
    </div>
  )
  if (!location || !product) return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <p className="text-muted-foreground">Datos de tarea incompletos.</p>
    </div>
  )

  const handleLocationMatch = () => {
    if (task.status === 'assigned') startPicking(task.id, 'Operador')
    setScanError(null)
    setPhase('product')
  }

  const handleProductMatch = () => {
    setScanError(null)
    setPhase('quantity')
  }

  const handleQuantityConfirm = (qty: number) => {
    completePick(task.id, qty)
    if (qty < task.requestedQuantity) approvePart(task.id)
    setPhase('done')
  }

  if (phase === 'done') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
        <CheckCircle2 className="size-16 text-emerald-500" />
        <p className="text-2xl font-semibold">¡Pick completado!</p>
        <p className="text-muted-foreground text-sm">Tarea {task.code}</p>
        <Button className="w-full max-w-xs" onClick={() => router.push('/picking')}>
          Volver a picking
        </Button>
      </div>
    )
  }

  if (phase === 'location') {
    return (
      <ScanStep
        title="Paso 1 de 3 — Ubicación"
        hint={`Escanea el barcode de la ubicación ${location.code}`}
        expectedCode={location.barcode}
        onMatch={handleLocationMatch}
        onError={(s) => setScanError(`Código incorrecto: ${s}`)}
      >
        <div className="text-center">
          <p className="text-4xl font-bold">{location.zone}</p>
          <p className="text-2xl font-mono">{location.code}</p>
          {scanError && <p className="mt-2 text-sm text-red-500">{scanError}</p>}
        </div>
      </ScanStep>
    )
  }

  if (phase === 'product') {
    return (
      <ScanStep
        title="Paso 2 de 3 — Producto"
        hint={`Escanea el barcode del producto`}
        expectedCode={product.barcode}
        onMatch={handleProductMatch}
        onError={(s) => setScanError(`Código incorrecto: ${s}`)}
      >
        <div className="text-center">
          {product.imageUrl && (
            <img src={product.imageUrl} alt={product.name} className="mx-auto mb-2 h-24 w-24 rounded object-cover" />
          )}
          <p className="font-mono text-sm text-gray-500">{product.sku}</p>
          <p className="text-xl font-semibold">{product.name}</p>
          {scanError && <p className="mt-2 text-sm text-red-500">{scanError}</p>}
        </div>
      </ScanStep>
    )
  }

  return (
    <QuantityStep
      requestedQty={task.requestedQuantity}
      onConfirm={handleQuantityConfirm}
    />
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "scan" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/picking/scan/
git commit -m "feat(picking): add mobile scan picking page /picking/scan/[taskId]"
```

---

### Task 10: Agregar acción "Escanear" en columna de picking

**Files:**
- Modify: `src/app/(app)/picking/columns.tsx`

**Interfaces:**
- Consumes: ruta `/picking/scan/[taskId]` (Task 9)

- [ ] **Step 1: Agregar acción "Escanear" en columna de acciones de tareas**

En `src/app/(app)/picking/columns.tsx`, en las columnas del tab de tareas, agregar en el cell de acciones:

```tsx
import { Scan } from 'lucide-react'
import Link from 'next/link'

// Dentro de la columna de acciones, agregar:
{['assigned', 'in_progress'].includes(row.original.status) && (
  <Button asChild size="sm" variant="outline" className="h-7 gap-1 text-xs">
    <Link href={`/picking/scan/${row.original.id}`}>
      <Scan className="size-3" />
      Escanear
    </Link>
  </Button>
)}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/picking/columns.tsx
git commit -m "feat(picking): add Escanear action button linking to mobile scan route"
```

---

## F3 — Slotting por ruta de manifiesto

### Task 11: Extender tipos — `StorageLocation.routeCode` y `RouteSlottingRecommendation`

**Files:**
- Modify: `src/types/wms.ts`

**Interfaces:**
- Produces: `StorageLocation.routeCode?: string`; nueva interface `RouteSlottingRecommendation`

- [ ] **Step 1: Agregar `routeCode` a `StorageLocation`**

En la interface `StorageLocation`, después de `barcode`:

```ts
  routeCode?: string  // staging zone de una ruta SAP, ej. "sap-rt-001"
```

- [ ] **Step 2: Agregar interface `RouteSlottingRecommendation`**

Después de `SlottingRecommendation` (~línea donde está definida):

```ts
export interface RouteSlottingRecommendation {
  productId: string
  routeCode: string
  routeLabel: string
  currentLocationId: string
  candidateLocationId: string
  routePickFrequency: number   // 0-1: ratio picks en esta ruta / total picks
  currentDistanceToStagingM: number
  candidateDistanceToStagingM: number
  distanceGainM: number
  totalDistanceSavedM: number  // distanceGainM × pickingFrequency del producto
  score: number                // 0-100
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/types/wms.ts
git commit -m "feat(types): add StorageLocation.routeCode and RouteSlottingRecommendation interface"
```

---

### Task 12: Selector `selectRouteSlottingRecommendations`

**Files:**
- Modify: `src/store/selectors.ts`

**Interfaces:**
- Consumes: `WmsState` con `loadManifests`, `pickingTasks`, `inventoryItems`, `locations`, `demandStats`; `RouteSlottingRecommendation` (Task 11)
- Produces: `selectRouteSlottingRecommendations(state: WmsState): RouteSlottingRecommendation[]`

- [ ] **Step 1: Escribir test del selector**

Crear `src/store/__tests__/selectors-route-slotting.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { selectRouteSlottingRecommendations } from '../selectors'
import * as seed from '@/data/seed'

const mockState = {
  ...seed,
  asnRecords: seed.asnRecords,
  // seed tiene loadManifests con sapRouteId 'sap-rt-001' y 'sap-rt-002'
}

describe('selectRouteSlottingRecommendations', () => {
  it('devuelve array (puede ser vacío con seed actual)', () => {
    const recs = selectRouteSlottingRecommendations(mockState as any)
    expect(Array.isArray(recs)).toBe(true)
  })

  it('cada recomendación tiene los campos requeridos', () => {
    const recs = selectRouteSlottingRecommendations(mockState as any)
    for (const rec of recs) {
      expect(rec).toHaveProperty('productId')
      expect(rec).toHaveProperty('routeCode')
      expect(rec).toHaveProperty('distanceGainM')
      expect(rec.score).toBeGreaterThanOrEqual(0)
      expect(rec.score).toBeLessThanOrEqual(100)
    }
  })

  it('no incluye productos sin ruta predominante (< 40%)', () => {
    const recs = selectRouteSlottingRecommendations(mockState as any)
    for (const rec of recs) {
      expect(rec.routePickFrequency).toBeGreaterThanOrEqual(0.4)
    }
  })
})
```

- [ ] **Step 2: Ejecutar test para verificar que falla**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx vitest run src/store/__tests__/selectors-route-slotting.test.ts 2>&1 | tail -20
```

Esperado: FAIL — `selectRouteSlottingRecommendations` no existe.

- [ ] **Step 3: Implementar selector en `src/store/selectors.ts`**

Al final del archivo, agregar:

```ts
export function selectRouteSlottingRecommendations(
  state: WmsState
): RouteSlottingRecommendation[] {
  const recs: RouteSlottingRecommendation[] = []

  // Índice: pickingTaskId → routeCode (via manifests)
  const taskRouteMap = new Map<string, string>()
  for (const manifest of state.loadManifests) {
    if (!manifest.sapRouteId) continue
    for (const orderId of manifest.orderIds) {
      for (const task of state.pickingTasks.filter((t) => t.orderId === orderId)) {
        taskRouteMap.set(task.id, manifest.sapRouteId)
      }
    }
  }

  // Agrupar picks por producto → ruta
  const productRouteCounts = new Map<string, Map<string, number>>()
  for (const task of state.pickingTasks) {
    if (task.status !== 'completed') continue
    const routeCode = taskRouteMap.get(task.id)
    if (!routeCode) continue
    if (!productRouteCounts.has(task.productId)) {
      productRouteCounts.set(task.productId, new Map())
    }
    const routeMap = productRouteCounts.get(task.productId)!
    routeMap.set(routeCode, (routeMap.get(routeCode) ?? 0) + 1)
  }

  for (const [productId, routeMap] of productRouteCounts.entries()) {
    const totalPicks = Array.from(routeMap.values()).reduce((a, b) => a + b, 0)
    if (totalPicks === 0) continue

    // Encontrar ruta predominante
    let dominantRoute = ''
    let dominantCount = 0
    for (const [routeCode, count] of routeMap.entries()) {
      if (count > dominantCount) {
        dominantRoute = routeCode
        dominantCount = count
      }
    }
    const frequency = dominantCount / totalPicks
    if (frequency < 0.4) continue // sin ruta clara

    // Ubicación actual del producto
    const item = state.inventoryItems.find(
      (i) => i.productId === productId && i.status === 'available'
    )
    if (!item) continue
    const currentLoc = state.locations.find((l) => l.id === item.locationId)
    if (!currentLoc) continue

    // Ubicaciones de staging de la ruta predominante
    const stagingLocs = state.locations.filter((l) => l.routeCode === dominantRoute)
    if (stagingLocs.length === 0) continue
    const avgStagingDist =
      stagingLocs.reduce((sum, l) => sum + l.distanceToDispatchM, 0) / stagingLocs.length

    // Buscar mejor candidato: pick face sin routeCode más cercano al staging
    const demand = state.demandStats.find((d) => d.productId === productId)
    const product = state.products.find((p) => p.id === productId)
    if (!product || !demand) continue

    const candidates = state.locations.filter(
      (l) => l.isPickFace && !l.isBlocked && !l.routeCode && l.id !== currentLoc.id
    )

    let best: { loc: (typeof candidates)[number]; distM: number } | null = null
    for (const candidate of candidates) {
      if (product.unitWeightKg > candidate.maxWeightKg) continue
      const distToStaging = Math.abs(candidate.distanceToDispatchM - avgStagingDist)
      if (!best || distToStaging < best.distM) {
        best = { loc: candidate, distM: distToStaging }
      }
    }
    if (!best) continue

    const currentDistToStaging = Math.abs(currentLoc.distanceToDispatchM - avgStagingDist)
    const distanceGainM = currentDistToStaging - best.distM
    if (distanceGainM <= 10) continue // ruido mínimo

    const score = Math.min(100, Math.round(frequency * 50 + (distanceGainM / 100) * 50))

    recs.push({
      productId,
      routeCode: dominantRoute,
      routeLabel: `Ruta ${dominantRoute}`,
      currentLocationId: currentLoc.id,
      candidateLocationId: best.loc.id,
      routePickFrequency: frequency,
      currentDistanceToStagingM: currentDistToStaging,
      candidateDistanceToStagingM: best.distM,
      distanceGainM,
      totalDistanceSavedM: distanceGainM * demand.pickingFrequency,
      score,
    })
  }

  return recs.sort((a, b) => b.totalDistanceSavedM - a.totalDistanceSavedM)
}
```

También agregar el import de `RouteSlottingRecommendation` al top del archivo.

- [ ] **Step 4: Ejecutar tests**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx vitest run src/store/__tests__/selectors-route-slotting.test.ts 2>&1 | tail -20
```

Esperado: PASS — 3 tests verde.

- [ ] **Step 5: Commit**

```bash
git add src/store/selectors.ts src/store/__tests__/selectors-route-slotting.test.ts
git commit -m "feat(selectors): add selectRouteSlottingRecommendations for route-affinity slotting"
```

---

### Task 13: Seed data — `routeCode` en ubicaciones de staging y manifests

**Files:**
- Modify: `src/data/seed.ts`

**Interfaces:**
- Consumes: `StorageLocation.routeCode` (Task 11)

- [ ] **Step 1: Agregar `routeCode` a `loc-stageout` en seed**

`loc-stageout` es la ubicación de staging principal. Asignarla a `sap-rt-001`:

```ts
{
  id: 'loc-stageout',
  barcode: 'LOC-S-STAGEOUT',
  routeCode: 'sap-rt-001',  // staging de ruta norte
  // resto igual
},
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Ejecutar selector test para verificar que produce recomendaciones con seed actualizado**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx vitest run src/store/__tests__/selectors-route-slotting.test.ts 2>&1 | tail -20
```

Esperado: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/data/seed.ts
git commit -m "feat(seed): add routeCode to staging location for route slotting"
```

---

### Task 14: Columnas y tab "Por ruta" en `/slotting`

**Files:**
- Create: `src/app/(app)/slotting/_columns/columns-route-slotting.tsx`
- Modify: `src/app/(app)/slotting/page.tsx`

**Interfaces:**
- Consumes: `selectRouteSlottingRecommendations` (Task 12); `relocateInventory` del store; `RouteSlottingRecommendation` (Task 11)

- [ ] **Step 1: Crear `columns-route-slotting.tsx`**

```tsx
// src/app/(app)/slotting/_columns/columns-route-slotting.tsx
'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { RouteSlottingRecommendation } from '@/types/wms'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type RouteSlottingRow = RouteSlottingRecommendation & {
  productName: string
  productSku: string
  currentLocationCode: string
  candidateLocationCode: string
  onRelocate: () => void
}

export const buildRouteSlottingColumns = (): ColumnDef<RouteSlottingRow>[] => [
  {
    accessorKey: 'productName',
    header: 'Producto',
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.productName}</p>
        <p className="text-muted-foreground font-mono text-xs">{row.original.productSku}</p>
      </div>
    ),
  },
  {
    accessorKey: 'routeLabel',
    header: 'Ruta predominante',
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.routeLabel}</p>
        <p className="text-muted-foreground font-mono text-xs">{row.original.routeCode}</p>
      </div>
    ),
  },
  {
    accessorKey: 'routePickFrequency',
    header: '% picks en ruta',
    cell: ({ row }) => (
      <span className="font-mono text-sm">
        {Math.round(row.original.routePickFrequency * 100)}%
      </span>
    ),
  },
  {
    accessorKey: 'currentLocationCode',
    header: 'Ubicación actual',
    cell: ({ row }) => (
      <div>
        <p className="font-mono text-sm">{row.original.currentLocationCode}</p>
        <p className="text-muted-foreground text-xs">
          {Math.round(row.original.currentDistanceToStagingM)} m al staging
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'candidateLocationCode',
    header: 'Ubicación propuesta',
    cell: ({ row }) => (
      <div>
        <p className="font-mono text-sm">{row.original.candidateLocationCode}</p>
        <p className="text-muted-foreground text-xs">
          {Math.round(row.original.candidateDistanceToStagingM)} m al staging
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'totalDistanceSavedM',
    header: 'Ahorro total',
    cell: ({ row }) => (
      <span className="font-mono text-sm text-emerald-600">
        {Math.round(row.original.totalDistanceSavedM)} m
      </span>
    ),
  },
  {
    accessorKey: 'score',
    header: 'Score',
    cell: ({ row }) => (
      <Badge
        variant="secondary"
        className={cn(
          row.original.score >= 70 ? 'bg-emerald-100 text-emerald-700' :
          row.original.score >= 40 ? 'bg-amber-100 text-amber-700' :
          'bg-gray-100 text-gray-600'
        )}
      >
        {row.original.score}
      </Badge>
    ),
  },
  {
    id: 'acciones',
    header: 'Acción',
    cell: ({ row }) => (
      <Button size="sm" variant="outline" onClick={row.original.onRelocate}>
        Reubicar
      </Button>
    ),
  },
]
```

- [ ] **Step 2: Agregar tab `'rutas'` en `src/app/(app)/slotting/page.tsx`**

Localizar `type TabValue` y agregar `'rutas'`:

```ts
type TabValue = 'optimization' | 'classification' | 'replenishment' | 'affinity' | 'history' | 'rutas'
```

En el array de tabs (donde están los `SubNavItem`), agregar:

```ts
{ value: 'rutas', label: 'Por ruta' },
```

Agregar import del nuevo selector y columnas:

```ts
import { selectRouteSlottingRecommendations } from '@/store/selectors'
import { buildRouteSlottingColumns, type RouteSlottingRow } from './_columns/columns-route-slotting'
import { MapPin } from 'lucide-react'
```

En el cuerpo de la página, dentro del `useMemo` donde se calculan los selectors, agregar:

```ts
const routeRecs = selectRouteSlottingRecommendations(state)
```

Agregar el panel del tab al final del bloque de tabs:

```tsx
{activeTab === 'rutas' && (
  <TabPanel
    title="Slotting por Ruta"
    description="Productos con alta afinidad a una ruta de manifiesto — reubicarlos cerca del staging de esa ruta reduce metros de traslado al despacho."
    icon={<MapPin className="size-4" />}
  >
    {routeRecs.length === 0 ? (
      <EmptyState message="No hay suficiente historial de manifiestos para detectar patrones de ruta." />
    ) : (
      <DataTable
        columns={buildRouteSlottingColumns()}
        data={routeRecs.map((rec): RouteSlottingRow => {
          const product = state.products.find((p) => p.id === rec.productId)
          const currentLoc = state.locations.find((l) => l.id === rec.currentLocationId)
          const candidateLoc = state.locations.find((l) => l.id === rec.candidateLocationId)
          const item = state.inventoryItems.find(
            (i) => i.productId === rec.productId && i.status === 'available'
          )
          return {
            ...rec,
            productName: product?.name ?? rec.productId,
            productSku: product?.sku ?? '',
            currentLocationCode: currentLoc?.code ?? rec.currentLocationId,
            candidateLocationCode: candidateLoc?.code ?? rec.candidateLocationId,
            onRelocate: () => {
              if (item) relocateInventory(item.id, rec.candidateLocationId, 'Operador')
            },
          }
        })}
      />
    )}
  </TabPanel>
)}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/slotting/ src/store/selectors.ts
git commit -m "feat(slotting): add Por Ruta tab with route-affinity recommendations"
```

---

## Self-review del plan

**Spec coverage:**
- ✅ F1: WmsLabel tipo receipt, estados labels_pending/putaway_ready, receiveAsn genera labels, printReceiptLabel, columna etiquetas, banner bloqueo, seed data
- ✅ F2: StorageLocation.barcode, /picking/scan/[taskId], ScanStep, ScanFeedback, QuantityStep, acción "Escanear" en columna, seed data
- ✅ F3: StorageLocation.routeCode, RouteSlottingRecommendation, selectRouteSlottingRecommendations, tab "Por ruta", seed data

**Placeholders:** ninguno — todo el código está escrito.

**Consistencia de tipos:**
- `WmsLabel.type` incluye `'receipt'` desde Task 1 — usado en Tasks 3, 4, 5
- `StorageLocation.barcode` agregado en Task 6 — usado en Task 9
- `StorageLocation.routeCode` agregado en Task 11 — usado en Tasks 12, 13, 14
- `RouteSlottingRecommendation` definida en Task 11 — usada en Tasks 12, 14
- `selectRouteSlottingRecommendations` implementada en Task 12 — usada en Task 14
- `printReceiptLabel` declarada en interface y action en Task 3 — usada en Task 4
