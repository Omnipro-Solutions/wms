# KpiCard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescribir `KpiCard` in-place para que use el estilo visual de `AnalyticsKpiStrip` — fondo `bg-card` neutro, icono discreto, badge semántico por tone — sin tocar los 26 call-sites.

**Architecture:** Un solo archivo modificado (`src/components/shared/kpi-card.tsx`). La interfaz pública se mantiene compatible: las props `onClick` y `alert` se eliminan de la interfaz TypeScript (los call-sites que las pasan seguirán compilando porque TypeScript ignora props no declaradas en componentes React cuando se usan como JSX attributes solo si son definidas como `[key: string]: unknown` — NO es así aquí). Por eso se deben limpiar los call-sites que pasan `onClick` y `alert` explícitamente para evitar advertencias de TypeScript. Se limpian solo esas props, sin tocar la lógica del call-site.

**Tech Stack:** React 19, TypeScript 5, TailwindCSS 4, shadcn/ui (`Card`, `Badge`), Lucide React

## Global Constraints

- Todos los classNames via `cn()` de `@/lib/utils` — nunca template literals
- Importar `Badge`, `Card`, `CardContent`, `CardHeader`, `CardTitle` de `@/components/ui/`
- Icono: `size-4 text-muted-foreground` en header inline con el título
- Valor: `text-2xl leading-none tracking-tight` (sin `font-bold`)
- Fondo: siempre `bg-card` — el tone NO toca el fondo
- Dark mode: usar variantes `dark:` en todos los badge colors
- Sin `onClick`, sin `alert`, sin `ChevronRight`

---

## Task 1: Reescribir `KpiCard`

**Files:**
- Modify: `src/components/shared/kpi-card.tsx`

**Interfaces:**
- Produces: `KpiCard({ icon, value, label, sublabel, tone })` — usado por 26 call-sites

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

Reemplazar todo el contenido de `src/components/shared/kpi-card.tsx` con:

```tsx
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  icon: LucideIcon
  value: number | string
  label: string
  sublabel?: string
  tone: 'blue' | 'red' | 'amber' | 'green' | 'neutral'
}

const TONE_BADGE: Record<KpiCardProps['tone'], string> = {
  blue: 'bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  green: 'bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  amber: 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  red: 'bg-destructive/10 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
}

export const KpiCard = ({ icon: Icon, value, label, sublabel, tone }: KpiCardProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-1.5 font-normal text-sm">
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </CardTitle>
    </CardHeader>
    <CardContent className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-2xl leading-none tracking-tight">{value}</div>
        {sublabel && (
          <Badge className={cn(TONE_BADGE[tone])}>{sublabel}</Badge>
        )}
      </div>
    </CardContent>
  </Card>
)
```

- [ ] **Step 2: Verificar que TypeScript compila sin errores**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -40
```

Resultado esperado: errores solo sobre props `onClick`/`alert` no reconocidas en los call-sites (TS2322 o similar). Si hay errores en `kpi-card.tsx` mismo, corregirlos antes de continuar.

- [ ] **Step 3: Commit del componente base**

```bash
git add src/components/shared/kpi-card.tsx
git commit -m "feat(kpi-card): redesign to match dashboard analytics strip style"
```

---

## Task 2: Limpiar props obsoletas en call-sites

**Files:**
- Modify: todos los archivos listados abajo — solo eliminar props `onClick` y `alert` de cada `<KpiCard>`

**Interfaces:**
- Consumes: `KpiCard({ icon, value, label, sublabel, tone })` de Task 1

> **Nota:** No cambiar ninguna lógica de los call-sites. Solo quitar las props `onClick={...}` y `alert={...}` de los JSX elements `<KpiCard>`. El resto del código del archivo queda intacto.

- [ ] **Step 1: Limpiar `src/app/receiving/page.tsx`**

Localizar los 5 `<KpiCard>` y eliminar sus props `onClick` y `alert`:

```tsx
// ANTES (ejemplo):
<KpiCard
  icon={AlertTriangle}
  value={overdueCount}
  label="Entregas con atraso"
  sublabel={overdueCount > 0 ? 'Requieren atención' : 'Sin atrasos'}
  tone={overdueCount > 0 ? 'red' : 'neutral'}
  alert
  onClick={overdueCount > 0 ? () => router.push(pathname + '?tab=citas') : undefined}
/>

// DESPUÉS:
<KpiCard
  icon={AlertTriangle}
  value={overdueCount}
  label="Entregas con atraso"
  sublabel={overdueCount > 0 ? 'Requieren atención' : 'Sin atrasos'}
  tone={overdueCount > 0 ? 'red' : 'neutral'}
