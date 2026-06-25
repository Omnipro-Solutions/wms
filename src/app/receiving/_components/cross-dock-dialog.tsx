'use client'

import { useState } from 'react'
import { useWmsStore } from '@/store/wms-store'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { matchCrossDockOrders } from '@/lib/rules/crossdock'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Asn } from '@/types/wms'

interface Props {
  asn: Asn | null
  open: boolean
  onClose: () => void
}

export const CrossDockDialog = ({ asn, open, onClose }: Props) => {
  const state = useWmsStore()
  const { operator } = useCurrentOperator()
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [qty, setQty] = useState(0)

  if (!asn) return null

  const candidates = matchCrossDockOrders(asn.productId, state.commerceOrders)
  // ponytail: ASN has no warehouseId; fall back to any staging location
  const stagingLoc = state.locations.find((l) => l.type === 'staging')

  const handleAssign = () => {
    if (!selectedOrderId || qty <= 0 || !stagingLoc) return
    try {
      state.createCrossDockTask(
        asn.id,
        selectedOrderId,
        qty,
        stagingLoc.id,
        operator?.name ?? 'sistema'
      )
      setSelectedOrderId(null)
      setQty(0)
      onClose()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const handleClose = () => {
    setSelectedOrderId(null)
    setQty(0)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Asignar Cross-Docking — {asn.code}</DialogTitle>
        </DialogHeader>

        {candidates.length === 0 ? (
          <p className="text-muted-foreground py-4 text-sm">
            No hay órdenes pendientes con tipo cross-docking para este producto.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">Selecciona la orden de destino:</p>
            {candidates.map((order) => (
              <div
                key={order.id}
                onClick={() => setSelectedOrderId(order.id)}
                className={cn(
                  'cursor-pointer rounded-md border p-3 text-sm transition-colors',
                  selectedOrderId === order.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'hover:bg-muted'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{order.orderNumber}</span>
                  <Badge variant="outline">{order.channel}</Badge>
                </div>
                <p className="text-muted-foreground">{order.customerName}</p>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-2">
              <label className="text-sm font-medium">Cantidad:</label>
              <input
                type="number"
                min={1}
                max={asn.receivedQuantity}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="w-24 rounded border px-2 py-1 text-sm"
              />
              {!stagingLoc && (
                <span className="text-destructive text-xs">Sin ubicación staging disponible</span>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            disabled={!selectedOrderId || qty <= 0 || !stagingLoc}
            onClick={handleAssign}
          >
            Asignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
