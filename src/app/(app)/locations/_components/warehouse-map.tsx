'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, Boxes, Flame, Gauge, Lock, Package, Star, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatNumber } from '@/lib/formatters'
import { isGoldenEligible, LOCATION_TYPE_LABELS, locationHierarchyPath } from '@/lib/rules/locations'
import { cn } from '@/lib/utils'
import type { StorageLocation, WmsSettings } from '@/types/wms'

export interface LocationRow extends StorageLocation {
  onHandUnits: number
  skuCount: number
  utilizationPct: number
}

// Fixed-order categorical hue per zone — validated with the dataviz palette
// checker (all pairs PASS). Red/rose deliberately excluded: red is reserved for
// the "blocked" status. Cycles past 5 zones; safe here because every cell also
// carries its code label inside a separately-titled column (secondary encoding).
const ZONE_HUES = [
  '#059669', // emerald
  '#2563eb', // blue
  '#d97706', // amber
  '#7c3aed', // violet
  '#0d9488', // teal
]

// Heatmap mode — "fire" ramp: yellow → orange → burnt amber. Stops short of pure
// red (that's reserved for "blocked"), and the golden star gets a white halo so it
// stays legible over the warm fill. Normalised to the busiest cell in view (relative
// heat) so contrast shows even when absolute utilisation is uniformly low.
const FIRE_STOPS = [
  [254, 240, 138], // yellow-200 #fef08a
  [249, 115, 22], // orange-500 #f97316
  [154, 52, 18], // orange-800 #9a3412
]
const HEAT_LEGEND_GRADIENT = 'linear-gradient(to right, #fef08a, #f97316, #9a3412)'
const heatCellStyle = (util: number, maxUtil: number) => {
  const t = maxUtil > 0 ? Math.max(0, Math.min(1, util / maxUtil)) : 0
  const seg = t * (FIRE_STOPS.length - 1)
  const i = Math.min(Math.floor(seg), FIRE_STOPS.length - 2)
  const f = seg - i
  const mix = FIRE_STOPS[i].map((c, k) => Math.round(c + (FIRE_STOPS[i + 1][k] - c) * f))
  return {
    backgroundColor: `rgb(${mix.join(',')})`,
    borderColor: 'transparent',
    color: t > 0.6 ? '#ffffff' : '#7c2d12',
  }
}

// Cell label = the real, unique code with the redundant zone prefix stripped
// (the zone already labels the column). Never derived from partial hierarchy,
// so two positions in different aisles never collapse to the same label.
const cellLabel = (loc: LocationRow): string => {
  const prefix = `${loc.zone}-`
  return loc.code.startsWith(prefix) ? loc.code.slice(prefix.length) : loc.code
}

// ── Single-value usage meter (one hue, neutral track) ────────────────────────

const UsageDonut = ({ value, color }: { value: number; color: string }) => {
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const dash = (pct / 100) * circumference
  return (
    <div className="relative size-28 shrink-0">
      <svg viewBox="0 0 96 96" className="size-full -rotate-90">
        <circle
          cx={48}
          cy={48}
          r={radius}
          fill="none"
          strokeWidth={10}
          className="stroke-zinc-100 dark:stroke-zinc-800"
        />
        <circle
          cx={48}
          cy={48}
          r={radius}
          fill="none"
          strokeWidth={10}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{pct}%</span>
        <span className="text-muted-foreground text-[10px] uppercase tracking-wide">ocupación</span>
      </div>
    </div>
  )
}

const PanelStat = ({ value, label, accent }: { value: number; label: string; accent?: string }) => (
  <div>
    <p className="text-xl font-bold tabular-nums" style={accent ? { color: accent } : undefined}>
      {formatNumber(value)}
    </p>
    <p className="text-muted-foreground text-[11px] leading-tight">{label}</p>
  </div>
)

const InventoryTile = ({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Package
  value: string
  label: string
}) => (
  <div className="flex items-start gap-2.5 rounded-lg border p-3">
    <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
      <Icon className="text-muted-foreground size-4" />
    </div>
    <div className="min-w-0">
      <p className="text-lg font-bold leading-tight tabular-nums">{value}</p>
      <p className="text-muted-foreground text-[11px] leading-tight">{label}</p>
    </div>
  </div>
)

// ── Cell ─────────────────────────────────────────────────────────────────────

