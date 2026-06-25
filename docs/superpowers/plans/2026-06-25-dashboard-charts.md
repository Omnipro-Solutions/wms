# Dashboard Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the dashboard from 12 KpiCards to 6 focused KPIs + 4 interactive charts (RadialBar gauge, Area trend, Bar by status, horizontal Bar by operator) using shadcn/ui charts (recharts).

**Architecture:** A new `selectDashboardChartData` selector pre-shapes all chart data; four focused chart components receive typed props with no store access. The dashboard page orchestrates layout only.

**Tech Stack:** Next.js 16 App Router · shadcn/ui charts (recharts) · Zustand selectors · TypeScript 5

## Global Constraints

- All user-facing strings in Spanish (es-CO). Use `STATUS_MAP` from `src/lib/status.ts` for order status labels — never hardcode Spanish strings.
- `cn()` from `@/lib/utils` for all conditional class merging — never template literals.
- No `useEffect` for derived data — use `useMemo`.
- Chart components accept typed props only — no direct store access inside them.
- Each component under 150 lines. Split if larger.
- No new npm dependencies beyond `recharts` (peer dep of shadcn charts).
- Arrow functions everywhere: `const Foo = () => {}`, `const useHook = () => {}`.
- Named exports except page-level files.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/data/seed.ts` | Modify | Add `dashboardHistory` export with 8-week demand + OTIF data |
| `src/store/selectors.ts` | Modify | Add `selectDashboardChartData` + `DashboardChartData` interface |
| `src/components/ui/chart.tsx` | Add (shadcn CLI) | shadcn chart primitives |
| `src/app/_components/otif-ira-gauge.tsx` | Create | RadialBarChart OTIF+IRA |
| `src/app/_components/demand-trend-chart.tsx` | Create | AreaChart top-5 weekly demand |
| `src/app/_components/orders-by-status-chart.tsx` | Create | BarChart orders by status |
| `src/app/_components/operator-productivity-chart.tsx` | Create | Horizontal BarChart operator productivity |
| `src/app/page.tsx` | Modify | 6 KPIs + 4 chart components |

---

## Task 1: Install recharts and add shadcn chart component

**Files:**
- Modify: `package.json` (via pnpm)
- Create: `src/components/ui/chart.tsx` (via shadcn CLI)

**Interfaces:**
- Produces: `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent` available from `@/components/ui/chart`

- [ ] **Step 1: Install recharts**

```bash
cd /Users/carlosgranados/Documents/develop/wms
pnpm add recharts
```

Expected output: `+ recharts X.X.X` added to dependencies.

- [ ] **Step 2: Add shadcn chart component**

```bash
npx shadcn@latest add chart
```

When prompted about overwriting, accept. This creates `src/components/ui/chart.tsx`.

- [ ] **Step 3: Verify chart.tsx exists**

```bash
ls src/components/ui/chart.tsx
```

Expected: file exists.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/ui/chart.tsx
git commit -m "feat(dashboard): install recharts and add shadcn chart component"
```

---

## Task 2: Add seed history data

**Files:**
- Modify: `src/data/seed.ts`

**Interfaces:**
- Produces: `dashboardHistory` exported from `src/data/seed.ts`

```ts
export const dashboardHistory: {
  weeklyOtif: number[]          // length 8, index 0 = 8 weeks ago
  weeklyDemand: Record<string, number[]>  // productId → 8-point array
}
```

- [ ] **Step 1: Add `dashboardHistory` export at the end of `src/data/seed.ts`**

Append after the last existing export:

```ts
// Chart-only historical data — NOT used by selectors or business rules.
// Index 0 = 8 weeks ago, index 7 = current week.
export const dashboardHistory = {
  weeklyOtif: [91, 89, 92, 88, 85, 90, 87, 91],
  weeklyDemand: {
    'p-tshirt': [285, 298, 310, 302, 318, 312, 305, 322],
    'p-socks':  [270, 280, 288, 292, 282, 298, 285, 293],
    'p-cap':    [175, 220, 195, 245, 205, 255, 215, 230],
    'p-jeans':  [105, 122, 112, 128, 118, 125, 115, 122],
    'p-hoodie': [45,  140, 55,  145, 68,  150, 72,  140],
  },
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/data/seed.ts
git commit -m "feat(dashboard): add dashboardHistory seed data for charts"
```

---

## Task 3: Add `selectDashboardChartData` selector

**Files:**
- Modify: `src/store/selectors.ts` (append after existing exports)

**Interfaces:**
- Consumes:
  - `dashboardHistory` from `src/data/seed.ts`
  - `productivityByOperator(tasks: PickingTask[]): ProductivityRow[]` from `src/lib/rules/picking.ts`
  - `WmsState` from `src/store/wms-store`
  - `ProductivityRow` from `src/types/wms`
