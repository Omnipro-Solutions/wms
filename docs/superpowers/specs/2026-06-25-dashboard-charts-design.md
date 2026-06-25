# Dashboard Charts — Design Spec

**Date:** 2026-06-25  
**Status:** Approved

---

## Goal

Replace the current 12-KpiCard grid with a restructured dashboard: 6 focused KPI cards + 4 interactive charts using shadcn/ui charts (recharts). Priority: throughput operativo — what's moving, how fast, how reliably.

---

## Layout

```
[ Alert banners — conditional, unchanged ]

[ 6 KpiCards — 2 rows × 3 cols on md+ ]
  OTIF % · IRA % · Órdenes pendientes · Oleadas activas · SLA vencidos · Stock crítico

[ RadialBarChart: OTIF + IRA ]    [ AreaChart: Demanda semanal top 5 productos ]
[ BarChart: Órdenes por estado ]  [ BarChart horiz: Productividad por operador ]
```

Charts section: 2-column grid on `md+`, stacked on mobile. Each chart wrapped in shadcn `<Card>` with `<CardHeader>` title + description.

---

## KPI Cards (6)

| Label | Field | Tone logic |
|---|---|---|
| OTIF | `kpis.otif` | `≥90` green · `≥80` amber · red |
| IRA exactitud | `kpis.ira` | `≥98` green · `≥95` amber · red |
| Órdenes pendientes | `kpis.pendingOrders` | blue |
| Oleadas activas | `kpis.activeWaves` | neutral |
| SLA vencidos | `kpis.slaBreaches` | `>0` red · green |
| Stock crítico | `kpis.criticalStockItems` | `>0` red · neutral |

Cards removed from grid (data visible in charts): `ordersInPicking`, `pendingReceipts`, `inventoryOnHold`, `pendingAdjustments`, `returnsInTransit`, `partialPickingTasks`, `criticalAlerts`, `expiringItems`, `misplacedAClassSkus`.

---

## Charts

### 1. OTIF + IRA Gauge — `RadialBarChart`

**File:** `src/app/_components/otif-ira-gauge.tsx`  
**Data source:** `selectDashboardChartData(state).gauges`

```ts
// shape
{ name: 'OTIF', value: 87.3, fill: 'var(--color-otif)' }
{ name: 'IRA',  value: 96.1, fill: 'var(--color-ira)'  }
```

Two radial bars, inner = IRA, outer = OTIF. Domain 0–100. Color: OTIF red/amber/green based on threshold, IRA always blue. Center label shows OTIF % large. Tooltip shows both values.

---

### 2. Demanda Semanal — `AreaChart`

**File:** `src/app/_components/demand-trend-chart.tsx`  
**Data source:** `selectDashboardChartData(state).weeklyDemand`

Top 5 products by `pickingFrequency`. X-axis: 8 weeks ("Sem 1" … "Sem 8"). One area series per product, stacked=false, fillOpacity=0.2. Lines use `demandSamples` extended to 8 points (see seed changes below).

```ts
// shape — one entry per week
{ week: 'Sem 1', [productName]: number, ... }[]
```

Legend shows product names. Tooltip shows all 5 values on hover.

---

### 3. Órdenes por Estado — `BarChart`

**File:** `src/app/_components/orders-by-status-chart.tsx`  
**Data source:** `selectDashboardChartData(state).ordersByStatus`

Single horizontal bar chart. Statuses: `pending`, `in_progress`, `completed`, `cancelled`. Spanish labels via `STATUS_MAP` from `lib/status.ts`. Color per status: pending=blue, in_progress=amber, completed=green, cancelled=muted.

```ts
// shape
{ status: 'Pendiente', count: 12, fill: '...' }[]
```

---

### 4. Productividad por Operador — `BarChart` horizontal

**File:** `src/app/_components/operator-productivity-chart.tsx`  
**Data source:** `selectDashboardChartData(state).operatorProductivity`

Uses existing `productivityByOperator(tasks)` from `lib/rules/picking.ts`. X-axis: unitsPicked. Y-axis: operator name. Sorted descending. Max 8 operators shown. Bar color: green.

```ts
// shape (already matches ProductivityRow from picking.ts)
{ operatorId: string, operatorName: string, unitsPicked: number, tasksCompleted: number }[]
```

---

## New Selector

**File:** `src/store/selectors.ts` — add `selectDashboardChartData`

```ts
export interface DashboardChartData {
  gauges: { name: string; value: number; fill: string }[]
  weeklyDemand: Record<string, number | string>[]  // { week, ...productNames }
  ordersByStatus: { status: string; count: number; fill: string }[]
  operatorProductivity: ProductivityRow[]
}

export function selectDashboardChartData(state: WmsState): DashboardChartData
```

All chart data computed here — zero derivation logic in page.tsx or chart components. Components receive pre-shaped data as props.

---

## Seed Data Changes

**File:** `src/data/seed.ts`

Add `dashboardHistory` export:

```ts
export const dashboardHistory = {
  // 8-week OTIF trend
  weeklyOtif: [91, 89, 92, 88, 85, 90, 87, 91],

  // extend demandSamples per product to 8 points
  // keyed by productId, index = week offset (0 = 8 weeks ago, 7 = current)
  weeklyDemand: {
    'p-001': [280, 295, 310, 305, 320, 315, 308, 322],
    'p-002': [260, 275, 280, 290, 285, 300, 288, 295],
    // ... top 5 products
  }
}
```

Existing `demandStats[].demandSamples` (5 points) remain unchanged — used by XYZ classifier. The `dashboardHistory.weeklyDemand` is chart-only display data.

---

## Dependencies

```bash
# Install recharts (peer dep of shadcn charts)
pnpm add recharts

# Add shadcn chart component
npx shadcn@latest add chart
```

This adds `src/components/ui/chart.tsx` with `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`.

---

## File Changes Summary

| File | Action |
|---|---|
| `src/app/page.tsx` | Restructure: 6 KPIs + import 4 chart components |
| `src/store/selectors.ts` | Add `selectDashboardChartData` |
| `src/data/seed.ts` | Add `dashboardHistory` export |
| `src/app/_components/otif-ira-gauge.tsx` | New |
| `src/app/_components/demand-trend-chart.tsx` | New |
| `src/app/_components/orders-by-status-chart.tsx` | New |
| `src/app/_components/operator-productivity-chart.tsx` | New |
| `src/components/ui/chart.tsx` | Added by shadcn CLI |

---

## Constraints

- All Spanish labels (es-CO). Use `STATUS_MAP` for order statuses, never hardcode.
- `cn()` for all conditional classes.
- No `useEffect` for derived data — all chart data via `useMemo(() => selectDashboardChartData(state), [state])`.
- Chart components accept typed props, no direct store access inside them.
- Components under 150 lines; split if larger.
- No new dependencies beyond recharts (already required by shadcn charts).
