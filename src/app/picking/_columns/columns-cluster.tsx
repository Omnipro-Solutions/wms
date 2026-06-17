'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { CheckCircle2, PlayCircle, ShoppingCart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { cn } from '@/lib/utils'
import { clusterSlotsCompleted } from '@/lib/rules/picking'
import type { ClusterTask } from '@/types/wms'
import { PRIORITY_COLORS, PRIORITY_LABELS, progressCell, operatorCol } from './shared'

export const buildClusterColumns = (
  onStart: (cluster: ClusterTask) => void,
  onDeposit: (cluster: ClusterTask) => void
): ColumnDef<ClusterTask>[] => [
  {
    accessorKey: 'code',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs font-semibold">{row.original.code}</span>
    ),
  },
  {
    id: 'slots',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Contenedores" />,
    cell: ({ row }) => {
      const completed = clusterSlotsCompleted(row.original)
      const total = row.original.slots.length
      return (
        <div className="flex items-center gap-1.5">
          <span className="tabular-nums text-sm font-semibold">{completed}</span>
          <span className="text-muted-foreground text-xs">/ {total}</span>
          {completed === total && total > 0 && (
            <CheckCircle2 className="size-3 text-green-600" />
          )}
        </div>
      )
    },
  },
  {
    id: 'route',
    header: 'Paradas',
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">
        {row.original.route.length} ubicaciones
      </span>
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
    id: 'progress',
    header: 'Progreso',
    enableSorting: false,
    cell: ({ row }) => {
      const total = row.original.slots.length
      const done = clusterSlotsCompleted(row.original)
      return progressCell(done, total)
    },
  },
  operatorCol<ClusterTask>(),
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const c = row.original
      if (c.status === 'pending')
        return (
          <Button size="sm" variant="outline" onClick={() => onStart(c)}>
            <PlayCircle className="mr-1 size-3" /> Iniciar
          </Button>
        )
      if (c.status === 'in_progress')
        return (
          <Button size="sm" onClick={() => onDeposit(c)}>
            <ShoppingCart className="mr-1 size-3" /> Depositar
          </Button>
        )
      return null
    },
  },
]
