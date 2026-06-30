'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { CheckCircle2, PlayCircle, Scan, ThumbsDown, ThumbsUp } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { ProductAvatar } from '@/app/(app)/receiving/_components/product-avatar'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { PickingTask } from '@/types/wms'
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  progressCell,
  operatorCol,
} from './shared'

export type TaskAction =
  | { type: 'start'; taskId: string }
  | { type: 'register'; task: PickingTask }
  | { type: 'approve'; taskId: string }
  | { type: 'reject'; taskId: string }
  | { type: 'retry'; task: PickingTask }

export const buildTaskColumns = (
  getProductName: (id: string) => string,
  getLocationCode: (id: string) => string,
  onAction: (action: TaskAction) => void
): ColumnDef<PickingTask>[] => [
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
    accessorKey: 'requestedQuantity',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Solicitado" />,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{formatNumber(row.original.requestedQuantity)}</div>
    ),
  },
  {
    id: 'progress',
    header: 'Progreso',
    enableSorting: false,
    cell: ({ row }) =>
      progressCell(row.original.pickedQuantity, row.original.requestedQuantity),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  operatorCol<PickingTask>(),
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const task = row.original
      const isPartialPending =
        task.status === 'partially_picked' || task.status === 'partial_with_shortage'

      return (
        <div className="flex items-center gap-1">
          {(task.status === 'pending' || task.status === 'assigned') && (
            <Button size="sm" variant="outline" onClick={() => onAction({ type: 'start', taskId: task.id })}>
              <PlayCircle className="mr-1 size-3" />
              {task.status === 'pending' ? 'Asignar' : 'Iniciar'}
            </Button>
          )}
          {task.status === 'in_progress' && (
            <Button size="sm" onClick={() => onAction({ type: 'register', task })}>
              <CheckCircle2 className="mr-1 size-3" /> Registrar
            </Button>
          )}
          {['assigned', 'in_progress'].includes(task.status) && (
            <Button asChild size="sm" variant="outline" className="h-7 gap-1 text-xs">
              <Link href={`/picking/scan/${task.id}`}>
                <Scan className="size-3" />
                Escanear
              </Link>
            </Button>
          )}
          {isPartialPending && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="border-green-300 text-green-700 hover:bg-green-50"
                onClick={() => onAction({ type: 'approve', taskId: task.id })}
              >
                <ThumbsUp className="size-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
                onClick={() => onAction({ type: 'reject', taskId: task.id })}
              >
                <ThumbsDown className="size-3" />
              </Button>
            </>
          )}
          {task.status === 'partial_rejected' && (
            <Button size="sm" onClick={() => onAction({ type: 'retry', task })}>
              <PlayCircle className="mr-1 size-3" /> Reintentar
            </Button>
          )}
        </div>
      )
    },
  },
]
