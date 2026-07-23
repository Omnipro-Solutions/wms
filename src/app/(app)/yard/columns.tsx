'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { Check, LogIn, Play, UserX, Warehouse as WarehouseIcon, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { formatDateTime } from '@/lib/formatters'
import { APPOINTMENT_TYPE_LABELS } from '@/lib/rules/yard'
import type { DockAppointmentStatus, DockAppointmentType } from '@/types/wms'

export interface AppointmentRow {
  id: string
  code: string
  warehouseId: string
  warehouseName: string
  type: DockAppointmentType
  status: DockAppointmentStatus
  dockId?: string
  dockLabel: string
  referenceLabel: string
  carrierName?: string
  driverName?: string
  vehiclePlate?: string
  scheduledStart: string
  scheduledEnd: string
}

export interface AppointmentHandlers {
  onAssignDock: (row: AppointmentRow) => void
  onCheckIn: (id: string) => void
  onStart: (id: string) => void
  onComplete: (id: string) => void
  onNoShow: (id: string) => void
  onCancel: (id: string) => void
}

const timeOf = (iso: string) => iso.slice(11, 16)

const ActionsCell = ({ row, handlers }: { row: AppointmentRow; handlers: AppointmentHandlers }) => {
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
  }

  const canAssignDock = row.status === 'scheduled' || row.status === 'arrived'
  const canCancel = row.status === 'scheduled' || row.status === 'arrived'

  return (
    <div className="flex items-center justify-end gap-1.5">
      {canAssignDock && (
        <Button size="sm" variant="outline" onClick={stop(() => handlers.onAssignDock(row))}>
          <WarehouseIcon className="mr-1 size-3.5" />
          {row.dockId ? 'Reasignar' : 'Asignar muelle'}
        </Button>
      )}
      {row.status === 'scheduled' && (
        <>
          <Button size="sm" variant="outline" onClick={stop(() => handlers.onCheckIn(row.id))}>
            <LogIn className="mr-1 size-3.5" />
            Llegó
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground size-8"
            onClick={stop(() => handlers.onNoShow(row.id))}
            title="Marcar no-show"
          >
            <UserX className="size-4" />
          </Button>
        </>
      )}
      {row.status === 'arrived' && (
        <Button
          size="sm"
          onClick={stop(() => handlers.onStart(row.id))}
          disabled={!row.dockId}
          title={!row.dockId ? 'Asigna un muelle antes de iniciar' : undefined}
        >
          <Play className="mr-1 size-3.5" />
          Iniciar
        </Button>
      )}
      {row.status === 'in_progress' && (
        <Button size="sm" onClick={stop(() => handlers.onComplete(row.id))}>
          <Check className="mr-1 size-3.5" />
          Completar
        </Button>
      )}
      {canCancel && (
        <Button
          size="icon"
          variant="ghost"
          className="text-muted-foreground size-8"
          onClick={stop(() => handlers.onCancel(row.id))}
          title="Cancelar cita"
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  )
}

export const buildAppointmentColumns = (handlers?: AppointmentHandlers): ColumnDef<AppointmentRow>[] => {
  const columns: ColumnDef<AppointmentRow>[] = [
    {
      accessorKey: 'code',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cita" />,
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <p className="font-medium">{row.getValue('code')}</p>
          <Badge variant="outline" className="text-xs">
            {APPOINTMENT_TYPE_LABELS[row.original.type]}
          </Badge>
        </div>
      ),
    },
    {
      id: 'location',
      header: 'Bodega / muelle',
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <p className="text-sm">{row.original.warehouseName}</p>
          <p className="text-muted-foreground text-xs">{row.original.dockLabel}</p>
        </div>
      ),
      enableSorting: false,
    },
    {
      id: 'reference',
      header: 'Referencia / transportista',
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <p className="text-sm">{row.original.referenceLabel}</p>
          <p className="text-muted-foreground text-xs">
            {row.original.carrierName ?? '—'}
            {row.original.driverName ? ` · ${row.original.driverName}` : ''}
          </p>
        </div>
      ),
      enableSorting: false,
    },
    {
      id: 'schedule',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Horario" />,
      accessorKey: 'scheduledStart',
      cell: ({ row }) => (
        <div className="space-y-0.5 text-sm">
          <p>{formatDateTime(row.original.scheduledStart)}</p>
          <p className="text-muted-foreground text-xs">hasta {timeOf(row.original.scheduledEnd)}</p>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
      cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
    },
  ]

  if (handlers) {
    columns.push({
      id: 'actions',
      enableHiding: false,
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => <ActionsCell row={row.original} handlers={handlers} />,
    })
  }

  return columns
}
