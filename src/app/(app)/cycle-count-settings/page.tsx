'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  CalendarClock,
  ClipboardCheck,
  Eye,
  Gauge,
  Lightbulb,
  ListChecks,
  Snowflake,
  Sparkles,
  TriangleAlert,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { selectCycleCountSchedule, selectInventoryAccuracy } from '@/store/selectors'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { AbcClass, WmsSettings } from '@/types/wms'

const ABC_BADGE: Record<AbcClass, string> = {
  A: 'bg-green-600 text-white hover:bg-green-600 dark:bg-emerald-500',
  B: 'bg-blue-500 text-white hover:bg-blue-500 dark:bg-blue-400',
  C: 'bg-zinc-200 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-500 dark:text-white',
}

// ── Reusable layout bits (mirror /inventory-settings, /returns-settings) ──────

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
  tone: 'neutral' | 'amber' | 'blue' | 'green' | 'red'
}) => {
  const toneClass = {
    neutral: 'text-zinc-500',
    amber: 'text-amber-600 dark:text-amber-300',
    blue: 'text-blue-600 dark:text-blue-300',
    green: 'text-emerald-600 dark:text-emerald-300',
    red: 'text-red-600 dark:text-red-300',
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

export default function CycleCountSettingsPage() {
  const state = useWmsStore()
  const { settings, cyclicCountPlans, cyclicCountLines, updateSettings, generateSuggestedCycleCounts } = state
  const { productName, warehouseName } = useStoreHelpers()

  const accuracy = selectInventoryAccuracy(state)
  const overdue = useMemo(() => selectCycleCountSchedule(state), [state])

  const [localSettings, setLocalSettings] = useState<WmsSettings>({ ...settings })
  const [settingsChanged, setSettingsChanged] = useState(false)

  const activePlans = cyclicCountPlans.filter(
    (p) => p.status === 'pending' || p.status === 'in_progress'
  ).length
  const discrepancyLines = cyclicCountLines.filter(
    (l) => l.countedQuantity !== undefined && l.variance !== 0
  ).length

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
    updateSettings({ cycleCountFreezeActive: active })
    setLocalSettings((prev) => ({ ...prev, cycleCountFreezeActive: active }))
  }

  const handleGenerateSuggested = () => {
    try {
      const created = generateSuggestedCycleCounts()
      if (created.length > 0) {
        toast.success(`${created.length} plan(es) sugerido(s) generado(s)`, {
          description: 'Revisa la pestaña «Planes» en /cycle-count para iniciarlos.',
        })
      } else {
        toast.info('No hay combinaciones almacén × clase ABC vencidas sin un plan activo')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron generar los planes')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración de Conteo Cíclico"
        description="Gobierno del módulo de conteo cíclico e inventario físico: congelamiento, tolerancia de variación, frecuencia de conteo por clase ABC y el generador de planes sugeridos. Los cambios aquí afectan /cycle-count al instante."
      />

      {/* ── KPI header ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Gauge}
          label="IRA"
          value={`${accuracy.ira}%`}
          sublabel="exactitud de inventario"
          tone={accuracy.ira >= 95 ? 'green' : accuracy.ira >= 80 ? 'amber' : 'red'}
        />
        <StatCard
          icon={ClipboardCheck}
          label="Planes activos"
          value={activePlans}
          sublabel="pendientes o en progreso"
          tone={activePlans > 0 ? 'blue' : 'neutral'}
        />
        <StatCard
          icon={TriangleAlert}
          label="Líneas con diferencia"
          value={discrepancyLines}
          sublabel="contadas con variación ≠ 0"
          tone={discrepancyLines > 0 ? 'amber' : 'green'}
        />
        <StatCard
          icon={CalendarClock}
          label="Vencidos por ABC"
          value={overdue.length}
          sublabel="combinaciones producto×almacén"
          tone={overdue.length > 0 ? 'amber' : 'green'}
        />
      </div>

      {/* ── Freeze governance ─────────────────────────────────────────────── */}
      <Card
        className={cn(
          localSettings.cycleCountFreezeActive &&
            'border-red-300 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20'
        )}
      >
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Snowflake
              className={cn(
                'mt-0.5 size-5 shrink-0',
                localSettings.cycleCountFreezeActive ? 'text-red-600' : 'text-muted-foreground'
              )}
            />
            <div>
              <p className="text-sm font-semibold">Congelar operaciones de conteo cíclico</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Bloquea crear, iniciar, registrar líneas, completar y cancelar planes de conteo.
                Útil durante cierres de inventario general. Se aplica de inmediato.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {localSettings.cycleCountFreezeActive && (
              <Badge variant="outline" className="border-red-300 bg-red-100 text-red-700">
                Congelado
              </Badge>
            )}
            <Switch
              checked={localSettings.cycleCountFreezeActive}
              onCheckedChange={handleToggleFreeze}
              aria-label="Congelar conteo cíclico"
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
                Frecuencia de conteo por clase ABC, tolerancia de variación y valores por defecto
                para planes nuevos. Guarda para aplicarlos.
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
              title="Frecuencia de conteo por clase ABC"
              description="Días máximos entre conteos por clase — clase A (alta rotación) se cuenta más seguido. Alimenta la tabla de vencidos y el generador de planes sugeridos."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow label="Clase A" description="Productos de alta rotación (80% del pareto de picking).">
                <InlineSlider
                  value={localSettings.cycleCountFrequencyDaysA}
                  min={7}
                  max={90}
                  step={1}
                  suffix="d"
                  onChange={(v) => handleChange('cycleCountFrequencyDaysA', v)}
                />
              </SettingRow>
              <SettingRow label="Clase B" description="Productos de rotación media.">
                <InlineSlider
                  value={localSettings.cycleCountFrequencyDaysB}
                  min={14}
                  max={180}
                  step={1}
                  suffix="d"
                  onChange={(v) => handleChange('cycleCountFrequencyDaysB', v)}
                />
              </SettingRow>
              <SettingRow label="Clase C" description="Productos de baja rotación.">
                <InlineSlider
                  value={localSettings.cycleCountFrequencyDaysC}
                  min={30}
                  max={365}
                  step={1}
                  suffix="d"
                  onChange={(v) => handleChange('cycleCountFrequencyDaysC', v)}
                />
              </SettingRow>
            </div>
          </section>

          <section className="py-5">
            <SectionHeading
              icon={TriangleAlert}
              title="Tolerancia de variación"
              description="Por encima de este % la línea se resalta como «fuera de tolerancia» en /cycle-count. Solo gobierna el resaltado visual — la aprobación real del ajuste sigue el umbral en unidades de Configuración → Inventario."
            />
            <div className="mt-2">
              <SettingRow
                label="Tolerancia (%)"
                description="Ej: 2% sobre una posición de 100 uds tolera hasta ±2 sin resaltarse en rojo."
              >
                <InlineSlider
                  value={localSettings.cycleCountVarianceTolerancePct}
                  min={0}
                  max={25}
                  step={0.5}
                  suffix="%"
                  onChange={(v) => handleChange('cycleCountVarianceTolerancePct', v)}
                />
              </SettingRow>
            </div>
          </section>

          <section className="pt-5">
            <SectionHeading
              icon={Eye}
              title="Valores por defecto y automatización"
              description="Aplican a los planes nuevos creados desde /cycle-count."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow
                label="Conteo ciego por defecto"
                description="El operario no ve la cantidad esperada del sistema mientras cuenta (buena práctica anti-sesgo). Se puede ajustar por plan al crearlo."
              >
                <Switch
                  checked={localSettings.cycleCountBlindCountDefault}
                  onCheckedChange={(v) => handleChange('cycleCountBlindCountDefault', v)}
                />
              </SettingRow>
              <SettingRow
                label="Sugerir planes automáticamente por ABC"
                description="Habilita el botón «Generar planes sugeridos» de abajo y en /cycle-count."
              >
                <Switch
                  checked={localSettings.cycleCountAutoSuggestEnabled}
                  onCheckedChange={(v) => handleChange('cycleCountAutoSuggestEnabled', v)}
                />
              </SettingRow>
            </div>
          </section>
        </CardContent>
      </Card>

      {/* ── Vencidos por clase ABC ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="size-4" />
                Vencidos por clase ABC
              </CardTitle>
              <CardDescription>
                Combinaciones producto×almacén con stock que superaron la frecuencia configurada
                arriba sin un conteo físico. Ordenados por más atrasados primero.
              </CardDescription>
            </div>
            <Button
              size="sm"
              disabled={!settings.cycleCountAutoSuggestEnabled || overdue.length === 0}
              onClick={handleGenerateSuggested}
            >
              <Zap className="mr-1.5 size-3.5" />
              Generar planes sugeridos
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!settings.cycleCountAutoSuggestEnabled && (
            <p className="text-muted-foreground mx-4 mb-3 rounded-md border border-dashed px-3 py-2 text-xs">
              El generador automático está desactivado — actívalo arriba para poder crear planes
              sugeridos desde esta tabla.
            </p>
          )}
          {overdue.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm">
              <ListChecks className="size-8 text-zinc-300" />
              Todo el inventario está dentro de su frecuencia de conteo.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Almacén</TableHead>
                  <TableHead>Clase</TableHead>
                  <TableHead>Último conteo</TableHead>
                  <TableHead className="text-right">Días desde conteo</TableHead>
                  <TableHead className="text-right">Frecuencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdue.slice(0, 25).map((entry) => (
                  <TableRow key={`${entry.productId}-${entry.warehouseId}`} className="border-border/60">
                    <TableCell className="text-sm font-medium">{productName(entry.productId)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {warehouseName(entry.warehouseId)}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-[10px]', ABC_BADGE[entry.abcClass])}>{entry.abcClass}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {entry.lastCountedAt ? new Date(entry.lastCountedAt).toLocaleDateString('es-CO') : 'Nunca'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {entry.daysSinceCount ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right text-xs">
                      {entry.frequencyDays}d
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {overdue.length > 25 && (
            <p className="text-muted-foreground px-4 py-3 text-xs">
              Mostrando 25 de {overdue.length} combinaciones vencidas.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Help ───────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
        <Lightbulb className="mt-0.5 size-4 shrink-0" />
        <p>
          Estos parámetros gobiernan{' '}
          <a href="/cycle-count" className="font-medium underline underline-offset-2">
            /cycle-count
          </a>
          . Los ajustes generados al completar un conteo se aprueban con el mismo umbral que ya
          usa{' '}
          <a href="/inventory-settings" className="font-medium underline underline-offset-2">
            /inventory-settings
          </a>{' '}
          — cámbialo ahí si quieres que más diferencias requieran aprobación manual.
        </p>
      </div>
    </div>
  )
}
