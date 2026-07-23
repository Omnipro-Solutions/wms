'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  CalendarClock,
  CircleParking,
  Clock3,
  DoorOpen,
  Plus,
  Settings2,
  Snowflake,
  Warehouse as WarehouseIcon,
  type LucideIcon,
} from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { selectYardKpis } from '@/store/selectors'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DOCK_TYPE_LABELS, WEEKDAY_LABELS } from '@/lib/rules/yard'
import { cn } from '@/lib/utils'
import type { Dock, DockStatus, WmsSettings } from '@/types/wms'
import { DockDialog } from './_components/dock-dialog'

// ── Reusable layout bits (mirror /cycle-count-settings, /location-settings) ──

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
      <Icon className="text-muted-foreground size-4" />
      {title}
    </h3>
    <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
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
      <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
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

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function YardSettingsPage() {
  const state = useWmsStore()
  const { docks, warehouses, settings, updateSettings, setDockStatus } = state

  const [localSettings, setLocalSettings] = useState<WmsSettings>({ ...settings })
  const [settingsChanged, setSettingsChanged] = useState(false)

  const [dockDialogOpen, setDockDialogOpen] = useState(false)
  const [editingDock, setEditingDock] = useState<Dock | null>(null)

  const kpis = useMemo(() => selectYardKpis(state), [state])
  const totalDocks = docks.length

  const handleChange = <K extends keyof WmsSettings>(key: K, value: WmsSettings[K]) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
    setSettingsChanged(true)
  }

  const handleSave = () => {
    updateSettings(localSettings)
    setSettingsChanged(false)
  }

  // Freeze is a governance kill-switch — applies immediately, not via the buffer.
  const handleToggleFreeze = (active: boolean) => {
    updateSettings({ yardFreezeActive: active })
    setLocalSettings((prev) => ({ ...prev, yardFreezeActive: active }))
  }

  const handleToggleWorkingDay = (day: number, checked: boolean) => {
    const next = checked
      ? [...localSettings.yardWorkingDays, day].sort((a, b) => a - b)
      : localSettings.yardWorkingDays.filter((d) => d !== day)
    handleChange('yardWorkingDays', next)
  }

  const handleOpenCreateDock = () => {
    setEditingDock(null)
    setDockDialogOpen(true)
  }

  const handleOpenEditDock = (dock: Dock) => {
    setEditingDock(dock)
    setDockDialogOpen(true)
  }

  const handleSetStatus = (dock: Dock, status: DockStatus) => {
    try {
      setDockStatus(dock.id, status)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el estado del muelle')
    }
  }

  const warehouseName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? id

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración de Patio y Muelles"
        description="Gobierno del módulo de patio y muelles: congelamiento, horario operativo, restricciones de agenda y catálogo de muelles. Los cambios aquí afectan /yard al instante."
      />

      {/* ── KPI header ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={WarehouseIcon}
          label="Muelles"
          value={totalDocks}
          sublabel={`${kpis.docksOutOfService} fuera de servicio`}
          tone={kpis.docksOutOfService > 0 ? 'amber' : 'neutral'}
        />
        <StatCard
          icon={CircleParking}
          label="Ocupación actual"
          value={`${kpis.docksOccupied}/${kpis.docksAvailable + kpis.docksOccupied}`}
          sublabel="muelles activos ocupados"
          tone={kpis.docksOccupied > 0 ? 'blue' : 'neutral'}
        />
        <StatCard
          icon={CalendarClock}
          label="Citas hoy"
          value={kpis.appointmentsToday}
          sublabel="agendadas para hoy"
          tone={kpis.appointmentsToday > 0 ? 'blue' : 'neutral'}
        />
        <StatCard
          icon={DoorOpen}
          label="No-show hoy"
          value={kpis.noShowToday}
          sublabel="citas sin llegada registrada"
          tone={kpis.noShowToday > 0 ? 'amber' : 'green'}
        />
      </div>

      {/* ── Freeze governance ─────────────────────────────────────────────── */}
      <Card
        className={cn(
          localSettings.yardFreezeActive &&
            'border-red-300 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20'
        )}
      >
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Snowflake
              className={cn(
                'mt-0.5 size-5 shrink-0',
                localSettings.yardFreezeActive ? 'text-red-600' : 'text-muted-foreground'
              )}
            />
            <div>
              <p className="text-sm font-semibold">Congelar operaciones de patio y muelles</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Bloquea crear citas, asignar muelle y avanzar la FSM (llegó, iniciar, completar,
                no-show, cancelar). Útil durante contingencias del patio. Se aplica de inmediato.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {localSettings.yardFreezeActive && (
              <Badge variant="outline" className="border-red-300 bg-red-100 text-red-700">
                Congelado
              </Badge>
            )}
            <Switch
              checked={localSettings.yardFreezeActive}
              onCheckedChange={handleToggleFreeze}
              aria-label="Congelar patio y muelles"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Parameters ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-sm">Parámetros del módulo</CardTitle>
              <CardDescription>
                Horario operativo, días de trabajo y restricciones de agenda. Guarda para
                aplicarlos.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {settingsChanged && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  Cambios sin guardar
                </span>
              )}
              <Button size="sm" disabled={!settingsChanged} onClick={handleSave}>
                Guardar cambios
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="divide-y divide-zinc-200 dark:divide-zinc-800">
          <section className="pb-5">
            <SectionHeading
              icon={Clock3}
              title="Horario operativo"
              description="Ventana y días en que el patio recibe/despacha vehículos. Citas fuera de este rango se rechazan al crearlas."
            />
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">Desde</p>
                <Input
                  type="time"
                  value={localSettings.yardOperatingHoursStart}
                  onChange={(e) => handleChange('yardOperatingHoursStart', e.target.value)}
                  className="w-28"
                />
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">Hasta</p>
                <Input
                  type="time"
                  value={localSettings.yardOperatingHoursEnd}
                  onChange={(e) => handleChange('yardOperatingHoursEnd', e.target.value)}
                  className="w-28"
                />
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">Días operativos</p>
                <div className="flex gap-1.5">
                  {WEEKDAYS.map((day) => {
                    const checked = localSettings.yardWorkingDays.includes(day)
                    return (
                      <label
                        key={day}
                        className={cn(
                          'flex size-9 cursor-pointer items-center justify-center rounded-md border text-xs font-medium transition-colors',
                          checked
                            ? 'border-zinc-800 bg-zinc-800 text-white dark:border-zinc-300 dark:bg-zinc-300 dark:text-zinc-900'
                            : 'text-muted-foreground'
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => handleToggleWorkingDay(day, !!c)}
                          className="sr-only"
                        />
                        {WEEKDAY_LABELS[day]}
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="py-5">
            <SectionHeading
              icon={CalendarClock}
              title="Duración y alertas"
              description="Duración por defecto de una cita nueva y umbral de retraso para marcarla en riesgo."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow
                label="Duración por defecto (min)"
                description="Se propone como ventana horaria al crear una cita en /yard."
              >
                <InlineSlider
                  value={localSettings.yardDefaultSlotMinutes}
                  min={15}
                  max={180}
                  step={15}
                  suffix="min"
                  onChange={(v) => handleChange('yardDefaultSlotMinutes', v)}
                />
              </SettingRow>
              <SettingRow
                label="Umbral de retraso (min)"
                description="Minutos tras la hora agendada, sin llegada registrada, para marcar la cita en riesgo."
              >
                <InlineSlider
                  value={localSettings.yardLateThresholdMinutes}
                  min={5}
                  max={120}
                  step={5}
                  suffix="min"
                  onChange={(v) => handleChange('yardLateThresholdMinutes', v)}
                />
              </SettingRow>
            </div>
          </section>

          <section className="pt-5">
            <SectionHeading
              icon={Settings2}
              title="Reglas de agenda"
              description="Restricciones al agendar o asignar muelle a una cita."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow
                label="Permitir sobre-reserva de muelle"
                description="Si está activo, se puede agendar/asignar más de una cita activa sobre el mismo muelle en horarios que se solapan."
              >
                <Switch
                  checked={localSettings.yardAllowOverbooking}
                  onCheckedChange={(v) => handleChange('yardAllowOverbooking', v)}
                />
              </SettingRow>
            </div>
          </section>
        </CardContent>
      </Card>

      {/* ── Dock catalog ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <WarehouseIcon className="size-4" />
                Catálogo de muelles
              </CardTitle>
              <CardDescription>
                Muelles de carga/descarga por bodega. El tipo determina qué citas admite cada uno.
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleOpenCreateDock}>
              <Plus className="mr-1.5 size-3.5" />
              Nuevo muelle
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {docks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <WarehouseIcon className="size-8 text-zinc-300" />
              <p className="text-sm text-muted-foreground">Sin muelles configurados.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Muelle</TableHead>
                  <TableHead>Bodega</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {docks.map((dock) => (
                  <TableRow key={dock.id} className="border-border/60">
                    <TableCell>
                      <p className="text-sm font-medium">{dock.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{dock.code}</p>
                    </TableCell>
                    <TableCell className="text-sm">{warehouseName(dock.warehouseId)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {DOCK_TYPE_LABELS[dock.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={dock.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost">
                            Acciones
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEditDock(dock)}>
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {dock.status !== 'active' && (
                            <DropdownMenuItem onClick={() => handleSetStatus(dock, 'active')}>
                              Activar
                            </DropdownMenuItem>
                          )}
                          {dock.status !== 'blocked' && (
                            <DropdownMenuItem onClick={() => handleSetStatus(dock, 'blocked')}>
                              Bloquear
                            </DropdownMenuItem>
                          )}
                          {dock.status !== 'maintenance' && (
                            <DropdownMenuItem onClick={() => handleSetStatus(dock, 'maintenance')}>
                              Enviar a mantenimiento
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DockDialog open={dockDialogOpen} dock={editingDock} onClose={() => setDockDialogOpen(false)} />
    </div>
  )
}
