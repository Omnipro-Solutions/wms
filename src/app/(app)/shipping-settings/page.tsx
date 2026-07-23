'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  ClipboardCheck,
  DollarSign,
  Layers,
  Snowflake,
  Target,
  Truck,
  type LucideIcon,
} from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  MODALITY_LABELS,
  SERVICE_LEVEL_LABELS,
  consolidationGroups,
  otifPercentage,
} from '@/lib/rules/shipping'
import type { CarrierModality, WmsSettings } from '@/types/wms'

const MODALITIES: CarrierModality[] = ['own', 'third_party', 'courier', 'last_mile']

// ── Reusable layout bits (mirror /packing-settings, /yard-settings) ──

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
  format,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  format?: (v: number) => string
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
      {format ? format(value) : value}
    </span>
  </div>
)

const ShippingSettingsPage = () => {
  const state = useWmsStore()
  const { settings, shipments, carriers, updateSettings } = state

  const [localSettings, setLocalSettings] = useState<WmsSettings>({ ...settings })
  const [settingsChanged, setSettingsChanged] = useState(false)

  const handleSettingChange = (
    key: keyof WmsSettings,
    value: number | boolean | string | CarrierModality[]
  ) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
    setSettingsChanged(true)
  }

  const handleSaveSettings = () => {
    updateSettings(localSettings)
    setSettingsChanged(false)
    toast.success('Configuración de despacho guardada')
  }

  const handleToggleFreeze = () => {
    const next = !settings.shippingFreezeActive
    updateSettings({ shippingFreezeActive: next })
    setLocalSettings((prev) => ({ ...prev, shippingFreezeActive: next }))
    toast[next ? 'warning' : 'success'](next ? 'Despacho congelado' : 'Despacho reactivado')
  }

  const handleToggleModality = (modality: CarrierModality) => {
    const current = localSettings.shippingEnabledModalities ?? []
    const next = current.includes(modality)
      ? current.filter((m) => m !== modality)
      : [...current, modality]
    handleSettingChange('shippingEnabledModalities', next)
  }

  // KPIs derived from shipments
  const kpis = useMemo(() => {
    const otif = otifPercentage(shipments)
    const pending = shipments.filter((s) => s.status === 'pending').length
    const inTransit = shipments.filter((s) => s.status === 'in_transit').length
    const unverified = shipments.filter(
      (s) => s.status === 'pending' && !(s.verifiedPackages ?? 0)
    ).length
    const groups = consolidationGroups(shipments)
    return { otif, pending, inTransit, unverified, groups }
  }, [shipments])

  const otifOnTarget = kpis.otif >= settings.shippingOtifTargetPct

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración de Despacho"
        description="Parámetros y gobierno del módulo de despacho y transporte — rate shopping, verificación de carga, despacho parcial, modalidades y meta OTIF. Los cambios aquí afectan de inmediato lo que se ve en /shipping."
      />

      {/* ── KPI row + freeze ─────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card
          className={cn(
            'border-2',
            otifOnTarget
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/40'
              : 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40'
          )}
        >
          <CardContent className="pt-5">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">OTIF</p>
            <p
              className={cn(
                'mt-1 text-4xl font-bold tabular-nums',
                otifOnTarget
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-red-700 dark:text-red-300'
              )}
            >
              {kpis.otif}%
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Meta {settings.shippingOtifTargetPct}% · {shipments.length} envíos
            </p>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardContent className="flex items-start gap-4 pt-5">
            <Snowflake
              className={cn(
                'mt-0.5 size-8 shrink-0',
                settings.shippingFreezeActive ? 'text-blue-500' : 'text-zinc-300'
              )}
            />
            <div className="flex-1">
              <p className="text-sm font-medium">Modo congelado</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Bloquea despachar, entregar, verificar carga, recotizar y crear/despachar
                manifiestos.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Switch
                  checked={settings.shippingFreezeActive}
                  onCheckedChange={handleToggleFreeze}
                />
                <span className="text-sm">
                  {settings.shippingFreezeActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              Por despachar
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-amber-600 dark:text-amber-300">
              {kpis.pending}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {kpis.unverified} sin verificar · {kpis.inTransit} en tránsito
            </p>
          </CardContent>
        </Card>
      </div>

      {settings.shippingFreezeActive && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/40">
          <Snowflake className="size-5 shrink-0 text-blue-600 dark:text-blue-300" />
          <p className="flex-1 text-sm text-blue-800 dark:text-blue-300">
            Con despacho congelado, ve a <span className="font-semibold">/shipping</span> e intenta
            despachar o entregar un envío — verás el bloqueo en vivo.
          </p>
        </div>
      )}

      <Separator />

      {/* ── Parameters ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-sm">Parámetros del módulo</CardTitle>
              <CardDescription>
                Rate shopping, verificación de carga, despacho parcial y OTIF.
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
              icon={DollarSign}
              title="Rate shopping"
              description="Cómo el sistema compara y recomienda transportadora según costo, zona y tiempo de tránsito."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow
                label="Preseleccionar mejor tarifa"
                description="Al abrir el comparador en /shipping, marca automáticamente la opción recomendada."
              >
                <Switch
                  checked={localSettings.shippingAutoRateShop}
                  onCheckedChange={(v) => handleSettingChange('shippingAutoRateShop', v)}
                />
              </SettingRow>
              <SettingRow
                label="Criterio de recomendación"
                description="Menor costo prioriza el precio; menor tiempo prioriza los días de tránsito."
              >
                <Select
                  value={localSettings.shippingRateStrategy}
                  onValueChange={(v) => handleSettingChange('shippingRateStrategy', v)}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cheapest">Menor costo</SelectItem>
                    <SelectItem value="fastest">Menor tiempo</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
              <SettingRow
                label="Sobrecosto máximo sobre la mejor tarifa"
                description="Cuánto más caro se acepta pagar por un servicio más rápido antes de volver a la opción económica."
              >
                <InlineSlider
                  value={localSettings.shippingMaxCostOverBestPct}
                  min={0}
                  max={0.5}
                  step={0.05}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onChange={(v) => handleSettingChange('shippingMaxCostOverBestPct', v)}
                />
              </SettingRow>
            </div>
          </section>

          <section className="py-5">
            <SectionHeading
              icon={ClipboardCheck}
              title="Verificación de carga y despacho parcial"
              description="Última barrera antes de que el camión salga: qué se exige para confirmar el despacho."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow
                label="Exigir verificación de carga"
                description="No se puede despachar hasta confirmar los bultos cargados contra los esperados."
              >
                <Switch
                  checked={localSettings.shippingRequireLoadVerification}
                  onCheckedChange={(v) => handleSettingChange('shippingRequireLoadVerification', v)}
                />
              </SettingRow>
              <SettingRow
                label="Permitir despacho parcial"
                description="Deja salir el envío con menos bultos de los esperados, registrando el saldo pendiente."
              >
                <Switch
                  checked={localSettings.shippingAllowPartialDispatch}
                  onCheckedChange={(v) => handleSettingChange('shippingAllowPartialDispatch', v)}
                />
              </SettingRow>
              <SettingRow
                label="Consolidar por destino"
                description="Sugiere agrupar envíos pendientes que comparten ciudad de destino en una sola ruta."
              >
                <Switch
                  checked={localSettings.shippingConsolidateByDestination}
                  onCheckedChange={(v) => handleSettingChange('shippingConsolidateByDestination', v)}
                />
              </SettingRow>
            </div>
          </section>

          <section className="pt-5">
            <SectionHeading
              icon={Target}
              title="OTIF (On-Time In-Full)"
              description="Umbrales de cumplimiento de la promesa de entrega al cliente."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow
                label="Holgura para 'en riesgo'"
                description="Días de retraso sobre la fecha prometida antes de marcar el envío como tarde."
              >
                <InlineSlider
                  value={localSettings.shippingOtifAtRiskDays}
                  min={0}
                  max={5}
                  step={1}
                  format={(v) => `${v} d`}
                  onChange={(v) => handleSettingChange('shippingOtifAtRiskDays', v)}
                />
              </SettingRow>
              <SettingRow
                label="Meta OTIF"
                description="Porcentaje objetivo de entregas a tiempo y completas — referencia de los KPIs."
              >
                <InlineSlider
                  value={localSettings.shippingOtifTargetPct}
                  min={50}
                  max={100}
                  step={1}
                  format={(v) => `${v}%`}
                  onChange={(v) => handleSettingChange('shippingOtifTargetPct', v)}
                />
              </SettingRow>
            </div>
          </section>
        </CardContent>
      </Card>

      {/* ── Modalities ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Truck className="size-4" /> Modalidades de transporte
          </CardTitle>
          <CardDescription>
            Medios habilitados para cotizar y despachar. Una modalidad desactivada desaparece del
            rate shopping y bloquea el despacho por ese medio.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-zinc-100 pt-0 dark:divide-zinc-800/60">
          {MODALITIES.map((modality) => {
            const enabled = localSettings.shippingEnabledModalities?.includes(modality) ?? false
            const carrierCount = carriers.filter((c) => c.modalityType === modality).length
            return (
              <SettingRow
                key={modality}
                label={MODALITY_LABELS[modality]}
                description={`${carrierCount} transportadora(s) registrada(s) con esta modalidad.`}
              >
                <Switch checked={enabled} onCheckedChange={() => handleToggleModality(modality)} />
              </SettingRow>
            )
          })}
        </CardContent>
      </Card>

      {/* ── Carrier / service catalogue (read-only view) ─────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <DollarSign className="size-4" /> Tarifario por transportadora ({carriers.length})
          </CardTitle>
          <CardDescription>
            Servicios y tarifas que alimentan el rate shopping. Se editan en Administración →
            Transportadoras.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {carriers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Truck className="size-8 text-zinc-300" />
              <p className="text-muted-foreground text-sm">Sin transportadoras configuradas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transportadora</TableHead>
                    <TableHead>Modalidad</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Por kg</TableHead>
                    <TableHead className="text-right">Tránsito</TableHead>
                    <TableHead>Zonas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carriers.flatMap((carrier) =>
                    carrier.services.map((service, idx) => (
                      <TableRow key={`${carrier.id}-${service.serviceLevel}`}>
                        <TableCell className="font-medium">
                          {idx === 0 ? carrier.name : ''}
                          {idx === 0 && !carrier.active && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              Inactiva
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-zinc-500">
                          {idx === 0 && carrier.modalityType
                            ? MODALITY_LABELS[carrier.modalityType]
                            : ''}
                        </TableCell>
                        <TableCell className="text-sm">
                          {SERVICE_LEVEL_LABELS[service.serviceLevel]}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          ${service.baseCostUsd}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          ${service.costPerKgUsd}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {service.transitDays} d
                        </TableCell>
                        <TableCell className="font-mono text-xs text-zinc-500">
                          {service.availableZones.join(', ')}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Consolidation preview ────────────────────────────────────────── */}
      {localSettings.shippingConsolidateByDestination && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Layers className="size-4" /> Oportunidades de consolidación ({kpis.groups.length})
            </CardTitle>
            <CardDescription>
              Envíos pendientes que comparten ciudad de destino y podrían viajar en una sola ruta.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {kpis.groups.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Layers className="size-8 text-zinc-300" />
                <p className="text-muted-foreground text-sm">
                  No hay destinos con más de un envío pendiente.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Destino</TableHead>
                      <TableHead className="text-right">Envíos</TableHead>
                      <TableHead className="text-right">Bultos</TableHead>
                      <TableHead className="text-right">Peso</TableHead>
                      <TableHead>Transportadoras</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kpis.groups.map((g) => (
                      <TableRow key={g.destinationCity}>
                        <TableCell className="font-medium">{g.destinationCity}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {g.shipmentIds.length}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{g.totalPackages}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {g.totalWeightKg.toFixed(1)} kg
                        </TableCell>
                        <TableCell className="text-xs text-zinc-500">
                          {g.carrierNames.join(', ')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ShippingSettingsPage
