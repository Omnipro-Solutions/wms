# Load Manifests UX/UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mejorar la UX/UI de la vista `/load-manifests` corrigiendo el bug del campo SAP y añadiendo búsqueda, KPIs ricos, header de card mejorado, progreso de paradas, agrupación por fecha y datos de conductor.

**Architecture:** Todos los cambios son en 3 archivos existentes (`page.tsx`, `manifest-card.tsx`, `create-manifest-dialog.tsx`). No se crean nuevos archivos ni componentes. Reutiliza `KpiCard` de `components/shared/`, `formatDate`/`formatWeight` de `lib/formatters`, y lógica `useMemo` ya presente en la página.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript 5 · Zustand 5 · TailwindCSS 4 · shadcn/Radix UI · Lucide Icons

## Global Constraints

- Todo texto UI en español (es-CO)
- Arrow functions en todos los componentes y handlers
- `cn()` de `@/lib/utils` para clases condicionales — nunca template literals
- Importar `KpiCard` de `@/components/shared/kpi-card` — no crear tarjetas custom
- Importar tipos de `@/types/wms` — nunca redefinir inline
- `formatDate`, `formatNumber`, `formatWeight` de `@/lib/formatters`
- `StatusBadge` de `@/components/shared/status-badge` para estados
- No modificar archivos en `components/ui/`

---

### Task 1: Fix bug — agregar campo SAP Route ID al CreateManifestDialog

**Files:**
- Modify: `src/app/load-manifests/_components/create-manifest-dialog.tsx`

**Interfaces:**
- El campo ya existe en el estado interno `sapRouteId` (línea 46) y en `handleConfirm` (línea 70)
- Solo falta el `<Input>` con su `<Label>` en el JSX — agregar antes del campo de fecha

- [ ] **Step 1: Agregar el campo SAP Route ID en el formulario**

En `create-manifest-dialog.tsx`, reemplazar el grid de route+date (líneas 97-108) con:

```tsx
{/* Route + date */}
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
  <div className="space-y-1.5">
    <Label className="flex items-center gap-1">
      <MapPinned className="size-3.5" /> Ruta SAP
    </Label>
    <Input
      placeholder="Ej. R-001"
      value={sapRouteId}
      onChange={(e) => setSapRouteId(e.target.value)}
    />
  </div>
  <div className="space-y-1.5">
    <Label className="flex items-center gap-1">
      <CalendarDays className="size-3.5" /> Fecha
    </Label>
    <Input
      type="date"
      value={manifestDate}
      onChange={(e) => setManifestDate(e.target.value)}
    />
  </div>
</div>
```

- [ ] **Step 2: Verificar manualmente**

Abrir el dialog "Nuevo manifiesto" → confirmar que aparece campo "Ruta SAP" + "Fecha" side-by-side. El botón "Crear manifiesto" debe permanecer disabled hasta escribir algo en Ruta SAP.

- [ ] **Step 3: Commit**

```bash
git add src/app/load-manifests/_components/create-manifest-dialog.tsx
git commit -m "fix(load-manifests): add missing SAP route ID input in create dialog"
```

---

### Task 2: Reemplazar KPI cards planas por KpiCard con icono y tono

**Files:**
- Modify: `src/app/load-manifests/page.tsx`

**Interfaces:**
- Consumes: `KpiCard` de `@/components/shared/kpi-card` — props: `icon`, `value`, `label`, `tone`
- Consumes: `formatNumber`, `formatWeight` de `@/lib/formatters`
- Consumes: `activeCount`, `pendingCount`, `totalUnits`, `totalWeight` ya calculados en `useMemo` (líneas 73-82)

- [ ] **Step 1: Agregar imports de KpiCard e iconos necesarios**

En `page.tsx`, reemplazar la línea de imports existente:
```tsx
import { MapPinned, Plus, TriangleAlert } from 'lucide-react'
```
con:
```tsx
import { Activity, MapPinned, Package, Plus, Scale, TriangleAlert, Truck } from 'lucide-react'
```

Agregar import de KpiCard después de los imports de shadcn:
```tsx
import { KpiCard } from '@/components/shared/kpi-card'
```

Agregar `formatWeight` a los imports de formatters:
```tsx
import { formatNumber, formatWeight } from '@/lib/formatters'
```

- [ ] **Step 2: Reemplazar el bloque de KPIs (líneas 128-157)**

Reemplazar todo el bloque `{/* KPIs */}` con:

