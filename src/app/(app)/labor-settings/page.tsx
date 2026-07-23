'use client'

import { useMemo, useState } from 'react'
import { Gauge, Route } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { buildLaborQueue, productivityByAllSources } from '@/lib/rules/labor'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

const SectionHeading = ({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Gauge
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
  children: React.ReactNode
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
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
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
    <span className="w-14 shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-right text-sm font-semibold tabular-nums dark:bg-zinc-800">
      {value}
    </span>
  </div>
)

const LaborSettingsPage = () => {
  const state = useWmsStore()
  const { settings, updateSettings } = state

  const [localSettings, setLocalSettings] = useState({ ...settings })
  const [settingsChanged, setSettingsChanged] = useState(false)

  const handleSettingChange = (key: keyof typeof settings, value: number | boolean) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
    setSettingsChanged(true)
  }

  const handleSaveSettings = () => {
    updateSettings(localSettings)
    setSettingsChanged(false)
  }

  const queue = useMemo(
    () => buildLaborQueue(state.pickingTasks, state.replenishmentTasks, state.asnRecords),
    [state.pickingTasks, state.replenishmentTasks, state.asnRecords]
  )
  const unassignedPct = queue.length > 0 ? Math.round((queue.filter((i) => !i.operatorName).length / queue.length) * 100) : 0

  const productivityRows = useMemo(
    () => productivityByAllSources(state.pickingTasks, state.replenishmentTasks, state.asnRecords),
    [state.pickingTasks, state.replenishmentTasks, state.asnRecords]
  )
  const avgUnitsPerOperator =
    productivityRows.length > 0
      ? Math.round(productivityRows.reduce((sum, r) => sum + r.unitsPicked, 0) / productivityRows.length)
      : 0

  const activeOperatorCount = state.operators.filter((o) => o.active).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración de Mano de obra"
        description="Parámetros de la cola de tareas, interleaving y metas de productividad usados en /labor."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Unidades promedio / operario</p>
            <p className="mt-1 text-4xl font-bold tabular-nums">{avgUnitsPerOperator}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Tareas sin asignar</p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-amber-600">{unassignedPct}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Operarios activos</p>
            <p className="mt-1 text-4xl font-bold tabular-nums">{activeOperatorCount}</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-sm">Parámetros del módulo</CardTitle>
              <CardDescription>Umbrales de prioridad, interleaving y metas de productividad.</CardDescription>
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
            <SectionHeading icon={Route} title="Interleaving" description="Sugerencia de ruta combinada cuando un operario tiene tareas de distinto tipo cerca entre sí." />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow label="Habilitar sugerencia de ruta combinada" description="Agrupa tareas de picking/putaway/reposición del mismo operario cuando están cerca.">
                <Switch
                  checked={localSettings.laborInterleavingEnabled}
                  onCheckedChange={(v) => handleSettingChange('laborInterleavingEnabled', v)}
                />
              </SettingRow>
              {localSettings.laborInterleavingEnabled && (
                <SettingRow label="Distancia máxima (m)" description="Distancia entre ubicaciones por debajo de la cual se agrupan como ruta combinada.">
                  <InlineSlider value={localSettings.laborInterleavingMaxDistanceM} min={5} max={100} step={5} onChange={(v) => handleSettingChange('laborInterleavingMaxDistanceM', v)} />
                </SettingRow>
              )}
            </div>
          </section>

          <section className="pt-5">
            <SectionHeading icon={Gauge} title="Meta de productividad" description="Solo colorea el KPI de unidades/hora en la pestaña Productividad — no genera incentivos reales." />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow label="Unidades/hora objetivo" description="Meta usada para colorear la fila de cada operario en la tabla de productividad.">
                <InlineSlider value={localSettings.laborTargetUnitsPerHour} min={5} max={200} step={5} onChange={(v) => handleSettingChange('laborTargetUnitsPerHour', v)} />
              </SettingRow>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}

export default LaborSettingsPage