- Produces:

```ts
export interface DashboardChartData {
  gauges: { name: string; value: number; fill: string }[]
  weeklyDemand: Record<string, string | number>[]  // { week: 'Sem 1', 'Camiseta': 285, ... }
  ordersByStatus: { status: string; count: number; fill: string }[]
  operatorProductivity: ProductivityRow[]
}
export function selectDashboardChartData(state: WmsState): DashboardChartData
```

- [ ] **Step 1: Add imports to `src/store/selectors.ts`**

At the top of `src/store/selectors.ts`, add after existing imports:

```ts
import { productivityByOperator } from '@/lib/rules/picking'
import { dashboardHistory } from '@/data/seed'
import type { ProductivityRow } from '@/types/wms'
```

- [ ] **Step 2: Append `DashboardChartData` interface and selector to `src/store/selectors.ts`**

Add at the end of the file:

```ts
export interface DashboardChartData {
  gauges: { name: string; value: number; fill: string }[]
  weeklyDemand: Record<string, string | number>[]
  ordersByStatus: { status: string; count: number; fill: string }[]
  operatorProductivity: ProductivityRow[]
}

export function selectDashboardChartData(state: WmsState): DashboardChartData {
  const otif = otifPercentage(state.shipments)
  const { ira } = selectInventoryAccuracy(state)

  const gauges = [
    {
      name: 'OTIF',
      value: Math.round(otif * 10) / 10,
      fill: otif >= 90 ? 'var(--color-green-500)' : otif >= 80 ? 'var(--color-amber-500)' : 'var(--color-red-500)',
    },
    {
      name: 'IRA',
      value: Math.round(ira * 10) / 10,
      fill: 'var(--color-blue-500)',
    },
  ]

  // Top-5 products already in seed order (highest pickingFrequency first)
  const top5Ids = Object.keys(dashboardHistory.weeklyDemand)
  const productNames: Record<string, string> = {}
  for (const id of top5Ids) {
    const product = state.products.find((p) => p.id === id)
    productNames[id] = product?.name ?? id
  }

  const weeklyDemand: Record<string, string | number>[] = Array.from({ length: 8 }, (_, i) => {
    const row: Record<string, string | number> = { week: `Sem ${i + 1}` }
    for (const id of top5Ids) {
      row[productNames[id]] = dashboardHistory.weeklyDemand[id][i]
    }
    return row
  })

  const statusCounts = {
    pending: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  }
  for (const o of state.commerceOrders) {
    if (o.status in statusCounts) statusCounts[o.status as keyof typeof statusCounts]++
  }
  const statusLabels: Record<string, string> = {
    pending: 'Pendiente',
    in_progress: 'En progreso',
    completed: 'Completado',
    cancelled: 'Cancelado',
  }
  const statusColors: Record<string, string> = {
    pending: 'var(--color-blue-500)',
    in_progress: 'var(--color-amber-500)',
    completed: 'var(--color-green-500)',
    cancelled: 'var(--color-muted-foreground)',
  }
  const ordersByStatus = Object.entries(statusCounts).map(([key, count]) => ({
    status: statusLabels[key],
    count,
    fill: statusColors[key],
  }))

  const operatorProductivity = productivityByOperator(state.pickingTasks)
    .sort((a, b) => b.unitsPicked - a.unitsPicked)
    .slice(0, 8)

  return { gauges, weeklyDemand, ordersByStatus, operatorProductivity }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/store/selectors.ts
git commit -m "feat(dashboard): add selectDashboardChartData selector"
```

---

## Task 4: OTIF + IRA Gauge component

**Files:**
- Create: `src/app/_components/otif-ira-gauge.tsx`

**Interfaces:**
- Consumes: `gauges: { name: string; value: number; fill: string }[]` (from `DashboardChartData.gauges`)
- Produces: `<OtifIraGauge gauges={...} />` named export

- [ ] **Step 1: Create `src/app/_components/otif-ira-gauge.tsx`**

```tsx
'use client'

import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface Props {
  gauges: { name: string; value: number; fill: string }[]
}

const chartConfig = {
  value: { label: 'Valor' },
} satisfies ChartConfig

export const OtifIraGauge = ({ gauges }: Props) => {
  if (gauges.length === 0) return null

  const otif = gauges.find((g) => g.name === 'OTIF')
  const ira = gauges.find((g) => g.name === 'IRA')

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium">OTIF + IRA</CardTitle>
        <CardDescription>Cumplimiento entrega e inventario</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center gap-8 pb-4">
        <ChartContainer config={chartConfig} className="h-[180px] w-[180px]">
          <RadialBarChart
            data={gauges}
            innerRadius={40}
            outerRadius={80}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" background cornerRadius={4} />
            <ChartTooltip
              content={<ChartTooltipContent nameKey="name" hideLabel />}
            />
          </RadialBarChart>
        </ChartContainer>
        <div className="flex flex-col gap-3">
          {otif && (
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">OTIF</span>
              <span className="text-2xl font-bold" style={{ color: otif.fill }}>
                {otif.value}%
              </span>
            </div>
          )}
          {ira && (
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">IRA</span>
              <span className="text-2xl font-bold" style={{ color: ira.fill }}>
                {ira.value}%
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/otif-ira-gauge.tsx
git commit -m "feat(dashboard): add OtifIraGauge radial chart component"
```

