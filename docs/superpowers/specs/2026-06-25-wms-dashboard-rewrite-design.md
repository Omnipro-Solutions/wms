# WMS Dashboard Rewrite — Design Spec

**Date:** 2026-06-25  
**Approach:** A — Replace data in existing components, preserve layout structure

---

## Goal

Replace analytics (web traffic) content in the homepage dashboard with real WMS operational data from the Zustand store. Keep the visual style, card structure, and grid layout intact.

---

## Architecture

### Constraint
Zero changes to `page.tsx` grid layout. All 6 components in `src/app/_components/` are rewritten in-place. No new files added except where unavoidable.

### Store connection pattern
Every component:
- Adds `"use client"` directive
- Reads from `useWmsStore` with the appropriate selector
- Uses clause guard `if (!data) return null` (store always has seed data, no loading state needed)
- No `useEffect`, no prop drilling

---

## Components

### 1. `analytics-kpi-strip.tsx` → WMS KPI Strip

5 KPIs in horizontal grid — same card structure, same badge pattern.

| Position | Label | Value | Badge color rule |
|---|---|---|---|
| 1 | Órdenes Pendientes | `kpis.pendingOrders` | blue (neutral) |
| 2 | En Picking | `kpis.ordersInPicking` | amber |
| 3 | OTIF | `kpis.otif`% | green ≥90 / amber ≥80 / red <80 |
| 4 | IRA | `kpis.ira`% | green ≥95 / amber ≥90 / red <90 |
| 5 | Alertas Críticas | `kpis.criticalAlerts` | red if >0, gray if 0 |

Badge secondary text: show threshold ("objetivo 90%") since no historical comparison exists.

Data source: `selectDashboardKpis`

---

### 2. `traffic-quality.tsx` → Demanda Semanal — Top 5 Productos

Replace the dual-line traffic quality chart with a multi-series line chart showing 8 weeks of demand for the top 5 products.

- Chart type: `ComposedChart` with one `Line` per product (same component already used)
- X axis: weeks (`Sem 1` … `Sem 8`) — already formatted in selector output
- Y axis: units picked
- Data: `selectDashboardChartData().weeklyDemand` — already shaped as `{ week, "Prod A": n, ... }`
- Product keys are dynamic (product names from store) — derive `chartConfig` from the data keys at runtime
- Title: **"Demanda Semanal — Top 5 Productos"**

---

### 3. `realtime-visitors.tsx` → Productividad de Operadores

Replace realtime bar chart + country breakdown with operator productivity.

- Headline number: total units picked by top operator
- Bar chart: `BarChart` vertical, one bar per operator (top 8), barred by `unitsPicked`
- Bottom 2×2 grid: top 4 operators with name + units (replaces country flags grid)
- Remove animated ping dot and "Live" label — not applicable
- Data: `selectDashboardChartData().operatorProductivity`

---

### 4. `top-pages.tsx` → Alertas y SLA

Replace page performance table with critical alerts list.

- Same `<Table>` structure, same card shell
- Columns: **Alerta** | **Detalle** | **Urgencia**
- Rows built from `selectDashboardKpis`:
  - SLA breaches (`slaBreaches > 0`) → one row per breach from `selectSlaBreaches`
  - Integration errors (`state.integrations.filter(i => i.status === 'error')`)
  - Critical stock items (`criticalStockItems > 0`)
  - Expiring items (`expiringItems > 0`)
  - Inventory on hold (`inventoryOnHold > 0`)
- Urgency column: `<StatusBadge>` or inline badge with `critical / warning / info` tone
- Empty state: single row "Sin alertas críticas" with green badge
- Title: **"Alertas y SLA"**

---

### 5. `top-traffic-sources.tsx` → Órdenes por Estado

Replace traffic sources horizontal bar chart with order distribution by status, with tabs for different entity types.

- Same card + Tabs shell (line variant tabs)
- Tab 1 **Órdenes**: horizontal `BarChart` with `LabelList` — `ordersByStatus` from `selectDashboardChartData()`
- Tab 2 **Picking**: picking tasks grouped by status (pending / in_progress / completed / partial) — computed inline from `state.pickingTasks`
- Tab 3 **Devoluciones**: return orders grouped by status — computed inline from `state.returnOrders`
- Each tab reuses the same `<HorizontalBarChart>` sub-component pattern from `TrafficSourceBarChart`
- Title: **"Distribución por Estado"**

---

### 6. `analytics-toolbar.tsx` → Simplify

Remove date range picker and analytics-specific controls. Replace with a read-only warehouse name display (`state.warehouses[0]?.name` or first warehouse). No filtering behavior — cosmetic only for now.

---

## `page.tsx` changes

Minimal — data only:
- Greeting: `"Bienvenido"` (static, no operator name lookup to avoid complexity)
- Subtitle: `"Operaciones del centro de distribución — estado en tiempo real"`
- Tab labels: `Visión General | Recepción | Inventario | Envíos`
- Non-overview tabs: keep existing "coming soon" placeholder pattern

---

## Data flow

```
useWmsStore(selectDashboardKpis)         → KPI Strip, Alerts table
useWmsStore(selectDashboardChartData)    → Weekly demand chart, Operator productivity, Orders by status
useWmsStore(state => state.integrations) → Alerts table (integration errors)
useWmsStore(selectSlaBreaches)           → Alerts table (SLA rows)
useWmsStore(state => state.pickingTasks) → Picking tab in Orders by Status
useWmsStore(state => state.returnOrders) → Returns tab in Orders by Status
```

`selectDashboardChartData` called in two separate components — fine since Zustand memoizes by reference. Use `useShallow` if object equality causes unnecessary re-renders.

---

## Out of scope

- Real-time polling or websocket updates
- Warehouse filtering (toolbar shows name, does not filter)
- Historical comparison badges (show target thresholds instead)
- Filling in Recepción / Inventario / Envíos tabs
- Any changes to `src/components/ui/` primitives
