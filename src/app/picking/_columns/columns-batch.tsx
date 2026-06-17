'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { CheckCircle2, PlayCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { ProductAvatar } from '@/app/receiving/_components/product-avatar'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { batchProgress } from '@/lib/rules/picking'
import type { BatchTask } from '@/types/wms'
import { PRIORITY_COLORS, PRIORITY_LABELS, progressCell, operatorCol } from './shared'

export const buildBatchColumns = (
  getProductName: (id: string) => string,
  getLocationCode: (id: string) => string,
  onStart: (batch: BatchTask) => void,
  onRegister: (batch: BatchTask) => void
): ColumnDef<BatchTask>[] => [
  {
    accessorKey: 'code',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs font-semibold">{row.original.code}</span>
    ),
  },
  {
    accessorKey: 'productId',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
    cell: ({ row }) => (
      <ProductAvatar productId={row.original.productId} name={getProductName(row.original.productId)} />
    ),
  },
  {
    accessorKey: 'locationId',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Ubicación" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs">{getLocationCode(row.original.locationId)}</span>
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
    id: 'orders',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Pedidos" />,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{row.original.pickingTaskIds.length}</div>
    ),
  },
  {
    accessorKey: 'totalRequestedQuantity',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Total solicitado" />,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        {formatNumber(row.original.totalRequestedQuantity)}
      </div>
    ),
  },
  {
    id: 'progress',
    header: 'Progreso',
    enableSorting: false,
    cell: ({ row }) => {
      const pct = batchProgress(row.original)
      return progressCell(Math.round((pct / 100) * row.original.totalRequestedQuantity), row.original.totalRequestedQuantity)
    },
  },
  operatorCol<BatchTask>(),
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
      const b = row.original
      if (b.status === 'pending')
        return (
          <Button size="sm" variant="outline" onClick={() => onStart(b)}>
            <PlayCircle className="mr-1 size-3" /> Iniciar
          </Button>
        )
      if (b.status === 'in_progress')
        return (
          <Button size="sm" onClick={() => onRegister(b)}>
            <CheckCircle2 className="mr-1 size-3" /> Registrar
          </Button>
        )
      return null
    },
  },
]