---

## Task 5: Weekly demand trend chart

**Files:**
- Create: `src/app/_components/demand-trend-chart.tsx`

**Interfaces:**
- Consumes: `weeklyDemand: Record<string, string | number>[]` (from `DashboardChartData.weeklyDemand`)
- Produces: `<DemandTrendChart weeklyDemand={...} />` named export

- [ ] **Step 1: Create `src/app/_components/demand-trend-chart.tsx`**

```tsx
'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface Props {
  weeklyDemand: Record<string, string | number>[]
}

const AREA_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

export const DemandTrendChart = ({ weeklyDemand }: Props) => {
  if (weeklyDemand.length === 0) return null

  const productNames = Object.keys(weeklyDemand[0]).filter((k) => k !== 'week')

  const chartConfig = Object.fromEntries(
    productNames.map((name, i) => [name, { label: name, color: AREA_COLORS[i % AREA_COLORS.length] }])
  ) satisfies ChartConfig

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium">Demanda Semanal</CardTitle>
        <CardDescription>Top 5 productos — últimas 8 semanas</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <AreaChart data={weeklyDemand} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {productNames.map((name, i) => (
              <Area
                key={name}
                type="monotone"
                dataKey={name}
                stroke={AREA_COLORS[i % AREA_COLORS.length]}
                fill={AREA_COLORS[i % AREA_COLORS.length]}
                fillOpacity={0.15}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/demand-trend-chart.tsx
git commit -m "feat(dashboard): add DemandTrendChart area chart component"
```

---

## Task 6: Orders by status bar chart

**Files:**
- Create: `src/app/_components/orders-by-status-chart.tsx`

**Interfaces:**
- Consumes: `ordersByStatus: { status: string; count: number; fill: string }[]`
- Produces: `<OrdersByStatusChart ordersByStatus={...} />` named export

- [ ] **Step 1: Create `src/app/_components/orders-by-status-chart.tsx`**

```tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, Cell, CartesianGrid } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface Props {
  ordersByStatus: { status: string; count: number; fill: string }[]
}

const chartConfig = {
  count: { label: 'Órdenes' },
} satisfies ChartConfig

export const OrdersByStatusChart = ({ ordersByStatus }: Props) => {
  if (ordersByStatus.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium">Órdenes por Estado</CardTitle>
        <CardDescription>Distribución actual de órdenes de comercio</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <BarChart
            data={ordersByStatus}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="status" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {ordersByStatus.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/orders-by-status-chart.tsx
git commit -m "feat(dashboard): add OrdersByStatusChart bar chart component"
```

---

## Task 7: Operator productivity horizontal bar chart

**Files:**
- Create: `src/app/_components/operator-productivity-chart.tsx`

**Interfaces:**
- Consumes: `operatorProductivity: { operatorName: string; unitsPicked: number; picksCompleted: number; partialCount: number; issueCount: number }[]`
- Produces: `<OperatorProductivityChart operatorProductivity={...} />` named export

- [ ] **Step 1: Create `src/app/_components/operator-productivity-chart.tsx`**

```tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { ProductivityRow } from '@/types/wms'

interface Props {
  operatorProductivity: ProductivityRow[]
}

const chartConfig = {
  unitsPicked: { label: 'Unidades pickeadas', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig

export const OperatorProductivityChart = ({ operatorProductivity }: Props) => {
  if (operatorProductivity.length === 0) return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium">Productividad por Operador</CardTitle>
        <CardDescription>Sin tareas completadas en este turno</CardDescription>
      </CardHeader>
    </Card>
  )

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium">Productividad por Operador</CardTitle>
        <CardDescription>Unidades pickeadas — top 8 operadores</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <BarChart
            layout="vertical"
            data={operatorProductivity}
            margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="operatorName"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={80}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="unitsPicked" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/operator-productivity-chart.tsx
git commit -m "feat(dashboard): add OperatorProductivityChart horizontal bar component"
```

---

## Task 8: Restructure dashboard page

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: all four chart components + `selectDashboardChartData` from selectors
- Produces: restructured dashboard with 6 KPIs + 4 charts

- [ ] **Step 1: Replace `src/app/page.tsx`**

