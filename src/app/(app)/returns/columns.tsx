'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { DISPOSITION_COLORS, DISPOSITION_LABELS, RETURN_TYPE_LABELS } from '@/lib/returns'
import type { ReturnOrder } from '@/types/wms'

export interface ReturnRow {
  id: string
  rmaCode: string
  customerName: string
  type: ReturnOrder['type']
  originName: string
  destinationName: string
  disposition: ReturnOrder['disposition']
  reasonLabel: string
  status: string
  canAdvance: boolean
}

export const buildReturnColumns = (
  onAdvance: (row: ReturnRow) => void,
  onRowClick: (row: ReturnRow) => void,
): ColumnDef<ReturnRow>[] => [
  {
    accessorKey: 'rmaCode',
    header: ({ column }) => <DataTableColumnHeader column={column} title="RMA" />,
    cell: ({ row }) => (
      <button
        onClick={() => onRowClick(row.original)}
        className="font-medium hover:underline text-left"
      >
        {row.getValue('rmaCode')}
      </button>
    ),
  },
  {
    accessorKey: 'customerName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" />,
  },
  {
    accessorKey: 'type',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="text-xs">
        {RETURN_TYPE_LABELS[row.getValue<ReturnOrder['type']>('type')]}
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
    accessorKey: 'disposition',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Disposición" />,
    cell: ({ row }) => {
      const d = row.getValue<ReturnOrder['disposition']>('disposition')
      return (
        <Badge variant="outline" className={`text-xs ${DISPOSITION_COLORS[d]}`}>
          {DISPOSITION_LABELS[d]}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'reasonLabel',
    header: 'Motivo',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">{row.getValue('reasonLabel') || '—'}</span>
    ),
    enableSorting: false,
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
