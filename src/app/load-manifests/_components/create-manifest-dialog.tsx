'use client'

import { useState } from 'react'
import { CalendarDays, MapPinned, Package, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/shared/status-badge'
import type { CommerceOrder, ReturnOrder, TransferOrder } from '@/types/wms'

interface Props {
  open: boolean
  pendingOrders: CommerceOrder[]
  pendingTransfers: TransferOrder[]
  pendingReturns: ReturnOrder[]
  error: string
  onConfirm: (data: {
    sapRouteId: string
    manifestDate: string
    orderIds: string[]
    transferIds: string[]
    returnIds: string[]
  }) => void
  onClose: () => void
}

export const CreateManifestDialog = ({
  open,
  pendingOrders,
  pendingTransfers,
  pendingReturns,
  error,
  onConfirm,
  onClose,
}: Props) => {
  const [sapRouteId, setSapRouteId] = useState('')
  const [manifestDate, setManifestDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [selectedTransfers, setSelectedTransfers] = useState<Set<string>>(new Set())
  const [selectedReturns, setSelectedReturns] = useState<Set<string>>(new Set())

  const toggle = <T,>(set: Set<T>, id: T): Set<T> => {
    const next = new Set(set)
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  }

  const totalDocs = selectedOrders.size + selectedTransfers.size + selectedReturns.size

  const handleClose = () => {
    setSapRouteId('')
    setManifestDate(new Date().toISOString().slice(0, 10))
    setSelectedOrders(new Set())
    setSelectedTransfers(new Set())
    setSelectedReturns(new Set())
    onClose()
  }

  const handleConfirm = () => {
    if (!sapRouteId) return
    onConfirm({
      sapRouteId,
      manifestDate,
      orderIds: [...selectedOrders],
      transferIds: [...selectedTransfers],
      returnIds: [...selectedReturns],
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose()
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPinned className="text-primary size-5" />
            Crear manifiesto de carga
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Route + date */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <MapPinned className="size-3.5" /> Ruta SAP
              </Label>
              <Input
                placeholder="Ej. R-001"
                value={sapRouteId}
                onChange={(e) => setSapRouteId(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <CalendarDays className="size-3.5" /> Fecha
              </Label>
              <Input
                type="date"
                value={manifestDate}
                onChange={(e) => setManifestDate(e.target.value)}
              />
            </div>
          </div>

          {/* Orders */}
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Package className="size-3.5" /> Pedidos disponibles ({pendingOrders.length})
            </p>
            {pendingOrders.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin pedidos pendientes de asignar.</p>
            ) : (
              <div className="space-y-1.5 rounded-md border p-3">
                {pendingOrders.map((o) => (
                  <label
                    key={o.id}
                    className="hover:bg-accent flex cursor-pointer items-center gap-3 rounded px-2 py-1.5"
                  >
                    <Checkbox
                      checked={selectedOrders.has(o.id)}
                      onCheckedChange={() => setSelectedOrders(toggle(selectedOrders, o.id))}
                    />
                    <span className="font-mono text-sm font-medium">{o.orderNumber}</span>
                    <span className="text-muted-foreground text-sm">{o.customerName}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {o.channel}
                    </Badge>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Transfers */}
          {pendingTransfers.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                Traslados disponibles ({pendingTransfers.length})
              </p>
              <div className="space-y-1.5 rounded-md border p-3">
                {pendingTransfers.map((t) => (
                  <label
                    key={t.id}
                    className="hover:bg-accent flex cursor-pointer items-center gap-3 rounded px-2 py-1.5"
                  >
                    <Checkbox
                      checked={selectedTransfers.has(t.id)}
                      onCheckedChange={() => setSelectedTransfers(toggle(selectedTransfers, t.id))}
                    />
                    <span className="font-mono text-sm font-medium">{t.code}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {t.type}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Returns */}
          {pendingReturns.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                Devoluciones disponibles ({pendingReturns.length})
              </p>
              <div className="space-y-1.5 rounded-md border p-3">
                {pendingReturns.map((r) => (
                  <label
                    key={r.id}
                    className="hover:bg-accent flex cursor-pointer items-center gap-3 rounded px-2 py-1.5"
                  >
                    <Checkbox
                      checked={selectedReturns.has(r.id)}
                      onCheckedChange={() => setSelectedReturns(toggle(selectedReturns, r.id))}
                    />
                    <span className="font-mono text-sm font-medium">{r.rmaCode}</span>
                    <StatusBadge status={r.status} />
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-destructive flex items-center gap-1 text-sm">
              <TriangleAlert className="size-3" /> {error}
            </p>
          )}
        </div>

        <DialogFooter className="flex-col items-end gap-1 sm:flex-row sm:items-center">
          {totalDocs > 0 && (
            <span className="text-muted-foreground mr-auto text-xs">
              {totalDocs} documento{totalDocs !== 1 ? 's' : ''} seleccionado
              {totalDocs !== 1 ? 's' : ''}
            </span>
          )}
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!sapRouteId}>
            <MapPinned className="mr-1 size-4" /> Crear manifiesto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
