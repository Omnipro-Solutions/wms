# Picking Settings Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full configuration layer to the Picking module (`/picking-settings`), matching the pattern already used by `inventory-settings`, `returns-settings`, `replenishment-settings`: freeze governance, SLA-driven priority suggestion, exception handling with photo/substitution, and a picking-zone catalog for pick-and-pass.

**Architecture:** Extend `WmsSettings` and `PickingTask` in `types/wms.ts`, add seed defaults, add two new store actions (`reportIssue`, `resolveIssue`) plus freeze guards on the 15 existing picking-related actions, add a pure `derivePriorityFromSla` helper in `lib/rules/picking.ts`, build the `/picking-settings` page following the `inventory-settings` template, wire the "Reportar incidencia" action into the desktop task table and the worker mobile wizard, and register the page in the sidebar.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Zustand 5 (already IndexedDB-persisted via `idbStorage`), shadcn/ui, TanStack Table 8.

## Global Constraints

- No test files, no test runs in this task — user explicitly said "no ejecutes test." Verify manually via the dev server instead.
- Arrow functions only for components/hooks/handlers (project CLAUDE.md).
- Clause guards before happy-path render; no default exports outside `app/` page files.
- `cn()` for conditional classes; import shadcn primitives from `@/components/ui/`, never modify them.
- Dates via `date-fns` with `es` locale — not used in this feature (no new date displays), but do not introduce `.toLocaleDateString()`.
- All new UI copy in Spanish (es-CO), matching existing pages.
- Every store action that mutates state must spread, never mutate directly, and must go through the existing FSM helper `canTransition` where a status transition is involved.
- Persistence: nothing new to wire — the whole store already round-trips through `idbStorage` (`src/lib/idb-storage.client.ts`). Do not add a second persistence mechanism.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/types/wms.ts` (modify) | Add `PickingZoneConfig`, extend `WmsSettings` and `PickingTask`, extend `Reason.context` union |
| `src/data/seed.ts` (modify) | Add default values for new `WmsSettings` fields + 2 seed `pickingZones` + 1 seed `Reason` with `context: 'picking_issue'` |
| `src/lib/rules/picking.ts` (modify) | Add pure `derivePriorityFromSla` function |
| `src/store/wms-store.ts` (modify) | Add `PICKING_FROZEN_MSG`, freeze guards on 15 actions, new `reportIssue`/`resolveIssue` actions + their interface entries |
| `src/app/(app)/picking-settings/page.tsx` (create) | New settings page — parameters + zone catalog CRUD, mirrors `inventory-settings/page.tsx` |
| `src/app/(app)/picking/_columns/columns-tasks.tsx` (modify) | Add "Reportar incidencia" row action + `'report-issue'` to `TaskAction` union |
| `src/app/(app)/picking/page.tsx` (modify) | Add issue-report dialog + handler, wired to the new column action |
| `src/app/(worker)/worker/picking/task/[taskId]/page.tsx` (modify) | Add "Reportar incidencia" button + inline dialog to the wizard |
| `src/components/navigation/sidebar/sidebar-items.ts` (modify) | Register `/picking-settings` under Sistema → Configuración |

---

## Task 1: Types — `WmsSettings`, `PickingZoneConfig`, `PickingTask`, `Reason`

**Files:**
- Modify: `src/types/wms.ts:552` (PickingTask), `src/types/wms.ts:1051` (Reason.context), `src/types/wms.ts:1163` (end of WmsSettings, right before yard's closing brace)

**Interfaces:**
- Produces: `PickingZoneConfig { id: string; name: string; sequenceOrder: number; active: boolean }`, `WmsSettings` gains `pickingFreezeActive: boolean`, `pickingSlaUrgentHours: number`, `pickingSlaWarningHours: number`, `pickingWaveMinOrders: number`, `pickingBatchMinOrders: number`, `pickingClusterMaxContainers: number`, `pickingRequireIssuePhoto: boolean`, `pickingAllowSubstitution: boolean`, `pickingZones: PickingZoneConfig[]`. `PickingTask` gains `issuePhotoUrl?: string`, `substituteProductId?: string`. `Reason.context` gains `'picking_issue'`.

- [ ] **Step 1: Add `picking_issue` to `Reason.context` union**

In `src/types/wms.ts`, find:

```ts
export interface Reason {
  id: string
  code: string
  label: string // Spanish label shown in the UI
  context:
    | 'return'
    | 'partial_picking'
    | 'adjustment'
    | 'scrap'
    | 'hold'
    | 'internal_move' // movimientos internos ad-hoc (bin-to-bin, consolidación, cuarentena…)
    | 'transfer_discrepancy' // short / over / damaged al recepcionar un traslado
  active: boolean
}
```

Replace with:

```ts
export interface Reason {
  id: string
  code: string
  label: string // Spanish label shown in the UI
  context:
    | 'return'
    | 'partial_picking'
    | 'adjustment'
    | 'scrap'
    | 'hold'
    | 'internal_move' // movimientos internos ad-hoc (bin-to-bin, consolidación, cuarentena…)
    | 'transfer_discrepancy' // short / over / damaged al recepcionar un traslado
    | 'picking_issue' // incidencia reportada durante picking (sin stock, dañado, ubicación vacía…)
  active: boolean
}
```

- [ ] **Step 2: Add exception fields to `PickingTask`**

Find:

```ts
export interface PickingTask {
  id: string
  code: string
  orderId: string
  productId: string
  locationId: string
  requestedQuantity: number
  pickedQuantity: number
  // Pending balance kept for missing items so picking can be retried later.
  pendingQuantity: number
  status: PickingTaskStatus
  operatorName?: string
  assignedOperatorId?: string
  priority: 'low' | 'medium' | 'high'
  partialReasonId?: string // references a Reason (context: "partial_picking")
  issueReason?: string
}
```

Replace with:

```ts
export interface PickingTask {
  id: string
  code: string
  orderId: string
  productId: string
  locationId: string
  requestedQuantity: number
  pickedQuantity: number
  // Pending balance kept for missing items so picking can be retried later.
  pendingQuantity: number
  status: PickingTaskStatus
  operatorName?: string
  assignedOperatorId?: string
  priority: 'low' | 'medium' | 'high'
  partialReasonId?: string // references a Reason (context: "partial_picking")
  issueReason?: string
  // Exception handling (module #5 — Estándar tier).
  issueReasonId?: string // references a Reason (context: "picking_issue")
  issuePhotoUrl?: string // dataURL captured via <input type="file" capture="environment">
  substituteProductId?: string // product suggested as replacement when out of stock
}
```

- [ ] **Step 3: Add `PickingZoneConfig` interface and picking fields to `WmsSettings`**

Find the end of `WmsSettings` (the closing brace right after `yardAllowOverbooking: boolean`):

```ts
  // Si está activo, permite agendar/asignar más de una cita activa sobre el mismo muelle
  // en horarios que se solapan (excepción a la validación de conflicto de agenda).
  yardAllowOverbooking: boolean
}
```

Replace with:

```ts
  // Si está activo, permite agendar/asignar más de una cita activa sobre el mismo muelle
  // en horarios que se solapan (excepción a la validación de conflicto de agenda).
  yardAllowOverbooking: boolean
  // Picking module (#5) — configured in /picking-settings.
  // Congela iniciar/completar/aprobar/rechazar picks, waves, batch, cluster,
  // put-to-store, waveless y reporte/resolución de incidencias.
  pickingFreezeActive: boolean
  // SLA de despacho → prioridad sugerida al crear tarea/oleada/orden waveless.
  // horas restantes < Urgent → 'high'; < Warning → 'medium'; resto → 'low'.
  pickingSlaUrgentHours: number
  pickingSlaWarningHours: number
  // Umbral sugerido (no forzado) para agrupar órdenes en wave vs. dejarlas waveless.
  pickingWaveMinOrders: number
  // Mínimo de órdenes del mismo producto+ubicación para considerar candidato de batch.
  pickingBatchMinOrders: number
  // Techo operativo de un cluster (número de contenedores simultáneos).
  pickingClusterMaxContainers: number
  // Gobierna el dialog de reporte de incidencia.
  pickingRequireIssuePhoto: boolean
  pickingAllowSubstitution: boolean
  // Catálogo independiente de zonas de picking (pick-and-pass), desacoplado de
  // StorageLocation.zone para permitir renombrar/reordenar sin tocar ubicaciones.
  pickingZones: PickingZoneConfig[]
}

