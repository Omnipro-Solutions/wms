"use client"

import { useMemo } from "react"
import { format, subMinutes } from "date-fns"
import { es } from "date-fns/locale"
import {
  ArrowDownRight, ArrowUpRight, CheckCircle2, Clock, PackageCheck,
  PackageX, TriangleAlert, Truck,
} from "lucide-react"
import {
  Area, AreaChart, Bar, CartesianGrid, ComposedChart,
  Label, Pie, PieChart, XAxis, YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent,
  ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useDashboardFilters } from "./dashboard-filters"

// ─── seed helper (same pattern as dashboard-mock-data) ───────────────────────
const seed = (wh: string, days: number) =>
  (wh.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 31 + days) % 997
const j = (base: number, pct: number, s: number) =>
  Math.max(0, Math.round(base * (1 + ((s % 100) / 100 - 0.5) * pct)))

// ─── KPI strip ───────────────────────────────────────────────────────────────
const RecepcionKpis = () => {
  const { warehouseId, days } = useDashboardFilters()
  const s = seed(warehouseId, days)
  const sc = days / 30
  const kpis = [
    { label: "ASNs Recibidos",     value: j(Math.round(84 * sc), 0.3, s),     icon: Truck,        color: "bg-blue-500/10 text-blue-700 dark:text-blue-300",   trend: "+5.2%",   up: true  },
    { label: "Líneas Procesadas",  value: j(Math.round(1240 * sc), 0.25, s+1), icon: PackageCheck, color: "bg-green-500/10 text-green-700 dark:text-green-300", trend: "+8.1%",   up: true  },
    { label: "En QC",              value: j(12, 0.5, s+2),                     icon: Clock,        color: "bg-amber-500/10 text-amber-700 dark:text-amber-300", trend: "-2 uds",  up: false },
    { label: "Discrepancias",      value: j(Math.round(7 * sc), 0.6, s+3),     icon: TriangleAlert,color: "bg-destructive/10 text-destructive",                 trend: "+0.4%",   up: false },
    { label: "Completados Hoy",    value: j(Math.round(18 * sc), 0.35, s+4),   icon: CheckCircle2, color: "bg-green-500/10 text-green-700 dark:text-green-300", trend: "+12.3%",  up: true  },
  ]

  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
      <div className="grid divide-y *:data-[slot=card]:rounded-none *:data-[slot=card]:ring-0 md:grid-cols-3 md:divide-x md:divide-y-0 xl:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader>
              <CardTitle className="font-normal text-sm">{k.label}</CardTitle>
            </CardHeader>
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

// ─── Actividad de recepción por hora (AreaChart) ──────────────────────────────
const RECEPTION_INTERVAL = 30 // minutes
const RECEPTION_POINTS = [
  8, 15, 42, 78, 95, 112, 88, 134, 156, 142, 98, 76,
  110, 145, 167, 188, 154, 122, 98, 74, 52, 38, 22, 14,
  8, 4, 2, 1, 0, 0, 0, 3,
] as const

const receptionConfig = {
  unidades: { label: "Unidades", color: "var(--chart-2)" },
  incidencias: { label: "Incidencias", color: "var(--destructive)" },
} satisfies ChartConfig

const ReceptionActivityChart = () => {
  const data = useMemo(() => {
    const now = new Date()
    return RECEPTION_POINTS.map((val, i) => ({
      timestamp: subMinutes(now, (RECEPTION_POINTS.length - 1 - i) * RECEPTION_INTERVAL).toISOString(),
      unidades: val,
      incidencias: Math.round(val * 0.04),
    }))
  }, [])

  const first = data[0].timestamp
  const last = data.at(-1)?.timestamp ?? ""

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Actividad de Recepción</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {RECEPTION_POINTS.reduce((a, b) => a + b, 0).toLocaleString()} uds. hoy
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={receptionConfig} className="h-54 w-full">
          <AreaChart data={data} margin={{ bottom: 0, left: 0, right: 0, top: 8 }}>
            <defs>
              <linearGradient id="fillRecepcion" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-unidades)" stopOpacity={0.28} />
                <stop offset="95%" stopColor="var(--color-unidades)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="timestamp"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => v === first ? "hace 16h" : v === last ? "ahora" : ""}
              tickLine={false}
              tickMargin={10}
              ticks={[first, last]}
            />
            <YAxis axisLine={false} tickLine={false} tickMargin={6} width={36} />
            <ChartTooltip
              content={<ChartTooltipContent labelFormatter={(v) => format(new Date(String(v)), "HH:mm", { locale: es })} />}
              cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
            />
            <ChartLegend align="right" verticalAlign="top" className="justify-end" content={<ChartLegendContent />} />
            <Area dataKey="unidades" dot={false} fill="url(#fillRecepcion)" stroke="var(--color-unidades)" strokeWidth={2} type="stepAfter" />
            <Area dataKey="incidencias" dot={false} fill="none" stroke="var(--color-incidencias)" strokeWidth={1.2} type="stepAfter" />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ─── Gauge disponibilidad muelle ─────────────────────────────────────────────
const DockGauge = () => {
  const { warehouseId, days } = useDashboardFilters()
  const s = seed(warehouseId, days)
  const libre = j(6, 0.4, s)
  const ocupado = j(8, 0.3, s + 1)
  const mantenimiento = j(2, 0.6, s + 2)
  const total = libre + ocupado + mantenimiento
  const pct = Math.round((libre / total) * 100)
  const segments = Array.from({ length: 32 }, (_, i) => {
    const libreSegs = Math.round((libre / total) * 32)
    const ocupSegs = Math.round((ocupado / total) * 32)
    const status = i < libreSegs ? "libre" : i < libreSegs + ocupSegs ? "ocupado" : "mant"
    return { value: 1, fill: status === "libre" ? "var(--chart-2)" : status === "ocupado" ? "var(--chart-1)" : "var(--destructive)" }
  })

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Muelles de Descarga</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {pct}% disponible
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ChartContainer config={{}} className="mx-auto h-30 w-full">
          <PieChart>
            <Pie cx="50%" cy="100%" cornerRadius={6} data={segments} dataKey="value"
              endAngle={0} innerRadius={80} outerRadius={110} paddingAngle={2}
              startAngle={180} stroke="var(--card)" strokeWidth={1}>
              <Label content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox)) return null
                return (
                  <text textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
                    <tspan className="fill-foreground font-medium text-2xl tabular-nums" x={viewBox.cx} y={(viewBox.cy ?? 0) + 22}>{pct}%</tspan>
                    <tspan className="fill-muted-foreground text-xs" x={viewBox.cx} y={(viewBox.cy ?? 0) + 38}>Libre</tspan>
                  </text>
                )
              }} />
            </Pie>
          </PieChart>
        </ChartContainer>
        <Separator />
        <div className="grid grid-cols-3 divide-x text-center">
          {[
            { icon: PackageCheck, label: "Libre",    value: libre,      color: "text-green-600" },
            { icon: Truck,        label: "Ocupado",  value: ocupado,    color: "text-amber-500" },
            { icon: PackageX,     label: "Mant.",    value: mantenimiento, color: "text-destructive" },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-3">
              <div className="grid size-9 place-items-center rounded-full bg-muted">
                <item.icon className={`size-4 ${item.color}`} />
              </div>
              <div>
                <div className="text-muted-foreground text-xs leading-none">{item.label}</div>
                <div className="font-medium text-sm tabular-nums">{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Top SKUs recibidos ───────────────────────────────────────────────────────
const topSkuConfig = { unidades: { color: "var(--chart-1)", label: "Uds" } } satisfies ChartConfig
const TOP_SKUS = [
  { sku: "Camiseta Básica",       unidades: 840, proveedor: "Textiles SA" },
  { sku: "Zapatilla Running",     unidades: 620, proveedor: "Deportes Ltda" },
  { sku: "Pantalón Cargo",        unidades: 510, proveedor: "Moda Express" },
  { sku: "Chaqueta Impermeable",  unidades: 380, proveedor: "OutdoorCo" },
  { sku: "Mochila Urbana",        unidades: 290, proveedor: "Accesorios Plus" },
]

const TopSkusRecibidos = () => {
  const { warehouseId, days } = useDashboardFilters()
  const s = seed(warehouseId, days)
  const sc = days / 30
  const data = TOP_SKUS.map((item, i) => ({
    ...item,
    unidades: j(Math.round(item.unidades * sc), 0.3, s + i),
  }))

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Top SKUs Recibidos</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {data.reduce((a, b) => a + b.unidades, 0).toLocaleString()} uds. totales
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ChartContainer config={topSkuConfig} className="h-36 w-full">
          <ComposedChart data={data} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
            <CartesianGrid horizontal={false} vertical={false} />
            <XAxis dataKey="unidades" hide type="number" />
            <YAxis dataKey="sku" hide type="category" />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
            <Bar barSize={16} dataKey="unidades" fill="var(--color-unidades)" fillOpacity={0.7} radius={4} />
          </ComposedChart>
        </ChartContainer>
        <Separator />
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-3 text-xs">
          <div className="text-muted-foreground">SKU</div>
          <div className="text-muted-foreground">Proveedor</div>
          <div className="text-muted-foreground">Uds.</div>
          {data.map((item) => (
            <div className="contents text-sm" key={item.sku}>
              <div className="truncate font-medium">{item.sku}</div>
              <div className="text-muted-foreground text-xs self-center">{item.proveedor}</div>
              <div className="font-medium tabular-nums self-center">{item.unidades.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────
export const TabRecepcion = () => (
  <div className="flex flex-col gap-4">
    <RecepcionKpis />
    <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
      <div className="xl:col-span-7"><ReceptionActivityChart /></div>
      <div className="xl:col-span-5"><DockGauge /></div>
    </div>
    <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
      <div className="xl:col-span-12"><TopSkusRecibidos /></div>
    </div>
  </div>
)
