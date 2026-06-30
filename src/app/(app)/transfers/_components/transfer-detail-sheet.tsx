'use client'

import { useState } from 'react'
import { ArrowRight, PackageCheck, Truck, TriangleAlert } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { useDialogState } from '@/hooks/use-dialog-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { TransferItinerary } from './transfer-itinerary'
import { ReceiveLegDialog } from './receive-leg-dialog'
import type { TransferLeg, TransferOrder } from '@/types/wms'

interface Props {
  transfer: TransferOrder | null
  originName: string
  destinationName: string
  getProduct: (id: string) => { name: string; imageUrl?: string } | undefined
  getWarehouseName: (id: string) => string
  open: boolean
  onClose: () => void
}

export const TransferDetailSheet = ({
  transfer,
  originName,
  destinationName,
  getProduct,
  getWarehouseName,
  open,
  onClose,
}: Props) => {
  const { dispatchLeg } = useWmsStore()
  const [error, setError] = useState('')
  const receiveLegDialog = useDialogState<TransferLeg>()

  if (!transfer) return null

  const currentLeg = transfer.legs[transfer.currentLegIndex]
  const isTerminal = transfer.status === 'completed' || transfer.status === 'cancelled'

  const canDispatch = currentLeg?.status === 'pending'
  const canReceive = currentLeg?.status === 'in_transit'

  const handleDispatch = () => {
    if (!currentLeg) return
    try {
      dispatchLeg(transfer.id, currentLeg.id, 'Operador')
      setError('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al despachar tramo')
    }
  }

  const isOverdue =
    !isTerminal && new Date(transfer.estimatedArrivalDate) < new Date()

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-140!">
          <SheetHeader className="border-b px-6 pb-4">
            <SheetTitle className="flex items-center gap-2">
              {transfer.code}
              <StatusBadge status={transfer.status} />
              {transfer.isMultiLeg && (
                <span className="text-muted-foreground text-xs font-normal">
                  Multi-tramo · {transfer.currentLegIndex + 1}/{transfer.legs.length}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-6 py-6">
            {/* Route summary */}
            <section className="space-y-2">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Ruta
              </h3>
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>{originName}</span>
                <ArrowRight className="text-muted-foreground size-4 shrink-0" />
                <span>{destinationName}</span>
              </div>
              <div className="text-muted-foreground flex gap-4 text-xs">
                <span>Creado: {formatDate(transfer.createdAt)}</span>
                <span className={cn('flex items-center gap-1', isOverdue && 'font-medium text-red-600')}>
                  ETA: {formatDate(transfer.estimatedArrivalDate)}
                  {isOverdue && ' · Atrasado'}
                </span>
              </div>
            </section>

            {/* Itinerary stepper */}
            <TransferItinerary
              legs={transfer.legs}
              getWarehouseName={getWarehouseName}
              currentLegIndex={transfer.currentLegIndex}
            />

            {/* Product lines */}
            <section className="space-y-2">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Líneas ({transfer.items.length})
              </h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Solicitado</TableHead>
                      <TableHead className="text-right">Pickeado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfer.items.map((line) => {
                      const product = getProduct(line.productId)
                      return (
                        <TableRow key={line.id}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              {product?.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="size-9 rounded-md border object-cover"
                                />
                              ) : (
                                <div className="bg-muted size-9 rounded-md border" />
                              )}
                              <span className="text-sm">{product?.name ?? line.productId}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(line.requestedQuantity)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-right tabular-nums">
                            {line.pickedQuantity != null ? formatNumber(line.pickedQuantity) : '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>

          {/* Footer actions */}
          <div className="border-t px-6 pt-4 pb-4">
            {!isTerminal && currentLeg ? (
              <div className="flex w-full flex-col gap-2">
                {error && (
                  <p className="text-destructive flex items-center gap-1 text-xs">
                    <TriangleAlert className="size-3" /> {error}
                  </p>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="text-muted-foreground text-xs">
                    Tramo {currentLeg.sequence}: {getWarehouseName(currentLeg.originId)} → {getWarehouseName(currentLeg.destinationId)}
                  </div>
                  {canDispatch && (
                    <Button size="sm" onClick={handleDispatch}>
                      <Truck className="mr-1.5 size-4" />
                      Despachar tramo {currentLeg.sequence}
                    </Button>
                  )}
                  {canReceive && (
                    <Button size="sm" onClick={() => receiveLegDialog.open(currentLeg)}>
                      <PackageCheck className="mr-1.5 size-4" />
                      Recepcionar en {getWarehouseName(currentLeg.destinationId)}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                {transfer.status === 'completed' && 'Traslado completado.'}
                {transfer.status === 'cancelled' && 'Traslado cancelado.'}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {receiveLegDialog.data && (
        <ReceiveLegDialog
          transfer={transfer}
          leg={receiveLegDialog.data}
          open={!!receiveLegDialog.data}
          onClose={receiveLegDialog.close}
        />
      )}
    </>
  )
}
