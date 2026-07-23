'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  DollarSign,
  Layers,
  Snowflake,
  Truck,
  TriangleAlert,
  TrendingUp,
} from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { useDialogState } from '@/hooks/use-dialog-state'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SubNav, type SubNavItem } from '@/components/shared/sub-nav'
import { formatNumber } from '@/lib/formatters'
import {
  consolidationGroups,
  otifPercentage,
  otifAlerts,
  rateShop,
  recommendedQuote,
} from '@/lib/rules/shipping'
import { RateShoppingDialog } from './_components/rate-shopping-dialog'
import { OtifDashboard } from './_components/otif-dashboard'
import { buildShippingColumns, type ShippingRow } from './columns'
import type { CarrierRateQuote } from '@/types/wms'

interface ShipDialogData {
  shipmentId: string
  customerName: string
  carrierName: string
  packageCount: number
  weightKg: number
  modalityType: ShippingRow['modalityType']
}

interface RateShopContext {
  shipmentId: string
  customerName: string
  destinationCity: string
  destinationZone: string
  weightKg: number
  packageCount: number
}

const SHIPPING_TABS: SubNavItem[] = [
  { value: 'shipments', label: 'Envíos' },
  { value: 'consolidation', label: 'Consolidación' },
  { value: 'otif', label: 'OTIF' },
]