```tsx
{/* KPIs */}
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <KpiCard
    icon={Activity}
    value={activeCount}
    label="Manifiestos activos"
    tone="blue"
  />
  <KpiCard
    icon={Truck}
    value={pendingCount}
    label="Pendientes de despacho"
    tone="amber"
    alert={pendingCount > 0}
  />
  <KpiCard
    icon={Package}
    value={formatNumber(totalUnits)}
    label="Unidades totales"
    tone="neutral"
  />
  <KpiCard
    icon={Scale}
    value={formatWeight(totalWeight)}
    label="Peso total"
    tone="neutral"
  />
</div>
```

- [ ] **Step 3: Verificar que no quedan imports de `Card`/`CardContent` huérfanos**

Revisar si `Card` y `CardContent` siguen usándose en el archivo (para el empty state y el close dialog). Si se usan: mantener el import. Solo eliminar si quedaran completamente sin uso.

- [ ] **Step 4: Commit**

```bash
git add src/app/load-manifests/page.tsx
git commit -m "feat(load-manifests): replace flat KPI cards with KpiCard component"
```

---

### Task 3: Agregar búsqueda por texto en el toolbar

**Files:**
- Modify: `src/app/load-manifests/page.tsx`

**Interfaces:**
- Produce: filtro por `manifest.code`, `manifest.carrierName`, `manifest.truckPlate`, `manifest.sapRouteId`
- Consumes: `Input` de `@/components/ui/input` (ya instalado), `Search` icon de lucide-react

- [ ] **Step 1: Agregar estado de búsqueda**

En `page.tsx`, debajo de `const [statusFilter, setStatusFilter] = useState('all')` (línea 41), agregar:
```tsx
const [searchQuery, setSearchQuery] = useState('')
```

- [ ] **Step 2: Agregar `Search` a los imports de lucide**

```tsx
import { Activity, MapPinned, Package, Plus, Scale, Search, TriangleAlert, Truck } from 'lucide-react'
```

Agregar `Input` a los imports de shadcn si no está:
```tsx
import { Input } from '@/components/ui/input'
```

- [ ] **Step 3: Actualizar el `useMemo` de `filtered` para incluir búsqueda**

Reemplazar el `filtered` memo (líneas 63-69) con:

```tsx
const filtered = useMemo(() => {
  const q = searchQuery.trim().toLowerCase()
  return state.loadManifests.filter((m) => {
    const matchStatus = statusFilter === 'all' || m.status === statusFilter
    const matchQuery =
      !q ||
      m.code.toLowerCase().includes(q) ||
      m.carrierName.toLowerCase().includes(q) ||
      m.truckPlate.toLowerCase().includes(q) ||
      m.sapRouteId.toLowerCase().includes(q)
    return matchStatus && matchQuery
  })
}, [state.loadManifests, statusFilter, searchQuery])
```

- [ ] **Step 4: Agregar el Input de búsqueda en el toolbar**

En el toolbar (bloque `{/* Toolbar */}`), agregar el input entre el título y el Select:

```tsx
{/* Toolbar */}
<div className="flex flex-wrap items-center gap-3">
  <div className="flex items-center gap-2 text-base font-semibold">
    <MapPinned className="size-4" /> Manifiestos
    <span className="text-muted-foreground font-normal">({filtered.length})</span>
  </div>
  <div className="relative">
    <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
    <Input
      className="h-8 w-48 pl-8"
      placeholder="Código, transportista, placa..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
    />
  </div>
  <Select value={statusFilter} onValueChange={setStatusFilter}>
    <SelectTrigger className="h-8 w-44">
      <SelectValue placeholder="Estado" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Todos</SelectItem>
      <SelectItem value="pending">Pendiente</SelectItem>
      <SelectItem value="in_progress">En tránsito</SelectItem>
      <SelectItem value="completed">Completado</SelectItem>
      <SelectItem value="cancelled">Cancelado</SelectItem>
    </SelectContent>
  </Select>
  <Button
    size="sm"
    className="ml-auto"
    onClick={() => {
      setCreateError('')
      setCreateOpen(true)
    }}
  >
    <Plus className="mr-1 size-4" /> Nuevo manifiesto
  </Button>
</div>
```

- [ ] **Step 5: Verificar búsqueda**

Escribir "MAN" en el input → debe filtrar por código. Escribir una placa parcial → debe filtrar. Cambiar estado + query → ambos filtros combinados funcionan.

- [ ] **Step 6: Commit**

```bash
git add src/app/load-manifests/page.tsx
git commit -m "feat(load-manifests): add text search filter for code, carrier, plate, route"
```

