'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import {
  Boxes,
  ClipboardList,
  Gauge,
  MapPin,
  Package,
  Pencil,
  Plus,
  Snowflake,
  Store,
  Trash2,
  TriangleAlert,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import {
  abcByProduct,
  selectReplenishmentNeeds,
  selectStoreReplenishmentNeeds,
} from '@/store/selectors'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { SubNav, type SubNavItem } from '@/components/shared/sub-nav'
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
import { formatNumber } from '@/lib/formatters'
import type { Product, StorageLocation, StoreReplenishmentPolicy, WmsSettings } from '@/types/wms'
import { LimitsDialog } from './_components/limits-dialog'
import { StorePolicyDialog } from './_components/store-policy-dialog'

type TabValue = 'params' | 'sku' | 'location' | 'stores'

// ── Reusable layout bits (mirror /returns-settings) ──────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReplenishmentSettingsPage() {
  const state = useWmsStore()
  const {
    settings,
    products,
    locations,
    warehouses,
    demandStats,
    storeReplenishmentPolicies,
    updateSettings,
    updateProduct,
    updateLocation,
    removeStoreReplenishmentPolicy,
    toggleStoreReplenishmentPolicy,
  } = state
  const { warehouseName } = useStoreHelpers()

  const searchParams = useSearchParams()
  const activeTab = (searchParams.get('tab') as TabValue) ?? 'params'

  const [localSettings, setLocalSettings] = useState<WmsSettings>({ ...settings })
  const [settingsChanged, setSettingsChanged] = useState(false)

  // Dialog state
  const [skuDialog, setSkuDialog] = useState<Product | null>(null)
  const [locDialog, setLocDialog] = useState<StorageLocation | null>(null)
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<StoreReplenishmentPolicy | null>(null)

  const abc = useMemo(() => abcByProduct(state), [state])
  const needs = useMemo(() => selectReplenishmentNeeds(state), [state])
  const storeNeeds = useMemo(
    () => selectStoreReplenishmentNeeds(state).filter((n) => !n.hasActiveTask),
    [state]
  )

  // DC pick faces only (store sales floors use policies, not location overrides).
  const dcWarehouseIds = useMemo(
    () => new Set(warehouses.filter((w) => w.type === 'distribution_center').map((w) => w.id)),
    [warehouses]
  )
  const dcPickFaces = useMemo(
    () => locations.filter((l) => l.isPickFace && dcWarehouseIds.has(l.warehouseId)),
    [locations, dcWarehouseIds]
  )

  // Effective SKU limits for display (explicit override vs demand-based fallback).
  const skuLimits = (p: Product) => {
    const demand = demandStats.find((d) => d.productId === p.id)
    const min =
      p.minStockUnits ??
      (demand ? Math.round(demand.pickingFrequency * 2) : localSettings.replenishmentDefaultMinUnits)
    const max =
      p.maxStockUnits ??
      (demand ? Math.round(demand.pickingFrequency * 6) : localSettings.replenishmentDefaultMaxUnits)
    const explicit = p.minStockUnits !== undefined || p.maxStockUnits !== undefined
    const source = explicit ? 'SKU' : demand ? 'demanda' : 'default'
    return { min, max, explicit, source }
  }

  const activePolicies = storeReplenishmentPolicies.filter((p) => p.active).length

  const handleChange = <K extends keyof WmsSettings>(key: K, value: WmsSettings[K]) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
    setSettingsChanged(true)
  }

  const handleSave = () => {
    // Keep medium strictly above high so the 3-tier priority stays coherent.
    const mediumFactor = Math.max(
      localSettings.replenishmentMediumFactor,
      localSettings.replenishmentHighFactor + 0.05
    )
    updateSettings({ ...localSettings, replenishmentMediumFactor: Number(mediumFactor.toFixed(2)) })
    setLocalSettings((prev) => ({ ...prev, replenishmentMediumFactor: Number(mediumFactor.toFixed(2)) }))
    setSettingsChanged(false)
  }

  // Governance switches apply immediately (not via the buffer).
  const handleToggleFreeze = (active: boolean) => {
    updateSettings({ replenishmentFreezeActive: active })
    setLocalSettings((prev) => ({ ...prev, replenishmentFreezeActive: active }))
  }
  const handleToggleAutoStore = (active: boolean) => {
    updateSettings({ replenishmentAutoStoreEnabled: active })
    setLocalSettings((prev) => ({ ...prev, replenishmentAutoStoreEnabled: active }))
  }
  const handleSourceChange = (id: string) => {
    updateSettings({ replenishmentStoreSourceWarehouseId: id })
    setLocalSettings((prev) => ({ ...prev, replenishmentStoreSourceWarehouseId: id }))
  }

  const dcOptions = warehouses.filter((w) => w.type === 'distribution_center')

  const TABS: SubNavItem[] = [
    { value: 'params', label: 'Parámetros', icon: Gauge },
    { value: 'sku', label: 'Min/Max por SKU', icon: Package, count: products.length },
    { value: 'location', label: 'Min/Max por ubicación', icon: MapPin, count: dcPickFaces.length },
    { value: 'stores', label: 'Tiendas', icon: Store, count: storeReplenishmentPolicies.length },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración de Reabastecimiento"
        description="Gobierno del módulo #11: umbrales de prioridad, min/max por SKU y por ubicación, políticas de tienda (retail), reabastecimiento automático y congelamiento. Los cambios afectan /replenishment al instante."
      />

      {/* KPI header */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={TriangleAlert}
          label="Pick faces bajo mínimo"
          value={needs.length}
          sublabel="según la configuración actual"
          tone={needs.length > 0 ? 'red' : 'green'}
        />
        <StatCard
          icon={Store}
          label="Tiendas bajo mínimo"
          value={storeNeeds.length}
          sublabel="con política activa"
          tone={storeNeeds.length > 0 ? 'red' : 'green'}
        />
        <StatCard
          icon={ClipboardList}
          label="Políticas de tienda"
          value={storeReplenishmentPolicies.length}
          sublabel={`${activePolicies} activas`}
          tone="neutral"
        />
        <StatCard
          icon={Zap}
          label="Auto tiendas"
          value={localSettings.replenishmentAutoStoreEnabled ? 'ON' : 'OFF'}
          sublabel={localSettings.replenishmentAutoStoreEnabled ? 'genera solo' : 'manual'}
          tone={localSettings.replenishmentAutoStoreEnabled ? 'blue' : 'neutral'}
        />
      </div>

      <SubNav items={TABS} defaultValue="params" />

      {/* ════════ Parámetros ════════ */}
      {activeTab === 'params' && (
        <div className="flex flex-col gap-6">
          {/* Freeze */}
          <Card
            className={cn(
              localSettings.replenishmentFreezeActive &&
                'border-red-300 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20'
            )}
          >
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Snowflake
                  className={cn(
                    'mt-0.5 size-5 shrink-0',
                    localSettings.replenishmentFreezeActive ? 'text-red-600' : 'text-muted-foreground'
                  )}
                />
                <div>
                  <p className="text-sm font-semibold">Congelar operaciones de reabastecimiento</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Bloquea generar, iniciar y completar tareas (CD y tienda). Útil durante conteos o
                    auditorías. Se aplica de inmediato.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {localSettings.replenishmentFreezeActive && (
                  <Badge variant="outline" className="border-red-300 bg-red-100 text-red-700">
                    Congelado
                  </Badge>
                )}
                <Switch
                  checked={localSettings.replenishmentFreezeActive}
                  onCheckedChange={handleToggleFreeze}
                  aria-label="Congelar reabastecimiento"
                />
              </div>
            </CardContent>
          </Card>

          {/* Auto-store */}
          <Card
            className={cn(
              localSettings.replenishmentAutoStoreEnabled &&
                'border-blue-300 bg-blue-50/60 dark:border-blue-900/60 dark:bg-blue-950/20'
            )}
          >
            <CardContent className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Zap
                    className={cn(
                      'mt-0.5 size-5 shrink-0',
                      localSettings.replenishmentAutoStoreEnabled
                        ? 'text-blue-600'
                        : 'text-muted-foreground'
                    )}
                  />
                  <div>
                    <p className="text-sm font-semibold">Reabastecimiento automático a tiendas</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Cuando está activo, las necesidades de tienda se convierten en tareas DC→tienda
                      sin intervención manual al abrir /replenishment.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={localSettings.replenishmentAutoStoreEnabled}
                  onCheckedChange={handleToggleAutoStore}
                  aria-label="Reabastecimiento automático a tiendas"
                />
              </div>
              <SettingRow
                label="CD origen de las tiendas"
                description="Centro de distribución que surte las tiendas por defecto."
              >
                <Select
                  value={localSettings.replenishmentStoreSourceWarehouseId}
                  onValueChange={handleSourceChange}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Selecciona un CD" />
                  </SelectTrigger>
                  <SelectContent>
                    {dcOptions.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>
            </CardContent>
          </Card>

          {/* Buffered parameters */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-sm">Umbrales y valores por defecto</CardTitle>
                  <CardDescription>
                    Prioridad de reposición y min/max por defecto. Guarda para aplicarlos.
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
                  icon={Gauge}
                  title="Prioridad de reposición (alta/media/baja)"
                  description="Como fracción del mínimo. Bajo «alta» = crítico; entre «alta» y «media» = media; entre «media» y el mínimo = baja."
                />
                <div className="mt-2">
                  <SettingRow
                    label="Umbral ALTA"
                    description={`Stock < ${Math.round(localSettings.replenishmentHighFactor * 100)}% del mínimo → prioridad alta.`}
                  >
                    <InlineSlider
                      value={localSettings.replenishmentHighFactor}
                      min={0.1}
                      max={0.9}
                      step={0.05}
                      onChange={(v) => handleChange('replenishmentHighFactor', v)}
                    />
                  </SettingRow>
                  <SettingRow
                    label="Umbral MEDIA"
                    description={`Stock < ${Math.round(localSettings.replenishmentMediumFactor * 100)}% del mínimo → prioridad media (debe ser mayor que «alta»).`}
                  >
                    <InlineSlider
                      value={localSettings.replenishmentMediumFactor}
                      min={0.15}
                      max={1}
                      step={0.05}
                      onChange={(v) => handleChange('replenishmentMediumFactor', v)}
                    />
                  </SettingRow>
                </div>
              </section>

              <section className="pt-5">
                <SectionHeading
                  icon={Boxes}
                  title="Min/Max por defecto"
                  description="Se usan cuando un SKU/ubicación no tiene límites explícitos ni datos de demanda."
                />
                <div className="mt-2">
                  <SettingRow label="Mínimo por defecto (uds.)" description="Nivel mínimo de fallback.">
                    <InlineSlider
                      value={localSettings.replenishmentDefaultMinUnits}
                      min={0}
                      max={100}
                      step={1}
                      suffix="u"
                      onChange={(v) => handleChange('replenishmentDefaultMinUnits', v)}
                    />
                  </SettingRow>
                  <SettingRow label="Máximo por defecto (uds.)" description="Nivel máximo de fallback.">
                    <InlineSlider
                      value={localSettings.replenishmentDefaultMaxUnits}
                      min={1}
                      max={300}
                      step={5}
                      suffix="u"
                      onChange={(v) => handleChange('replenishmentDefaultMaxUnits', v)}
                    />
                  </SettingRow>
                </div>
              </section>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════ Min/Max por SKU ════════ */}
      {activeTab === 'sku' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Package className="size-4" />
              Min/Max por SKU
            </CardTitle>
            <CardDescription>
              Nivel de reposición por producto. Si no se define, se estima por demanda histórica
              (frecuencia × 2 / × 6) o cae al valor por defecto.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>ABC</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="text-right">Máximo</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => {
                  const { min, max, explicit, source } = skuLimits(p)
                  return (
                    <TableRow key={p.id} className="border-border/60">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            <Image
                              src={p.imageUrl}
                              alt={p.name}
                              width={28}
                              height={28}
                              className="size-7 shrink-0 rounded-md object-cover"
                            />
                          ) : (
                            <div className="bg-muted size-7 shrink-0 rounded-md" />
                          )}
                          <div>
                            <p className="text-sm font-medium leading-tight">{p.name}</p>
                            <p className="text-muted-foreground font-mono text-[10px]">{p.sku}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {abc[p.id] ?? 'C'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">
                        {formatNumber(min)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">
                        {formatNumber(max)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px]',
                            explicit
                              ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300'
                              : 'text-muted-foreground'
                          )}
                        >
                          {source}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setSkuDialog(p)}>
                          <Pencil className="mr-1 size-3.5" /> Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ════════ Min/Max por ubicación ════════ */}
      {activeTab === 'location' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <MapPin className="size-4" />
              Min/Max por ubicación (pick face)
            </CardTitle>
            <CardDescription>
              Override a nivel de ubicación. Cuando se define, manda sobre el min/max del SKU para
              todo lo que viva en esa cara.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Almacén</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="text-right">Máximo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dcPickFaces.map((l) => {
                  const hasOverride = l.minStockUnits !== undefined || l.maxStockUnits !== undefined
                  return (
                    <TableRow key={l.id} className="border-border/60">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                            {l.code}
                          </span>
                          {l.golden && (
                            <Badge
                              variant="outline"
                              className="border-amber-200 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
                            >
                              golden
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {warehouseName(l.warehouseId)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {l.minStockUnits !== undefined ? (
                          <span className="font-semibold">{formatNumber(l.minStockUnits)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {l.maxStockUnits !== undefined ? (
                          <span className="font-semibold">{formatNumber(l.maxStockUnits)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasOverride ? (
                          <Badge
                            variant="outline"
                            className="border-blue-200 bg-blue-50 text-[10px] text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300"
                          >
                            override
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">hereda del SKU</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setLocDialog(l)}>
                          <Pencil className="mr-1 size-3.5" /> Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ════════ Tiendas (policies) ════════ */}
      {activeTab === 'stores' && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Store className="size-4" />
                  Políticas de tienda (min/max por tienda × SKU)
                </CardTitle>
                <CardDescription>
                  Definen cuándo una tienda se considera bajo mínimo y cuánto surtir desde el CD.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingPolicy(null)
                  setPolicyDialogOpen(true)
                }}
              >
                <Plus className="mr-1.5 size-3.5" />
                Nueva política
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {storeReplenishmentPolicies.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm">
                <Store className="size-7 text-zinc-300" />
                Sin políticas de tienda. Crea la primera para habilitar el surtido retail.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tienda</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                    <TableHead className="text-right">Máximo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {storeReplenishmentPolicies.map((pol) => {
                    const product = products.find((p) => p.id === pol.productId)
                    return (
                      <TableRow key={pol.id} className="border-border/60">
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Store className="text-muted-foreground size-3.5" />
                            {warehouseName(pol.storeWarehouseId)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {product?.name ?? pol.productId}
                          <span className="text-muted-foreground ml-1 font-mono text-[10px]">
                            {product?.sku}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold tabular-nums">
                          {formatNumber(pol.minStock)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold tabular-nums">
                          {formatNumber(pol.maxStock)}
                        </TableCell>
                        <TableCell>
                          {pol.active ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                            >
                              Activa
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Inactiva
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Switch
                              checked={pol.active}
                              onCheckedChange={() => toggleStoreReplenishmentPolicy(pol.id)}
                              aria-label={pol.active ? 'Desactivar' : 'Activar'}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="size-8 p-0"
                              onClick={() => {
                                setEditingPolicy(pol)
                                setPolicyDialogOpen(true)
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive size-8 p-0"
                              onClick={() => removeStoreReplenishmentPolicy(pol.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Dialogs ── */}
      <LimitsDialog
        open={skuDialog !== null}
        title={skuDialog ? `Min/Max — ${skuDialog.name}` : ''}
        subtitle="Nivel de reposición explícito para este SKU. Manda sobre la estimación por demanda."
        initialMin={skuDialog?.minStockUnits}
        initialMax={skuDialog?.maxStockUnits}
        hasOverride={
          skuDialog ? skuDialog.minStockUnits !== undefined || skuDialog.maxStockUnits !== undefined : false
        }
        onSave={(min, max) => {
          if (skuDialog) updateProduct(skuDialog.id, { minStockUnits: min, maxStockUnits: max })
        }}
        onClear={() => {
          if (skuDialog) updateProduct(skuDialog.id, { minStockUnits: undefined, maxStockUnits: undefined })
        }}
        onClose={() => setSkuDialog(null)}
      />

      <LimitsDialog
        open={locDialog !== null}
        title={locDialog ? `Min/Max — ${locDialog.code}` : ''}
        subtitle="Override de ubicación. Manda sobre el min/max del SKU para todo lo que viva en esta cara."
        initialMin={locDialog?.minStockUnits}
        initialMax={locDialog?.maxStockUnits}
        hasOverride={
          locDialog ? locDialog.minStockUnits !== undefined || locDialog.maxStockUnits !== undefined : false
        }
        onSave={(min, max) => {
          if (locDialog) updateLocation(locDialog.id, { minStockUnits: min, maxStockUnits: max })
        }}
        onClear={() => {
          if (locDialog) updateLocation(locDialog.id, { minStockUnits: undefined, maxStockUnits: undefined })
        }}
        onClose={() => setLocDialog(null)}
      />

      <StorePolicyDialog
        open={policyDialogOpen}
        policy={editingPolicy}
        onClose={() => {
          setPolicyDialogOpen(false)
          setEditingPolicy(null)
        }}
      />
    </div>
  )
}
