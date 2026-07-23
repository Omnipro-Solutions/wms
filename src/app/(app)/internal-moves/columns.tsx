'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { ArrowRight, Check, Hand, PackageCheck, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTableColumnHeader } from '@/components/data-table'
import type { InternalMoveType } from '@/types/wms'

export interface InternalMoveRow {
  id: string
  code: string
  moveType: InternalMoveType
  productName: string
  productSku: string
  fromCode: string
  toCode: string
  quantity: number
  status: string
  operatorName?: string
  reasonLabel?: string
}

export const MOVE_TYPE_LABELS: Record<InternalMoveType, string> = {
  putaway: 'Putaway',
  replenishment: 'Reabastecimiento',
  reslotting: 'Reslotting',
  bin_to_bin: 'Bin-to-bin',
  consolidation: 'Consolidación',
  quarantine: 'Cuarentena',
  housekeeping: 'Limpieza',
}

export interface InternalMoveHandlers {
  onAssign: (id: string) => void
  onPick: (id: string) => void
  onDrop: (id: string) => void
  onCancel: (id: string) => void
}

// Botones de la confirmación en dos pasos, condicionados al estado de la tarea.
const ActionsCell = ({ row, handlers }: { row: InternalMoveRow; handlers: InternalMoveHandlers }) => {
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {row.status === 'pending' && (
        <Button size="sm" variant="outline" onClick={stop(() => handlers.onAssign(row.id))}>
          <Hand className="mr-1 size-3.5" />
          Asignar
        </Button>
      )}
      {row.status === 'assigned' && (
        <Button size="sm" variant="outline" onClick={stop(() => handlers.onPick(row.id))}>
          <PackageCheck className="mr-1 size-3.5" />
          Recoger
        </Button>
      )}
      {row.status === 'picked' && (
        <Button size="sm" onClick={stop(() => handlers.onDrop(row.id))}>
          <Check className="mr-1 size-3.5" />
          Depositar
        </Button>
      )}
      {row.status !== 'dropped' && row.status !== 'cancelled' && (
        <Button
          size="icon"
          variant="ghost"
          className="text-muted-foreground size-8"
          onClick={stop(() => handlers.onCancel(row.id))}
          title="Cancelar movimiento"
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  )
}

export const buildInternalMoveColumns = (
  handlers?: InternalMoveHandlers
): ColumnDef<InternalMoveRow>[] => {
  const columns: ColumnDef<InternalMoveRow>[] = [
    {
      accessorKey: 'code',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Código / Tipo" />,
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <p className="font-medium">{row.getValue('code')}</p>
          <Badge variant="outline" className="text-xs">
            {MOVE_TYPE_LABELS[row.original.moveType]}
          </Badge>
        </div>
      ),
    },
    {
      id: 'product',
      header: 'Producto',
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <p className="max-w-[180px] truncate text-sm">{row.original.productName}</p>
          <p className="text-muted-foreground text-xs">{row.original.productSku}</p>
        </div>
      ),
      enableSorting: false,
    },
    {
      id: 'route',
      header: 'Ruta interna',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm">
          <span className="truncate max-w-[120px]">{row.original.fromCode}</span>
          <ArrowRight className="text-muted-foreground size-3.5 shrink-0" />
          <span className="truncate max-w-[120px]">{row.original.toCode}</span>
        </div>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Cant." className="justify-end" />
      ),
      cell: ({ row }) => (
        <div className="text-right tabular-nums">{row.getValue('quantity')}</div>
      ),
    },
    {
      id: 'operator',
      header: 'Operario',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.operatorName ?? '—'}</span>
      ),
      enableSorting: false,
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
