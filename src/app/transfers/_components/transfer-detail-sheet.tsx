'use client'

import { ArrowRight, CheckCircle2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import { useWmsStore } from '@/store/wms-store'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import type { TransferOrder } from '@/types/wms'

const STEPS: Array<{ key: TransferOrder['status']; label: string }> = [
  { key: 'draft', label: 'Borrador' },
  { key: 'pending', label: 'Pendiente' },
  { key: 'in_progress', label: 'En preparación' },
  { key: 'in_transit', label: 'En tránsito' },
  { key: 'completed', label: 'Completado' },
]

const NEXT_MAP: Partial<Record<string, string>> = {
  draft: 'pending',
  pending: 'in_progress',
  in_progress: 'in_transit',
  in_transit: 'completed',
  partial: 'completed',
}

const NEXT_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En preparación',
  in_transit: 'En tránsito',
  completed: 'Completado',
}

interface Props {
  transfer: TransferOrder | null
  originName: string
  destinationName: string
  productName: (id: string) => string
  open: boolean
  onClose: () => void
}

export const TransferDetailSheet = ({
  transfer,
  originName,
  destinationName,
  productName,
  open,
  onClose,
}: Props) => {
  const { advanceTransfer } = useWmsStore()
  const [error, setError] = useState('')

  if (!transfer) return null

  const nextStatus = NEXT_MAP[transfer.status]
  const canAdvance = !!nextStatus

  const currentStepIndex = STEPS.findIndex((s) => s.key === transfer.status)

  const handleAdvance = () => {
    try {
      advanceTransfer(transfer.id, 'Operador')
      setError('')
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al avanzar traslado')
    }
  }

  const isOverdue =
    transfer.status !== 'completed' &&
    transfer.status !== 'cancelled' &&
    new Date(transfer.estimatedArrivalDate) < new Date()

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-[480px]">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="flex items-center gap-2">
            {transfer.code}
            <StatusBadge status={transfer.status} />
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-6 py-6">
          {/* Ruta y fechas */}
          <section className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Ruta
            </h3>
            <div className="flex items-center gap-2 text-sm font-medium">
              <span>{originName}</span>
              <ArrowRight className="text-muted-foreground size-4 shrink-0" />
              <span>{destinationName}</span>
            </div>
            <div className="text-muted-foreground flex gap-4 text-xs">
              <span>Creado: {formatDate(transfer.createdAt)}</span>
              <span className={cn('flex items-center gap-1', isOverdue && 'text-red-600 font-medium')}>
                ETA: {formatDate(transfer.estimatedArrivalDate)}
                {isOverdue && ' · Atrasado'}
              </span>
            </div>
          </section>

          {/* Timeline de estados */}
          <section className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Estado del ciclo
            </h3>
            <div className="flex items-start gap-0">
              {STEPS.map((step, i) => {
                const isDone = i < currentStepIndex
                const isCurrent = i === currentStepIndex
                const isLast = i === STEPS.length - 1
                return (
                  <div key={step.key} className="flex flex-1 flex-col items-center">
                    <div className="flex w-full items-center">
                      <div
                        className={cn(
                          'flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
                          isDone && 'border-emerald-500 bg-emerald-500 text-white',
                          isCurrent && 'border-blue-500 bg-blue-500 text-white',
                          !isDone && !isCurrent && 'border-zinc-300 bg-white text-zinc-400'
                        )}
                      >
                        {isDone ? '✓' : i + 1}
                      </div>
                      {!isLast && (
                        <div
                          className={cn(
                            'h-0.5 flex-1',
                            isDone ? 'bg-emerald-400' : 'bg-zinc-200'
                          )}
                        />
                      )}
                    </div>
                    <p
                      className={cn(
                        'mt-1 text-center text-[10px] leading-tight',
                        isCurrent ? 'font-semibold text-blue-600' : 'text-muted-foreground'
                      )}
                    >
                      {step.label}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Tabla de líneas */}
          <section className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
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
                  {transfer.items.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="text-sm">{productName(line.productId)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(line.requestedQuantity)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right tabular-nums">
                        {line.pickedQuantity != null ? formatNumber(line.pickedQuantity) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>

        {/* Pie con acción de avance */}
        <SheetFooter className="border-t pt-4">
          {canAdvance ? (
            <div className="flex w-full flex-col gap-2">
              {nextStatus === 'completed' && (
                <p className="text-muted-foreground text-xs">
                  Al completar se registrarán movimientos de inventario de tipo <strong>transfer</strong> por cada línea.
                </p>
              )}
              {error && (
                <p className="text-destructive flex items-center gap-1 text-xs">
                  <TriangleAlert className="size-3" /> {error}
                </p>
              )}
              <div className="flex items-center justify-between gap-2">
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <span>Siguiente:</span>
                  <StatusBadge status={nextStatus} />
                </div>
                <Button size="sm" onClick={handleAdvance}>
                  <CheckCircle2 className="mr-1.5 size-4" />
                  Avanzar a {NEXT_LABELS[nextStatus] ?? nextStatus}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              {transfer.status === 'completed' && 'Traslado completado.'}
              {transfer.status === 'cancelled' && 'Traslado cancelado.'}
            </p>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
