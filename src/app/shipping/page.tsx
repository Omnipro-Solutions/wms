"use client"

import { useMemo } from "react"
import { CheckCircle2, Truck, TriangleAlert } from "lucide-react"

import { useWmsStore } from "@/store/wms-store"
import { useDialogState } from "@/hooks/use-dialog-state"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatNumber, formatPercent } from "@/lib/formatters"
import { otifPercentage } from "@/lib/rules/shipping"
import { buildShippingColumns, type ShippingRow } from "./columns"
import { useState } from "react"

interface ShipDialogData {
  shipmentId: string
  customerName: string
  carrierName: string
  packageCount: number
  weightKg: number
}

export default function ShippingPage() {
  const state = useWmsStore()
  const { shipOrder } = useWmsStore()

  const [otifFilter, setOtifFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const shipDialog = useDialogState<ShipDialogData>()

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
      shipOrder(shipDialog.data.shipmentId, "Operador")
      shipDialog.close()
    } catch (e: unknown) {
      shipDialog.setError(e instanceof Error ? e.message : "Error al despachar")
    }
  }

  const rows = useMemo<ShippingRow[]>(
    () =>
      state.shipments.map((sh) => {
        const order = state.commerceOrders.find((o) => o.id === sh.orderId)
        const route = sh.sapRouteId
          ? state.sapRoutes.find((r) => r.id === sh.sapRouteId)
          : null
        return {
          id: sh.id,
          orderNumber: order?.orderNumber ?? sh.orderId,
          customerName: sh.customerName,
          carrierName: sh.carrierName,
          sapRouteCode: route?.code ?? "",
          packageCount: sh.packageCount,
          weightKg: sh.weightKg,
          trackingNumber: sh.trackingNumber ?? null,
          otifStatus: sh.otifStatus,
          status: sh.status,
          shippedAt: sh.shippedAt ?? null,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.shipments]
  )

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (otifFilter !== "all" && r.otifStatus !== otifFilter) return false
        if (statusFilter !== "all" && r.status !== statusFilter) return false
        return true
      }),
    [rows, otifFilter, statusFilter]
  )

  const otif = otifPercentage(state.shipments)
  const inTransitCount = state.shipments.filter((s) => s.status === "in_transit").length
  const pendingCount = state.shipments.filter((s) => s.status === "pending").length

  const columns = useMemo(
    () => buildShippingColumns(openShipDialog),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const filtersNode = (
    <>
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
          <SelectItem value="delivered">Entregado</SelectItem>
          <SelectItem value="cancelled">Cancelado</SelectItem>
        </SelectContent>
      </Select>
    </>
  )

  return (
    <>
      <PageHeader
        title="Shipping — Despacho"
        description="Gestiona el despacho de envíos. Supervisa OTIF y estado de entrega por transportadora."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">OTIF estimado</p>
            <p className={`text-2xl font-bold tabular-nums ${otif >= 90 ? "text-green-700" : otif >= 75 ? "text-amber-600" : "text-red-600"}`}>
              {formatPercent(otif)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">En tránsito</p>
            <p className="text-2xl font-bold tabular-nums text-blue-600">{formatNumber(inTransitCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pendientes de despacho</p>
            <p className="text-2xl font-bold tabular-nums text-amber-600">{formatNumber(pendingCount)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="mb-1 flex items-center gap-2 text-base font-semibold">
            <Truck className="size-4" /> Envíos
          </div>
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

      <Dialog
        open={!!shipDialog.data}
        onOpenChange={(o) => { if (!o) shipDialog.close() }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar despacho</DialogTitle>
          </DialogHeader>
          {shipDialog.data && (
            <div className="space-y-4 py-2">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Cliente: <span className="font-medium text-foreground">{shipDialog.data.customerName}</span></p>
                <p>Transportadora: <span className="font-medium text-foreground">{shipDialog.data.carrierName}</span></p>
                <p>Paquetes: <span className="font-medium text-foreground">{shipDialog.data.packageCount}</span></p>
                <p>Peso total: <span className="font-medium text-foreground">{shipDialog.data.weightKg} kg</span></p>
              </div>
              <p className="text-sm text-muted-foreground">
                Esta acción cambiará el estado del envío a <strong>En tránsito</strong> y generará el número de tracking.
              </p>
              {shipDialog.error && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <TriangleAlert className="size-3" /> {shipDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={shipDialog.close}>Cancelar</Button>
            <Button onClick={handleShip}>
              <CheckCircle2 className="mr-1 size-4" /> Confirmar despacho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