```tsx
'use client'

import { useMemo } from 'react'
import { useWmsStore } from '@/store/wms-store'
import {
  selectDashboardKpis,
  selectExpiringItems,
  selectCriticalStockItems,
  selectSlaBreaches,
  selectDashboardChartData,
} from '@/store/selectors'
import { KpiCard } from '@/components/shared/kpi-card'
import { PageHeader } from '@/components/shared/page-header'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { OtifIraGauge } from './_components/otif-ira-gauge'
import { DemandTrendChart } from './_components/demand-trend-chart'
import { OrdersByStatusChart } from './_components/orders-by-status-chart'
import { OperatorProductivityChart } from './_components/operator-productivity-chart'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  Snowflake,
  TrendingDown,
  TrendingUp,
  Truck,
  BarChart3,
} from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const state = useWmsStore()
  const { operator } = useCurrentOperator()
  const kpis = useMemo(() => selectDashboardKpis(state), [state])
  const expiring = useMemo(() => selectExpiringItems(state), [state])
  const criticalStock = useMemo(() => selectCriticalStockItems(state), [state])
  const slaBreaches = useMemo(() => selectSlaBreaches(state, Date.now()), [state])
  const chartData = useMemo(() => selectDashboardChartData(state), [state])

  const breached = slaBreaches.filter((s) => s.isBreached)
  const atRisk = slaBreaches.filter((s) => s.isAtRisk && !s.isBreached)

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={operator ? `Hola, ${operator.name}` : 'Dashboard'}
        description="Resumen operativo del almacén"
      />

      {/* Alert banners */}
      {kpis.inventoryFreezeActive && (
        <div className="flex items-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Snowflake className="h-4 w-4" />
          <span className="font-medium">Inventario congelado.</span>
          <span>Las operaciones de ajuste y movimiento están bloqueadas.</span>
          <Link href="/admin" className="ml-auto underline">Descongelar</Link>
        </div>
      )}
      {breached.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">{breached.length} SLA vencido{breached.length > 1 ? 's' : ''}.</span>
          <span>{breached.map((s) => s.orderNumber).join(', ')}</span>
        </div>
      )}
      {atRisk.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Clock className="h-4 w-4" />
          <span className="font-medium">{atRisk.length} orden{atRisk.length > 1 ? 'es' : ''} en riesgo de SLA.</span>
        </div>
      )}
      {expiring.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">{expiring.length} ítem{expiring.length > 1 ? 's' : ''} por vencer.</span>
          <Link href="/inventory/lot-trace" className="ml-auto underline">Ver lotes</Link>
        </div>
      )}
      {criticalStock.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <TrendingDown className="h-4 w-4" />
          <span className="font-medium">{criticalStock.length} producto{criticalStock.length > 1 ? 's' : ''} en stock crítico.</span>
          <Link href="/inventory" className="ml-auto underline">Ver inventario</Link>
        </div>
      )}

      {/* 6 KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiCard
          icon={Truck}
          label="OTIF"
          value={`${kpis.otif.toFixed(1)}%`}
          tone={kpis.otif >= 90 ? 'green' : kpis.otif >= 80 ? 'amber' : 'red'}
        />
        <KpiCard
          icon={CheckCircle2}
          label="IRA exactitud"
          value={`${kpis.ira.toFixed(1)}%`}
          tone={kpis.ira >= 98 ? 'green' : kpis.ira >= 95 ? 'amber' : 'red'}
        />
        <KpiCard icon={Package} label="Órdenes pendientes" value={kpis.pendingOrders} tone="blue" />
        <KpiCard icon={BarChart3} label="Oleadas activas" value={kpis.activeWaves} tone="neutral" />
        <KpiCard
          icon={Clock}
          label="SLA vencidos"
          value={kpis.slaBreaches}
          tone={kpis.slaBreaches > 0 ? 'red' : 'green'}
        />
        <KpiCard
          icon={TrendingDown}
          label="Stock crítico"
          value={kpis.criticalStockItems}
          tone={kpis.criticalStockItems > 0 ? 'red' : 'neutral'}
        />
      </div>

      {/* Charts 2-column grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <OtifIraGauge gauges={chartData.gauges} />
        <DemandTrendChart weeklyDemand={chartData.weeklyDemand} />
        <OrdersByStatusChart ordersByStatus={chartData.ordersByStatus} />
        <OperatorProductivityChart operatorProductivity={chartData.operatorProductivity} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start dev server and verify dashboard renders**

```bash
pnpm dev
```

Open `http://localhost:3000`. Verify:
- 6 KPI cards visible in 3-column grid
- 4 charts render below KPIs in 2-column grid
- Alert banners still appear when applicable
- No console errors

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(dashboard): restructure to 6 KPIs + 4 shadcn charts"
```
