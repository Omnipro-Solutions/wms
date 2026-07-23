'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  CalendarClock,
  ClipboardCheck,
  Hash,
  Lightbulb,
  ListChecks,
  MapPin,
  Pencil,
  Plus,
  Snowflake,
  Sparkles,
  Undo2,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  CONDITION_DOT,
  CONDITION_LABELS,
  CONDITION_ORDER,
  ITEM_DISPOSITION_LABELS,
  TERMINAL_RETURN_STATUSES,
} from '@/lib/returns'
import type { ItemCondition, ItemDisposition, Reason, WmsSettings } from '@/types/wms'
import { ReasonDialog } from './_components/reason-dialog'

const DISPOSITIONS = Object.keys(ITEM_DISPOSITION_LABELS) as ItemDisposition[]

// ── Reusable layout bits (mirror /slotting-settings) ──────────────────────────

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
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          <Icon className="size-3.5" />
          {label}
        </p>
        <p className={cn('mt-1 text-3xl font-bold tabular-nums', toneClass)}>{value}</p>
        <p className="mt-1 text-xs text-zinc-500">{sublabel}</p>
      </CardContent>
    </Card>
  )
}

// Condition/disposition labels + colors are centralized in @/lib/returns.

// ── Reason management sub-component ─────────────────────────────────────────────

