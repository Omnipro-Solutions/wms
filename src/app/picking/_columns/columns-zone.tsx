'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { ProductAvatar } from '@/app/receiving/_components/product-avatar'
import { cn } from '@/lib/utils'
import type { PickingTask } from '@/types/wms'
import { PRIORITY_COLORS, PRIORITY_LABELS, ZONE_COLORS, progressCell, operatorCol } from './shared'

export type ZoneTask = PickingTask & { zone: string }

export const buildZoneColumns = (
  getProductName: (id: string) => string,
  getLocationCode: (id: string) => string
): ColumnDef<ZoneTask>[] => [
  {
    accessorKey: 'code',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tarea" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs font-semibold">{row.original.code}</span>
    ),
  },
  {
    accessorKey: 'zone',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Zona" />,
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={cn('font-mono text-xs', ZONE_COLORS[row.original.zone] ?? '')}
      >
        {row.original.zone}
      </Badge>
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
    id: 'progress',
    header: 'Progreso',
    enableSorting: false,
    cell: ({ row }) =>
      progressCell(row.original.pickedQuantity, row.original.requestedQuantity),
  },
  operatorCol<ZoneTask>(),
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
]
