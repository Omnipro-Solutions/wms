'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { ArrowRight, AlertCircle, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { TransferOrder } from '@/types/wms'

export interface TransferRow {
  id: string
  code: string
  type: TransferOrder['type']
  originName: string
  destinationName: string
  linesCount: number
  estimatedArrivalDate: string
  status: string
}

export const TYPE_LABELS: Record<TransferOrder['type'], string> = {
  dc_to_store: 'DC → Tienda',
  store_to_store: 'Tienda → Tienda',
  store_to_dc: 'Tienda → DC',
  dc_to_dc: 'DC → DC',
}

const TERMINAL_STATUSES = new Set(['completed', 'cancelled'])

const isOverdue = (eta: string, status: string) =>
  !TERMINAL_STATUSES.has(status) && new Date(eta) < new Date()

export const buildTransferColumns = (): ColumnDef<TransferRow>[] => [
  {
    accessorKey: 'code',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Código / Tipo" />,
    cell: ({ row }) => (
      <div className="space-y-0.5">
        <p className="font-medium">{row.getValue('code')}</p>
        <Badge variant="outline" className="text-xs">
          {TYPE_LABELS[row.original.type]}
        </Badge>
      </div>
    ),
  },
  {
    id: 'route',
    header: 'Ruta',
    cell: ({ row }) => (
      <div className="flex max-w-[220px] items-center gap-1 text-sm">
        <span className="truncate">{row.original.originName}</span>
        <ArrowRight className="text-muted-foreground size-3.5 shrink-0" />
        <span className="truncate">{row.original.destinationName}</span>
      </div>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'linesCount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Líneas" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{row.getValue('linesCount')}</div>
    ),
  },
  {
    accessorKey: 'estimatedArrivalDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="ETA" />,
    cell: ({ row }) => {
      const eta = row.getValue<string>('estimatedArrivalDate')
      const overdue = isOverdue(eta, row.original.status)
      return (
        <div className={cn('flex items-center gap-1 text-sm', overdue && 'text-red-600')}>
          {overdue && <AlertCircle className="size-3.5 shrink-0" />}
          {formatDate(eta)}
        </div>
      )
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
  },
  {
    id: 'expand',
    enableHiding: false,
    enableSorting: false,
    header: () => null,
    cell: () => (
      <ChevronRight className="text-muted-foreground/40 group-hover:text-muted-foreground size-4 transition-colors" />
    ),
  },
]