---

### Task 4: Mejorar header del ManifestCard — separar identidad de metadatos y acciones

**Files:**
- Modify: `src/app/load-manifests/_components/manifest-card.tsx`

**Interfaces:**
- Consumes: `formatDate` de `@/lib/formatters` (importar)
- Consumes: `formatNumber` ya importado
- Mismas props que hoy — sin cambios de interface

- [ ] **Step 1: Agregar import de formatDate**

```tsx
import { formatDate, formatNumber } from '@/lib/formatters'
```

- [ ] **Step 2: Reemplazar el `<CardHeader>` completo**

Reemplazar desde `<CardHeader className="pb-2">` hasta el cierre `</CardHeader>` (líneas 37-76) con:

```tsx
<CardHeader className="pb-3">
  {/* Fila 1: identidad */}
  <div className="flex flex-wrap items-center gap-2">
    <MapPinned className="size-4 text-blue-600" />
    <span className="font-mono text-sm font-semibold">{manifest.code}</span>
    <StatusBadge status={manifest.status} />
    <span className="text-muted-foreground text-xs">{formatDate(manifest.manifestDate)}</span>
    <span className="text-muted-foreground text-xs">·</span>
    <span className="text-muted-foreground text-xs">Ruta SAP: <span className="font-mono">{manifest.sapRouteId}</span></span>
  </div>

  {/* Fila 2: metadatos + acciones */}
  <div className="mt-2 flex flex-wrap items-center gap-2">
    <Badge variant="outline" className="text-xs">{manifest.carrierName}</Badge>
    <Badge variant="outline" className="font-mono text-xs">{manifest.truckPlate}</Badge>
    {manifest.driverName && (
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        <Truck className="size-3" /> {manifest.driverName}
      </span>
    )}
    <span className="text-muted-foreground text-xs">
      {manifest.stops.length} parada{manifest.stops.length !== 1 ? 's' : ''} ·{' '}
      {formatNumber(manifest.totalPackages)} paq. ·{' '}
      {formatNumber(manifest.totalWeightKg)} kg
    </span>
    <div className="ml-auto flex gap-2">
      {canDispatch && (
        <Button size="sm" onClick={() => onDispatch(manifest.id)}>
          <Truck className="mr-1 size-3" /> Despachar
        </Button>
      )}
      {canClose && (
        <Button size="sm" variant="outline" onClick={() => onClose(manifest.id)}>
          <CheckCircle2 className="mr-1 size-3" /> Cerrar manifiesto
        </Button>
      )}
    </div>
  </div>
</CardHeader>
```

- [ ] **Step 3: Verificar render**

Con manifiestos de distintos estados: pending → solo botón Despachar. in_progress → solo botón Cerrar. completed → sin botones. El nombre del conductor aparece si existe.

- [ ] **Step 4: Commit**

```bash
git add src/app/load-manifests/_components/manifest-card.tsx
git commit -m "feat(load-manifests): improve manifest card header layout with two-row structure"
```

---

### Task 5: Mostrar conductor en ManifestCard y datos de volumen

> Nota: Este task está integrado en Task 4 (el `driverName` ya se incluyó en la fila 2 del header). El `totalVolumeM3` se puede agregar como sublabel en el KpiCard de peso si se desea, o mostrarse en la card.

**Files:**
- Modify: `src/app/load-manifests/_components/manifest-card.tsx`

**Interfaces:**
- Consumes: `formatVolume` de `@/lib/formatters`

- [ ] **Step 1: Agregar volumen en la línea de metadatos de la card**

En la línea de metadatos de la fila 2 (del Task 4), extender el span de stats:

```tsx
<span className="text-muted-foreground text-xs">
  {manifest.stops.length} parada{manifest.stops.length !== 1 ? 's' : ''} ·{' '}
  {formatNumber(manifest.totalPackages)} paq. ·{' '}
  {formatNumber(manifest.totalWeightKg)} kg ·{' '}
  {formatVolume(manifest.totalVolumeM3)}
</span>
```

Agregar `formatVolume` al import:
```tsx
import { formatDate, formatNumber, formatVolume } from '@/lib/formatters'
```

- [ ] **Step 2: Commit**

```bash
git add src/app/load-manifests/_components/manifest-card.tsx
git commit -m "feat(load-manifests): show driver name and total volume in manifest card"
```

---

### Task 6: Indicador de progreso de documentos por parada

