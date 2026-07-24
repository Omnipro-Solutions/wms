'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { Download, Printer, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTableColumnHeader } from '@/components/data-table'
import type { WmsLabel } from '@/types/wms'

export interface LabelRow {
  id: string
  code: string
  type: WmsLabel['type']
  reference: string
  status: string
  createdBy: string
  createdAt: string
}

export const TYPE_LABELS: Record<WmsLabel['type'], string> = {
  product: 'Producto',
  location: 'Ubicación',
  box: 'Caja',
  pallet: 'Pallet',
  shipping: 'Envío',
  return: 'Devolución',
  receipt: 'Recepción',
  lpn: 'LPN',
}

export const TYPE_COLORS: Record<WmsLabel['type'], string> = {
  product: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50',
  location: 'bg-slate-100 dark:bg-zinc-800/50 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700/50',
  box: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50',
  pallet: 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/50',
  shipping: 'bg-green-100 dark:bg-emerald-950/40 text-green-700 dark:text-emerald-300 border-green-200 dark:border-emerald-800/50',
  return: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/50',
  receipt: 'bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/50',
  lpn: 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50',
}

export const buildLabelColumns = (onPreview?: (row: LabelRow) => void): ColumnDef<LabelRow>[] => [
  {
    accessorKey: 'code',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
    cell: ({ row }) => (
      <span className="font-mono text-sm font-medium">{row.getValue('code')}</span>
    ),
  },
  {
    accessorKey: 'type',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
    cell: ({ row }) => {
      const type = row.getValue<WmsLabel['type']>('type')
      return (
        <Badge variant="outline" className={`text-xs ${TYPE_COLORS[type]}`}>
          {TYPE_LABELS[type]}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'reference',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Referencia" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground font-mono text-xs">{row.getValue('reference')}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
  },
  {
    accessorKey: 'createdBy',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Creada por" />,
    cell: ({ row }) => <span className="text-sm">{row.getValue('createdBy')}</span>,
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" />,
    cell: ({ row }) => (
      <span className="text-sm">
        {row.getValue<string>('createdAt').slice(0, 16).replace('T', ' ')}
      </span>
    ),
  },
  {
    id: 'actions',
    enableHiding: false,
    enableSorting: false,
    cell: ({ row }) => {
      const { status } = row.original
      if (status === 'completed') {
        return (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => onPreview?.(row.original)}>
              <Printer className="mr-1 size-3" /> ZPL
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onPreview?.(row.original)}>
              <Download className="size-3" />
            </Button>
          </div>
        )
      }
      if (status === 'pending') {
        return (
          <Button size="sm">
            <RefreshCw className="mr-1 size-3" /> Generar
          </Button>
        )
      }
      return null
    },
  },
]
