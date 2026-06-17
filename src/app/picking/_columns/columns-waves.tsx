'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { PlayCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { PickingWave } from '@/types/wms'
import { PRIORITY_COLORS, PRIORITY_LABELS } from './shared'

const GROUP_BY_LABELS: Record<PickingWave['groupBy'], string> = {
  zone: 'Zona',
  route: 'Ruta',
  priority: 'Prioridad',
  carrier: 'Transportadora',
  dispatch_window: 'Ventana despacho',
  fulfillment_type: 'Tipo despacho',
}

export const buildWaveColumns = (
  onRelease: (wave: PickingWave) => void
): ColumnDef<PickingWave>[] => [
  {
    accessorKey: 'code',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs font-semibold">{row.original.code}</span>
    ),
  },
  {
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
    cell: ({ row }) => <span className="text-sm font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'groupBy',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Agrupación" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {GROUP_BY_LABELS[row.original.groupBy]}
      </span>
    ),
  },
  {
    accessorKey: 'groupValue',
    header: 'Valor',
    cell: ({ row }) => (
      <Badge variant="outline" className="font-mono text-xs">
        {row.original.groupValue}
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
    accessorKey: 'orderCount',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Pedidos" />,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{formatNumber(row.original.orderCount)}</div>
    ),
  },
  {
    accessorKey: 'unitCount',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Unidades" />,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{formatNumber(row.original.unitCount)}</div>
    ),
  },
  {
    accessorKey: 'assignedTeam',
    header: 'Equipo',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">{row.original.assignedTeam ?? '—'}</span>
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
      row.original.status === 'draft' ? (
        <Button size="sm" onClick={() => onRelease(row.original)}>
          <PlayCircle className="mr-1 size-3" /> Liberar
        </Button>
      ) : null,
  },
]
