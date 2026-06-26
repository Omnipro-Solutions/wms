'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { ChevronDown, Truck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { formatNumber } from '@/lib/formatters'
import type { SapRoute, SapRouteStatus } from '@/types/wms'

// Valid next states from each status
const NEXT_STATES: Record<SapRouteStatus, SapRouteStatus[]> = {
  pending:     ['in_progress', 'error'],
  in_progress: ['in_transit', 'error'],
  in_transit:  ['completed', 'synced', 'error'],
  completed:   ['synced'],
  synced:      [],
  error:       ['pending', 'synced'],
}

const STATUS_LABELS: Record<SapRouteStatus, string> = {
  pending:     'Pendiente',
  in_progress: 'En preparación',
  in_transit:  'En tránsito',
  completed:   'Completado',
  synced:      'Sincronizado',
  error:       'Error',
}

interface ColumnActions {
  onStatusChange: (id: string, status: SapRouteStatus) => void
  warehouseName: (id: string) => string
}

export const buildSapRouteColumns = ({ onStatusChange, warehouseName }: ColumnActions): ColumnDef<SapRoute>[] => [
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
    id: 'origin',
    header: 'Origen',
    cell: ({ row }) => (
      <span className="text-sm">{warehouseName(row.original.originId)}</span>
    ),
    enableSorting: false,
  },
  {
    id: 'destinations',
    header: 'Destinos',
    cell: ({ row }) => {
      const names = row.original.destinationIds.map(warehouseName)
      if (!names.length) return <span className="text-muted-foreground text-sm">—</span>
      return (
        <div className="flex flex-wrap gap-1">
          {names.map((d) => (
            <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
          ))}
        </div>
      )
    },
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
    id: 'load',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Ocupación" />,
    cell: ({ row }) => {
      const { currentLoadKg, capacityKg } = row.original
      const pct = capacityKg > 0 ? Math.round((currentLoadKg / capacityKg) * 100) : 0
      const colorClass = pct >= 90 ? '[&>div]:bg-red-500' : pct >= 70 ? '[&>div]:bg-amber-500' : ''
      return (
        <div className="flex items-center gap-2">
          <Progress value={pct} className={`h-2 w-20 ${colorClass}`} />
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatNumber(currentLoadKg)}/{formatNumber(capacityKg)} kg
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
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const nextStates = NEXT_STATES[row.original.status as SapRouteStatus] ?? []
      if (!nextStates.length) return null
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
              Avanzar <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {nextStates.map((s) => (
              <DropdownMenuItem
                key={s}
                onClick={() => onStatusChange(row.original.id, s)}
              >
                {STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
