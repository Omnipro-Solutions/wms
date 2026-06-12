import { type ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, Clock, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { DataTableColumnHeader } from '@/components/data-table'
import { formatNumber } from '@/lib/formatters'
import type { AsnRow } from '../columns'
import { codeCol, supplierCol, productCol, abcCol, flagsCol, type ActionHandler } from './shared'

export const buildAppointmentColumns = (onAction: ActionHandler): ColumnDef<AsnRow>[] => [
  codeCol,
  supplierCol,
  productCol,
  abcCol,
  {
    accessorKey: 'appointmentDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha de cita" />,
    cell: ({ row }) => {
      const { appointmentDate, isOverdue } = row.original
      return (
        <div className="flex items-center gap-1.5">
          {isOverdue ? (
            <AlertTriangle className="size-3.5 shrink-0 text-red-500" />
          ) : (
            <Clock className="text-muted-foreground size-3.5 shrink-0" />
          )}
          <span className={isOverdue ? 'text-sm font-semibold text-red-600' : 'text-sm'}>
            {appointmentDate}
          </span>
          {isOverdue && (
            <Badge variant="destructive" className="ml-1 text-xs">
              Atrasada
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    id: 'deliveryProgress',
    header: 'Entregas',
    enableSorting: false,
    cell: ({ row }) => {
      const { status, deliveryCount, receivedQuantity, expectedQuantity } = row.original
      const pct = Math.round((receivedQuantity / expectedQuantity) * 100)
      const pending = expectedQuantity - receivedQuantity

      if (status === 'pending') {
        return (
          <div className="min-w-36 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs tabular-nums">
                {formatNumber(expectedQuantity)} uds esperadas
              </span>
              <span className="text-muted-foreground text-xs">0%</span>
            </div>
            <Progress value={0} />
          </div>
        )
      }

      return (
        <div className="min-w-36 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold tabular-nums">
              {formatNumber(receivedQuantity)}
              <span className="text-muted-foreground font-normal">
                {' '}
                / {formatNumber(expectedQuantity)} uds
              </span>
            </span>
            <span className="text-xs font-bold text-blue-600">{pct}%</span>
          </div>
          <Progress value={pct} className="*:data-[slot=progress-indicator]:bg-blue-500" />
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              -{formatNumber(pending)} pendiente
            </span>
            <span className="text-muted-foreground text-[10px]">
              · {deliveryCount} {deliveryCount === 1 ? 'entrega' : 'entregas'}
            </span>
          </div>
        </div>
      )
    },
  },
  flagsCol,
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      if (!row.original.canReceive) return null
      return (
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onAction('confirm', row.original)
          }}
        >
          <Truck className="mr-1.5 size-3.5" />
          Confirmar llegada
        </Button>
      )
    },
  },
]
