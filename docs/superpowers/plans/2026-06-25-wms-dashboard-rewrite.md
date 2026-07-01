# WMS Dashboard Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace analytics (web traffic) content in `src/app/_components/` with real WMS operational data from the Zustand store, keeping the visual style and grid layout intact.

**Architecture:** Rewrite 6 existing components in-place (Approach A). All components become `"use client"` and read from `useWmsStore` via memoized selectors. Zero layout changes in `page.tsx` — only labels and tab names change.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript 5 · Zustand 5 · Recharts (via shadcn ChartContainer) · TailwindCSS 4 · shadcn/ui Cards + Table + Tabs

## Global Constraints

- All UI labels in Spanish (es-CO) — "Órdenes Pendientes", "En Picking", etc.
- Import types exclusively from `src/types/wms.ts` — never redefine inline
- Use `cn()` from `@/lib/utils` for conditional class merging — never template literals
- Use `useShallow` from `zustand/react/shallow` when subscribing to object selectors
- Arrow functions only — no `function` declarations for components
- `"use client"` on every component that reads from store
- No `useEffect` for derived data — compute inline
- Clause guards before happy path: `if (!data) return null`
- No default exports — named exports only (page.tsx is the exception)
- Keep `src/components/ui/` files untouched

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/app/_components/analytics-kpi-strip.tsx` | Modify in-place | 5 WMS KPI cards (orders, picking, OTIF, IRA, alerts) |
| `src/app/_components/analytics-toolbar.tsx` | Modify in-place | Warehouse name badge (simplified) |
| `src/app/_components/traffic-quality.tsx` | Modify in-place | Weekly demand line chart — top 5 products |
| `src/app/_components/realtime-visitors.tsx` | Modify in-place | Operator productivity bar chart + top 4 breakdown |
| `src/app/_components/top-pages.tsx` | Modify in-place | Critical alerts + SLA breach table |
| `src/app/_components/top-traffic-sources.tsx` | Modify in-place | Orders by status horizontal bar chart with tabs |
| `src/app/page.tsx` | Modify | Title, subtitle, tab labels only |

---

## Task 1: WMS KPI Strip

**Files:**
- Modify: `src/app/_components/analytics-kpi-strip.tsx`

**Interfaces:**
- Consumes: `selectDashboardKpis` from `@/store/selectors` → `DashboardKpis`
- Consumes: `useWmsStore` from `@/store/wms-store`
- Produces: `<AnalyticsKpiStrip />` — named export, no props

- [ ] **Step 1: Replace the file content**

```tsx
"use client"