export interface PickingZoneConfig {
  id: string
  name: string
  sequenceOrder: number // orden de paso en pick-and-pass, ascendente
  active: boolean
}
```

- [ ] **Step 4: Verify TypeScript picks up the new types**

Run: `cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep -E "seed.ts|wms-store.ts" | head -20`

Expected: errors pointing at `src/data/seed.ts` (missing new `WmsSettings` fields) and possibly none yet in `wms-store.ts`. This confirms the type change is live; Task 2 fixes the seed error.

- [ ] **Step 5: Commit**

```bash
git add src/types/wms.ts
git commit -m "feat(picking): add WmsSettings, PickingZoneConfig, and exception fields for picking module"
```

---

## Task 2: Seed defaults

**Files:**
- Modify: `src/data/seed.ts:3597` (end of `settings` object, right after `yardAllowOverbooking: false,`), and the `reasons` array (find it via grep, add one entry)

**Interfaces:**
- Consumes: `PickingZoneConfig` from Task 1.
- Produces: `seed.settings` fully satisfies `WmsSettings`; `seed.reasons` includes a `picking_issue` entry for the exception dialog to use.

- [ ] **Step 1: Add picking settings defaults**

In `src/data/seed.ts`, find:

```ts
  yardFreezeActive: false,
  yardOperatingHoursStart: '06:00',
  yardOperatingHoursEnd: '20:00',
  yardWorkingDays: [1, 2, 3, 4, 5, 6],
  yardDefaultSlotMinutes: 60,
  yardLateThresholdMinutes: 30,
  yardAllowOverbooking: false,
```

Replace with:

```ts
  yardFreezeActive: false,
  yardOperatingHoursStart: '06:00',
  yardOperatingHoursEnd: '20:00',
  yardWorkingDays: [1, 2, 3, 4, 5, 6],
  yardDefaultSlotMinutes: 60,
  yardLateThresholdMinutes: 30,
  yardAllowOverbooking: false,
  // Picking module (#5)
  pickingFreezeActive: false,
  pickingSlaUrgentHours: 4,
  pickingSlaWarningHours: 12,
  pickingWaveMinOrders: 5,
  pickingBatchMinOrders: 2,
  pickingClusterMaxContainers: 8,
  pickingRequireIssuePhoto: false,
  pickingAllowSubstitution: true,
  pickingZones: [
    { id: 'pz-1', name: 'Zona A — Picking rápido', sequenceOrder: 1, active: true },
    { id: 'pz-2', name: 'Zona B — Reserva', sequenceOrder: 2, active: true },
    { id: 'pz-3', name: 'Zona C — Voluminosos', sequenceOrder: 3, active: true },
  ],
```

- [ ] **Step 2: Add a `picking_issue` reason**

Find the `reasons` array in `src/data/seed.ts` (grep `export const reasons`). Add these entries to the array (adjust the exact insertion point to be alongside the other context groups, following the file's existing id/code numbering convention):

```ts
  {
    id: 'reason-pick-1',
    code: 'PICK_NO_STOCK',
    label: 'Sin stock físico en la ubicación',
    context: 'picking_issue',
    active: true,
  },
  {
    id: 'reason-pick-2',
    code: 'PICK_DAMAGED',
    label: 'Producto dañado en ubicación',
    context: 'picking_issue',
    active: true,
  },
  {
    id: 'reason-pick-3',
    code: 'PICK_LOCATION_EMPTY',
    label: 'Ubicación vacía / mal etiquetada',
    context: 'picking_issue',
    active: true,
  },
```

Before writing, run `grep -n "id: 'reason-" src/data/seed.ts | tail -5` to confirm the next free numeric suffix per existing convention and adjust the ids above if collisions exist.

- [ ] **Step 3: Verify the seed file type-checks**

Run: `cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "seed.ts"`

Expected: no output (no errors referencing `seed.ts`).

- [ ] **Step 4: Commit**

```bash
git add src/data/seed.ts
git commit -m "feat(picking): seed default picking settings, zones, and exception reasons"
```

---

## Task 3: `derivePriorityFromSla` pure rule

**Files:**
- Modify: `src/lib/rules/picking.ts`

**Interfaces:**
- Consumes: nothing new — pure function, no store/React imports (per `lib/rules/` layering rule in project CLAUDE.md).
- Produces: `derivePriorityFromSla(dispatchDeadline: string, now: Date, settings: { pickingSlaUrgentHours: number; pickingSlaWarningHours: number }): 'low' | 'medium' | 'high'` — consumed later by UI form defaults (not wired to any store action in this plan; see "Not in scope" note in Task 8).

- [ ] **Step 1: Add the function**

Append to `src/lib/rules/picking.ts`:

```ts
// Suggests a priority level from hours remaining until dispatch deadline.
// Pure default — callers may still let the user override it manually.
export function derivePriorityFromSla(
  dispatchDeadline: string,
  now: Date,
  settings: { pickingSlaUrgentHours: number; pickingSlaWarningHours: number }
): 'low' | 'medium' | 'high' {
  const deadline = new Date(dispatchDeadline)
  const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
  if (hoursRemaining < settings.pickingSlaUrgentHours) return 'high'
  if (hoursRemaining < settings.pickingSlaWarningHours) return 'medium'
  return 'low'
}
```

- [ ] **Step 2: Verify it compiles standalone**

Run: `cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "rules/picking.ts"`

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/rules/picking.ts
git commit -m "feat(picking): add derivePriorityFromSla pure rule"
```

---

## Task 4: Store — freeze guards + `reportIssue`/`resolveIssue`

**Files:**
- Modify: `src/store/wms-store.ts` — add constant near line 129 (after `YARD_FROZEN_MSG`), add guards inside the 15 existing picking action bodies (lines ~1525-1900, see list below), add two new actions after `rejectPart` (~line 1653), add their type signatures to the store interface (~line 275-293).

**Interfaces:**
- Consumes: `PickingZoneConfig`, `PickingTask.issuePhotoUrl`/`substituteProductId`/`issueReasonId` from Task 1; `pickingTaskTransitions` from `src/lib/state-machines.ts` (already imported in this file).
- Produces: `reportIssue(taskId: string, reasonId: string, note: string, photoDataUrl?: string, substituteProductId?: string) => PickingTask`, `resolveIssue(taskId: string) => PickingTask`. Both added to the store's public interface so Task 6/7 can call `useWmsStore().reportIssue` / `.resolveIssue`.

- [ ] **Step 1: Add the frozen-message constant**

Find:

```ts
// Shared error shown by every yard/dock action when the module is frozen (see /yard-settings).
const YARD_FROZEN_MSG = 'Patio y muelles en modo congelado. No se permiten operaciones.'
```

Replace with:

```ts
// Shared error shown by every yard/dock action when the module is frozen (see /yard-settings).
const YARD_FROZEN_MSG = 'Patio y muelles en modo congelado. No se permiten operaciones.'

// Shared error shown by every picking action when the module is frozen (see /picking-settings).
const PICKING_FROZEN_MSG = 'Picking en modo congelado. No se permiten operaciones.'
```