const ReasonSection = ({
  title,
  description,
  reasons,
  onCreate,
  onEdit,
  onToggle,
}: {
  title: string
  description: string
  reasons: Reason[]
  onCreate: () => void
  onEdit: (reason: Reason) => void
  onToggle: (id: string) => void
}) => (
  <Card>
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ListChecks className="size-4" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button size="sm" onClick={onCreate}>
          <Plus className="mr-1.5 size-3.5" />
          Nuevo motivo
        </Button>
      </div>
    </CardHeader>
    <CardContent className="p-0">
      {reasons.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-sm">
          <ListChecks className="size-7 text-zinc-300" />
          Sin motivos configurados.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Etiqueta</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reasons.map((r) => (
              <TableRow key={r.id} className="border-border/60">
                <TableCell className="text-muted-foreground font-mono text-xs">{r.code}</TableCell>
                <TableCell className="text-sm font-medium">{r.label}</TableCell>
                <TableCell>
                  {r.active ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      Activo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Inactivo
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Switch
                      checked={r.active}
                      onCheckedChange={() => onToggle(r.id)}
                      aria-label={r.active ? 'Desactivar motivo' : 'Activar motivo'}
                    />
                    <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => onEdit(r)}>
                      <Pencil className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardContent>
  </Card>
)

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReturnsSettingsPage() {
  const state = useWmsStore()
  const { settings, reasons, locations, returnOrders, repairTickets, updateSettings, toggleReason } =
    state
  const { warehouseName } = useStoreHelpers()

  const [localSettings, setLocalSettings] = useState<WmsSettings>({ ...settings })
  const [settingsChanged, setSettingsChanged] = useState(false)

  // Reason dialog state
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false)
  const [reasonContext, setReasonContext] = useState<'return' | 'scrap'>('return')
  const [editingReason, setEditingReason] = useState<Reason | null>(null)

  const returnReasons = useMemo(
    () => reasons.filter((r) => r.context === 'return'),
    [reasons]
  )
  const scrapReasons = useMemo(() => reasons.filter((r) => r.context === 'scrap'), [reasons])

  // Candidate reentry destinations: returns / staging / QC bins that aren't blocked.
  const reentryLocations = useMemo(
    () =>
      locations.filter(
        (l) =>
          !l.isBlocked &&
          (l.type === 'returns' || l.type === 'staging' || l.type === 'quality_control')
      ),
    [locations]
  )

  // KPIs (reflect live data, independent of unsaved edits).
  const totalReturns = returnOrders.length
  const inProcess = returnOrders.filter((r) => !TERMINAL_RETURN_STATUSES.has(r.status)).length
  const openRepairs = repairTickets.filter(
    (t) => t.status !== 'completed' && t.status !== 'failed'
  ).length
  const activeReturnReasons = returnReasons.filter((r) => r.active).length

  const handleChange = <K extends keyof WmsSettings>(key: K, value: WmsSettings[K]) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
    setSettingsChanged(true)
  }

  const handleGradingChange = (condition: ItemCondition, disposition: ItemDisposition) => {
    setLocalSettings((prev) => ({
      ...prev,
      returnGradingPolicy: prev.returnGradingPolicy.map((g) =>
        g.condition === condition ? { ...g, disposition } : g
      ),
    }))
    setSettingsChanged(true)
  }

  const dispositionFor = (condition: ItemCondition): ItemDisposition =>
    localSettings.returnGradingPolicy.find((g) => g.condition === condition)?.disposition ?? 'reject'

  const handleSave = () => {
    updateSettings(localSettings)
    setSettingsChanged(false)
  }

  // Freeze is a governance kill-switch — applies immediately, not via the buffer.
  const handleToggleFreeze = (active: boolean) => {
    updateSettings({ returnsFreezeActive: active })
    setLocalSettings((prev) => ({ ...prev, returnsFreezeActive: active }))
  }

  const openCreateReason = (context: 'return' | 'scrap') => {
    setReasonContext(context)
    setEditingReason(null)
    setReasonDialogOpen(true)
  }

  const openEditReason = (reason: Reason) => {
    setReasonContext(reason.context as 'return' | 'scrap')
    setEditingReason(reason)
    setReasonDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración de Devoluciones"
        description="Gobierno de la logística inversa (RMA): ventana de devolución, validación de serie, disposición automática, motivos tipificados y congelamiento. Los cambios aquí afectan el flujo de /returns al instante."
      />

      {/* ── KPI header ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Undo2}
          label="Devoluciones"
          value={totalReturns}
          sublabel="registradas en el sistema"
          tone="neutral"
        />
        <StatCard
          icon={ClipboardCheck}
          label="En proceso"
          value={inProcess}
          sublabel="requieren gestión (no cerradas)"
          tone={inProcess > 0 ? 'amber' : 'green'}
        />
        <StatCard
          icon={Wrench}
          label="Reparaciones abiertas"
          value={openRepairs}
          sublabel="tickets con taller sin cerrar"
          tone={openRepairs > 0 ? 'blue' : 'green'}
        />
        <StatCard
          icon={ListChecks}
          label="Motivos activos"
          value={activeReturnReasons}
          sublabel={`de ${returnReasons.length} motivos de devolución`}
          tone="neutral"
        />
      </div>

      {/* ── Freeze governance ─────────────────────────────────────────────── */}
      <Card
        className={cn(
          localSettings.returnsFreezeActive &&
            'border-red-300 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20'
        )}
      >
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Snowflake
              className={cn(
                'mt-0.5 size-5 shrink-0',
                localSettings.returnsFreezeActive ? 'text-red-600' : 'text-muted-foreground'
              )}
            />
            <div>
              <p className="text-sm font-semibold">Congelar operaciones de devoluciones</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Bloquea registrar, avanzar, inspeccionar, reingresar, reparar y dar de baja. Útil
                durante cierres de inventario o auditorías. Se aplica de inmediato.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {localSettings.returnsFreezeActive && (
              <Badge variant="outline" className="border-red-300 bg-red-100 text-red-700">
                Congelado
              </Badge>
            )}
            <Switch
              checked={localSettings.returnsFreezeActive}
              onCheckedChange={handleToggleFreeze}
              aria-label="Congelar devoluciones"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Parameters ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-sm">Parámetros del flujo</CardTitle>
              <CardDescription>
                Ventana de aceptación, controles de validación y disposición automática. Guarda para
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
              icon={CalendarClock}
              title="Ventana de devolución"
              description="Días máximos desde el despacho original para aceptar una devolución. Al registrar una RMA fuera de este plazo, el formulario advierte al usuario."
            />
            <div className="mt-2">
              <SettingRow
                label="Plazo de aceptación (días)"
                description="Estándar retail Colombia: 30 días. Ecommerce suele ampliarlo a 60–90."
              >
                <InlineSlider
                  value={localSettings.returnWindowDays}
                  min={7}
                  max={90}
                  step={1}
                  suffix="d"
                  onChange={(v) => handleChange('returnWindowDays', v)}
                />
              </SettingRow>
            </div>
          </section>

          <section className="py-5">
            <SectionHeading
              icon={Hash}
              title="Controles de validación"
              description="Reglas que el motor aplica durante la inspección en el CD."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow
                label="Exigir validación de serie"
                description="Para productos serializados, la inspección exige que el N/S devuelto exista en el historial de despacho. Si no coincide, bloquea la inspección (anti-fraude / garantías)."
              >
                <Switch
                  checked={localSettings.returnRequireSerialValidation}
                  onCheckedChange={(v) => handleChange('returnRequireSerialValidation', v)}
                />
              </SettingRow>
              <SettingRow
                label="Disposición automática"
                description="La inspección pre-llena la disposición recomendada de cada ítem según la matriz de calificación de abajo. El inspector puede ajustarla."
              >
                <Switch
                  checked={localSettings.returnAutoDispositionEnabled}
                  onCheckedChange={(v) => handleChange('returnAutoDispositionEnabled', v)}
                />
              </SettingRow>
            </div>
          </section>

          <section className="pt-5">
            <SectionHeading
              icon={MapPin}
              title="Reingreso al inventario"
              description="Ubicación destino sugerida por defecto al reingresar o al recibir de taller."
            />
            <div className="mt-2">
              <SettingRow
                label="Ubicación de reingreso por defecto"
                description="Zona de devoluciones / staging donde aterriza el stock reintegrado, listo para putaway."
              >
                <Select
                  value={localSettings.returnDefaultLocationId}
                  onValueChange={(v) => handleChange('returnDefaultLocationId', v)}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Selecciona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {reentryLocations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.code} · {warehouseName(l.warehouseId)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>
            </div>
          </section>
        </CardContent>
      </Card>

      {/* ── Grading policy matrix ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="size-4" />
              Matriz de calificación → disposición
            </CardTitle>
            <CardDescription>
              Política de <em>grading</em>: para cada condición del ítem inspeccionado, la disposición
              que el sistema recomienda por defecto. Se aplica cuando «Disposición automática» está
              activa.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!localSettings.returnAutoDispositionEnabled && (
            <p className="text-muted-foreground mb-3 rounded-md border border-dashed px-3 py-2 text-xs">
              La disposición automática está desactivada — esta matriz no se aplica hasta activarla
              arriba. Puedes editarla igualmente. Recuerda guardar los cambios.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CONDITION_ORDER.map((condition) => {
              return (
                <div
                  key={condition}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className={cn('size-2 rounded-full', CONDITION_DOT[condition])} />
                    {CONDITION_LABELS[condition]}
                  </span>
                  <Select
                    value={dispositionFor(condition)}
                    onValueChange={(v) => handleGradingChange(condition, v as ItemDisposition)}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISPOSITIONS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {ITEM_DISPOSITION_LABELS[d]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Reasons ────────────────────────────────────────────────────────── */}
      <ReasonSection
        title="Motivos de devolución"
        description="Motivos tipificados que el operario elige al registrar una RMA. Desactiva uno para retirarlo de los formularios sin perder el histórico."
        reasons={returnReasons}
        onCreate={() => openCreateReason('return')}
        onEdit={openEditReason}
        onToggle={toggleReason}
      />

      <ReasonSection
        title="Motivos de baja (scrap)"
        description="Motivos disponibles al confirmar la baja definitiva de una devolución no recuperable."
        reasons={scrapReasons}
        onCreate={() => openCreateReason('scrap')}
        onEdit={openEditReason}
        onToggle={toggleReason}
      />

      {/* ── Help ───────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
        <Lightbulb className="mt-0.5 size-4 shrink-0" />
        <p>
          Estos parámetros gobiernan el módulo de{' '}
          <a href="/returns" className="font-medium underline underline-offset-2">
            /returns
          </a>
          . Prueba el efecto: activa «Exigir validación de serie» y verás que la inspección rechaza un
          N/S que no fue despachado; ajusta la matriz de calificación y la inspección propondrá otra
          disposición; congela el módulo y toda acción se bloqueará con un aviso.
        </p>
      </div>

      <ReasonDialog
        open={reasonDialogOpen}
        reason={editingReason}
        context={reasonContext}
        onClose={() => setReasonDialogOpen(false)}
      />
    </div>
  )
}
