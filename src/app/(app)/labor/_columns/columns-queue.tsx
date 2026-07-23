'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { ProductAvatar } from '@/app/(app)/receiving/_components/product-avatar'
import { PRIORITY_COLORS, PRIORITY_LABELS, operatorCol } from '@/app/(app)/picking/_columns/shared'
import { cn } from '@/lib/utils'
import type { LaborQueueItem } from '@/types/wms'

const SOURCE_TYPE_LABELS: Record<LaborQueueItem['sourceType'], string> = {
  picking: 'Picking',
  putaway: 'Putaway',
  replenishment: 'Reposición',
}

const SOURCE_TYPE_COLORS: Record<LaborQueueItem['sourceType'], string> = {
  picking: 'border-blue-200 bg-blue-100 text-blue-700',
  putaway: 'border-purple-200 bg-purple-100 text-purple-700',
  replenishment: 'border-amber-200 bg-amber-100 text-amber-700',
}

export const buildQueueColumns = (
  getProductName: (id: string) => string,
  getLocationCode: (id: string) => string,
  onAssign: (item: LaborQueueItem) => void
): ColumnDef<LaborQueueItem>[] => [
  {
    accessorKey: 'sourceType',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
    cell: ({ row }) => (
      <Badge variant="outline" className={cn('text-xs', SOURCE_TYPE_COLORS[row.original.sourceType])}>
        {SOURCE_TYPE_LABELS[row.original.sourceType]}
      </Badge>
    ),
  },
  {
    accessorKey: 'code',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
    cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.code}</span>,
  },
  {
    accessorKey: 'productId',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
    cell: ({ row }) =>
      row.original.productId ? (
        <ProductAvatar productId={row.original.productId} name={getProductName(row.original.productId)} />
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      ),
  },
  {
    accessorKey: 'locationId',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Ubicación" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {row.original.locationId ? getLocationCode(row.original.locationId) : '—'}
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
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  operatorCol<LaborQueueItem>(),
  {
    id: 'suggestedRoute',
    header: 'Ruta combinada',
    enableSorting: false,
    cell: ({ row }) =>
      row.original.suggestedRouteId ? (
        <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-xs text-emerald-700">
          Sugerida
        </Badge>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      ),
  },
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <Button size="sm" variant="outline" onClick={() => onAssign(row.original)}>
        <Play className="mr-1 size-3" />
        {row.original.operatorName ? 'Reasignar' : 'Asignar'}
      </Button>
    ),
  },
]
