'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Clock, DollarSign, Truck, TriangleAlert, TrendingUp } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { useDialogState } from '@/hooks/use-dialog-state'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
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
import { otifPercentage, otifAlerts, rateShop } from '@/lib/rules/shipping'
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
  { value: 'otif', label: 'OTIF' },
]

export default function ShippingPage() {
  const today = new Date().toISOString().slice(0, 10)

  const state = useWmsStore()
  const { shipOrder, deliverShipment } = state

  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'shipments'
  const [otifFilter, setOtifFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [carrierFilter, setCarrierFilter] = useState('all')

  const shipDialog = useDialogState<ShipDialogData>()
  const deliverDialog = useDialogState<{ shipmentId: string; customerName: string }>()

  const [rateShopCtx, setRateShopCtx] = useState<RateShopContext | null>(null)
  const [rateShopError, setRateShopError] = useState('')

  // ── Rows ──────────────────────────────────────────────────────────────────

  const rows = useMemo<ShippingRow[]>(
    () =>
      state.shipments.map((sh) => {
        const order = state.commerceOrders.find((o) => o.id === sh.orderId)
        return {
          id: sh.id,
          orderNumber: order?.orderNumber ?? sh.orderId,
          customerName: sh.customerName,
          carrierId: sh.carrierId,
          carrierName: sh.carrierName,
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
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.shipments]
  )

  const uniqueCarriers = useMemo(() => [...new Set(rows.map((r) => r.carrierName))], [rows])

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (otifFilter !== 'all' && r.otifStatus !== otifFilter) return false
        if (statusFilter !== 'all' && r.status !== statusFilter) return false
        if (carrierFilter !== 'all' && r.carrierName !== carrierFilter) return false
        return true
      }),
    [rows, otifFilter, statusFilter, carrierFilter]
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

  // ── Rate shop quotes ───────────────────────────────────────────────────────

  const rateQuotes = useMemo<CarrierRateQuote[]>(() => {
    if (!rateShopCtx) return []
    return rateShop(state.carriers, rateShopCtx.weightKg, rateShopCtx.destinationZone, today)
  }, [rateShopCtx, state.carriers])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openShipDialog = (row: ShippingRow) => {
    shipDialog.open({
      shipmentId: row.id,
      customerName: row.customerName,
      carrierName: row.carrierName,
      packageCount: row.packageCount,
      weightKg: row.weightKg,
    })
  }

  const handleShip = () => {
    if (!shipDialog.data) return
    try {
      shipOrder(shipDialog.data.shipmentId, 'Operador')
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
      useWmsStore.setState((st) => ({
        shipments: st.shipments.map((s) =>
          s.id === rateShopCtx.shipmentId
            ? {
                ...s,
                carrierId: quote.carrierId,
                carrierName: quote.carrierName,
                serviceLevel: quote.serviceLevel,
                quotedCostUsd: quote.quotedCostUsd,
                estimatedDeliveryDate: quote.estimatedDeliveryDate,
              }
            : s
        ),
      }))
      setRateShopCtx(null)
    } catch (e: unknown) {
      setRateShopError(e instanceof Error ? e.message : 'Error al aplicar tarifa')
    }
  }

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns = useMemo(
    () =>
      buildShippingColumns({
        onShip: openShipDialog,
        onRateShop: openRateShop,
        onDeliver: openDeliverDialog,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
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
        description="Gestiona el despacho de envíos. Cotiza tarifas, supervisa OTIF y registra entregas por transportadora."
      />

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
            <Button onClick={handleShip}>
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
    </div>
  )
}