export default function ShippingPage() {
  const today = new Date().toISOString().slice(0, 10)

  const state = useWmsStore()
  const { shipOrder, deliverShipment, verifyShipmentLoad, applyRateQuote, settings } = state
  const { carriers } = state

  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'shipments'
  const [otifFilter, setOtifFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [carrierFilter, setCarrierFilter] = useState('all')
  const [modalityFilter, setModalityFilter] = useState('all')

  const shipDialog = useDialogState<ShipDialogData>()
  const deliverDialog = useDialogState<{ shipmentId: string; customerName: string }>()
  const verifyDialog = useDialogState<{
    shipmentId: string
    customerName: string
    packageCount: number
  }>()
  const [verifiedInput, setVerifiedInput] = useState(0)

  const [rateShopCtx, setRateShopCtx] = useState<RateShopContext | null>(null)
  const [rateShopError, setRateShopError] = useState('')
  const [driverName, setDriverName] = useState('')
  const [vehiclePlate, setVehiclePlate] = useState('')

  // ── Rows ──────────────────────────────────────────────────────────────────

  const rows = useMemo<ShippingRow[]>(
    () =>
      state.shipments.map((sh) => {
        const order = state.commerceOrders.find((o) => o.id === sh.orderId)
        const carrier = carriers.find((c) => c.id === sh.carrierId)
        return {
          id: sh.id,
          orderNumber: order?.orderNumber ?? sh.orderId,
          customerName: sh.customerName,
          carrierId: sh.carrierId,
          carrierName: sh.carrierName,
          modalityType: carrier?.modalityType,
          serviceLevel: sh.serviceLevel,
          quotedCostUsd: sh.quotedCostUsd,
          destinationCity: sh.destinationCity,
          packageCount: sh.packageCount,
          weightKg: sh.weightKg,
          trackingNumber: sh.trackingNumber ?? null,
          promisedDate: sh.promisedDate ?? null,
          estimatedDeliveryDate: sh.estimatedDeliveryDate ?? null,
          otifStatus: sh.otifStatus,
          status: sh.status,
          shippedAt: sh.shippedAt ?? null,
          deliveredAt: sh.deliveredAt ?? null,
          verifiedPackages: sh.verifiedPackages ?? 0,
          partialDispatch: sh.partialDispatch ?? false,
          pendingPackages: sh.pendingPackages ?? 0,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.shipments, carriers]
  )

  const uniqueCarriers = useMemo(() => [...new Set(rows.map((r) => r.carrierName))], [rows])

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (otifFilter !== 'all' && r.otifStatus !== otifFilter) return false
        if (statusFilter !== 'all' && r.status !== statusFilter) return false
        if (carrierFilter !== 'all' && r.carrierName !== carrierFilter) return false
        if (modalityFilter !== 'all' && r.modalityType !== modalityFilter) return false
        return true
      }),
    [rows, otifFilter, statusFilter, carrierFilter, modalityFilter]
  )

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const otif = otifPercentage(state.shipments)
  const { inTransitCount, pendingCount, totalCost } = useMemo(() => {
    let inTransit = 0, pending = 0, cost = 0
    for (const s of state.shipments) {
      if (s.status === 'in_transit') inTransit++
      if (s.status === 'pending') pending++
      cost += s.quotedCostUsd ?? 0
    }
    return { inTransitCount: inTransit, pendingCount: pending, totalCost: cost }
  }, [state.shipments])

  // ── OTIF alerts ───────────────────────────────────────────────────────────

  const orderNumberMap = useMemo(
    () => Object.fromEntries(state.commerceOrders.map((o) => [o.id, o.orderNumber])),
    [state.commerceOrders]
  )

  const alerts = useMemo(
    () => otifAlerts(state.shipments, orderNumberMap, today),
    [state.shipments, orderNumberMap]
  )

  // ── Consolidation by destination ──────────────────────────────────────────

  const consolidation = useMemo(
    () => (settings.shippingConsolidateByDestination ? consolidationGroups(state.shipments) : []),
    [state.shipments, settings.shippingConsolidateByDestination]
  )

  // ── Rate shop quotes ───────────────────────────────────────────────────────

  const rateQuotes = useMemo<CarrierRateQuote[]>(() => {
    if (!rateShopCtx) return []
    return rateShop(state.carriers, rateShopCtx.weightKg, rateShopCtx.destinationZone, today, {
      enabledModalities: settings.shippingEnabledModalities,
      strategy: settings.shippingRateStrategy,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rateShopCtx,
    state.carriers,
    settings.shippingEnabledModalities,
    settings.shippingRateStrategy,
  ])

  // Cotización recomendada por la política configurada — se preselecciona si así se configuró.
  const suggestedQuote = useMemo(
    () =>
      settings.shippingAutoRateShop
        ? recommendedQuote(rateQuotes, settings.shippingMaxCostOverBestPct)
        : null,
    [rateQuotes, settings.shippingAutoRateShop, settings.shippingMaxCostOverBestPct]
  )

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openShipDialog = (row: ShippingRow) => {
    setDriverName('')
    setVehiclePlate('')
    shipDialog.open({
      shipmentId: row.id,
      customerName: row.customerName,
      carrierName: row.carrierName,
      packageCount: row.packageCount,
      weightKg: row.weightKg,
      modalityType: row.modalityType,
    })
  }

  const handleShip = () => {
    if (!shipDialog.data) return
    const isOwn = shipDialog.data.modalityType === 'own'
    try {
      shipOrder(
        shipDialog.data.shipmentId,
        'Operador',
        isOwn ? { driverName: driverName.trim(), vehiclePlate: vehiclePlate.trim().toUpperCase() } : undefined
      )
      shipDialog.close()
    } catch (e: unknown) {
      shipDialog.setError(e instanceof Error ? e.message : 'Error al despachar')
    }
  }

  const openDeliverDialog = (row: ShippingRow) => {
    deliverDialog.open({ shipmentId: row.id, customerName: row.customerName })
  }

  const handleDeliver = () => {
    if (!deliverDialog.data) return
    try {
      deliverShipment(deliverDialog.data.shipmentId)
      deliverDialog.close()
    } catch (e: unknown) {
      deliverDialog.setError(e instanceof Error ? e.message : 'Error al registrar entrega')
    }
  }

  const openRateShop = (row: ShippingRow) => {
    setRateShopError('')
    const shipment = state.shipments.find((s) => s.id === row.id)
    setRateShopCtx({
      shipmentId: row.id,
      customerName: row.customerName,
      destinationCity: row.destinationCity ?? '',
      destinationZone: shipment?.destinationZone ?? 'Z1',
      weightKg: row.weightKg,
      packageCount: row.packageCount,
    })
  }

  const handleConfirmRate = (quote: CarrierRateQuote) => {
    if (!rateShopCtx) return
    try {
      applyRateQuote(rateShopCtx.shipmentId, quote)
      setRateShopCtx(null)
    } catch (e: unknown) {
      setRateShopError(e instanceof Error ? e.message : 'Error al aplicar tarifa')
    }
  }

  const openVerifyDialog = (row: ShippingRow) => {
    setVerifiedInput(row.verifiedPackages || row.packageCount)
    verifyDialog.open({
      shipmentId: row.id,
      customerName: row.customerName,
      packageCount: row.packageCount,
    })
  }

  const handleVerifyLoad = () => {
    if (!verifyDialog.data) return
    try {
      verifyShipmentLoad(verifyDialog.data.shipmentId, verifiedInput, 'Operador')
      verifyDialog.close()
    } catch (e: unknown) {
      verifyDialog.setError(e instanceof Error ? e.message : 'Error al verificar la carga')
    }
  }

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns = useMemo(
    () =>
      buildShippingColumns({
        onShip: openShipDialog,
        onRateShop: openRateShop,
        onDeliver: openDeliverDialog,
        onVerifyLoad: openVerifyDialog,
        requireLoadVerification: settings.shippingRequireLoadVerification,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.shippingRequireLoadVerification]
  )

  // ── Filters node ──────────────────────────────────────────────────────────

  const filtersNode = (
    <>
      <Select value={carrierFilter} onValueChange={setCarrierFilter}>
        <SelectTrigger className="h-8 w-44">
          <SelectValue placeholder="Transportadora" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {uniqueCarriers.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={modalityFilter} onValueChange={setModalityFilter}>
        <SelectTrigger className="h-8 w-40">
          <SelectValue placeholder="Modalidad" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="own">Flota propia</SelectItem>
          <SelectItem value="third_party">Tercero</SelectItem>
          <SelectItem value="courier">Courier</SelectItem>
          <SelectItem value="last_mile">Última milla</SelectItem>
        </SelectContent>
      </Select>
      <Select value={otifFilter} onValueChange={setOtifFilter}>
        <SelectTrigger className="h-8 w-36">
          <SelectValue placeholder="OTIF" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos OTIF</SelectItem>
          <SelectItem value="on_time">A tiempo</SelectItem>
          <SelectItem value="at_risk">En riesgo</SelectItem>
          <SelectItem value="late">Tarde</SelectItem>
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="h-8 w-44">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="pending">Pendiente</SelectItem>
          <SelectItem value="in_transit">En tránsito</SelectItem>
          <SelectItem value="completed">Entregado</SelectItem>
          <SelectItem value="cancelled">Cancelado</SelectItem>
        </SelectContent>
      </Select>
    </>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Shipping — Despacho"
        description="Gestiona el despacho de envíos. Cotiza tarifas, verifica la carga, supervisa OTIF y registra entregas por transportadora."
      />

      {settings.shippingFreezeActive && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/40">
          <Snowflake className="size-5 shrink-0 text-blue-600 dark:text-blue-300" />
          <p className="flex-1 text-sm text-blue-800 dark:text-blue-300">
            Despacho en <span className="font-semibold">modo congelado</span> — las operaciones
            están bloqueadas. Desactívalo en Sistema → Configuración → Despacho.
          </p>
        </div>
      )}

      {/* Global KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={TrendingUp}
          value={otif}
          label="OTIF estimado"
          sublabel={`${formatNumber(state.shipments.length)} envíos totales`}
          tone={otif >= 90 ? 'green' : otif >= 75 ? 'amber' : 'red'}
        />
        <KpiCard icon={Truck} value={inTransitCount} label="En tránsito" tone="blue" />
        <KpiCard
          icon={Clock}
          value={pendingCount}
          label="Pendientes de despacho"
          tone="amber"
        />
        <KpiCard
          icon={DollarSign}
          value={Math.round(totalCost)}
          label="Costo cotizado (USD)"
          sublabel={`$${totalCost.toFixed(2)} total`}
          tone="neutral"
        />
      </div>

      {/* SubNav */}
      <SubNav items={SHIPPING_TABS} defaultValue="shipments" />

      {/* Shipments table */}
      {activeTab === 'shipments' && (
        <Card>
          <CardContent className="pt-4">
            <DataTable
              columns={columns}
              data={filteredRows}
              searchColumn="customerName"
              searchPlaceholder="Buscar cliente..."
              filters={filtersNode}
              emptyMessage="No hay envíos con los filtros seleccionados."
            />
          </CardContent>
        </Card>
      )}

      {/* Consolidation by destination */}
      {activeTab === 'consolidation' && (
        <Card>
          <CardContent className="pt-6">
            {!settings.shippingConsolidateByDestination ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Layers className="size-8 text-zinc-300" />
                <p className="text-muted-foreground text-sm">
                  La consolidación por destino está desactivada en la configuración de despacho.
                </p>
              </div>
            ) : consolidation.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Layers className="size-8 text-zinc-300" />
                <p className="text-muted-foreground text-sm">
                  No hay destinos con más de un envío pendiente por consolidar.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm">
                  {consolidation.length} destino(s) con envíos pendientes que pueden viajar en una
                  sola ruta.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {consolidation.map((group) => (
                    <Card key={group.destinationCity} className="border-2">
                      <CardContent className="pt-5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold">{group.destinationCity}</p>
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                            {group.shipmentIds.length} envíos
                          </span>
                        </div>
                        <div className="text-muted-foreground mt-3 space-y-1 text-xs">
                          <p>
                            Bultos:{' '}
                            <span className="text-foreground font-medium tabular-nums">
                              {group.totalPackages}
                            </span>
                          </p>
                          <p>
                            Peso total:{' '}
                            <span className="text-foreground font-medium tabular-nums">
                              {group.totalWeightKg.toFixed(1)} kg
                            </span>
                          </p>
                          <p>Transportadoras: {group.carrierNames.join(', ')}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* OTIF dashboard */}
      {activeTab === 'otif' && (
        <OtifDashboard shipments={state.shipments} alerts={alerts} today={today} />
      )}

      {/* Rate shopping dialog */}
      <RateShoppingDialog
        open={!!rateShopCtx}
        quotes={rateQuotes}
        weightKg={rateShopCtx?.weightKg ?? 0}
        destinationCity={rateShopCtx?.destinationCity ?? ''}
        packageCount={rateShopCtx?.packageCount ?? 0}
        customerName={rateShopCtx?.customerName ?? ''}
        error={rateShopError}
        suggested={suggestedQuote}
        onConfirm={handleConfirmRate}
        onClose={() => setRateShopCtx(null)}
      />

      {/* Ship confirmation */}
      <Dialog
        open={!!shipDialog.data}
        onOpenChange={(o) => {
          if (!o) shipDialog.close()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar despacho</DialogTitle>
          </DialogHeader>
          {shipDialog.data && (
            <div className="space-y-4 py-2">
              <div className="text-muted-foreground space-y-1 text-sm">
                <p>
                  Cliente:{' '}
                  <span className="text-foreground font-medium">
                    {shipDialog.data.customerName}
                  </span>
                </p>
                <p>
                  Transportadora:{' '}
                  <span className="text-foreground font-medium">{shipDialog.data.carrierName}</span>
                </p>
                <p>
                  Paquetes:{' '}
                  <span className="text-foreground font-medium">
                    {shipDialog.data.packageCount}
                  </span>
                </p>
                <p>
                  Peso total:{' '}
                  <span className="text-foreground font-medium">{shipDialog.data.weightKg} kg</span>
                </p>
              </div>
              <p className="text-muted-foreground text-sm">
                Esta acción cambiará el estado del envío a <strong>En tránsito</strong> y generará
                el número de tracking.
              </p>
              {shipDialog.data.modalityType === 'own' && (
                <div className="space-y-3 rounded-lg border bg-muted/30 px-4 py-3">
                  <p className="text-sm font-semibold">Datos de flota propia</p>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-muted-foreground text-xs font-medium">
                        Nombre del conductor *
                      </label>
                      <Input
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        placeholder="Ej. Luis Hernández"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-muted-foreground text-xs font-medium">
                        Placa del vehículo * (máx. 7 caracteres)
                      </label>
                      <Input
                        value={vehiclePlate}
                        onChange={(e) => setVehiclePlate(e.target.value.toUpperCase().slice(0, 7))}
                        placeholder="Ej. BJK-412"
                        className="font-mono uppercase"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>
              )}
              {shipDialog.error && (
                <p className="text-destructive flex items-center gap-1 text-sm">
                  <TriangleAlert className="size-3" /> {shipDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={shipDialog.close}>
              Cancelar
            </Button>
            <Button
              onClick={handleShip}
              disabled={
                shipDialog.data?.modalityType === 'own' &&
                (!driverName.trim() || !vehiclePlate.trim())
              }
            >
              <CheckCircle2 className="mr-1 size-4" /> Confirmar despacho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliver confirmation */}
      <Dialog
        open={!!deliverDialog.data}
        onOpenChange={(o) => {
          if (!o) deliverDialog.close()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar entrega</DialogTitle>
          </DialogHeader>
          {deliverDialog.data && (
            <div className="space-y-4 py-2">
              <p className="text-muted-foreground text-sm">
                Confirma la entrega del envío de <strong>{deliverDialog.data.customerName}</strong>.
                El estado cambiará a <strong>Entregado</strong>.
              </p>
              {deliverDialog.error && (
                <p className="text-destructive flex items-center gap-1 text-sm">
                  <TriangleAlert className="size-3" /> {deliverDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={deliverDialog.close}>
              Cancelar
            </Button>
            <Button onClick={handleDeliver}>
              <Clock className="mr-1 size-4" /> Registrar entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load verification */}
      <Dialog
        open={!!verifyDialog.data}
        onOpenChange={(o) => {
          if (!o) verifyDialog.close()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verificar carga</DialogTitle>
          </DialogHeader>
          {verifyDialog.data && (
            <div className="space-y-4 py-2">
              <p className="text-muted-foreground text-sm">
                Confirma los bultos cargados físicamente para el envío de{' '}
                <strong>{verifyDialog.data.customerName}</strong>. Esperados:{' '}
                <strong>{verifyDialog.data.packageCount}</strong>.
              </p>
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs font-medium">
                  Bultos verificados
                </label>
                <Input
                  type="number"
                  min={0}
                  max={verifyDialog.data.packageCount}
                  value={verifiedInput}
                  onChange={(e) => setVerifiedInput(Number(e.target.value))}
                  className="tabular-nums"
                />
              </div>
              {verifiedInput < verifyDialog.data.packageCount && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                  Faltan {verifyDialog.data.packageCount - verifiedInput} bulto(s).{' '}
                  {settings.shippingAllowPartialDispatch
                    ? 'Se despachará como parcial con saldo pendiente.'
                    : 'La configuración no permite despacho parcial — el despacho quedará bloqueado.'}
                </p>
              )}
              {verifyDialog.error && (
                <p className="text-destructive flex items-center gap-1 text-sm">
                  <TriangleAlert className="size-3" /> {verifyDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={verifyDialog.close}>
              Cancelar
            </Button>
            <Button onClick={handleVerifyLoad}>
              <ClipboardCheck className="mr-1 size-4" /> Confirmar carga
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
