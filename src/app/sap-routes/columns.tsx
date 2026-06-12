'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { Truck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { formatNumber } from '@/lib/formatters'

export interface SapRouteRow {
  id: string
  code: string
  name: string
  originName: string
  destinationNames: string[]
  carrierName: string
  driverName: string
  truckPlate: string
  routeDate: string
  currentLoadKg: number
  capacityKg: number
  loadPct: number
  status: string
}

export const buildSapRouteColumns = (): ColumnDef<SapRouteRow>[] => [
  {
    accessorKey: 'code',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
    cell: ({ row }) => (
      <span className="font-mono text-sm font-medium">{row.getValue('code')}</span>
    ),
  },
  {
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
    cell: ({ row }) => <span className="font-medium">{row.getValue('name')}</span>,
  },
  {
    accessorKey: 'originName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Origen" />,
    cell: ({ row }) => <span className="text-sm">{row.getValue('originName')}</span>,
  },
  {
    id: 'destinations',
    accessorKey: 'destinationNames',
    header: 'Destinos',
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.destinationNames.map((d) => (
          <Badge key={d} variant="outline" className="text-xs">
            {d}
          </Badge>
        ))}
      </div>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'carrierName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Transportadora" />,
    cell: ({ row }) => <span className="text-sm">{row.getValue('carrierName')}</span>,
  },
  {
    id: 'driver',
    header: () => (
      <div className="flex items-center gap-1">
        <Truck className="size-3" /> Conductor / Placa
      </div>
    ),
    cell: ({ row }) => (
      <div>
        <p className="text-sm font-medium">{row.original.driverName}</p>
        <p className="text-muted-foreground font-mono text-xs">{row.original.truckPlate}</p>
      </div>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'routeDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha ruta" />,
    cell: ({ row }) => <span className="text-sm">{row.getValue('routeDate')}</span>,
  },
  {
    accessorKey: 'loadPct',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Ocupación" />,
    cell: ({ row }) => {
      const pct = row.original.loadPct
      const colorClass = pct >= 90 ? '[&>div]:bg-red-500' : pct >= 70 ? '[&>div]:bg-amber-500' : ''
      return (
        <div className="flex items-center gap-2">
          <Progress value={pct} className={`h-2 w-20 ${colorClass}`} />
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatNumber(row.original.currentLoadKg)}/{formatNumber(row.original.capacityKg)} kg
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
  },
]
