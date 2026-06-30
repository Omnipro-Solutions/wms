import { type ColumnDef } from '@tanstack/react-table'
import { PackageCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { formatNumber } from '@/lib/formatters'
import type { WmsLabel } from '@/types/wms'
import type { AsnRow } from '../columns'
import { codeCol, supplierCol, productCol, abcCol, flagsCol, type ActionHandler } from './shared'
import { ReceiptLabelButton } from '../_components/receipt-label-dialog'

export const buildReceivingColumns = (onAction: ActionHandler): ColumnDef<AsnRow>[] => [
  codeCol,
  supplierCol,
  productCol,
  abcCol,
  {
    id: 'quantities',
    header: 'Recepción',
    enableSorting: false,
    cell: ({ row }) => {
      const { expectedQuantity, receivedQuantity, pendingQuantity, progressPct, deliveryCount } =
        row.original
      return (
        <div className="min-w-40 space-y-1.5">
          <div className="flex items-center justify-between gap-4 tabular-nums">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold">{formatNumber(receivedQuantity)}</span>
              <span className="text-muted-foreground text-xs">
                / {formatNumber(expectedQuantity)} uds
              </span>
            </div>
            <span
              className={cn(
                'text-xs font-bold',
                progressPct === 100 ? 'text-emerald-600' : 'text-sky-600'
              )}
            >
              {progressPct}%
            </span>
          </div>
          <Progress
            value={progressPct}
            className={cn(
              progressPct === 100
                ? '*:data-[slot=progress-indicator]:bg-emerald-500'
                : '*:data-[slot=progress-indicator]:bg-sky-400'
            )}
          />
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 tabular-nums">
              -{formatNumber(pendingQuantity)} pendiente
            </span>
            {deliveryCount > 0 && (
              <span className="text-muted-foreground text-[10px]">
                · {deliveryCount} {deliveryCount === 1 ? 'entrega previa' : 'entregas previas'}
              </span>
            )}
          </div>
        </div>
      )
    },
  },
  flagsCol,
  {
    id: 'etiquetas',
    header: 'Etiquetas',
    enableSorting: false,
    cell: ({ row }) => {
      const labels: WmsLabel[] = row.original.receiptLabels ?? []
      const printed = labels.filter((l) => l.status === 'completed').length
      const total = labels.length
      if (total === 0) return <span className="text-muted-foreground text-xs">—</span>
      return (
        <div className="flex flex-col gap-1.5">
          <span
            className={cn(
              'text-xs font-medium',
              printed < total ? 'text-red-600' : 'text-emerald-600'
            )}
          >
            {printed}/{total} impresas
          </span>
          <div className="flex flex-wrap gap-1">
            {labels.map((l) => (
              <ReceiptLabelButton key={l.id} label={l} />
            ))}
          </div>
        </div>
      )
    },
  },
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const { canReceive, crossDocking } = row.original
      return (
        <div className="flex items-center gap-2">
          {canReceive && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onAction('receive', row.original)
              }}
            >
              <PackageCheck className="mr-1.5 size-3.5" />
              Registrar conteo
            </Button>
          )}
          {crossDocking && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onAction('crossdock', row.original)
              }}
            >
              Cross-dock
            </Button>
          )}
        </div>
      )
    },
  },
]
