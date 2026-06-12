'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { formatNumber } from '@/lib/formatters'
import type { AbcClass } from '@/types/wms'

export interface InventoryRow {
  id: string
  productId: string
  productName: string
  locationId: string
  locationCode: string
  lot: string | null
  serial: string | null
  abcClass: AbcClass
  onHandQuantity: number
  reservedQuantity: number
  holdQuantity: number
  available: number
  status: string
}

type ActionHandler = (type: 'hold' | 'release' | 'adjust', row: InventoryRow) => void

export const buildInventoryColumns = (onAction: ActionHandler): ColumnDef<InventoryRow>[] => [
  {
    accessorKey: 'productName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
    cell: ({ row }) => <span className="font-medium">{row.getValue('productName')}</span>,
  },
  {
    accessorKey: 'locationCode',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Ubicación" />,
    cell: ({ row }) => <span className="font-mono text-xs">{row.getValue('locationCode')}</span>,
  },
  {
    accessorKey: 'abcClass',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Clase" />,
    cell: ({ row }) => {
      const cls = row.getValue<AbcClass>('abcClass')
      return (
        <Badge variant={cls === 'A' ? 'default' : cls === 'B' ? 'secondary' : 'outline'}>
          {cls}
        </Badge>
      )
    },
  },
  {
    id: 'lotSerial',
    accessorFn: (row) => row.lot ?? row.serial ?? '',
    header: 'Lote / Serial',
    cell: ({ row }) => {
      const { lot, serial } = row.original
      return (
        <span className="text-muted-foreground text-xs">
          {lot ? `L: ${lot}` : serial ? `S: ${serial}` : '—'}
        </span>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'onHandQuantity',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="En mano" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{formatNumber(row.getValue('onHandQuantity'))}</div>
    ),
  },
  {
    accessorKey: 'reservedQuantity',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Reservado" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right text-blue-600 tabular-nums">
        {formatNumber(row.getValue('reservedQuantity'))}
      </div>
    ),
  },
  {
    accessorKey: 'holdQuantity',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Hold" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right text-amber-600 tabular-nums">
        {formatNumber(row.getValue('holdQuantity'))}
      </div>
    ),
  },
  {
    accessorKey: 'available',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Disponible" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right font-semibold text-green-700 tabular-nums">
        {formatNumber(row.getValue('available'))}
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
    filterFn: (row, _id, filterValue) =>
      filterValue === 'all' || row.original.status === filterValue,
  },
  {
    id: 'actions',
    enableHiding: false,
    enableSorting: false,
    cell: ({ row }) => {
      const item = row.original
      return (
        <div className="flex gap-1">
          {item.status !== 'on_hold' && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                onAction('hold', item)
              }}
            >
              Hold
            </Button>
          )}
          {item.holdQuantity > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                onAction('release', item)
              }}
            >
              Liberar
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              onAction('adjust', item)
            }}
          >
            Ajustar
          </Button>
        </div>
      )
    },
  },
]