- [ ] **Step 2: Add freeze guards to the 15 existing picking actions**

For each of the following actions in `src/store/wms-store.ts`, add `if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)` as the first line inside the function body, immediately after `const state = get()`. Follow the exact style used at `wms-store.ts:2524` (`RETURNS_FROZEN_MSG` check).

Actions to guard (search for each `<name>: (` to find its body):
`startPicking`, `completePick`, `approvePart`, `rejectPart`, `releaseWave`, `createWave`, `startBatchTask`, `completeBatchTask`, `startClusterTask`, `depositToSlot`, `completeClusterTask`, `startPutToStore`, `distributeToStore`, `completePutToStore`, `createWavelessOrder`, `startWavelessOrder`.

Example for `startPicking` — find:

```ts
  startPicking: (taskId, operatorName) => {
    const state = get()
    const task = state.pickingTasks.find((t) => t.id === taskId)
    if (!task) throw new Error('picking task not found')
```

Replace with:

```ts
  startPicking: (taskId, operatorName) => {
    const state = get()
    if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
    const task = state.pickingTasks.find((t) => t.id === taskId)
    if (!task) throw new Error('picking task not found')
```

Repeat the same `const state = get()` → freeze-check insertion pattern for the remaining 14 actions listed above, each in its own function body at its own `const state = get()` line.

- [ ] **Step 3: Add `reportIssue` and `resolveIssue` actions**

Find (end of `rejectPart`):

```ts
  rejectPart: (taskId) => {
    const state = get()
    const task = state.pickingTasks.find((t) => t.id === taskId)
    if (!task) throw new Error('picking task not found')
    if (!canTransition(pickingTaskTransitions, task.status, 'partial_rejected')) {
      throw new Error(`No se puede rechazar parcial desde el estado ${task.status}`)
    }
    const updated: PickingTask = { ...task, status: 'partial_rejected' }
    set({ pickingTasks: state.pickingTasks.map((t) => (t.id === taskId ? updated : t)) })
    return updated
  },
```

Replace with:

```ts
  rejectPart: (taskId) => {
    const state = get()
    if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
    const task = state.pickingTasks.find((t) => t.id === taskId)
    if (!task) throw new Error('picking task not found')
    if (!canTransition(pickingTaskTransitions, task.status, 'partial_rejected')) {
      throw new Error(`No se puede rechazar parcial desde el estado ${task.status}`)
    }
    const updated: PickingTask = { ...task, status: 'partial_rejected' }
    set({ pickingTasks: state.pickingTasks.map((t) => (t.id === taskId ? updated : t)) })
    return updated
  },

  reportIssue: (taskId, reasonId, note, photoDataUrl, substituteProductId) => {
    const state = get()
    if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
    const task = state.pickingTasks.find((t) => t.id === taskId)
    if (!task) throw new Error('picking task not found')
    if (!canTransition(pickingTaskTransitions, task.status, 'with_issue')) {
      throw new Error(`No se puede reportar incidencia desde el estado ${task.status}`)
    }
    if (state.settings.pickingRequireIssuePhoto && !photoDataUrl) {
      throw new Error('Este almacén exige foto para reportar una incidencia')
    }
    const updated: PickingTask = {
      ...task,
      status: 'with_issue',
      issueReasonId: reasonId,
      issueReason: note,
      ...(photoDataUrl ? { issuePhotoUrl: photoDataUrl } : {}),
      ...(substituteProductId ? { substituteProductId } : {}),
    }
    set({ pickingTasks: state.pickingTasks.map((t) => (t.id === taskId ? updated : t)) })
    return updated
  },

  resolveIssue: (taskId) => {
    const state = get()
    if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
    const task = state.pickingTasks.find((t) => t.id === taskId)
    if (!task) throw new Error('picking task not found')
    if (!canTransition(pickingTaskTransitions, task.status, 'in_progress')) {
      throw new Error(`No se puede resolver incidencia desde el estado ${task.status}`)
    }
    const updated: PickingTask = { ...task, status: 'in_progress' }
    set({ pickingTasks: state.pickingTasks.map((t) => (t.id === taskId ? updated : t)) })
    return updated
  },
```

- [ ] **Step 4: Add the two actions to the store's public interface**

Find (in the interface block, near the other picking action signatures):

```ts
  approvePart: (taskId: string) => PickingTask
  rejectPart: (taskId: string) => PickingTask
```

Replace with:

```ts
  approvePart: (taskId: string) => PickingTask
  rejectPart: (taskId: string) => PickingTask
  reportIssue: (
    taskId: string,
    reasonId: string,
    note: string,
    photoDataUrl?: string,
    substituteProductId?: string
  ) => PickingTask
  resolveIssue: (taskId: string) => PickingTask
```

- [ ] **Step 5: Type-check**

Run: `cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "wms-store.ts"`

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/store/wms-store.ts
git commit -m "feat(picking): add freeze guards and reportIssue/resolveIssue store actions"
```

---

## Task 5: `/picking-settings` page

**Files:**
- Create: `src/app/(app)/picking-settings/page.tsx`

**Interfaces:**
- Consumes: `useWmsStore().settings` / `.updateSettings` (existing, `Partial<WmsSettings> => WmsSettings`), `PickingZoneConfig` from Task 1, `pickingTasks` from store for the incidents KPI.
- Produces: nothing consumed by later tasks — this is a leaf page. Route becomes reachable once Task 8 wires the sidebar link.

- [ ] **Step 1: Add `createPickingZone`/`updatePickingZone`/`togglePickingZone` helpers inline in the page (no new store actions needed — zones are a plain array field updated via `updateSettings`)**

This page follows the `inventory-settings/page.tsx` template exactly: local settings draft + `settingsChanged` flag + `Save changes` button, using the existing generic `updateSettings`. Zone CRUD writes directly to `localSettings.pickingZones` and saves through the same `updateSettings` call — no bespoke store action required, matching how `admin/page.tsx` handles UoM-adjacent simple lists inline via component state before commit.

- [ ] **Step 2: Write the page**

Create `src/app/(app)/picking-settings/page.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Pencil,
  Route,
  ShieldAlert,
  Snowflake,
  Timer,
  X,
} from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { PickingZoneConfig } from '@/types/wms'