/>
```

Hacer lo mismo con los otros 4 `<KpiCard>` en ese archivo (líneas ~278–318).

Si después de limpiar `onClick`/`alert` el import de `useRouter` o `usePathname` queda sin usar, eliminarlo también.

- [ ] **Step 2: Limpiar `src/app/commerce/page.tsx`**

Buscar con: `grep -n "KpiCard\|onClick\|alert=" src/app/commerce/page.tsx`

Eliminar props `onClick` y `alert` de todos los `<KpiCard>` encontrados. Limpiar imports no usados.

- [ ] **Step 3: Limpiar `src/app/inventory/page.tsx`**

Buscar con: `grep -n "KpiCard\|onClick\|alert=" src/app/inventory/page.tsx`

Eliminar props `onClick` y `alert` de todos los `<KpiCard>` encontrados. Limpiar imports no usados.

- [ ] **Step 4: Limpiar `src/app/slotting/page.tsx`**

Buscar con: `grep -n "KpiCard\|onClick\|alert=" src/app/slotting/page.tsx`

Eliminar props `onClick` y `alert` de todos los `<KpiCard>` encontrados. Limpiar imports no usados.

- [ ] **Step 5: Limpiar `src/app/load-manifests/page.tsx`**

Buscar con: `grep -n "KpiCard\|onClick\|alert=" src/app/load-manifests/page.tsx`

Eliminar props `onClick` y `alert` de todos los `<KpiCard>` encontrados. Limpiar imports no usados.

- [ ] **Step 6: Limpiar `src/app/shipping/page.tsx` y `src/app/shipping/_components/otif-dashboard.tsx`**

```bash
grep -n "KpiCard\|onClick\|alert=" src/app/shipping/page.tsx
grep -n "KpiCard\|onClick\|alert=" src/app/shipping/_components/otif-dashboard.tsx
```

Eliminar props `onClick` y `alert` en ambos archivos. Limpiar imports no usados.

- [ ] **Step 7: Limpiar `src/app/integrations/page.tsx`**

```bash
grep -n "KpiCard\|onClick\|alert=" src/app/integrations/page.tsx
```

Eliminar props `onClick` y `alert`. Limpiar imports no usados.

- [ ] **Step 8: Limpiar `src/app/locations/page.tsx`**

```bash
grep -n "KpiCard\|onClick\|alert=" src/app/locations/page.tsx
```

Eliminar props `onClick` y `alert`. Limpiar imports no usados.

- [ ] **Step 9: Limpiar `src/app/packing/page.tsx`**

```bash
grep -n "KpiCard\|onClick\|alert=" src/app/packing/page.tsx
```

Eliminar props `onClick` y `alert`. Limpiar imports no usados.

- [ ] **Step 10: Limpiar archivos de picking (`_components/`)**

```bash
grep -rn "onClick\|alert=" src/app/picking/ --include="*.tsx"
```

Para cada archivo que tenga hits, eliminar las props `onClick` y `alert` de los `<KpiCard>`. Archivos a revisar:
- `src/app/picking/_components/BatchTab.tsx`
- `src/app/picking/_components/ClusterTab.tsx`
- `src/app/picking/_components/PutToStoreTab.tsx`
- `src/app/picking/_components/TasksTab.tsx`
- `src/app/picking/_components/WavelessTab.tsx`
- `src/app/picking/_components/WavesTab.tsx`
- `src/app/picking/_components/ZoneTab.tsx`
- `src/app/picking/page.tsx`

- [ ] **Step 11: Limpiar archivos restantes**

```bash
grep -rn "onClick\|alert=" src/app/admin/page.tsx src/app/returns/page.tsx src/app/serial-trace/page.tsx src/app/transfers/page.tsx src/app/reports/ --include="*.tsx"
```

Eliminar props `onClick` y `alert` de los `<KpiCard>` en cada archivo con hits.

- [ ] **Step 12: Verificar compilación limpia**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep -i "kpi\|onclick\|alert" | head -20
```

Resultado esperado: sin errores relacionados con KpiCard.

- [ ] **Step 13: Commit de limpieza de call-sites**

```bash
git add src/app/
git commit -m "chore(kpi-card): remove onClick and alert props from all call-sites"
```

---

## Task 3: Verificación visual

**Files:** ninguno — solo verificación

- [ ] **Step 1: Iniciar dev server**

```bash
cd /Users/carlosgranados/Documents/develop/wms && pnpm dev
```

- [ ] **Step 2: Revisar módulos con KPIs**

Abrir en browser y verificar en cada módulo que los KPI cards:
- Tienen fondo `bg-card` (mismo que las cards de gráficas del dashboard)
- Icono pequeño visible en el header junto al título
- Badge con color correcto según tone
- `sublabel` aparece dentro del badge
- Sin efectos hover de cursor pointer
- Dark mode correcto (si aplica)

Módulos a verificar:
1. `/` — Dashboard (AnalyticsKpiStrip, no KpiCard — referencia visual)
2. `/receiving` — 5 KPIs
3. `/inventory` — KPIs con tones amber/red/green
4. `/picking` — múltiples tabs con KPIs
5. `/commerce` — KPIs de órdenes
6. `/slotting` — KPIs con alert que ahora son solo informativos
7. `/shipping` — KPIs de OTIF

- [ ] **Step 3: Commit final si hubo ajustes visuales**

```bash
git add -p
git commit -m "fix(kpi-card): visual adjustments after browser review"
```
