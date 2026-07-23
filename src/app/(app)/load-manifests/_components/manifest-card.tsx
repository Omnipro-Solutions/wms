'use client'

import { CheckCircle2, MapPin, MapPinned, Package, Truck, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatDate, formatNumber, formatVolume } from '@/lib/formatters'
import type { CommerceOrder, LoadManifest, ReturnOrder, TransferOrder, Warehouse } from '@/types/wms'

interface Props {
  manifest: LoadManifest
  warehouses: Warehouse[]
  orders: CommerceOrder[]
  transfers: TransferOrder[]
  returns: ReturnOrder[]
  onDispatch: (manifestId: string) => void
  onClose: (manifestId: string) => void
  onAssignDriver: (manifestId: string) => void
}

export const ManifestCard = ({
  manifest,
  warehouses,
  orders,
  transfers,
  returns,
  onDispatch,
  onClose,
  onAssignDriver,
}: Props) => {
  const warehouseName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? id

  const canDispatch = manifest.status === 'pending'
  const canClose = manifest.status === 'in_progress'

  return (
    <Card>
      <CardHeader className="pb-3">
        {/* Fila 1: identidad */}
        <div className="flex flex-wrap items-center gap-2">
          <MapPinned className="size-4 text-blue-600" />
          <span className="font-mono text-sm font-semibold">{manifest.code}</span>
          <StatusBadge status={manifest.status} />
          <span className="text-muted-foreground text-xs">{formatDate(manifest.manifestDate)}</span>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="text-muted-foreground text-xs">Ruta SAP: <span className="font-mono">{manifest.sapRouteId}</span></span>
        </div>

        {/* Fila 2: metadatos + acciones */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">{manifest.carrierName}</Badge>
          <Badge variant="outline" className="font-mono text-xs">{manifest.truckPlate}</Badge>
          {manifest.driverName ? (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Truck className="size-3" /> {manifest.driverName}
            </span>
          ) : (
            <span className="text-amber-600 flex items-center gap-1 text-xs">
              <Truck className="size-3" /> Sin conductor
            </span>
          )}
          <Button size="sm" variant="outline" onClick={() => onAssignDriver(manifest.id)}>
            <UserPlus className="mr-1 size-3" /> Asignar conductor
          </Button>
          <span className="text-muted-foreground text-xs">
            {manifest.stops.length} parada{manifest.stops.length !== 1 ? 's' : ''} ·{' '}
            {formatNumber(manifest.totalPackages)} paq. ·{' '}
            {formatNumber(manifest.totalWeightKg)} kg ·{' '}
            {formatVolume(manifest.totalVolumeM3)}
          </span>
          <div className="ml-auto flex gap-2">
            {canDispatch && (
              <Button size="sm" onClick={() => onDispatch(manifest.id)}>
                <Truck className="mr-1 size-3" /> Despachar
              </Button>
            )}
            {canClose && (
              <Button size="sm" variant="outline" onClick={() => onClose(manifest.id)}>
                <CheckCircle2 className="mr-1 size-3" /> Cerrar manifiesto
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {manifest.stops
          .sort((a, b) => a.sequence - b.sequence)
          .map((stop) => {
            const stopOrders = stop.orderIds
              .map((oid) => orders.find((o) => o.id === oid))
              .filter(Boolean) as CommerceOrder[]
            const stopTransfers = stop.transferIds
              .map((tid) => transfers.find((t) => t.id === tid))
              .filter(Boolean) as TransferOrder[]
            const stopReturns = stop.returnIds
              .map((rid) => returns.find((r) => r.id === rid))
              .filter(Boolean) as ReturnOrder[]

            const isEmpty = stopOrders.length === 0 && stopTransfers.length === 0 && stopReturns.length === 0

            return (
              <div key={stop.id} className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                    {stop.sequence}
                  </div>
                  <MapPin className="text-muted-foreground size-3.5" />
                  <span className="text-sm font-medium">{warehouseName(stop.destinationId)}</span>
                  <div className="ml-auto flex items-center gap-2">
                    {isEmpty ? (
                      <Badge variant="outline" className="text-xs text-amber-600">
                        Sin documentos
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {stopOrders.length + stopTransfers.length + stopReturns.length} doc{stopOrders.length + stopTransfers.length + stopReturns.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>

                {!isEmpty && (
                  <div className="grid gap-2 pl-8 sm:grid-cols-3">
                    {stopOrders.length > 0 && (
                      <div>
                        <p className="text-muted-foreground mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
                          <Package className="size-3" /> Pedidos ({stopOrders.length})
                        </p>
                        {stopOrders.map((o) => (
                          <p key={o.id} className="text-sm">
                            <span className="font-mono font-medium">{o.orderNumber}</span>
                            <span className="text-muted-foreground ml-1">— {o.customerName}</span>
                          </p>
                        ))}
                      </div>
                    )}
                    {stopTransfers.length > 0 && (
                      <div>
                        <p className="text-muted-foreground mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
                          <Truck className="size-3" /> Traslados ({stopTransfers.length})
                        </p>
                        {stopTransfers.map((t) => (
                          <p key={t.id} className="font-mono text-sm font-medium">
                            {t.code}
                          </p>
                        ))}
                      </div>
                    )}
                    {stopReturns.length > 0 && (
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
                          Devoluciones ({stopReturns.length})
                        </p>
                        {stopReturns.map((r) => (
                          <p key={r.id} className="font-mono text-sm font-medium">
                            {r.rmaCode}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
      </CardContent>
    </Card>
  )
}