const SectionHeading = ({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Timer
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

const ZONE_BLANK = { name: '', sequenceOrder: 1 }

export default function PickingSettingsPage() {
  const state = useWmsStore()
  const { settings, pickingTasks, updateSettings } = state

  const [localSettings, setLocalSettings] = useState({ ...settings })
  const [settingsChanged, setSettingsChanged] = useState(false)

  const [zoneDialogOpen, setZoneDialogOpen] = useState(false)
  const [zoneEditId, setZoneEditId] = useState<string | null>(null)
  const [zoneForm, setZoneForm] = useState(ZONE_BLANK)
  const [zoneFormError, setZoneFormError] = useState('')

  const handleSettingChange = (key: keyof typeof settings, value: number | boolean) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
    setSettingsChanged(true)
  }

  const handleSaveSettings = () => {
    updateSettings(localSettings)
    setSettingsChanged(false)
  }

  const handleToggleFreeze = () => {
    const next = !settings.pickingFreezeActive
    updateSettings({ pickingFreezeActive: next })
    setLocalSettings((prev) => ({ ...prev, pickingFreezeActive: next }))
  }

  const openZoneCreate = () => {
    setZoneEditId(null)
    setZoneForm({ name: '', sequenceOrder: localSettings.pickingZones.length + 1 })
    setZoneFormError('')
    setZoneDialogOpen(true)
  }

  const openZoneEdit = (zone: PickingZoneConfig) => {
    setZoneEditId(zone.id)
    setZoneForm({ name: zone.name, sequenceOrder: zone.sequenceOrder })
    setZoneFormError('')
    setZoneDialogOpen(true)
  }

  const handleSaveZone = () => {
    if (!zoneForm.name.trim()) {
      setZoneFormError('El nombre es obligatorio')
      return
    }
    const nextZones = zoneEditId
      ? localSettings.pickingZones.map((z) =>
          z.id === zoneEditId ? { ...z, name: zoneForm.name.trim(), sequenceOrder: zoneForm.sequenceOrder } : z
        )
      : [
          ...localSettings.pickingZones,
          {
            id: `pz-${Date.now()}`,
            name: zoneForm.name.trim(),
            sequenceOrder: zoneForm.sequenceOrder,
            active: true,
          },
        ]
    const updatedZones = [...nextZones].sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    setLocalSettings((prev) => ({ ...prev, pickingZones: updatedZones }))
    updateSettings({ pickingZones: updatedZones })
    setZoneDialogOpen(false)
  }

  const handleToggleZone = (zoneId: string) => {
    const updatedZones = localSettings.pickingZones.map((z) =>
      z.id === zoneId ? { ...z, active: !z.active } : z
    )
    setLocalSettings((prev) => ({ ...prev, pickingZones: updatedZones }))
    updateSettings({ pickingZones: updatedZones })
  }

  const issueCount = useMemo(
    () => pickingTasks.filter((t) => t.status === 'with_issue').length,
    [pickingTasks]
  )
  const activeStrategyCount = useMemo(
    () =>
      pickingTasks.filter((t) => t.status === 'in_progress' || t.status === 'assigned').length,
    [pickingTasks]
  )
  const urgentCount = useMemo(
    () => pickingTasks.filter((t) => t.priority === 'high' && t.status !== 'completed').length,
    [pickingTasks]
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración de Picking"
        description="Parámetros y gobierno del módulo de picking — SLA de prioridad, agrupación, excepciones y zonas de pick-and-pass. Los cambios aquí afectan de inmediato lo que se ve en /picking."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card
          className={cn(
            'border-2',
            issueCount === 0
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/40'
              : 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40'
          )}
        >
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Incidencias abiertas</p>
            <p
              className={cn(
                'mt-1 text-4xl font-bold tabular-nums',
                issueCount === 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'
              )}
            >
              {issueCount}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Tareas en estado &ldquo;Con incidencia&rdquo;</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-4 pt-5">
            <Snowflake className={cn('mt-0.5 size-8 shrink-0', settings.pickingFreezeActive ? 'text-blue-500' : 'text-zinc-300')} />
            <div className="flex-1">
              <p className="text-sm font-medium">Modo congelado</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Bloquea iniciar, completar, aprobar/rechazar y reportar incidencias.</p>
              <div className="mt-3 flex items-center gap-2">
                <Switch checked={settings.pickingFreezeActive} onCheckedChange={handleToggleFreeze} />
                <span className="text-sm">{settings.pickingFreezeActive ? 'Activo' : 'Inactivo'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Tareas activas / urgentes</p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-amber-600 dark:text-amber-300">{activeStrategyCount}</p>
            <p className="mt-1 text-xs text-zinc-500">{urgentCount} con prioridad alta</p>
          </CardContent>
        </Card>
      </div>

      {settings.pickingFreezeActive && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/40">
          <Snowflake className="size-5 shrink-0 text-blue-600 dark:text-blue-300" />
          <p className="flex-1 text-sm text-blue-800 dark:text-blue-300">
            Con picking congelado, ve a <span className="font-semibold">/picking</span> e intenta iniciar o registrar un pick — verás el bloqueo en vivo.
          </p>
        </div>
      )}

      <Separator />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-sm">Parámetros del módulo</CardTitle>
              <CardDescription>SLA de prioridad, umbrales de agrupación y gobierno de excepciones.</CardDescription>
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
            <SectionHeading
              icon={Timer}
              title="SLA y prioridad"
              description="Horas restantes hasta el despacho que disparan la prioridad sugerida al crear una tarea, oleada u orden waveless."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow label="Prioridad alta (horas)" description="Menos de N horas para el despacho → prioridad alta.">
                <InlineSlider
                  value={localSettings.pickingSlaUrgentHours}
                  min={1}
                  max={48}
                  step={1}
                  onChange={(v) => handleSettingChange('pickingSlaUrgentHours', v)}
                />
              </SettingRow>
              <SettingRow label="Prioridad media (horas)" description="Menos de N horas para el despacho → prioridad media.">
                <InlineSlider
                  value={localSettings.pickingSlaWarningHours}
                  min={1}
                  max={96}
                  step={1}
                  onChange={(v) => handleSettingChange('pickingSlaWarningHours', v)}
                />
              </SettingRow>
            </div>
          </section>

          <section className="py-5">
            <SectionHeading
              icon={Boxes}
              title="Agrupación (wave, batch, cluster)"
              description="Umbrales sugeridos para decidir qué estrategia usar — no se aplican automáticamente."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow label="Mínimo de órdenes para oleada" description="Por debajo de este número conviene picking waveless.">
                <InlineSlider
                  value={localSettings.pickingWaveMinOrders}
                  min={1}
                  max={50}
                  step={1}
                  onChange={(v) => handleSettingChange('pickingWaveMinOrders', v)}
                />
              </SettingRow>
              <SettingRow label="Mínimo de órdenes para batch" description="Órdenes del mismo SKU+ubicación para agrupar en un solo viaje.">
                <InlineSlider
                  value={localSettings.pickingBatchMinOrders}
                  min={2}
                  max={20}
                  step={1}
                  onChange={(v) => handleSettingChange('pickingBatchMinOrders', v)}
                />
              </SettingRow>
              <SettingRow label="Máximo contenedores por cluster" description="Techo operativo de un picker con múltiples pedidos simultáneos.">
                <InlineSlider
                  value={localSettings.pickingClusterMaxContainers}
                  min={2}
                  max={16}
                  step={1}
                  onChange={(v) => handleSettingChange('pickingClusterMaxContainers', v)}
                />
              </SettingRow>
            </div>
          </section>

          <section className="pt-5">
            <SectionHeading
              icon={ShieldAlert}
              title="Excepciones"
              description="Gobierna el dialog de 'Reportar incidencia' en /picking y en la app del operario."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow label="Exigir foto" description="La incidencia no se puede guardar sin una foto adjunta.">
                <Switch
                  checked={localSettings.pickingRequireIssuePhoto}
                  onCheckedChange={(v) => handleSettingChange('pickingRequireIssuePhoto', v)}
                />
              </SettingRow>
              <SettingRow label="Permitir sustitución" description="El operario puede sugerir un producto sustituto al reportar falta de stock.">
                <Switch
                  checked={localSettings.pickingAllowSubstitution}
                  onCheckedChange={(v) => handleSettingChange('pickingAllowSubstitution', v)}
                />
              </SettingRow>
            </div>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Route className="size-4" /> Zonas de picking ({localSettings.pickingZones.length})
              </CardTitle>
              <CardDescription>Orden de paso para picking por zona (pick-and-pass).</CardDescription>
            </div>
            <Button size="sm" onClick={openZoneCreate}>
              + Nueva zona
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {localSettings.pickingZones.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <ClipboardList className="size-8 text-zinc-300" />
              <p className="text-sm text-muted-foreground">Sin zonas configuradas.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Orden</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {localSettings.pickingZones.map((zone) => (
                  <TableRow key={zone.id}>
                    <TableCell className="tabular-nums">{zone.sequenceOrder}</TableCell>
                    <TableCell className="font-medium">{zone.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          zone.active
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-zinc-300'
                        )}
                      >
                        {zone.active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openZoneEdit(zone)}>
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={cn('h-7 px-2 text-xs', zone.active ? 'text-red-500 hover:text-red-700' : 'text-emerald-600 hover:text-emerald-800')}
                          onClick={() => handleToggleZone(zone.id)}
                        >
                          {zone.active ? 'Desactivar' : 'Activar'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={zoneDialogOpen} onOpenChange={(o) => { if (!o) setZoneDialogOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Route className="size-4 text-blue-600" />
              {zoneEditId ? 'Editar zona' : 'Nueva zona de picking'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {zoneEditId ? 'Editar zona existente' : 'Crear nueva zona de picking'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="zone-name">Nombre <span className="text-destructive">*</span></Label>
              <Input
                id="zone-name"
                placeholder="Ej: Zona D — Alto valor"
                value={zoneForm.name}
                onChange={(e) => setZoneForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zone-order">Orden de secuencia</Label>
              <Input
                id="zone-order"
                type="number"
                min={1}
                value={zoneForm.sequenceOrder}
                onChange={(e) => setZoneForm((p) => ({ ...p, sequenceOrder: Number(e.target.value) }))}
              />
            </div>
            {zoneFormError && (
              <p className="flex items-center gap-1 text-sm text-destructive">
                <AlertTriangle className="size-3" /> {zoneFormError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setZoneDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveZone}>{zoneEditId ? 'Guardar cambios' : 'Crear zona'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

Note: `CheckCircle2`, `X` are imported but unused in this draft — remove unused imports before commit (keep only `AlertTriangle, Boxes, Pencil, Route, ShieldAlert, Snowflake, Timer` from lucide, plus `ClipboardList`). Run the lint step below to catch this precisely.

- [ ] **Step 3: Lint and type-check**

Run: `cd /Users/carlosgranados/Documents/develop/wms && npx eslint src/app/\(app\)/picking-settings/page.tsx && npx tsc --noEmit 2>&1 | grep "picking-settings"`

Expected: eslint reports unused-import errors for `CheckCircle2` and `X` — remove those two names from the lucide-react import line. Re-run until both commands produce no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/picking-settings/page.tsx
git commit -m "feat(picking): add /picking-settings configuration page"
```

---

## Task 6: Desktop — "Reportar incidencia" row action + dialog

**Files:**
- Modify: `src/app/(app)/picking/_columns/columns-tasks.tsx`
- Modify: `src/app/(app)/picking/page.tsx`

**Interfaces:**
- Consumes: `reportIssue` from Task 4's store interface, `PickingZoneConfig`/reason context `'picking_issue'` from Tasks 1-2.
- Produces: nothing new consumed elsewhere — this is the desktop supervisor entry point.

- [ ] **Step 1: Extend `TaskAction` union and add the button**

In `src/app/(app)/picking/_columns/columns-tasks.tsx`, find:

```ts
export type TaskAction =
  | { type: 'start'; taskId: string }
  | { type: 'register'; task: PickingTask }
  | { type: 'approve'; taskId: string }
  | { type: 'reject'; taskId: string }
  | { type: 'retry'; task: PickingTask }
```

Replace with:

```ts
export type TaskAction =
  | { type: 'start'; taskId: string }
  | { type: 'register'; task: PickingTask }
  | { type: 'approve'; taskId: string }
  | { type: 'reject'; taskId: string }
  | { type: 'retry'; task: PickingTask }
  | { type: 'report-issue'; task: PickingTask }
  | { type: 'resolve-issue'; taskId: string }
```

Find the import line:

```ts
import { CheckCircle2, PlayCircle, Scan, ThumbsDown, ThumbsUp } from 'lucide-react'
```

Replace with:

```ts
import { AlertTriangle, CheckCircle2, PlayCircle, Scan, ThumbsDown, ThumbsUp } from 'lucide-react'
```

Find the actions cell body (inside the `id: 'actions'` column), right before the closing of the `<div className="flex items-center gap-1">`:

```tsx
          {task.status === 'partial_rejected' && (
            <Button size="sm" onClick={() => onAction({ type: 'retry', task })}>
              <PlayCircle className="mr-1 size-3" /> Reintentar
            </Button>
          )}
        </div>
      )
    },
  },
]
```

Replace with:

```tsx
          {task.status === 'partial_rejected' && (
            <Button size="sm" onClick={() => onAction({ type: 'retry', task })}>
              <PlayCircle className="mr-1 size-3" /> Reintentar
            </Button>
          )}
          {['pending', 'assigned', 'in_progress'].includes(task.status) && (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => onAction({ type: 'report-issue', task })}
            >
              <AlertTriangle className="size-3" />
            </Button>
          )}
          {task.status === 'with_issue' && (
            <Button size="sm" onClick={() => onAction({ type: 'resolve-issue', taskId: task.id })}>
              <PlayCircle className="mr-1 size-3" /> Resolver
            </Button>
          )}
        </div>
      )
    },
  },
]
```

- [ ] **Step 2: Add issue dialog state and handler in `page.tsx`**

In `src/app/(app)/picking/page.tsx`, find the `PickDialogData` interface block near line 93 and add a sibling interface right after it:

```ts
interface PickDialogData {
  taskId: string
  code: string
  productName: string
  locationCode: string
  requestedQuantity: number
  requiresSerial: boolean
}
```

Replace with:

```ts
interface PickDialogData {
  taskId: string
  code: string
  productName: string
  locationCode: string
  requestedQuantity: number
  requiresSerial: boolean
}

interface IssueDialogData {
  taskId: string
  code: string
  productName: string
}
```

Find the picking store destructure block near line 140:

```ts
  const { startClusterTask, depositToSlot, completeClusterTask } = useWmsStore()
  const { startPutToStore, distributeToStore, completePutToStore } = useWmsStore()
```

Replace with:

```ts
  const { startClusterTask, depositToSlot, completeClusterTask } = useWmsStore()
  const { startPutToStore, distributeToStore, completePutToStore } = useWmsStore()
  const { reportIssue, resolveIssue, products: allProducts } = useWmsStore()
```

Find the `pickDialog` declaration and `partialReasons` line:

```ts
  const pickDialog = useDialogState<PickDialogData>()

  const partialReasons = state.reasons.filter((r) => r.context === 'partial_picking' && r.active)
```

Replace with:

```ts
  const pickDialog = useDialogState<PickDialogData>()
  const issueDialog = useDialogState<IssueDialogData>()
  const [issueReasonId, setIssueReasonId] = useState('')
  const [issueNote, setIssueNote] = useState('')
  const [issuePhotoUrl, setIssuePhotoUrl] = useState<string | undefined>(undefined)
  const [issueSubstituteId, setIssueSubstituteId] = useState('')

  const partialReasons = state.reasons.filter((r) => r.context === 'partial_picking' && r.active)
  const issueReasons = state.reasons.filter((r) => r.context === 'picking_issue' && r.active)
```

Find `handleTaskAction` and add the two new branches before the closing of the `useCallback`:

```ts
      } else if (action.type === 'reject') {
        try {
          rejectPart(action.taskId)
        } catch (e) {
          console.error(e)
        }
      }
    },
    [state.pickingTasks, startPicking, openPickDialog, approvePart, rejectPart]
  )
```

Replace with:

```ts
      } else if (action.type === 'reject') {
        try {
          rejectPart(action.taskId)
        } catch (e) {
          console.error(e)
        }
      } else if (action.type === 'report-issue') {
        issueDialog.open({
          taskId: action.task.id,
          code: action.task.code,
          productName: helpers.productName(action.task.productId),
        })
        setIssueReasonId('')
        setIssueNote('')
        setIssuePhotoUrl(undefined)
        setIssueSubstituteId('')
      } else if (action.type === 'resolve-issue') {
        try {
          resolveIssue(action.taskId)
        } catch (e) {
          console.error(e)
        }
      }
    },
    [state.pickingTasks, startPicking, openPickDialog, approvePart, rejectPart, issueDialog, helpers, resolveIssue]
  )

  const handlePhotoSelected = useCallback((file: File | undefined) => {
    if (!file) {
      setIssuePhotoUrl(undefined)
      return
    }
    const reader = new FileReader()
    reader.onload = () => setIssuePhotoUrl(reader.result as string)
    reader.readAsDataURL(file)
  }, [])

  const handleSubmitIssue = useCallback(() => {
    if (!issueDialog.data) return
    if (!issueReasonId) {
      issueDialog.setError('Selecciona un motivo.')
      return
    }
    if (state.settings.pickingRequireIssuePhoto && !issuePhotoUrl) {
      issueDialog.setError('Este almacén exige foto para reportar una incidencia.')
      return
    }
    try {
      reportIssue(
        issueDialog.data.taskId,
        issueReasonId,
        issueNote.trim(),
        issuePhotoUrl,
        issueSubstituteId || undefined
      )
      issueDialog.close()
    } catch (e: unknown) {
      issueDialog.setError(e instanceof Error ? e.message : 'Error al reportar incidencia')
    }
  }, [issueDialog, issueReasonId, issueNote, issuePhotoUrl, issueSubstituteId, reportIssue, state.settings.pickingRequireIssuePhoto])
