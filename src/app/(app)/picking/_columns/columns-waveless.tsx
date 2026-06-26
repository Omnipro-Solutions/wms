'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { PlayCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { cn } from '@/lib/utils'
import type { WavelessOrder } from '@/types/wms'
import { PRIORITY_COLORS, PRIORITY_LABELS, CHANNEL_LABELS, FULFILLMENT_LABELS } from './shared'

export const buildWavelessColumns = (
  onStart: (order: WavelessOrder) => void
): ColumnDef<WavelessOrder>[] => [
  {
    accessorKey: 'orderNumber',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Pedido" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs font-semibold">{row.original.orderNumber}</span>
    ),
  },
  {
    accessorKey: 'customerName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" />,
    cell: ({ row }) => <span className="text-sm">{row.original.customerName}</span>,
  },
  {
    accessorKey: 'channel',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Canal" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {CHANNEL_LABELS[row.original.channel] ?? row.original.channel}
      </span>
    ),
  },
  {
    accessorKey: 'fulfillmentType',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fulfillment" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="text-xs">
        {FULFILLMENT_LABELS[row.original.fulfillmentType] ?? row.original.fulfillmentType}
      </Badge>
    ),
  },
  {
    accessorKey: 'priority',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Prioridad" />,
    cell: ({ row }) => (
      <Badge variant="outline" className={cn('text-xs', PRIORITY_COLORS[row.original.priority])}>
        {PRIORITY_LABELS[row.original.priority]}
      </Badge>
    ),
  },
  {
    id: 'tasks',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tareas" />,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{row.original.pickingTaskIds.length}</div>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Creado" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs tabular-nums">
        {row.original.createdAt.slice(0, 10)}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) =>
      row.original.status === 'pending' ? (
        <Button size="sm" variant="outline" onClick={() => onStart(row.original)}>
          <PlayCircle className="mr-1 size-3" /> Iniciar
        </Button>
      ) : null,
  },
]
