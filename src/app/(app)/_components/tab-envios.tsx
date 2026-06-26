"use client"

import { useMemo } from "react"
import { format, subMinutes } from "date-fns"
import { es } from "date-fns/locale"
import {
  ArrowDownRight, ArrowUpRight, CheckCircle2, Clock,
  PackageCheck, Truck, AlertTriangle,
} from "lucide-react"
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid,
  LabelList, type LabelProps, XAxis, YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent,
  ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useDashboardFilters } from "./dashboard-filters"

const seed = (wh: string, days: number) =>
  (wh.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 31 + days) % 997
const j = (base: number, pct: number, s: number) =>
  Math.max(0, Math.round(base * (1 + ((s % 100) / 100 - 0.5) * pct)))

// ─── KPI strip ───────────────────────────────────────────────────────────────
const EnviosKpis = () => {
  const { warehouseId, days } = useDashboardFilters()
  const s = seed(warehouseId, days)
  const sc = days / 30
  const otif = Math.min(99, Math.max(72, 91.4 + ((s % 20) - 10) * 0.4))
  const kpis = [
    { label: "Despachos Hoy",    value: j(Math.round(64 * sc), 0.3, s),   icon: Truck,        color: "bg-blue-500/10 text-blue-700 dark:text-blue-300",   trend: "+9.2%",        up: true  },
    { label: "En Tránsito",      value: j(Math.round(148 * sc), 0.2, s+1),icon: PackageCheck, color: "bg-green-500/10 text-green-700 dark:text-green-300", trend: "+4.1%",        up: true  },
    { label: "Retrasados",       value: j(Math.round(11 * sc), 0.5, s+2), icon: AlertTriangle,color: "bg-destructive/10 text-destructive",                 trend: "+2 envíos",    up: false },
    { label: "OTIF",             value: `${otif.toFixed(1)}%`,            icon: CheckCircle2, color: otif >= 90 ? "bg-green-500/10 text-green-700 dark:text-green-300" : "bg-amber-500/10 text-amber-700", trend: "obj. 90%", up: otif >= 90 },
    { label: "Entregas a Tiempo",value: j(Math.round(52 * sc), 0.25, s+4),icon: Clock,        color: "bg-green-500/10 text-green-700 dark:text-green-300", trend: "+7.3%",        up: true  },
  ]
  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
      <div className="grid divide-y *:data-[slot=card]:rounded-none *:data-[slot=card]:ring-0 md:grid-cols-3 md:divide-x md:divide-y-0 xl:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader><CardTitle className="font-normal text-sm">{k.label}</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-2xl leading-none tracking-tight tabular-nums">{String(k.value)}</div>
                <Badge className={k.color}>
                  {k.up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {k.trend}
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <k.icon className="size-3" /><span>vs período anterior</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Despachos por hora (AreaChart) ──────────────────────────────────────────
const DISPATCH_INTERVAL = 30
const DISPATCH_POINTS = [
  0, 0, 0, 2, 8, 18, 34, 52, 68, 74, 82, 88,
  76, 64, 58, 72, 88, 96, 84, 66, 48, 32, 18, 8,
  4, 2, 0, 0, 0, 0, 0, 0,
] satisfies readonly number[]

const dispatchConfig = {
  despachos:  { label: "Despachos",  color: "var(--chart-1)" },
  retrasados: { label: "Retrasados", color: "var(--destructive)" },
} satisfies ChartConfig

const DispatchActivityChart = () => {
  const data = useMemo(() => {
    const now = new Date()
    return DISPATCH_POINTS.map((val, i) => ({
      timestamp: subMinutes(now, (DISPATCH_POINTS.length - 1 - i) * DISPATCH_INTERVAL).toISOString(),
      despachos: val,
      retrasados: Math.round(val * 0.06),
    }))
  }, [])

  const first = data[0].timestamp
  const last = data.at(-1)?.timestamp ?? ""

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Actividad de Despacho</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {DISPATCH_POINTS.reduce((a, b) => a + b, 0)} despachos hoy
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={dispatchConfig} className="h-54 w-full">
          <AreaChart data={data} margin={{ bottom: 0, left: 0, right: 0, top: 8 }}>
            <defs>
              <linearGradient id="fillDespacho" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-despachos)" stopOpacity={0.28} />
                <stop offset="95%" stopColor="var(--color-despachos)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis axisLine={false} dataKey="timestamp" tick={{ fontSize: 11 }}
              tickFormatter={(v) => v === first ? "hace 16h" : v === last ? "ahora" : ""}
              tickLine={false} tickMargin={10} ticks={[first, last]} />
            <YAxis axisLine={false} tickLine={false} tickMargin={6} width={36} />
            <ChartTooltip
              content={<ChartTooltipContent labelFormatter={(v) => format(new Date(String(v)), "HH:mm", { locale: es })} />}
              cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
            />
            <ChartLegend align="right" verticalAlign="top" className="justify-end" content={<ChartLegendContent />} />
            <Area dataKey="despachos"  dot={false} fill="url(#fillDespacho)" stroke="var(--color-despachos)"  strokeWidth={2}   type="stepAfter" />
            <Area dataKey="retrasados" dot={false} fill="none"               stroke="var(--color-retrasados)" strokeWidth={1.2} type="stepAfter" />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ─── OTIF por transportista ──────────────────────────────────────────────────
const otifConfig = { otif: { color: "var(--chart-2)", label: "OTIF %" } } satisfies ChartConfig

type OtifDatum = { transportista: string; otif: number; label: string }

const renderOtifLabel = (props: LabelProps) => {
  const { height, value, y } = props
  if (value == null || y == null || height == null) return null
  return (
    <text className="fill-foreground" dominantBaseline="middle" dx={-6} fontSize={13}
      textAnchor="end" x="100%" y={Number(y) + Number(height) / 2}>
      {value}%
    </text>
  )
}

const OtifByCarrier = () => {
  const { warehouseId, days } = useDashboardFilters()
  const s = seed(warehouseId, days)
  const carriers: OtifDatum[] = [
    { transportista: "Servientrega",  otif: Math.min(99, j(94, 0.08, s)),     label: "" },
    { transportista: "TCC",           otif: Math.min(99, j(91, 0.1,  s+1)),   label: "" },
    { transportista: "Coordinadora",  otif: Math.min(99, j(88, 0.1,  s+2)),   label: "" },
    { transportista: "Envía",         otif: Math.min(99, j(85, 0.12, s+3)),   label: "" },
    { transportista: "Deprisa",       otif: Math.min(99, j(79, 0.15, s+4)),   label: "" },
  ].map((c) => ({ ...c, label: String(c.otif) }))

  return (
    <Card className="h-full">
      <CardHeader><CardTitle className="font-normal">OTIF por Transportista</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={otifConfig} className="h-64 w-full">
          <BarChart accessibilityLayer data={carriers} layout="vertical" margin={{ left: 0, right: 56 }}>
            <CartesianGrid horizontal={false} vertical={false} />
            <YAxis dataKey="transportista" hide tickLine={false} type="category" />
            <XAxis dataKey="otif" hide type="number" domain={[0, 100]} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
            <Bar barSize={40} dataKey="otif" fill="var(--color-otif)" fillOpacity={0.6} radius={8}>
              <LabelList className="fill-foreground" dataKey="transportista" fontSize={13} offset={12} position="insideLeft" />
              <LabelList content={renderOtifLabel} dataKey="label" />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ─── Top destinos ────────────────────────────────────────────────────────────
const DESTINOS = [
  { ciudad: "Bogotá",        envios: 840, share: "38%" },
  { ciudad: "Medellín",      envios: 520, share: "24%" },
  { ciudad: "Cali",          envios: 310, share: "14%" },
  { ciudad: "Barranquilla",  envios: 220, share: "10%" },
  { ciudad: "Bucaramanga",   envios: 180, share: "8%"  },
  { ciudad: "Otros",         envios: 130, share: "6%"  },
]

const TopDestinos = () => {
  const { warehouseId, days } = useDashboardFilters()
  const s = seed(warehouseId, days)
  const sc = days / 30
  const data = DESTINOS.map((d, i) => ({ ...d, envios: j(Math.round(d.envios * sc), 0.25, s + i) }))
  const total = data.reduce((a, b) => a + b.envios, 0)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Top Destinos</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {total.toLocaleString()} envíos
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex h-2 gap-1 overflow-hidden rounded-full bg-muted">
          {data.slice(0, 5).map((d, i) => (
            <div key={d.ciudad} className="rounded-md"
              style={{ backgroundColor: `var(--chart-${i + 1})`, width: `${Math.round((d.envios / total) * 100)}%` }} />
          ))}
        </div>
        <Separator />
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-3 text-xs">
          <div className="text-muted-foreground">Ciudad</div>
          <div className="text-muted-foreground">Envíos</div>
          <div className="text-muted-foreground">%</div>
          {data.map((item, i) => (
            <div className="contents text-sm" key={item.ciudad}>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: `var(--chart-${Math.min(i + 1, 5)})` }} />
                <span className="truncate font-medium">{item.ciudad}</span>
              </div>
              <div className="tabular-nums self-center text-right">{item.envios.toLocaleString()}</div>
              <div className="text-muted-foreground tabular-nums self-center text-right">
                {Math.round((item.envios / total) * 100)}%
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────
export const TabEnvios = () => (
  <div className="flex flex-col gap-4">
    <EnviosKpis />
    <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
      <div className="xl:col-span-7"><DispatchActivityChart /></div>
      <div className="xl:col-span-5"><TopDestinos /></div>
    </div>
    <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
      <div className="xl:col-span-12"><OtifByCarrier /></div>
    </div>
  </div>
)