const MapCell = ({
  loc,
  hue,
  heatmap,
  maxUtil,
  onSelect,
  settings,
}: {
  loc: LocationRow
  hue: string
  heatmap: boolean
  maxUtil: number
  onSelect: (loc: LocationRow) => void
  settings: WmsSettings
}) => {
  const occupied = loc.onHandUnits > 0
  const overUtilized = occupied && loc.utilizationPct >= settings.locationHighUtilizationPct

  // Inline styles (never Tailwind dynamic classes) for the tinted states:
  // heatmap → intensity by utilization; normal → the zone hue.
  const style = loc.isBlocked
    ? undefined
    : !occupied
      ? undefined
      : heatmap
        ? heatCellStyle(loc.utilizationPct, maxUtil)
        : { backgroundColor: `${hue}22`, borderColor: `${hue}66`, color: hue }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onSelect(loc)}
          style={style}
          className={cn(
            'relative flex h-10 w-full flex-col items-center justify-center rounded-lg border text-[10px] font-semibold transition-transform hover:scale-[1.04] hover:shadow-sm',
            loc.isBlocked && 'border-destructive/40 bg-destructive/10 text-destructive',
            !loc.isBlocked && !occupied && 'border-dashed border-zinc-200 bg-zinc-50/70 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/40'
          )}
        >
          {loc.isBlocked ? (
            <Lock className="size-3.5" />
          ) : (
            <span className="max-w-full truncate px-1.5 tabular-nums">{cellLabel(loc)}</span>
          )}
          {overUtilized && (
            <span className="absolute -left-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-red-500 text-white">
              <TriangleAlert className="size-2" />
            </span>
          )}
          {loc.golden && !loc.isBlocked && (
            <Star className="absolute -right-1 -top-1 size-3.5 fill-amber-400 text-amber-500 drop-shadow-[0_0_1.5px_#ffffff]" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-56">
        <p className="font-mono text-xs font-semibold">{loc.code}</p>
        <p className="text-background/70 text-[11px]">{locationHierarchyPath(loc)}</p>
        <p className="text-background/70 text-[11px]">
          {LOCATION_TYPE_LABELS[loc.type]}
          {loc.golden ? ' · Golden' : ''}
        </p>
        <p className="text-background/70 text-[11px]">
          {occupied ? `${loc.onHandUnits} uds · ${loc.utilizationPct}% ocupación` : 'Disponible'}
        </p>
        {loc.type === 'pick' && !loc.golden && isGoldenEligible(loc, settings) && (
          <p className="mt-0.5 text-[11px] text-amber-300">Cumple umbrales golden — reclasificable</p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

// ── Map + side panel ───────────────────────────────────────────────────────────

// Display order — operational flow first (picking → reserva → QC → staging → devoluciones).
const TYPE_ORDER: Record<StorageLocation['type'], number> = {
  pick: 0,
  reserve: 1,
  quality_control: 2,
  staging: 3,
  returns: 4,
}

interface Props {
  rows: LocationRow[]
  settings: WmsSettings
  selectedZone: string | null
  onSelectZone: (zone: string) => void
  onViewList: (zone: string) => void
  onSelect: (loc: LocationRow) => void
}

export const WarehouseMap = ({
  rows,
  settings,
  selectedZone,
  onSelectZone,
  onViewList,
  onSelect,
}: Props) => {
  const [heatmap, setHeatmap] = useState(false)

  // Busiest occupied cell in view — normaliser for the relative heatmap.
  const maxUtil = useMemo(() => {
    const occ = rows.filter((r) => r.onHandUnits > 0)
    return occ.length > 0 ? Math.max(...occ.map((r) => r.utilizationPct)) : 0
  }, [rows])

  const zones = useMemo(() => {
    const map = new Map<string, LocationRow[]>()
    for (const loc of rows) {
      if (!map.has(loc.zone)) map.set(loc.zone, [])
      map.get(loc.zone)!.push(loc)
    }
    // Hue follows the entity: fixed by alphabetical zone name, independent of the
    // display order — so re-sorting by type never repaints a zone.
    const names = Array.from(map.keys()).sort((a, b) => a.localeCompare(b))
    const hueByZone = new Map(names.map((z, i) => [z, ZONE_HUES[i % ZONE_HUES.length]]))
    return Array.from(map.entries())
      .map(([zone, cells]) => {
        const typeCounts = new Map<StorageLocation['type'], number>()
        for (const c of cells) typeCounts.set(c.type, (typeCounts.get(c.type) ?? 0) + 1)
        const dominantType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
        return {
          zone,
          hue: hueByZone.get(zone)!,
          dominantType,
          cells: [...cells].sort((a, b) => a.code.localeCompare(b.code)),
        }
      })
      .sort(
        (a, b) => TYPE_ORDER[a.dominantType] - TYPE_ORDER[b.dominantType] || a.zone.localeCompare(b.zone)
      )
  }, [rows])

  // Defensive active zone — survives warehouse switches without an effect.
  const activeZone = zones.find((z) => z.zone === selectedZone) ?? zones[0]

  const panel = useMemo(() => {
    if (!activeZone) return null
    const cells = activeZone.cells
    const total = cells.length
    const occupied = cells.filter((c) => c.onHandUnits > 0 && !c.isBlocked).length
    const available = cells.filter((c) => c.onHandUnits === 0 && !c.isBlocked).length
    const blocked = cells.filter((c) => c.isBlocked).length
    const golden = cells.filter((c) => c.golden).length
    const units = cells.reduce((s, c) => s + c.onHandUnits, 0)
    const skus = cells.reduce((s, c) => s + c.skuCount, 0)
    const occupiedCells = cells.filter((c) => c.onHandUnits > 0)
    const avgUtil =
      occupiedCells.length > 0
        ? Math.round(occupiedCells.reduce((s, c) => s + c.utilizationPct, 0) / occupiedCells.length)
        : 0
    const overUtilized = occupiedCells.filter((c) => c.utilizationPct >= settings.locationHighUtilizationPct).length
    const usedPct = total > 0 ? ((occupied + blocked) / total) * 100 : 0
    return { total, occupied, available, blocked, golden, units, skus, avgUtil, overUtilized, usedPct }
  }, [activeZone, settings.locationHighUtilizationPct])

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="text-muted-foreground text-sm">No hay ubicaciones para este almacén.</p>
        <p className="text-muted-foreground text-xs">
          Usa &ldquo;Nueva ubicación&rdquo; o &ldquo;Generar layout&rdquo; para construir la estructura.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* ── Section columns ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <p className="text-sm font-semibold">Secciones ({rows.length})</p>
              {heatmap ? (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span>Menos</span>
                  <span className="h-3 w-24 rounded" style={{ background: HEAT_LEGEND_GRADIENT }} />
                  <span>más ocupación</span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <LegendDot swatch="bg-emerald-100 border-emerald-300" label="Ocupada" />
                  <LegendDot swatch="border-dashed border-zinc-300 bg-zinc-50" label="Disponible" />
                  <LegendDot swatch="border-destructive/40 bg-destructive/10" label="Bloqueada" />
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Star className="size-3 fill-amber-400 text-amber-500" /> Golden
                  </span>
                </div>
              )}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Flame className={cn('size-3.5', heatmap ? 'text-orange-600' : 'text-muted-foreground')} />
              <span className="text-muted-foreground">Mapa de calor</span>
              <Switch checked={heatmap} onCheckedChange={setHeatmap} />
            </label>
          </div>

          {/* Responsive wrap grid: fills the width, wraps to a new row when zones
              don't fit, and align-items:start keeps short columns their natural
              height (no stretching, no width reflow when a zone is generated). */}
          <div
            className="grid items-start gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))' }}
          >
            {zones.map(({ zone, hue, dominantType, cells }) => {
              const occ = cells.filter((c) => c.onHandUnits > 0 || c.isBlocked).length
              const isActive = activeZone?.zone === zone
              return (
                <div
                  key={zone}
                  className={cn(
                    'rounded-xl border p-2 transition-colors',
                    isActive ? 'border-2 bg-muted/40' : 'border-border/60'
                  )}
                  style={isActive ? { borderColor: hue } : undefined}
                >
                  <button
                    type="button"
                    onClick={() => onSelectZone(zone)}
                    className="mb-2 flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left hover:bg-muted"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: hue }} />
                      <span className="text-xs font-semibold">{zone}</span>
                      <span className="text-muted-foreground truncate text-[11px] font-normal">
                        · {LOCATION_TYPE_LABELS[dominantType]}
                      </span>
                    </span>
                    <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                      {occ}/{cells.length}
                    </span>
                  </button>
                  <div className="grid grid-cols-2 gap-1.5">
                    {cells.map((loc) => (
                      <MapCell
                        key={loc.id}
                        loc={loc}
                        hue={hue}
                        heatmap={heatmap}
                        maxUtil={maxUtil}
                        onSelect={onSelect}
                        settings={settings}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Side panel: zone usage + inventory ──────────────────────────── */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
        {activeZone && panel && (
          <>
            <Card>
              <CardContent className="pt-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: activeZone.hue }} />
                  <p className="text-sm font-semibold">Uso · Zona {activeZone.zone}</p>
                </div>
                <div className="flex items-center gap-4">
                  <UsageDonut value={panel.usedPct} color={activeZone.hue} />
                  <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-3">
                    <PanelStat value={panel.total} label="Posiciones" />
                    <PanelStat value={panel.available} label="Disponibles" accent="#059669" />
                    <PanelStat value={panel.occupied} label="Ocupadas" accent={activeZone.hue} />
                    <PanelStat value={panel.golden} label="Golden" accent="#d97706" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <p className="mb-3 text-sm font-semibold">Inventario · Zona {activeZone.zone}</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <InventoryTile icon={Package} value={formatNumber(panel.units)} label="Unidades en mano" />
                  <InventoryTile icon={Boxes} value={formatNumber(panel.skus)} label="Líneas de SKU" />
                  <InventoryTile icon={Gauge} value={`${panel.avgUtil}%`} label="Ocupación media" />
                  <InventoryTile icon={TriangleAlert} value={formatNumber(panel.overUtilized)} label="Sobreocupadas" />
                </div>
                {panel.blocked > 0 && (
                  <div className="text-destructive mt-3 flex items-center gap-1.5 text-xs">
                    <Lock className="size-3.5" />
                    {panel.blocked} posición{panel.blocked !== 1 ? 'es' : ''} bloqueada{panel.blocked !== 1 ? 's' : ''}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => onViewList(activeZone.zone)}
                >
                  Ver posiciones en el listado
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

const LegendDot = ({ swatch, label }: { swatch: string; label: string }) => (
  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
    <span className={cn('size-3 rounded border', swatch)} />
    {label}
  </span>
)
