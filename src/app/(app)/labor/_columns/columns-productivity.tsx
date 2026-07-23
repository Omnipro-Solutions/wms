'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/data-table'
import { cn } from '@/lib/utils'
import type { ProductivityRow } from '@/types/wms'

export const buildProductivityColumns = (targetUnitsPerHour: number): ColumnDef<ProductivityRow>[] => [
  {
    accessorKey: 'operatorName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Operario" />,
    cell: ({ row }) => <span className="text-sm font-medium">{row.original.operatorName}</span>,
  },
  {
    accessorKey: 'picksCompleted',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Picks completados" />,
    cell: ({ row }) => <div className="text-right tabular-nums">{row.original.picksCompleted}</div>,
  },
  {
    accessorKey: 'unitsPicked',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Unidades" />,
    cell: ({ row }) => {
      const pct = targetUnitsPerHour > 0 ? (row.original.unitsPicked / targetUnitsPerHour) * 100 : 0
      const tone = pct >= 100 ? 'text-emerald-600' : pct >= 80 ? 'text-amber-600' : 'text-red-600'
      return <div className={cn('text-right font-semibold tabular-nums', tone)}>{row.original.unitsPicked}</div>
    },
  },
  {
    accessorKey: 'partialCount',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Parciales" />,
    cell: ({ row }) => <div className="text-right tabular-nums">{row.original.partialCount}</div>,
  },
  {
    accessorKey: 'issueCount',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Incidencias" />,
    cell: ({ row }) => <div className="text-right tabular-nums">{row.original.issueCount}</div>,
  },
]
