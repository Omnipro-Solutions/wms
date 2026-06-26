"use client"

import {
  ArrowDownRight, ArrowUpRight, BoxIcon, Layers, PackageCheck,
  PackageX, TriangleAlert, Warehouse,
} from "lucide-react"
import {
  CartesianGrid, Label, Line, LineChart, Pie, PieChart, XAxis, YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useDashboardFilters } from "./dashboard-filters"

const seed = (wh: string, days: number) =>
  (wh.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 31 + days) % 997
const j = (base: number, pct: number, s: number) =>
  Math.max(0, Math.round(base * (1 + ((s % 100) / 100 - 0.5) * pct)))

// ─── KPI strip ───────────────────────────────────────────────────────────────
const InventarioKpis = () => {
  const { warehouseId, days } = useDashboardFilters()
  const s = seed(warehouseId, days)
  const kpis = [
    { label: "SKUs Activos",       value: j(1840, 0.1, s),       icon: BoxIcon,      color: "bg-blue-500/10 text-blue-700 dark:text-blue-300",   trend: "+3.1%",  up: true  },
    { label: "En Stock",           value: j(28400, 0.15, s+1),   icon: PackageCheck, color: "bg-green-500/10 text-green-700 dark:text-green-300", trend: "+6.4%",  up: true  },
    { label: "Bajo Mínimo",        value: j(23, 0.5, s+2),       icon: TriangleAlert,color: "bg-amber-500/10 text-amber-700 dark:text-amber-300", trend: "+2 SKU", up: false },
    { label: "Agotados",           value: j(8, 0.6, s+3),        icon: PackageX,     color: "bg-destructive/10 text-destructive",                 trend: "-1 SKU", up: true  },
    { label: "En Hold",            value: j(847, 0.3, s+4),      icon: Warehouse,    color: "bg-amber-500/10 text-amber-700 dark:text-amber-300", trend: "+0.8%",  up: false },
  ]
  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
      <div className="grid divide-y *:data-[slot=card]:rounded-none *:data-[slot=card]:ring-0 md:grid-cols-3 md:divide-x md:divide-y-0 xl:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader><CardTitle className="font-normal text-sm">{k.label}</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-2xl leading-none tracking-tight tabular-nums">{k.value.toLocaleString()}</div>
                <Badge className={k.color}>
                  {k.up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {k.trend}
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <k.icon className="size-3" />
                <span>vs período anterior</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Distribución por zona (donut) ────────────────────────────────────────────
const zonaConfig = {
  amount: { label: "Unidades" },
  zonaA: { color: "var(--chart-1)", label: "Zona A — Pick" },
  zonaB: { color: "var(--chart-2)", label: "Zona B — Reserva" },
  zonaC: { color: "var(--chart-3)", label: "Zona C — QC" },
  zonaD: { color: "var(--chart-4)", label: "Zona D — Staging" },
} satisfies ChartConfig

const ZonaDistributionCard = () => {
  const { warehouseId, days } = useDashboardFilters()
  const s = seed(warehouseId, days)
  const raw = [
    { key: "zonaA", label: "Zona A — Pick",    base: 12400 },
    { key: "zonaB", label: "Zona B — Reserva", base: 9800  },
    { key: "zonaC", label: "Zona C — QC",      base: 3200  },
    { key: "zonaD", label: "Zona D — Staging", base: 2000  },
  ]
  const data = raw.map((z, i) => ({
    ...z,
    amount: j(z.base, 0.2, s + i),
    fill: `var(--color-${z.key})`,
  }))
  const total = data.reduce((a, b) => a + b.amount, 0)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal">Distribución por Zona</CardTitle>
      </CardHeader>
      <CardContent className="grid items-center gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
        <ChartContainer config={zonaConfig} className="mx-auto aspect-square h-50">
          <PieChart>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel className="w-52" nameKey="label" />} />
            <Pie cornerRadius={6} data={data} dataKey="amount" innerRadius={65} nameKey="label"
              outerRadius={90} paddingAngle={2} strokeWidth={5}>
              <Label content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox)) return null
                return (
                  <text dominantBaseline="middle" textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
                    <tspan className="fill-muted-foreground text-xs" x={viewBox.cx} y={(viewBox.cy ?? 0) - 8}>Total</tspan>
                    <tspan className="fill-foreground font-medium text-lg tabular-nums" x={viewBox.cx} y={(viewBox.cy ?? 0) + 14}>
                      {(total / 1000).toFixed(1)}k
                    </tspan>
                  </text>
                )
              }} />
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="flex min-w-0 flex-col gap-3">
          {data.map((item) => {
            const pct = Math.round((item.amount / total) * 100)
            return (
              <div className="grid grid-cols-[1fr_auto] items-end gap-3" key={item.key}>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="h-2 w-1 rounded-full" style={{ backgroundColor: item.fill }} />
                    <p className="truncate text-muted-foreground text-xs">{item.label}</p>
                  </div>
                  <p className="font-medium tabular-nums">{item.amount.toLocaleString()} uds.</p>
                </div>
                <div className="font-medium tabular-nums">{pct}%</div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Movimientos de stock — línea doble ──────────────────────────────────────
const movConfig = {
  entradas: { color: "var(--chart-2)", label: "Entradas" },
  salidas:  { color: "var(--chart-4)", label: "Salidas"  },
} satisfies ChartConfig

const DAY_MS = 24 * 60 * 60 * 1000
const MOV_DATA = [
  { entradas: 320, salidas: 280 }, { entradas: 410, salidas: 350 },
  { entradas: 280, salidas: 310 }, { entradas: 520, salidas: 420 },
  { entradas: 390, salidas: 360 }, { entradas: 450, salidas: 400 },
  { entradas: 310, salidas: 290 },
]

const MovimientosChart = () => {
  const weekStart = Date.UTC(2026, 5, 19) // fixed reference
  const ticks = Array.from({ length: 7 }, (_, i) => weekStart + (i + 0.5) * DAY_MS)
  const data = MOV_DATA.map((d, i) => ({ ...d, timestamp: weekStart + i * DAY_MS + DAY_MS / 2 }))
  const domain: [number, number] = [weekStart, weekStart + 7 * DAY_MS]
  const fmt = new Intl.DateTimeFormat("es-CO", { weekday: "short", timeZone: "UTC" })

  return (
    <Card className="h-full">
      <CardHeader><CardTitle className="font-normal">Movimientos de Stock</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={movConfig} className="h-50 w-full">
          <LineChart data={data} margin={{ bottom: 0, left: 0, right: 0, top: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis axisLine={false} dataKey="timestamp" domain={domain} scale="time" type="number"
              tickFormatter={(v) => fmt.format(new Date(v))} tickLine={false} tickMargin={10}
              ticks={ticks} tick={{ fontSize: 12 }} />
            <YAxis hide />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Line connectNulls dataKey="entradas" dot={false} stroke="var(--color-entradas)"
              strokeWidth={2} type="linear" />
            <Line dataKey="salidas" dot={false} stroke="var(--color-salidas)"
              strokeDasharray="5 5" strokeWidth={1.5} type="linear" />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ─── Breakdown por categoría ─────────────────────────────────────────────────
const CATEGORIAS = [
  { label: "Ropa y Textiles · 42%", amount: "11,680 uds.", color: "bg-chart-3" },
  { label: "Calzado · 28%",         amount: "7,784 uds.", color: "bg-chart-3/75" },
  { label: "Accesorios · 30%",      amount: "8,348 uds.", color: "bg-chart-3/50" },
]

const CategoriaBreakdown = () => (
  <Card className="h-full">
    <CardHeader><CardTitle className="font-normal">Categorías de Inventario</CardTitle></CardHeader>
    <CardContent className="grid grid-cols-1 gap-1 md:grid-cols-3">
      {CATEGORIAS.map((cat) => (
        <section key={cat.label} className="isolate flex gap-[0.5px]">
          <Separator orientation="vertical" className="mb-1 h-auto self-auto border-muted-foreground/50 border-l border-dashed bg-transparent" />
          <div className="flex min-h-24 flex-1 flex-col justify-between">
            <div className="flex min-w-0 flex-col gap-1 px-1">
              <p className="wrap-break-word text-muted-foreground text-xs leading-none">{cat.label}</p>
              <div className="text-lg leading-none tracking-tight">{cat.amount}</div>
            </div>
            <div className={`-ml-0.5 h-5 rounded-sm ${cat.color}`} />
          </div>
        </section>
      ))}
    </CardContent>
  </Card>
)

// ─── Precisión de inventario gauge ───────────────────────────────────────────
const IraGauge = () => {
  const { warehouseId, days } = useDashboardFilters()
  const s = seed(warehouseId, days)
  const exacto = j(760, 0.2, s)
  const diferencia = j(180, 0.4, s + 1)
  const faltante = j(60, 0.5, s + 2)
  const total = exacto + diferencia + faltante
  const pct = Math.round((exacto / total) * 100)
  const segs = Array.from({ length: 32 }, (_, i) => {
    const eSegs = Math.round((exacto / total) * 32)
    const dSegs = Math.round((diferencia / total) * 32)
    return {
      value: 1,
      fill: i < eSegs ? "var(--chart-2)" : i < eSegs + dSegs ? "var(--chart-1)" : "var(--destructive)",
    }
  })

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Precisión de Inventario (IRA)</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {pct}% exacto
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ChartContainer config={{}} className="mx-auto h-30 w-full">
          <PieChart>
            <Pie cx="50%" cy="100%" cornerRadius={6} data={segs} dataKey="value"
              endAngle={0} innerRadius={80} outerRadius={110} paddingAngle={2}
              startAngle={180} stroke="var(--card)" strokeWidth={1}>
              <Label content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox)) return null
                return (
                  <text textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
                    <tspan className="fill-foreground font-medium text-2xl tabular-nums" x={viewBox.cx} y={(viewBox.cy ?? 0) + 22}>{pct}%</tspan>
                    <tspan className="fill-muted-foreground text-xs" x={viewBox.cx} y={(viewBox.cy ?? 0) + 38}>IRA</tspan>
                  </text>
                )
              }} />
            </Pie>
          </PieChart>
        </ChartContainer>
        <Separator />
        <div className="grid grid-cols-3 divide-x text-center">
          {[
            { icon: PackageCheck, label: "Exacto",      value: exacto,      color: "text-green-600" },
            { icon: Layers,       label: "Diferencia",  value: diferencia,  color: "text-amber-500" },
            { icon: PackageX,     label: "Faltante",    value: faltante,    color: "text-destructive" },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-3">
              <div className="grid size-9 place-items-center rounded-full bg-muted">
                <item.icon className={`size-4 ${item.color}`} />
              </div>
              <div>
                <div className="text-muted-foreground text-xs leading-none">{item.label}</div>
                <div className="font-medium text-sm tabular-nums">{item.value.toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────
export const TabInventario = () => (
  <div className="flex flex-col gap-4">
    <InventarioKpis />
    <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
      <div className="xl:col-span-7"><ZonaDistributionCard /></div>
      <div className="xl:col-span-5"><IraGauge /></div>
    </div>
    <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
      <div className="xl:col-span-7"><MovimientosChart /></div>
      <div className="xl:col-span-5"><CategoriaBreakdown /></div>
    </div>
  </div>
)