import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { useWmsStore } from "@/store/wms-store"
import { selectDashboardKpis } from "@/store/selectors"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export const AnalyticsKpiStrip = () => {
  const kpis = useWmsStore(selectDashboardKpis)

  if (!kpis) return null

  const otifColor =
    kpis.otif >= 90
      ? "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300"
      : kpis.otif >= 80
        ? "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        : "bg-destructive/10 text-destructive"

  const iraColor =
    kpis.ira >= 95
      ? "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300"
      : kpis.ira >= 90
        ? "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        : "bg-destructive/10 text-destructive"

  const alertsColor =
    kpis.criticalAlerts > 0
      ? "bg-destructive/10 text-destructive"
      : "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300"

  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
      <div className="grid divide-y *:data-[slot=card]:rounded-none *:data-[slot=card]:ring-0 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="font-normal text-sm">Órdenes Pendientes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-2xl leading-none tracking-tight">{kpis.pendingOrders}</div>
              <Badge className="bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                <ArrowUpRight />
                pendientes
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <span>
                picking activo <span className="text-foreground">{kpis.ordersInPicking}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-normal text-sm">En Picking</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-2xl leading-none tracking-tight">{kpis.ordersInPicking}</div>
              <Badge className="bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                <ArrowUpRight />
                activas
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <span>
                parciales <span className="text-foreground">{kpis.partialPickingTasks}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-normal text-sm">OTIF</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-2xl leading-none tracking-tight">{kpis.otif.toFixed(1)}%</div>
              <Badge className={cn(otifColor)}>
                {kpis.otif >= 90 ? <ArrowUpRight /> : <ArrowDownRight />}
                objetivo 90%
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <span>On time in full</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-normal text-sm">IRA</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-2xl leading-none tracking-tight">{kpis.ira.toFixed(1)}%</div>
              <Badge className={cn(iraColor)}>
                {kpis.ira >= 95 ? <ArrowUpRight /> : <ArrowDownRight />}
                objetivo 95%
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <span>Inventory Record Accuracy</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-normal text-sm">Alertas Críticas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-2xl leading-none tracking-tight">{kpis.criticalAlerts}</div>
              <Badge className={cn(alertsColor)}>
                {kpis.criticalAlerts > 0 ? <ArrowUpRight /> : <ArrowDownRight />}
                {kpis.criticalAlerts > 0 ? "activas" : "sin alertas"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <span>
                SLA breaches <span className="text-foreground">{kpis.slaBreaches}</span>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "analytics-kpi-strip"
```
Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/analytics-kpi-strip.tsx
git commit -m "feat(dashboard): replace analytics KPI strip with WMS KPIs from store"
```

---

## Task 2: Toolbar — Warehouse Name Display

**Files:**
- Modify: `src/app/_components/analytics-toolbar.tsx`

**Interfaces:**
- Consumes: `useWmsStore`, `state.warehouses: Warehouse[]`
- Produces: `<AnalyticsToolbar />` — named export, no props

- [ ] **Step 1: Replace the file content**

```tsx
"use client"

import { useWmsStore } from "@/store/wms-store"
import { Badge } from "@/components/ui/badge"
import { Building2 } from "lucide-react"

export const AnalyticsToolbar = () => {
  const warehouses = useWmsStore((s) => s.warehouses)
  const primary = warehouses[0]

  if (!primary) return null

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-normal">
        <Building2 className="size-3.5" />
        {primary.name}
      </Badge>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "analytics-toolbar"
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/analytics-toolbar.tsx
git commit -m "feat(dashboard): simplify toolbar to show warehouse name"
```

---

## Task 3: Weekly Demand Line Chart

**Files:**
- Modify: `src/app/_components/traffic-quality.tsx`

**Interfaces:**
- Consumes: `selectDashboardChartData` from `@/store/selectors` → `DashboardChartData`
- Consumes: `useWmsStore`, `useShallow` from `zustand/react/shallow`
- Produces: `<TrafficQuality />` — named export, no props

**Note:** `selectDashboardChartData().weeklyDemand` is shaped as `{ week: string, [productName: string]: string | number }[]`. Product name keys are dynamic — derive `chartConfig` and line keys at runtime from the first row's keys (excluding `"week"`).

- [ ] **Step 1: Replace the file content**

```tsx
"use client"

import { useWmsStore } from "@/store/wms-store"
import { selectDashboardChartData } from "@/store/selectors"
import { useShallow } from "zustand/react/shallow"
import { CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export const TrafficQuality = () => {
  const { weeklyDemand } = useWmsStore(
    useShallow((s) => selectDashboardChartData(s))
  )

  if (!weeklyDemand || weeklyDemand.length === 0) return null

  const productKeys = Object.keys(weeklyDemand[0]).filter((k) => k !== "week")

  const chartConfig = productKeys.reduce<ChartConfig>((acc, key, i) => {
    acc[key] = { color: CHART_COLORS[i % CHART_COLORS.length], label: key }
    return acc
  }, {})

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal">Demanda Semanal — Top 5 Productos</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-68 w-full">
          <ComposedChart data={weeklyDemand} margin={{ bottom: 0, left: 0, right: 0, top: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="week"
              axisLine={false}
              tickLine={false}
              tickMargin={14}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              width={34}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent className="w-48" />}
            />
            {productKeys.map((key, i) => (
              <Line
                key={key}
                dataKey={key}
                dot={false}
                activeDot={{ r: 4 }}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                type="monotone"
              />
            ))}
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "traffic-quality"
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/traffic-quality.tsx
git commit -m "feat(dashboard): replace traffic quality chart with WMS weekly demand by product"
```

---

## Task 4: Operator Productivity Widget

**Files:**
- Modify: `src/app/_components/realtime-visitors.tsx`

**Interfaces:**
- Consumes: `selectDashboardChartData` → `DashboardChartData.operatorProductivity: ProductivityRow[]`
- `ProductivityRow` shape (from `src/types/wms.ts`): `{ operatorName: string, picksCompleted: number, unitsPicked: number, partialCount: number, issueCount: number }`
- Produces: `<RealtimeVisitors />` — named export, no props

- [ ] **Step 1: Replace the file content**

```tsx
"use client"

import { useWmsStore } from "@/store/wms-store"
import { selectDashboardChartData } from "@/store/selectors"
import { useShallow } from "zustand/react/shallow"
import { Bar, BarChart, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const chartConfig = {
  unitsPicked: {
    color: "var(--chart-3)",
    label: "Unidades",
  },
} satisfies ChartConfig

export const RealtimeVisitors = () => {
  const { operatorProductivity } = useWmsStore(
    useShallow((s) => selectDashboardChartData(s))
  )

  if (!operatorProductivity || operatorProductivity.length === 0) return null

  const top = operatorProductivity[0]
  const top4 = operatorProductivity.slice(0, 4)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal">Productividad de Operadores</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl tabular-nums leading-none tracking-tight">
              {top.unitsPicked}
            </span>
            <span className="text-muted-foreground text-sm">uds. — {top.operatorName}</span>
          </div>
        </div>
        <ChartContainer config={chartConfig} className="h-36 w-full">
          <BarChart
            data={operatorProductivity}
            margin={{ bottom: 0, left: 0, right: 0, top: 0 }}
            barCategoryGap={3}
          >
            <XAxis dataKey="operatorName" hide />
            <YAxis hide />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="unitsPicked" fill="var(--color-unitsPicked)" radius={2} />
          </BarChart>
        </ChartContainer>
        <div className="grid grid-cols-2">
          {top4.map((row, i) => {
            const isLastRow = i >= 2
            const isRightCol = i % 2 === 1
            return (
              <div
                key={row.operatorName}
                className={[
                  "flex items-center gap-3",
                  !isLastRow ? "border-b border-border/50" : "",
                  !isRightCol ? "border-r border-border/50 pr-5" : "pl-5",
                  isLastRow ? "pt-4 pb-1" : "pt-1 pb-4",
                ].join(" ")}
              >
                <span className="size-2 rounded-full bg-chart-3 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm">{row.operatorName}</span>
                <span className="text-sm tabular-nums">{row.unitsPicked}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "realtime-visitors"
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/realtime-visitors.tsx
git commit -m "feat(dashboard): replace realtime visitors with operator productivity widget"
```

---

## Task 5: Critical Alerts + SLA Table

**Files:**
- Modify: `src/app/_components/top-pages.tsx`

**Interfaces:**
- Consumes: `selectDashboardKpis` → `DashboardKpis`
- Consumes: `selectSlaBreaches` from `@/store/selectors` → `SlaBreachRecord[]`
- `SlaBreachRecord` shape: `{ orderId: string, channel: string, fulfillmentType: string, maxHours: number, elapsedHours: number, breachPercent: number, isBreached: boolean, isAtRisk: boolean }`
- Consumes: `state.integrations` filtered for `status === 'error'`
- Produces: `<TopPages />` — named export, no props

- [ ] **Step 1: Replace the file content**

```tsx
"use client"

import { useWmsStore } from "@/store/wms-store"
import { selectDashboardKpis, selectSlaBreaches } from "@/store/selectors"
import { useShallow } from "zustand/react/shallow"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

type AlertRow = {
  id: string
  label: string
  detail: string
  urgency: "critica" | "advertencia" | "info"
}

export const TopPages = () => {
  const kpis = useWmsStore(selectDashboardKpis)
  const { slaBreaches, integrationErrors } = useWmsStore(
    useShallow((s) => ({
      slaBreaches: selectSlaBreaches(s, Date.now()),
      integrationErrors: s.integrations.filter((i) => i.status === "error"),
    }))
  )

  if (!kpis) return null

  const alerts: AlertRow[] = []

  for (const sla of slaBreaches) {
    alerts.push({
      id: `sla-${sla.orderId}`,
      label: sla.isBreached ? "SLA Incumplido" : "SLA en Riesgo",
      detail: `Orden ${sla.orderId} — ${sla.elapsedHours}h / ${sla.maxHours}h (${sla.breachPercent}%)`,
      urgency: sla.isBreached ? "critica" : "advertencia",
    })
  }

  for (const integ of integrationErrors) {
    alerts.push({
      id: `integ-${integ.id}`,
      label: "Error de Integración",
      detail: integ.name,
      urgency: "critica",
    })
  }

  if (kpis.criticalStockItems > 0) {
    alerts.push({
      id: "stock-critical",
      label: "Stock Crítico",
      detail: `${kpis.criticalStockItems} producto(s) bajo mínimo`,
      urgency: "critica",
    })
  }

  if (kpis.expiringItems > 0) {
    alerts.push({
      id: "expiring",
      label: "Próximos a Vencer",
      detail: `${kpis.expiringItems} ítem(s) con vencimiento próximo`,
      urgency: "advertencia",
    })
  }

  if (kpis.inventoryOnHold > 0) {
    alerts.push({
      id: "hold",
      label: "Inventario en Hold",
      detail: `${kpis.inventoryOnHold} unidades bloqueadas`,
      urgency: "info",
    })
  }

  const urgencyBadge = (urgency: AlertRow["urgency"]) => {
    if (urgency === "critica")
      return <Badge className="bg-destructive/10 text-destructive">Crítica</Badge>
    if (urgency === "advertencia")
      return (
        <Badge className="bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          Advertencia
        </Badge>
      )
    return <Badge variant="outline">Info</Badge>
  }

  return (
    <Card className="h-full gap-2">
      <CardHeader>
        <CardTitle className="font-normal">Alertas y SLA</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
          <TableHeader className="[&_tr]:border-border/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 font-normal">Alerta</TableHead>
              <TableHead className="h-8 font-normal">Detalle</TableHead>
              <TableHead className="h-8 w-28 text-right font-normal">Urgencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr]:border-border/50">
            {alerts.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="py-4 text-center text-muted-foreground text-sm">
                  Sin alertas críticas
                </TableCell>
              </TableRow>
            ) : (
              alerts.map((alert) => (
                <TableRow className="hover:bg-transparent" key={alert.id}>
                  <TableCell className="py-4 font-medium">{alert.label}</TableCell>
                  <TableCell className="max-w-0 truncate text-muted-foreground">{alert.detail}</TableCell>
                  <TableCell className="text-right">{urgencyBadge(alert.urgency)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "top-pages"
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/top-pages.tsx
git commit -m "feat(dashboard): replace page performance table with WMS critical alerts and SLA"
```

---

## Task 6: Orders by Status — Horizontal Bar Chart with Tabs

**Files:**
- Modify: `src/app/_components/top-traffic-sources.tsx`

**Interfaces:**
- Consumes: `selectDashboardChartData` → `DashboardChartData.ordersByStatus: { status: string, count: number, fill: string }[]`
- Consumes: `state.pickingTasks` to group by status inline
- Consumes: `state.returnOrders` to group by status inline
- Consumes: `statusLabel` from `@/lib/status`
- Produces: `<TopTrafficSources />` — named export, no props

- [ ] **Step 1: Replace the file content**

```tsx
"use client"

import { useWmsStore } from "@/store/wms-store"
import { selectDashboardChartData } from "@/store/selectors"
import { useShallow } from "zustand/react/shallow"
import { statusLabel } from "@/lib/status"
import { Bar, BarChart, CartesianGrid, LabelList, type LabelProps, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const chartConfig = {
  count: {
    color: "var(--chart-1)",
    label: "Cantidad",
  },
} satisfies ChartConfig

type StatusDatum = { label: string; status: string; count: number }

const renderValueLabel = (props: LabelProps) => {
  const { height, value, y } = props
  return (
    <text
      className="fill-foreground"
      dominantBaseline="middle"
      dx={-6}
      fontSize={14}
      textAnchor="end"
      x="100%"
      y={Number(y) + Number(height) / 2}
    >
      {value}
    </text>
  )
}

const StatusBarChart = ({ data }: { data: StatusDatum[] }) => (
  <ChartContainer config={chartConfig} className="h-64 w-full">
    <BarChart
      accessibilityLayer
      data={data}
      layout="vertical"
      margin={{ left: 0, right: 48 }}
    >
      <CartesianGrid horizontal={false} vertical={false} />
      <YAxis dataKey="status" hide tickLine={false} tickMargin={10} type="category" />
      <XAxis dataKey="count" hide type="number" />
      <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
      <Bar barSize={40} dataKey="count" fill="var(--color-count)" fillOpacity={0.5} radius={8}>
        <LabelList className="fill-foreground" dataKey="status" fontSize={14} offset={12} position="insideLeft" />
        <LabelList content={renderValueLabel} dataKey="label" />
      </Bar>
    </BarChart>
  </ChartContainer>
)

export const TopTrafficSources = () => {
  const { ordersByStatus, pickingData, returnData } = useWmsStore(
    useShallow((s) => {
      const chart = selectDashboardChartData(s)

      const pickingCounts: Record<string, number> = {}
      for (const t of s.pickingTasks) {
        pickingCounts[t.status] = (pickingCounts[t.status] ?? 0) + 1
      }
      const pickingData: StatusDatum[] = Object.entries(pickingCounts).map(([st, count]) => ({
        status: statusLabel(st),
        label: String(count),
        count,
      }))

      const returnCounts: Record<string, number> = {}
      for (const r of s.returnOrders) {
        returnCounts[r.status] = (returnCounts[r.status] ?? 0) + 1
      }
      const returnData: StatusDatum[] = Object.entries(returnCounts).map(([st, count]) => ({
        status: statusLabel(st),
        label: String(count),
        count,
      }))

      return {
        ordersByStatus: chart.ordersByStatus.map((o) => ({
          status: o.status,
          label: String(o.count),
          count: o.count,
        })) as StatusDatum[],
        pickingData,
        returnData,
      }
    })
  )

  return (
    <Card className="h-full gap-2">
      <CardHeader>
        <CardTitle className="font-normal">Distribución por Estado</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Tabs defaultValue="orders" className="flex flex-col gap-3">
          <TabsList className="w-full justify-start border-b px-2.5" variant="line">
            <TabsTrigger className="flex-none font-normal" value="orders">
              Órdenes
            </TabsTrigger>
            <TabsTrigger className="flex-none font-normal" value="picking">
              Picking
            </TabsTrigger>
            <TabsTrigger className="flex-none font-normal" value="devoluciones">
              Devoluciones
            </TabsTrigger>
          </TabsList>
          <TabsContent value="orders" className="px-4">
            <StatusBarChart data={ordersByStatus} />
          </TabsContent>
          <TabsContent value="picking" className="px-4">
            <StatusBarChart data={pickingData} />
          </TabsContent>
          <TabsContent value="devoluciones" className="px-4">
            <StatusBarChart data={returnData} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "top-traffic-sources"
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/top-traffic-sources.tsx
git commit -m "feat(dashboard): replace traffic sources with orders/picking/returns by status"
```

---

## Task 7: Update page.tsx labels and tabs

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- No store connection needed — static labels only
- Imports unchanged — same 6 component names, same paths

- [ ] **Step 1: Replace the file content**

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { AnalyticsKpiStrip } from './_components/analytics-kpi-strip'
import { AnalyticsToolbar } from './_components/analytics-toolbar'
import { RealtimeVisitors } from './_components/realtime-visitors'
import { TopPages } from './_components/top-pages'
import { TopTrafficSources } from './_components/top-traffic-sources'
import { TrafficQuality } from './_components/traffic-quality'

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight">Bienvenido</h1>
        <p className="text-muted-foreground text-sm">
          Operaciones del centro de distribución — estado en tiempo real.
        </p>
      </div>

      <Tabs defaultValue="overview" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="gap-1">
            <TabsTrigger value="overview">Visión General</TabsTrigger>
            <TabsTrigger value="recepcion">Recepción</TabsTrigger>
            <TabsTrigger value="inventario">Inventario</TabsTrigger>
            <TabsTrigger value="envios">Envíos</TabsTrigger>
          </TabsList>

          <AnalyticsToolbar />
        </div>

        <TabsContent value="overview" className="flex flex-col gap-4">
          <AnalyticsKpiStrip />

          <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <TrafficQuality />
            </div>
            <div className="xl:col-span-5">
              <RealtimeVisitors />
            </div>
          </div>

          <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <TopPages />
            </div>
            <div className="xl:col-span-5 xl:col-start-8">
              <TopTrafficSources />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="recepcion">
          <div className="border-border text-muted-foreground flex h-64 items-center justify-center rounded-xl border border-dashed">
            Vista de recepción próximamente.
          </div>
        </TabsContent>

        <TabsContent value="inventario">
          <div className="border-border text-muted-foreground flex h-64 items-center justify-center rounded-xl border border-dashed">
            Vista de inventario próximamente.
          </div>
        </TabsContent>

        <TabsContent value="envios">
          <div className="border-border text-muted-foreground flex h-64 items-center justify-center rounded-xl border border-dashed">
            Vista de envíos próximamente.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles (full project)**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(dashboard): update page title, subtitle, and tab labels to WMS"
```

---

## Task 8: Visual Verification

- [ ] **Step 1: Start dev server**

```bash
cd /Users/carlosgranados/Documents/develop/wms && pnpm dev
```

- [ ] **Step 2: Verify each widget at http://localhost:3000**

Check:
- KPI strip shows 5 cards with numeric WMS data (Órdenes Pendientes, En Picking, OTIF %, IRA %, Alertas Críticas)
- Toolbar shows warehouse name badge
- Left chart (7/12 col) shows multi-line weekly demand with product names in legend
- Right chart (5/12 col) shows operator productivity bars + top 4 name/units breakdown
- Bottom-left table shows alert rows (or "Sin alertas críticas" empty state)
- Bottom-right chart shows Órdenes/Picking/Devoluciones tabs with horizontal bars

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore(dashboard): verify WMS dashboard rewrite complete"
```

---

## Self-Review

- **Spec coverage:** KPI strip ✓, toolbar ✓, weekly demand chart ✓, operator productivity ✓, alerts table ✓, orders-by-status with tabs ✓, page.tsx labels ✓
- **No placeholders:** All steps have complete code blocks
- **Type consistency:** `selectDashboardKpis` returns `DashboardKpis` — all fields (`otif`, `ira`, `criticalAlerts`, `slaBreaches`, `partialPickingTasks`, etc.) used match the interface defined in `src/store/selectors.ts:19-40`. `selectDashboardChartData` returns `DashboardChartData` — `weeklyDemand`, `operatorProductivity`, `ordersByStatus` fields all used as defined. `ProductivityRow` fields `operatorName` and `unitsPicked` match `src/types/wms.ts:833-838`. `SlaBreachRecord` fields used match `src/store/selectors.ts:564-574`.
