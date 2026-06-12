'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTableColumnHeader } from '@/components/data-table'
import type { ReturnOrder } from '@/types/wms'

export interface ReturnRow {
  id: string
  rmaCode: string
  customerName: string
  type: ReturnOrder['type']
  originName: string
  destinationName: string
  disposition: ReturnOrder['disposition']
  reasonLabel: string
  status: string
  canAdvance: boolean
}

export const TYPE_LABELS: Record<ReturnOrder['type'], string> = {
  customer_to_store: 'Cliente → Tienda',
  customer_store_to_dc: 'Cliente/Tienda → DC',
  store_to_dc: 'Tienda → DC',
  store_to_store: 'Tienda → Tienda',
  dc_to_supplier: 'DC → Proveedor',
}

export const DISPOSITION_COLORS: Record<ReturnOrder['disposition'], string> = {
  restock: 'bg-green-100 text-green-700 border-green-200',
  scrap: 'bg-red-100 text-red-700 border-red-200',
  quality_control: 'bg-amber-100 text-amber-700 border-amber-200',
  repair: 'bg-blue-100 text-blue-700 border-blue-200',
  rejected: 'bg-slate-100 text-slate-600 border-slate-200',
}

export const DISPOSITION_LABELS: Record<ReturnOrder['disposition'], string> = {
  restock: 'Reingresar',
  scrap: 'Desecho',
  quality_control: 'Control calidad',
  repair: 'Reparación',
  rejected: 'Rechazada',
}

export const buildReturnColumns = (onAdvance: (row: ReturnRow) => void): ColumnDef<ReturnRow>[] => [
  {
    accessorKey: 'rmaCode',
    header: ({ column }) => <DataTableColumnHeader column={column} title="RMA" />,
    cell: ({ row }) => <span className="font-medium">{row.getValue('rmaCode')}</span>,
  },
  {
    accessorKey: 'customerName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" />,
  },
  {
    accessorKey: 'type',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="text-xs">
        {TYPE_LABELS[row.getValue<ReturnOrder['type']>('type')]}
      </Badge>
    ),
  },
  {
    id: 'route',
    header: 'Ruta',
    cell: ({ row }) => (
      <div className="flex items-center gap-1 text-sm">
        <span>{row.original.originName}</span>
        <ArrowRight className="text-muted-foreground size-3.5 shrink-0" />
        <span>{row.original.destinationName}</span>
      </div>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'disposition',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Disposición" />,
    cell: ({ row }) => {
      const d = row.getValue<ReturnOrder['disposition']>('disposition')
      return (
        <Badge variant="outline" className={`text-xs ${DISPOSITION_COLORS[d]}`}>
          {DISPOSITION_LABELS[d]}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'reasonLabel',
    header: 'Motivo',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">{row.getValue('reasonLabel') || '—'}</span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
  },
  {
    id: 'actions',
    enableHiding: false,
    enableSorting: false,
    cell: ({ row }) => {
      if (!row.original.canAdvance) return null
      return (
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onAdvance(row.original)
          }}
        >
          Avanzar
        </Button>
      )
    },
  },
]
