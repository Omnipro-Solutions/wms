'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTableColumnHeader } from '@/components/data-table'
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
  canAdvance: boolean
}

export const TYPE_LABELS: Record<TransferOrder['type'], string> = {
  dc_to_store: 'DC → Tienda',
  store_to_store: 'Tienda → Tienda',
  store_to_dc: 'Tienda → DC',
  dc_to_dc: 'DC → DC',
}

export const buildTransferColumns = (
  onAdvance: (row: TransferRow) => void
): ColumnDef<TransferRow>[] => [
  {
    accessorKey: 'code',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
    cell: ({ row }) => <span className="font-medium">{row.getValue('code')}</span>,
  },
  {
    accessorKey: 'type',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="text-xs">
        {TYPE_LABELS[row.getValue<TransferOrder['type']>('type')]}
      </Badge>
    ),
  },
  {
    id: 'route',
    header: 'Ruta',
    cell: ({ row }) => (
      <div className="flex items-center gap-1 text-sm">
        <span>{row.original.originName}</span>
        <ArrowRight className="text-muted-foreground size-3.5 shrink-0" />
        <span>{row.original.destinationName}</span>
      </div>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'linesCount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Líneas" className="justify-end" />
    ),
    cell: ({ row }) => <div className="text-right tabular-nums">{row.getValue('linesCount')}</div>,
  },
  {
    accessorKey: 'estimatedArrivalDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="ETA" />,
    cell: ({ row }) => <span className="text-sm">{row.getValue('estimatedArrivalDate')}</span>,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
  },
  {
    id: 'actions',
    enableHiding: false,
    enableSorting: false,
    cell: ({ row }) => {
      if (!row.original.canAdvance) return null
      return (
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onAdvance(row.original)
          }}
        >
          Avanzar
        </Button>
      )
    },
  },
]