```

- [ ] **Step 3: Wire `TaskAction` handling into `columns-tasks.tsx` caller and add the dialog JSX**

Confirm `buildTaskColumns` call site (near line 271) already forwards `handleTaskAction` — no change needed there since the union just gained variants handled by the same callback.

In `src/app/(app)/picking/page.tsx`, find the closing `</Dialog>` right after the pick dialog (the block ending at line 958 in the current file, right before the `{/* ── Release wave dialog */}` comment):

```tsx
          <DialogFooter>
            <Button variant="outline" onClick={pickDialog.close}>
              Cancelar
            </Button>
            <Button onClick={handleCompletePick}>
              <CheckCircle2 className="mr-1 size-4" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Release wave dialog ────────────────────────────────────────────── */}
```

Replace with:

```tsx
          <DialogFooter>
            <Button variant="outline" onClick={pickDialog.close}>
              Cancelar
            </Button>
            <Button onClick={handleCompletePick}>
              <CheckCircle2 className="mr-1 size-4" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Report issue dialog ───────────────────────────────────────────── */}
      <Dialog open={!!issueDialog.data} onOpenChange={(o) => { if (!o) issueDialog.close() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reportar incidencia</DialogTitle>
          </DialogHeader>
          {issueDialog.data && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/40 space-y-1 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground">
                  Tarea: <span className="text-foreground font-mono font-semibold">{issueDialog.data.code}</span>
                </p>
                <p className="text-muted-foreground">
                  Producto: <span className="text-foreground font-medium">{issueDialog.data.productName}</span>
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="issue-reason">Motivo</Label>
                <Select value={issueReasonId} onValueChange={setIssueReasonId}>
                  <SelectTrigger id="issue-reason" className="w-full">
                    <SelectValue placeholder="Seleccionar motivo…" />
                  </SelectTrigger>
                  <SelectContent>
                    {issueReasons.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="issue-note">Nota</Label>
                <Input
                  id="issue-note"
                  placeholder="Detalle adicional…"
                  value={issueNote}
                  onChange={(e) => setIssueNote(e.target.value)}
                />
              </div>
              {state.settings.pickingAllowSubstitution && (
                <div className="space-y-1">
                  <Label htmlFor="issue-substitute">Producto sustituto (opcional)</Label>
                  <Select value={issueSubstituteId} onValueChange={setIssueSubstituteId}>
                    <SelectTrigger id="issue-substitute" className="w-full">
                      <SelectValue placeholder="Sin sustituto" />
                    </SelectTrigger>
                    <SelectContent>
                      {allProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="issue-photo">
                  Foto {state.settings.pickingRequireIssuePhoto && <span className="text-destructive">*</span>}
                </Label>
                <input
                  id="issue-photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoSelected(e.target.files?.[0])}
                  className="block w-full text-sm"
                />
                {issuePhotoUrl && (
                  <img src={issuePhotoUrl} alt="Foto de incidencia" className="mt-2 h-24 w-24 rounded-lg object-cover" />
                )}
              </div>
              {issueDialog.error && (
                <p className="text-destructive flex items-center gap-1 text-sm">
                  <TriangleAlert className="size-3" /> {issueDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={issueDialog.close}>Cancelar</Button>
            <Button onClick={handleSubmitIssue}>Reportar incidencia</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Release wave dialog ────────────────────────────────────────────── */}
```

- [ ] **Step 4: Lint and type-check**

Run: `cd /Users/carlosgranados/Documents/develop/wms && npx eslint "src/app/(app)/picking/_columns/columns-tasks.tsx" "src/app/(app)/picking/page.tsx" && npx tsc --noEmit 2>&1 | grep "app/(app)/picking/"`

Expected: no errors. Fix any unused-variable/import issues surfaced (e.g. if `allProducts` destructure name collides with something already in scope, check first with `grep -n "allProducts\|const { .*products" src/app/\(app\)/picking/page.tsx`).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/picking/_columns/columns-tasks.tsx src/app/\(app\)/picking/page.tsx
git commit -m "feat(picking): add report/resolve issue action and dialog to desktop task table"
```

---

## Task 7: Worker (mobile) wizard — "Reportar incidencia"

**Files:**
- Modify: `src/app/(worker)/worker/picking/task/[taskId]/page.tsx`

**Interfaces:**
- Consumes: `reportIssue` from Task 4.
- Produces: nothing consumed elsewhere — terminal UI for the operator flow.

- [ ] **Step 1: Add store destructure, state, and photo handler**

Find:

```ts
  const { pickingTasks, products, locations, startPicking, completePick, approvePart } =
    useWmsStore()
```

Replace with:

```ts
  const { pickingTasks, products, locations, settings, reasons, startPicking, completePick, approvePart, reportIssue } =
    useWmsStore()
```

Find:

```ts
  const [showPartialDialog, setShowPartialDialog] = useState(false)
  const [pickError, setPickError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
```

Replace with:

```ts
  const [showPartialDialog, setShowPartialDialog] = useState(false)
  const [pickError, setPickError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [showIssueDialog, setShowIssueDialog] = useState(false)
  const [issueReasonId, setIssueReasonId] = useState('')
  const [issuePhotoUrl, setIssuePhotoUrl] = useState<string | undefined>(undefined)
  const [issueError, setIssueError] = useState<string | null>(null)
```

- [ ] **Step 2: Add the submit handler after `handleConfirmPartial`**

Find:

```ts
  const handleConfirmPartial = () => {
    setPickError(null)
    try {
      completePick(task.id, qty, undefined, serial.trim() || undefined)
      approvePart(task.id)
      setShowPartialDialog(false)
      setStep('done')
    } catch (e: unknown) {
      setShowPartialDialog(false)
      setPickError(e instanceof Error ? e.message : 'Error al registrar pick parcial')
    }
  }
```

Replace with:

```ts
  const handleConfirmPartial = () => {
    setPickError(null)
    try {
      completePick(task.id, qty, undefined, serial.trim() || undefined)
      approvePart(task.id)
      setShowPartialDialog(false)
      setStep('done')
    } catch (e: unknown) {
      setShowPartialDialog(false)
      setPickError(e instanceof Error ? e.message : 'Error al registrar pick parcial')
    }
  }

  const issueReasons = reasons.filter((r) => r.context === 'picking_issue' && r.active)

  const handleIssuePhoto = (file: File | undefined) => {
    if (!file) {
      setIssuePhotoUrl(undefined)
      return
    }
    const reader = new FileReader()
    reader.onload = () => setIssuePhotoUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmitIssue = () => {
    setIssueError(null)
    if (!issueReasonId) {
      setIssueError('Selecciona un motivo.')
      return
    }
    if (settings.pickingRequireIssuePhoto && !issuePhotoUrl) {
      setIssueError('Se requiere una foto para reportar la incidencia.')
      return
    }
    try {
      reportIssue(task.id, issueReasonId, '', issuePhotoUrl)
      setShowIssueDialog(false)
      router.push('/worker/picking')
    } catch (e: unknown) {
      setIssueError(e instanceof Error ? e.message : 'Error al reportar incidencia')
    }
  }
```

- [ ] **Step 3: Add the trigger button to the `location` and `product` steps, and the dialog at the bottom**

Find the `location` step block:

```tsx
          {pickError && <ErrorBanner message={pickError} />}
          <ScanInput
            label="Escanea la ubicación"
            expectedValue={location.barcode ?? location.code}
            onMatch={handleLocationMatch}
          />
        </div>
      )}
```

Replace with:

```tsx
          {pickError && <ErrorBanner message={pickError} />}
          <ScanInput
            label="Escanea la ubicación"
            expectedValue={location.barcode ?? location.code}
            onMatch={handleLocationMatch}
          />
          <Button variant="outline" className="h-11 w-full text-amber-700" onClick={() => setShowIssueDialog(true)}>
            ⚠️ Reportar incidencia
          </Button>
        </div>
      )}
```

Find the `product` step block:

```tsx
          {pickError && <ErrorBanner message={pickError} />}
          <ScanInput
            label="Escanea el producto"
            expectedValue={product.barcode ?? product.sku}
            onMatch={handleProductMatch}
          />
        </div>
      )}
```

Replace with:

```tsx
          {pickError && <ErrorBanner message={pickError} />}
          <ScanInput
            label="Escanea el producto"
            expectedValue={product.barcode ?? product.sku}
            onMatch={handleProductMatch}
          />
          <Button variant="outline" className="h-11 w-full text-amber-700" onClick={() => setShowIssueDialog(true)}>
            ⚠️ Reportar incidencia
          </Button>
        </div>
      )}
```

Find the end of the file (closing `Dialog` for `showPartialDialog`, right before the final `</div>` and `)`):

```tsx
      <Dialog open={showPartialDialog} onOpenChange={setShowPartialDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-center">¿Confirmar cantidad parcial?</DialogTitle>
            <DialogDescription className="text-center">
              <span className="text-4xl font-black tabular-nums text-foreground">
                {qty}
              </span>
              <span className="text-2xl font-medium text-muted-foreground">
                {' '}/{' '}{task.requestedQuantity}
              </span>
              <br />
              <span className="text-sm">unidades — se marcará como pick parcial</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button className="h-14 w-full text-base font-bold" onClick={handleConfirmPartial}>
              Confirmar {qty} uds (parcial)
            </Button>
            <Button variant="outline" className="h-12 w-full" onClick={() => setShowPartialDialog(false)}>
              Cancelar — seguir picando
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

Replace with:

```tsx
      <Dialog open={showPartialDialog} onOpenChange={setShowPartialDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-center">¿Confirmar cantidad parcial?</DialogTitle>
            <DialogDescription className="text-center">
              <span className="text-4xl font-black tabular-nums text-foreground">
                {qty}
              </span>
              <span className="text-2xl font-medium text-muted-foreground">
                {' '}/{' '}{task.requestedQuantity}
              </span>
              <br />
              <span className="text-sm">unidades — se marcará como pick parcial</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button className="h-14 w-full text-base font-bold" onClick={handleConfirmPartial}>
              Confirmar {qty} uds (parcial)
            </Button>
            <Button variant="outline" className="h-12 w-full" onClick={() => setShowPartialDialog(false)}>
              Cancelar — seguir picando
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showIssueDialog} onOpenChange={setShowIssueDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-center">Reportar incidencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="worker-issue-reason">Motivo</Label>
              <select
                id="worker-issue-reason"
                value={issueReasonId}
                onChange={(e) => setIssueReasonId(e.target.value)}
                className="h-12 w-full rounded-md border bg-background px-3 text-base"
              >
                <option value="">Seleccionar…</option>
                {issueReasons.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="worker-issue-photo">
                Foto {settings.pickingRequireIssuePhoto && <span className="text-destructive">*</span>}
              </Label>
              <input
                id="worker-issue-photo"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleIssuePhoto(e.target.files?.[0])}
                className="block w-full text-sm"
              />
              {issuePhotoUrl && (
                <img src={issuePhotoUrl} alt="Foto de incidencia" className="mt-2 h-20 w-20 rounded-lg object-cover" />
              )}
            </div>
            {issueError && <ErrorBanner message={issueError} />}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button className="h-14 w-full text-base font-bold" onClick={handleSubmitIssue}>
              Enviar incidencia
            </Button>
            <Button variant="outline" className="h-12 w-full" onClick={() => setShowIssueDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 4: Add the `Label` import if not already present (it already is, per the file's existing imports) — verify and lint**

Run: `cd /Users/carlosgranados/Documents/develop/wms && npx eslint "src/app/(worker)/worker/picking/task/[taskId]/page.tsx" && npx tsc --noEmit 2>&1 | grep "worker/picking/task"`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(worker)/worker/picking/task/[taskId]/page.tsx"
git commit -m "feat(picking): add report-issue flow to the worker picking wizard"
```

---

## Task 8: Sidebar navigation entry

**Files:**
- Modify: `src/components/navigation/sidebar/sidebar-items.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `/picking-settings` becomes reachable from Sistema → Configuración.

- [ ] **Step 1: Add the icon import and the nav entry**

Find:

```ts
import type { OperatorRole } from '@/lib/worker-routes'
import {
  ArrowRightLeft,
  BarChart3,
  Boxes,
  Cable,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  Grid3x3,
  Layers,
  MapPinned,
  Package,
  PackageCheck,
  Repeat,
  Route,
  Settings2,
  ShoppingCart,
  ScanLine,
  Shuffle,
  SlidersHorizontal,
  Tags,
  Truck,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
```

No new icon needed — `ClipboardList` is already imported and matches the main Picking nav item's icon (`src/lib/constants.ts:50`).

Find:

```ts
          { id: 'config-slotting', title: 'Slotting', url: '/slotting-settings', icon: Grid3x3 },
          {
            id: 'config-replenishment',
            title: 'Reabastecimiento',
            url: '/replenishment-settings',
            icon: Repeat,
          },
```

Replace with:

```ts
          { id: 'config-slotting', title: 'Slotting', url: '/slotting-settings', icon: Grid3x3 },
          { id: 'config-picking', title: 'Picking', url: '/picking-settings', icon: ClipboardList },
          {
            id: 'config-replenishment',
            title: 'Reabastecimiento',
            url: '/replenishment-settings',
            icon: Repeat,
          },
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "sidebar-items"`

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/navigation/sidebar/sidebar-items.ts
git commit -m "feat(picking): register /picking-settings in Sistema > Configuración"
```

---

## Task 9: Manual verification (no automated tests, per user instruction)

**Files:** none — this task runs the dev server and clicks through the feature.

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/carlosgranados/Documents/develop/wms && npm run dev`

Expected: server starts on `http://localhost:3000` (or the configured port) without compile errors.

- [ ] **Step 2: Verify the settings page**

Navigate to `/picking-settings` as a supervisor session. Confirm:
- KPI cards render (incidencias abiertas, modo congelado, tareas activas).
- Sliders/switches update `localSettings` and show "Cambios sin guardar"; "Guardar cambios" persists (reload the page — values survive, proving the IndexedDB round-trip works).
- Toggling "Modo congelado" immediately shows the blue banner.
- Zone table: create, edit, and deactivate a zone; confirm the table re-sorts by `sequenceOrder`.

- [ ] **Step 3: Verify freeze enforcement**

With `pickingFreezeActive` on, go to `/picking` → Tareas tab, try "Iniciar" on a pending task. Confirm it fails silently per the existing `catch (e) { console.error(e) }` pattern used by `handleTaskAction` (matches how `startPicking` failures are already handled in this file) — check the browser console shows the `PICKING_FROZEN_MSG` error. Turn freeze back off before continuing.

- [ ] **Step 4: Verify the exception flow on desktop**

On a `pending`/`assigned`/`in_progress` task in `/picking` → Tareas, click the amber warning-triangle button. Confirm the dialog opens, requires a motivo, optionally accepts a photo and substitute product, and on submit the task's status badge changes to "Con incidencia" (red `with_issue` variant). Click "Resolver" and confirm it returns to `in_progress`.

- [ ] **Step 5: Verify the exception flow on the worker wizard**

Log in as (or switch operator to) a `picker` role, open `/worker/picking`, start a task, and on the location or product step tap "⚠️ Reportar incidencia". Confirm the dialog requires a motivo (and a photo if `pickingRequireIssuePhoto` is on), and submitting redirects back to `/worker/picking` with the task no longer in the active list (now `with_issue`).

- [ ] **Step 6: Confirm middleware still blocks workers from settings**

While still in a `picker` session, manually navigate the browser to `/picking-settings`. Confirm the middleware redirects back to `/worker/picking` (per existing `WORKER_ROLES` redirect behavior in `src/middleware.ts` — no code change needed, this just confirms nothing in this feature broke that guard).

- [ ] **Step 7: Report results to the user**

Summarize pass/fail for each of steps 2-6 before moving to the documentation tasks below.

---

## Task 10: Module documentation — `docs/modulo_gestion_picking.md`

**Files:**
- Create: `docs/modulo_gestion_picking.md`

This must mirror the structure and depth of the sibling module doc the user referenced (`docs/modulo_gestion_inventario.md` — if it does not exist in this checkout, use `docs/funcionalidades_base_wms.md` section 5 and the module docs already present under `docs/` as the structural template: an overview, feature-by-feature breakdown mapped to 🟢/🔵/🟣 maturity tiers, what's implemented vs. not, config reference table, and related routes).

- [ ] **Step 1: Write the document**

Create `docs/modulo_gestion_picking.md` with these sections (populate with real specifics from Tasks 1-8, not placeholders):

1. **Resumen** — what the module does, referencing `docs/funcionalidades_base_wms.md` §5 as the market benchmark.
2. **Estrategias soportadas** — table of the 6 strategies (discreto/tareas, wave, waveless, batch, cluster, zona, put-to-store) with route/tab and store actions per strategy.
3. **Configuración (`/picking-settings`)** — table of every new `WmsSettings` field from Task 1 with its default value (from Task 2) and what it governs.
4. **Manejo de excepciones** — describe the `with_issue` FSM state, `reportIssue`/`resolveIssue` actions, photo capture, substitution, and the `picking_issue` reason context.
5. **Gobierno (freeze)** — list the 15 guarded actions from Task 4.
6. **Cobertura frente al catálogo de referencia** — a 🟢/🔵/🟣 checklist mirroring `funcionalidades_base_wms.md` §5, marking what is now implemented (discrete picking with scan validation ✅, partial picking ✅, multi-strategy ✅, SLA-based priority suggestion ✅, exception handling with photo ✅, zone catalog ✅) vs. explicitly out of scope (order streaming/AI orchestration, voice/RFID/wearables, goods-to-person — 🟣 Avanzado tier, not built).
7. **Rutas relacionadas** — `/picking`, `/picking-settings`, `/worker/picking`, `/worker/picking/task/[taskId]`.

- [ ] **Step 2: Commit**

```bash
git add docs/modulo_gestion_picking.md
git commit -m "docs(picking): add module documentation for Picking / preparación de pedidos"
```

---

## Task 11: Mobile worker plan document

**Files:**
- Create: `docs/superpowers/plans/2026-07-23-picking-mobile-worker-plan.md`

This is a planning document only — no code in this task. It describes phased future work for the operator-facing mobile experience, informed by what Tasks 1-8 just added to the desktop/config side.

- [ ] **Step 1: Write the plan**

Create `docs/superpowers/plans/2026-07-23-picking-mobile-worker-plan.md` covering:

1. **Contexto** — current state of `(worker)/worker/picking` (list + 3-step wizard: location → product → quantity → done, scan-to-confirm via `ScanInput`, no offline queueing) and what this task just added (report-issue button + dialog).
2. **Fase 1 — Reflejar configuración en el wizard** (small, builds directly on Task 7): show priority badge on the task list sorted/colored by `pickingSlaUrgentHours`/`pickingSlaWarningHours`; respect `pickingFreezeActive` with a full-screen blocking banner instead of letting `startPicking` throw silently.
3. **Fase 2 — Cluster y batch en mobile**: today only discrete `PickingTask` has a worker screen; `BatchTask` and `ClusterTask` have no worker-facing UI at all (only desktop tabs). Scope: a `(worker)/worker/picking/batch/[batchId]` and `/cluster/[clusterId]` screen reusing `ScanInput`/`QuantityStepper`, respecting `pickingClusterMaxContainers`.
4. **Fase 3 — Zona (pick-and-pass) en mobile**: worker screen that walks `pickingZones` in `sequenceOrder`, showing only tasks in the operator's current zone, advancing to the next zone on completion.
5. **Fase 4 — Modo offline**: today there is zero offline handling (`store/wms-store.ts` writes assume connectivity to IndexedDB, which is actually available offline since IndexedDB is local — clarify that "offline" here means: queue actions when the underlying `fetch`-based sync to a future backend is unavailable, since today everything is client-local already). Out of scope until a backend exists (see `docs/funcionalidades_base_wms.md` §23 platform notes) — flag as blocked on backend work, not a UI task.
6. **Fase 5 — Voice/RFID/wearables** — explicitly 🟣 Avanzado tier per the reference catalog, not planned.

Each phase: goal, files likely touched (best-guess paths under `(worker)/worker/picking/`), dependencies on this task's config (which `WmsSettings` field it reads), and a rough size (S/M/L).

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-07-23-picking-mobile-worker-plan.md
git commit -m "docs(picking): add mobile worker roadmap for Picking module"
```

---

## Self-Review Notes

- **Spec coverage:** all 9 spec sections (persistence, WmsSettings fields, exceptions, SLA priority, freeze, settings page, nav, testing note, deliverables list) map to Tasks 1-11 above.
- **Scope boundary honored:** `pickingDefaultStrategy` (auto-strategy suggestion) and zone-catalog-derived-from-`StorageLocation.zone` were explicitly rejected by the user during brainstorming and are not present anywhere in this plan.
- **Type consistency:** `reportIssue(taskId, reasonId, note, photoDataUrl?, substituteProductId?)` signature is identical across Task 4 (store), Task 6 (desktop dialog), and Task 7 (worker dialog, called with `''` for note since the mobile dialog has no note field — this is intentional, not an inconsistency, to keep the mobile flow to one tap).
- **No test files** were added anywhere in this plan, per explicit user instruction; Task 9 substitutes manual verification.