**Files:**
- Modify: `src/app/load-manifests/_components/manifest-card.tsx`

**Interfaces:**
- Consumes: datos ya disponibles en `stopOrders`, `stopTransfers`, `stopReturns` dentro del `.map()` de stops
- Solo visual — no requiere cambios de tipos ni store

- [ ] **Step 1: Agregar badge de conteo de docs en cada parada**

En el bloque de cada stop (dentro del `.map()` de stops), reemplazar el div de header de parada (líneas 98-109 aprox.) con:

```tsx
<div className="mb-2 flex items-center gap-2">
  <div className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
    {stop.sequence}
  </div>
  <MapPin className="text-muted-foreground size-3.5" />
  <span className="text-sm font-medium">{warehouseName(stop.destinationId)}</span>
  <div className="ml-auto flex items-center gap-2">
    {isEmpty ? (
      <Badge variant="outline" className="text-xs text-amber-600">
        Sin documentos
      </Badge>
    ) : (
      <Badge variant="outline" className="text-xs">
        {stopOrders.length + stopTransfers.length + stopReturns.length} doc{stopOrders.length + stopTransfers.length + stopReturns.length !== 1 ? 's' : ''}
      </Badge>
    )}
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/load-manifests/_components/manifest-card.tsx
git commit -m "feat(load-manifests): show document count badge per manifest stop"
```

---

### Task 7: Ordenar manifiestos por fecha desc con separadores de día

**Files:**
- Modify: `src/app/load-manifests/page.tsx`

**Interfaces:**
- Consumes: `isToday`, `isYesterday` de `date-fns` (ya instalado)
- Consumes: `filtered` — array ya filtrado, solo hay que ordenarlo y agrupar en el render

- [ ] **Step 1: Agregar imports de date-fns**

```tsx
import { isToday, isYesterday, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { format } from 'date-fns'
```

- [ ] **Step 2: Agregar lógica de ordenado y agrupación**

Debajo del `useMemo` de `filtered`, agregar:

```tsx
const groupedManifests = useMemo(() => {
  const sorted = [...filtered].sort(
    (a, b) => b.manifestDate.localeCompare(a.manifestDate)
  )
  const groups: Array<{ label: string; items: typeof sorted }> = []
  for (const m of sorted) {
    const date = parseISO(m.manifestDate)
    const label = isToday(date)
      ? 'Hoy'
      : isYesterday(date)
        ? 'Ayer'
        : format(date, "EEEE d 'de' MMMM", { locale: es })
    const existing = groups.find((g) => g.label === label)
    if (existing) {
      existing.items.push(m)
    } else {
      groups.push({ label, items: [m] })
    }
  }
  return groups
}, [filtered])
```

- [ ] **Step 3: Reemplazar el render de la lista de manifiestos**

Reemplazar el bloque `{filtered.length === 0 ? ... : ...}` (líneas 190-214) con:

```tsx
{filtered.length === 0 ? (
  <Card>
    <CardContent className="text-muted-foreground py-12 text-center text-sm">
      No hay manifiestos con el filtro seleccionado.
    </CardContent>
  </Card>
) : (
  <div className="space-y-6">
    {groupedManifests.map((group) => (
      <div key={group.label} className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            {group.label}
          </span>
          <div className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs">{group.items.length}</span>
        </div>
        {group.items.map((m) => (
          <ManifestCard
            key={m.id}
            manifest={m}
            warehouses={state.warehouses}
            orders={state.commerceOrders}
            transfers={state.transfers}
            returns={state.returnOrders}
            onDispatch={handleDispatch}
            onClose={(id) => {
              const manifest = state.loadManifests.find((x) => x.id === id)
              if (manifest) closeDialog.open({ manifestId: id, code: manifest.code })
            }}
          />
        ))}
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 4: Verificar agrupación**

Con manifiestos de distintas fechas: deben aparecer agrupados "Hoy", "Ayer", o nombre del día en español. Dentro de cada grupo, orden desc por fecha.

- [ ] **Step 5: Commit**

```bash
git add src/app/load-manifests/page.tsx
git commit -m "feat(load-manifests): group manifests by date with day separators, sort desc"
```

---

## Orden de ejecución recomendado

1. Task 1 (bug crítico — SAP Route ID)
2. Task 2 (KPIs)
3. Task 3 (búsqueda)
4. Task 4 (header card)
5. Task 5 (volumen — integrado en Task 4, ejecutar en mismo paso)
6. Task 6 (badge docs por parada)
7. Task 7 (agrupación por fecha)
