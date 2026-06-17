'use client'

import { CheckCircle2, MapPin, MapPinned, Package, Truck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatNumber } from '@/lib/formatters'
import type { CommerceOrder, LoadManifest, ReturnOrder, TransferOrder, Warehouse } from '@/types/wms'

interface Props {
  manifest: LoadManifest
  warehouses: Warehouse[]
  orders: CommerceOrder[]
  transfers: TransferOrder[]
  returns: ReturnOrder[]
  onDispatch: (manifestId: string) => void
  onClose: (manifestId: string) => void
}

export const ManifestCard = ({
  manifest,
  warehouses,
  orders,
  transfers,
  returns,
  onDispatch,
  onClose,
}: Props) => {
  const warehouseName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? id

  const canDispatch = manifest.status === 'pending'
  const canClose = manifest.status === 'in_progress'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          <MapPinned className="size-4 text-blue-600" />
          <span className="font-mono font-semibold">{manifest.code}</span>
          <StatusBadge status={manifest.status} />
          <span className="text-muted-foreground font-normal">{manifest.manifestDate}</span>

          {/* Summary badges */}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {manifest.carrierName}
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              {manifest.truckPlate}
            </Badge>
            <span className="text-muted-foreground text-xs">
              {manifest.stops.length} parada{manifest.stops.length !== 1 ? 's' : ''} ·{' '}
              {formatNumber(manifest.totalPackages)} paq. ·{' '}
              {formatNumber(manifest.totalWeightKg)} kg
            </span>

            {/* Actions */}
            {canDispatch && (
              <Button
                size="sm"
                onClick={() => onDispatch(manifest.id)}
              >
                <Truck className="mr-1 size-3" /> Despachar
              </Button>
            )}
            {canClose && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onClose(manifest.id)}
              >
                <CheckCircle2 className="mr-1 size-3" /> Cerrar manifiesto
              </Button>
            )}
          </div>
        </CardTitle>
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
                  {isEmpty && (
                    <Badge variant="outline" className="ml-auto text-xs text-amber-600">
                      Sin documentos
                    </Badge>
                  )}
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
