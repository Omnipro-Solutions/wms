import { type ColumnDef } from '@tanstack/react-table'
import { MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { PickingTask } from '@/types/wms'

export const PRIORITY_COLORS: Record<string, string> = {
  high: 'border-red-200 bg-red-100 text-red-700',
  medium: 'border-amber-200 bg-amber-100 text-amber-700',
  low: 'border-slate-200 bg-slate-100 text-slate-600',
}

export const PRIORITY_LABELS: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
}

export const ZONE_COLORS: Record<string, string> = {
  A: 'border-green-200 bg-green-100 text-green-800',
  B: 'border-blue-200 bg-blue-100 text-blue-800',
  R: 'border-slate-200 bg-slate-100 text-slate-700',
  S: 'border-orange-200 bg-orange-100 text-orange-800',
  QC: 'border-purple-200 bg-purple-100 text-purple-800',
}

export const CHANNEL_LABELS: Record<string, string> = {
  ecommerce: 'E-commerce',
  marketplace: 'Marketplace',
  pos: 'POS',
  b2b: 'B2B',
  app: 'App',
}

export const FULFILLMENT_LABELS: Record<string, string> = {
  ship_from_dc: 'Envío DC',
  ship_from_store: 'Envío tienda',
  pickup_in_store: 'Recogida tienda',
  put_to_store: 'Put-to-store',
  cross_docking: 'Cross-docking',
}

export const priorityCol = <T extends { priority: string }>(): ColumnDef<T> => ({
  accessorKey: 'priority',
  header: ({ column }) => <DataTableColumnHeader column={column} title="Prioridad" />,
  cell: ({ row }) => {
    const p = (row.original as { priority: string }).priority
    return (
      <Badge variant="outline" className={cn('text-xs', PRIORITY_COLORS[p])}>
        {PRIORITY_LABELS[p] ?? p}
      </Badge>
    )
  },
})

export const progressCell = (picked: number, requested: number) => {
  const pct = requested > 0 ? Math.round((picked / requested) * 100) : 0
  const missing = requested - picked
  return (
    <div className="min-w-32 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs tabular-nums">
          <span className="font-semibold">{formatNumber(picked)}</span>
          <span className="text-muted-foreground"> / {formatNumber(requested)}</span>
        </span>
        <span className="text-xs font-bold text-blue-600">{pct}%</span>
      </div>
      <Progress value={pct} className="h-1.5 *:data-[slot=progress-indicator]:bg-blue-500" />
      {missing > 0 && (
        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
          -{formatNumber(missing)} falta
        </span>
      )}
    </div>
  )
}

export const statusCol = <T extends { status: string }>(): ColumnDef<T> => ({
  accessorKey: 'status',
  header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
  cell: ({ row }) => <StatusBadge status={(row.original as { status: string }).status} />,
})

export const operatorCol = <T extends { operatorName?: string | null }>(): ColumnDef<T> => ({
  accessorKey: 'operatorName',
  header: ({ column }) => <DataTableColumnHeader column={column} title="Operador" />,
  cell: ({ row }) => (
    <span className="text-muted-foreground text-xs">
      {(row.original as { operatorName?: string | null }).operatorName ?? '—'}
    </span>
  ),
})

export const locationCol = (getCode: (id: string) => string) =>
  ({
    accessorKey: 'locationId',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Ubicación" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <MapPin className="text-muted-foreground size-3 shrink-0" />
        <span className="font-mono text-xs">
          {getCode((row.original as PickingTask).locationId)}
        </span>
      </div>
    ),
  }) as ColumnDef<PickingTask>
