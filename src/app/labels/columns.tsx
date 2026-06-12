'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { Download, RefreshCw } from 'lucide-react'
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
}

export const TYPE_COLORS: Record<WmsLabel['type'], string> = {
  product: 'bg-blue-100 text-blue-700 border-blue-200',
  location: 'bg-slate-100 text-slate-700 border-slate-200',
  box: 'bg-amber-100 text-amber-700 border-amber-200',
  pallet: 'bg-orange-100 text-orange-700 border-orange-200',
  shipping: 'bg-green-100 text-green-700 border-green-200',
  return: 'bg-red-100 text-red-700 border-red-200',
}

export const buildLabelColumns = (): ColumnDef<LabelRow>[] => [
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
          <Button size="sm" variant="outline">
            <Download className="mr-1 size-3" /> Reimprimir
          </Button>
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
