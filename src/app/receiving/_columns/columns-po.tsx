import { type ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, Clock, PackageCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { DataTableColumnHeader } from '@/components/data-table'
import { formatNumber } from '@/lib/formatters'
import type { PoRow } from '../columns'

const PO_STATUS_MAP: Record<string, { label: string; className: string }> = {
  draft: { label: 'Borrador', className: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
  confirmed: { label: 'Confirmada', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  partial: { label: 'Parcial', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  received: { label: 'Recibida', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelada', className: 'bg-red-100 text-red-700 border-red-200' },
}

export const buildPoColumns = (onCreateReception: (row: PoRow) => void): ColumnDef<PoRow>[] => [
  {
    accessorKey: 'code',
    header: ({ column }) => <DataTableColumnHeader column={column} title="N° Orden" />,
    filterFn: (row, _columnId, filterValue: string) => {
      const q = filterValue.toLowerCase()
      return (
        row.original.code.toLowerCase().includes(q) ||
        row.original.supplierName.toLowerCase().includes(q)
      )
    },
    cell: ({ row }) => (
      <span className="text-muted-foreground font-mono text-xs font-semibold">
        {row.getValue('code')}
      </span>
    ),
  },
  {
    accessorKey: 'supplierName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Proveedor" />,
    cell: ({ row }) => <span className="text-sm font-medium">{row.getValue('supplierName')}</span>,
  },
  {
    accessorKey: 'expectedDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha esperada" />,
    cell: ({ row }) => {
      const { expectedDate, isOverdue } = row.original
      return (
        <div className="flex items-center gap-1.5">
          {isOverdue ? (
            <AlertTriangle className="size-3.5 shrink-0 text-red-500" />
          ) : (
            <Clock className="text-muted-foreground size-3.5 shrink-0" />
          )}
          <span className={cn('text-sm', isOverdue && 'font-semibold text-red-600')}>
            {expectedDate}
          </span>
          {isOverdue && (
            <Badge variant="destructive" className="ml-1 text-xs">
              Atrasada
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    id: 'lines',
    header: 'Líneas',
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm tabular-nums">
        {row.original.lineCount} {row.original.lineCount === 1 ? 'producto' : 'productos'}
      </span>
    ),
  },
  {
    id: 'progress',
    header: 'Progreso de recepción',
    enableSorting: false,
    cell: ({ row }) => {
      const { totalOrdered, totalReceived, pendingQty, progressPct } = row.original
      return (
        <div className="min-w-40 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground tabular-nums">
              {formatNumber(totalReceived)} / {formatNumber(totalOrdered)} uds
            </span>
            <span
              className={cn(
                'font-semibold tabular-nums',
                progressPct === 100
                  ? 'text-emerald-600'
                  : progressPct > 0
                    ? 'text-blue-600'
                    : 'text-muted-foreground'
              )}
            >
              {progressPct}%
            </span>
          </div>
          <Progress
            value={progressPct}
            className={cn(
              progressPct === 100
                ? '*:data-[slot=progress-indicator]:bg-emerald-500'
                : progressPct > 0
                  ? '*:data-[slot=progress-indicator]:bg-blue-500'
                  : ''
            )}
          />
          {pendingQty > 0 && (
            <p className="text-muted-foreground tabular-nums text-[10px]">
              {formatNumber(totalReceived)} recibidas · {formatNumber(pendingQty)} pendientes
            </p>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => {
      const s = row.getValue<string>('status')
      const config = PO_STATUS_MAP[s] ?? { label: s, className: 'bg-zinc-100 text-zinc-600' }
      return (
        <Badge variant="outline" className={cn('text-xs font-medium', config.className)}>
          {config.label}
        </Badge>
      )
    },
  },
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      if (!row.original.canCreateReception) return null
      return (
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onCreateReception(row.original)
          }}
        >
          <PackageCheck className="mr-1.5 size-3.5" />
          Crear recepción
        </Button>
      )
    },
  },
]
