'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  Layers,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Ruler,
  Sparkles,
  Star,
  Warehouse as WarehouseIcon,
  type LucideIcon,
} from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  hasGoldenMismatch,
  isGoldenEligible,
  locationUtilizationPct,
  RACK_STYLE_LABELS,
} from '@/lib/rules/locations'
import { cn } from '@/lib/utils'
import type { RackType, StorageLocation } from '@/types/wms'
import { RackTypeDialog } from './_components/rack-type-dialog'

// Virtual slots (en tránsito / recibo de traslado) no son posiciones físicas del layout.
const VIRTUAL_ZONES = new Set(['TR', 'RB'])
const isPhysical = (loc: StorageLocation) => !VIRTUAL_ZONES.has(loc.zone)

// ── Reusable layout bits (mirror /inventory-settings) ─────────────────────────

const SectionHeading = ({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) => (
  <div>
    <h3 className="flex items-center gap-2 text-sm font-semibold">
      <Icon className="size-4 text-muted-foreground" />
      {title}
    </h3>
    <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
  </div>
)

const SettingRow = ({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: ReactNode
}) => (
  <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="sm:max-w-[60%]">
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
)

const InlineSlider = ({
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  onChange: (value: number) => void
}) => (
  <div className="flex items-center gap-3">
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="h-1.5 w-40 cursor-pointer accent-zinc-800 sm:w-48 dark:accent-zinc-300"
    />
    <span className="w-16 shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-right text-sm font-semibold tabular-nums dark:bg-zinc-800">
      {value}
      {suffix ? <span className="text-muted-foreground ml-0.5 text-xs">{suffix}</span> : null}
    </span>
  </div>
)

const StatCard = ({
  icon: Icon,
  label,
  value,
  sublabel,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  sublabel: string
  tone: 'neutral' | 'amber' | 'blue' | 'green'
}) => {
  const toneClass = {
    neutral: 'text-zinc-500',
    amber: 'text-amber-600 dark:text-amber-300',
    blue: 'text-blue-600 dark:text-blue-300',
    green: 'text-emerald-600 dark:text-emerald-300',
  }[tone]
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          <Icon className="size-3.5" />
          {label}
        </p>
        <p className={cn('mt-1 text-3xl font-bold tabular-nums', toneClass)}>{value}</p>
        <p className="mt-1 text-xs text-zinc-500">{sublabel}</p>
      </CardContent>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LocationSettingsPage() {
  const state = useWmsStore()
  const {
    locations,
    rackTypes,
    inventoryItems,
    settings,
    updateSettings,
    reclassifyGoldenZones,
    toggleRackType,
  } = state

  const [localSettings, setLocalSettings] = useState({ ...settings })
  const [settingsChanged, setSettingsChanged] = useState(false)
  const [reclassResult, setReclassResult] = useState<{ updated: number; goldenCount: number } | null>(null)

  const [rackDialogOpen, setRackDialogOpen] = useState(false)
  const [editingRack, setEditingRack] = useState<RackType | null>(null)

  const handleSettingChange = (key: keyof typeof settings, value: number | boolean) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
    setSettingsChanged(true)
  }

  const handleSaveSettings = () => {
    updateSettings(localSettings)
    setSettingsChanged(false)
    setReclassResult(null)
  }

  const physical = useMemo(() => locations.filter(isPhysical), [locations])

  // Occupancy per location (uses SAVED settings for the alert threshold).
  const occupancy = useMemo(() => {
    let occupied = 0
    let overUtilized = 0
    let utilizationSum = 0
    for (const loc of physical) {
      const units = inventoryItems
        .filter((i) => i.locationId === loc.id)
        .reduce((s, i) => s + i.onHandQuantity, 0)
      if (units <= 0) continue
      occupied++
      const pct = locationUtilizationPct(units, loc.volumeCapacityM3)
      utilizationSum += pct
      if (pct >= settings.locationHighUtilizationPct) overUtilized++
    }
    return {
      occupied,
      overUtilized,
      avgUtilization: occupied > 0 ? Math.round(utilizationSum / occupied) : 0,
    }
  }, [physical, inventoryItems, settings.locationHighUtilizationPct])

  // Golden alignment vs SAVED thresholds.
  const goldenStats = useMemo(() => {
    const marked = physical.filter((l) => l.golden)
    const eligible = physical.filter((l) => isGoldenEligible(l, settings))
    const mismatches = physical.filter((l) => hasGoldenMismatch(l, settings))
    return { marked, eligible, mismatches }
  }, [physical, settings])

  const blockedCount = physical.filter((l) => l.isBlocked).length

  const handleReclassify = () => {
    const result = reclassifyGoldenZones()
    setReclassResult(result)
  }

  const handleOpenCreateRack = () => {
    setEditingRack(null)
    setRackDialogOpen(true)
  }

  const handleOpenEditRack = (rack: RackType) => {
    setEditingRack(rack)
    setRackDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración de Ubicaciones"
        description="Gobierno del layout del almacén — definición de la zona golden, umbrales de ocupación, reglas de bloqueo y catálogo de tipos de estiba. Los cambios aquí afectan de inmediato lo que se ve en /locations."
      />

      {/* ── KPI header ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={WarehouseIcon}
          label="Ubicaciones físicas"
          value={physical.length}
          sublabel={`${occupancy.occupied} ocupadas · ${occupancy.avgUtilization}% ocupación media`}
          tone="neutral"
        />
        <StatCard
          icon={Star}
          label="Zona golden"
          value={goldenStats.marked.length}
          sublabel={
            goldenStats.mismatches.length > 0
              ? `${goldenStats.mismatches.length} desalineada${goldenStats.mismatches.length !== 1 ? 's' : ''} vs. umbral`
              : `${goldenStats.eligible.length} elegibles · alineado`
          }
          tone={goldenStats.mismatches.length > 0 ? 'amber' : 'green'}
        />
        <StatCard
          icon={Lock}
          label="Bloqueadas / sobreocupadas"
          value={`${blockedCount} / ${occupancy.overUtilized}`}
          sublabel={`Alerta de ocupación ≥ ${settings.locationHighUtilizationPct}%`}
          tone={blockedCount + occupancy.overUtilized > 0 ? 'amber' : 'neutral'}
        />
      </div>

      <Separator />

      {/* ── Parameters ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-sm">Parámetros del módulo</CardTitle>
              <CardDescription>
                Definen qué ubicación es golden, cuándo se alerta por sobreocupación y las reglas de
                bloqueo. Guarda para aplicarlos.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {settingsChanged && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  Cambios sin guardar
                </span>
              )}
              <Button size="sm" disabled={!settingsChanged} onClick={handleSaveSettings}>
                Guardar cambios
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="divide-y divide-zinc-200 dark:divide-zinc-800">
          <section className="pb-5">
            <SectionHeading
              icon={Star}
              title="Zona golden"
              description="Una ubicación de picking califica como golden cuando está cerca del despacho y es muy accesible. Estos dos umbrales definen el corte."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow
                label="Distancia máx. a despacho (m)"
                description="Posiciones a esta distancia o menos son candidatas a golden."
              >
                <InlineSlider
                  value={localSettings.goldenMaxDistanceM}
                  min={1}
                  max={60}
                  step={1}
                  suffix="m"
                  onChange={(v) => handleSettingChange('goldenMaxDistanceM', v)}
                />
              </SettingRow>
              <SettingRow
                label="Accesibilidad mínima"
                description="Score de accesibilidad (0–100) requerido para calificar como golden."
              >
                <InlineSlider
                  value={localSettings.goldenMinAccessibility}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => handleSettingChange('goldenMinAccessibility', v)}
                />
              </SettingRow>
            </div>
          </section>

          <section className="py-5">
            <SectionHeading
              icon={Ruler}
              title="Ocupación"
              description="Umbral por encima del cual una ubicación se marca como sobreocupada en /locations."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow
                label="Alerta de sobreocupación (%)"
                description="Ocupación volumétrica ≥ este valor dispara la alerta de sobreocupación."
              >
                <InlineSlider
                  value={localSettings.locationHighUtilizationPct}
                  min={50}
                  max={100}
                  step={1}
                  suffix="%"
                  onChange={(v) => handleSettingChange('locationHighUtilizationPct', v)}
                />
              </SettingRow>
            </div>
          </section>

          <section className="pt-5">
            <SectionHeading
              icon={Lock}
              title="Gobierno del layout"
              description="Reglas de operación sobre las ubicaciones."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow
                label="Exigir ubicación vacía para bloquear"
                description="Si está activo, no se podrá bloquear una ubicación que aún tenga stock; primero hay que reubicarlo."
              >
                <Switch
                  checked={localSettings.blockRequiresEmptyLocation}
                  onCheckedChange={(v) => handleSettingChange('blockRequiresEmptyLocation', v)}
                />
              </SettingRow>
            </div>
          </section>
        </CardContent>
      </Card>

      {/* ── Golden reclassification ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="size-4" />
                Reclasificar zonas golden
              </CardTitle>
              <CardDescription>
                Aplica los umbrales guardados a todas las posiciones de picking y sincroniza la marca
                golden. Las desalineadas aparecen abajo.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={goldenStats.mismatches.length === 0}
              onClick={handleReclassify}
            >
              <Sparkles className="mr-1.5 size-3.5" />
              Reclasificar ({goldenStats.mismatches.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {reclassResult && (
            <div className="mx-6 mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Sparkles className="size-4 shrink-0" />
              Se actualizaron <span className="font-semibold">{reclassResult.updated}</span> ubicaciones.
              Ahora hay <span className="font-semibold">{reclassResult.goldenCount}</span> posiciones golden.
            </div>
          )}
          {goldenStats.mismatches.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Star className="size-8 text-zinc-300" />
              <p className="text-sm text-muted-foreground">
                Todas las posiciones de picking están alineadas con los umbrales golden.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ubicación</TableHead>
                  <TableHead className="text-right">Dist. despacho</TableHead>
                  <TableHead className="text-right">Accesibilidad</TableHead>
                  <TableHead>Marca actual</TableHead>
                  <TableHead>Debería ser</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {goldenStats.mismatches.map((loc) => {
                  const shouldBeGolden = isGoldenEligible(loc, settings)
                  return (
                    <TableRow key={loc.id} className="border-border/60">
                      <TableCell>
                        <p className="font-mono text-sm font-semibold">{loc.code}</p>
                        <p className="text-muted-foreground text-[11px]">Zona {loc.zone}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {loc.distanceToDispatchM} m
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {loc.accessibilityScore}
                      </TableCell>
                      <TableCell>
                        {loc.golden ? (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                            <Star className="mr-1 size-3 fill-amber-400 text-amber-400" />
                            Golden
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Estándar
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {shouldBeGolden ? (
                          <span className="flex items-center gap-1 text-sm font-medium text-amber-600">
                            <Star className="size-3.5" /> Golden
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Estándar</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Rack / estiba types ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Layers className="size-4" />
                Tipos de estiba
              </CardTitle>
              <CardDescription>
                Catálogo de racks. Define capacidad por nivel y qué producto admite cada estilo (rack↔producto).
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleOpenCreateRack}>
              <Plus className="mr-1.5 size-3.5" />
              Nuevo tipo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {rackTypes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Layers className="size-8 text-zinc-300" />
              <p className="text-sm text-muted-foreground">Sin tipos de estiba configurados.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estilo</TableHead>
                  <TableHead className="text-right">Niveles</TableHead>
                  <TableHead className="text-right">Kg / nivel</TableHead>
                  <TableHead>Admite</TableHead>
                  <TableHead>Ubicaciones</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rackTypes.map((rack) => {
                  const usageCount = locations.filter((l) => l.rackTypeId === rack.id).length
                  return (
                    <TableRow key={rack.id} className="border-border/60">
                      <TableCell>
                        <p className="text-sm font-medium">{rack.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{rack.code}</p>
                      </TableCell>
                      <TableCell className="text-sm">{RACK_STYLE_LABELS[rack.storageStyle]}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{rack.levels}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {rack.maxWeightKgPerLevel}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {rack.compatibleCategories.length === 0
                          ? 'Todas las categorías'
                          : rack.compatibleCategories.join(', ')}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">{usageCount}</TableCell>
                      <TableCell>
                        {rack.active ? (
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                            Activo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Inactivo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="size-8 p-0">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEditRack(rack)}>
                              <Pencil className="mr-2 size-3.5" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => toggleRackType(rack.id)}>
                              {rack.active ? 'Desactivar' : 'Activar'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RackTypeDialog
        open={rackDialogOpen}
        rack={editingRack}
        onClose={() => setRackDialogOpen(false)}
      />
    </div>
  )
}
