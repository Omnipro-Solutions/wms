'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { Building2, CheckCircle2, PlayCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { ProductAvatar } from '@/app/(app)/receiving/_components/product-avatar'
import { formatNumber } from '@/lib/formatters'
import type { PutToStoreTask } from '@/types/wms'
import { operatorCol } from './shared'

export const buildPutToStoreColumns = (
  getProductName: (id: string) => string,
  onStart: (task: PutToStoreTask) => void,
  onDistribute: (task: PutToStoreTask) => void
): ColumnDef<PutToStoreTask>[] => [
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
    id: 'stores',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tiendas" />,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{row.original.allocations.length}</div>
    ),
  },
  {
    accessorKey: 'totalPickedQuantity',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Total pickeado" />,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        {formatNumber(row.original.totalPickedQuantity)}
      </div>
    ),
  },
  {
    id: 'distributed',
    header: 'Distribución',
    enableSorting: false,
    cell: ({ row }) => {
      const distributed = row.original.allocations.reduce(
        (s, a) => s + a.distributedQuantity,
        0
      )
      const total = row.original.allocations.reduce((s, a) => s + a.requestedQuantity, 0)
      const pct = total > 0 ? Math.round((distributed / total) * 100) : 0
      return (
        <div className="min-w-32 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs tabular-nums">
              <span className="font-semibold">{formatNumber(distributed)}</span>
              <span className="text-muted-foreground"> / {formatNumber(total)}</span>
            </span>
            <span className="text-xs font-bold text-primary">{pct}%</span>
          </div>
          <Progress value={pct} className="h-1.5" />
          {pct === 100 && (
            <div className="flex items-center gap-1 text-[10px] text-green-700">
              <CheckCircle2 className="size-3" /> Completo
            </div>
          )}
        </div>
      )
    },
  },
  operatorCol<PutToStoreTask>(),
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
      const t = row.original
      if (t.status === 'pending')
        return (
          <Button size="sm" variant="outline" onClick={() => onStart(t)}>
            <PlayCircle className="mr-1 size-3" /> Iniciar
          </Button>
        )
      if (t.status === 'in_progress')
        return (
          <Button size="sm" onClick={() => onDistribute(t)}>
            <Building2 className="mr-1 size-3" /> Distribuir
          </Button>
        )
      return null
    },
  },
]
