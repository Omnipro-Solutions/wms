'use client'

import { type ColumnDef } from '@tanstack/react-table'
import Image from 'next/image'
import { Package, PlayCircle, ScanLine, XCircle } from 'lucide-react'

import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { DataTableColumnHeader } from '@/components/data-table'
import type { CyclicCountMethod, CyclicCountStatus, InventoryAdjustmentRequest } from '@/types/wms'

export const METHOD_LABELS: Record<CyclicCountMethod, string> = {
  by_zone: 'Zona',
  by_category: 'Categoría',
  by_abc: 'Clase ABC',
  by_rotation: 'Rotación',
}

export interface PlanRow {
  id: string
  code: string
  name: string
  method: CyclicCountMethod
  filterValue: string
  warehouseName: string
  countedItems: number
  totalItems: number
  scheduledDate: string
  status: CyclicCountStatus
  blindCount: boolean
  auto: boolean
}

export const buildPlanColumns = (
  onStart: (id: string) => void,
  onExecute: (id: string) => void,
  onCancel: (id: string) => void
): ColumnDef<PlanRow>[] => [
  {
    accessorKey: 'code',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
    cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.code}</span>,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
    cell: ({ row }) => (
      <div>
        <p className="text-sm font-medium leading-tight">{row.original.name}</p>
        {row.original.auto && (
          <Badge variant="outline" className="mt-0.5 text-[10px] border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
            Sugerido por ABC
          </Badge>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'method',
    header: 'Método',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {METHOD_LABELS[row.original.method]} · {row.original.filterValue}
      </span>
    ),
  },
  {
    accessorKey: 'warehouseName',
    header: 'Almacén',
    cell: ({ row }) => <span className="text-sm">{row.original.warehouseName}</span>,
  },
  {
    id: 'progress',
    header: 'Progreso',
    cell: ({ row }) => {
      const { countedItems, totalItems } = row.original
      const pct = totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0
      return (
        <div className="w-32 space-y-1">
          <div className="flex justify-between text-xs tabular-nums">
            <span>{countedItems}/{totalItems}</span>
            <span className="text-muted-foreground">{pct}%</span>
          </div>
          <Progress value={pct} variant={pct === 100 ? 'success' : 'default'} />
        </div>
      )
    },
  },
  {
    accessorKey: 'scheduledDate',
    header: 'Programado',
    cell: ({ row }) => <span className="text-sm">{row.original.scheduledDate}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Estado',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      const plan = row.original
      return (
        <div className="flex justify-end gap-1">
          {plan.status === 'pending' && (
            <Button variant="ghost" size="sm" onClick={() => onStart(plan.id)}>
              <PlayCircle className="mr-1.5 size-3.5" /> Iniciar
            </Button>
          )}
          {plan.status === 'in_progress' && (
            <Button variant="ghost" size="sm" className="text-blue-600" onClick={() => onExecute(plan.id)}>
              <ScanLine className="mr-1.5 size-3.5" /> Contar
            </Button>
          )}
          {(plan.status === 'pending' || plan.status === 'in_progress') && (
            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => onCancel(plan.id)}>
              <XCircle className="mr-1.5 size-3.5" /> Cancelar
            </Button>
          )}
        </div>
      )
    },
  },
]

export interface DiscrepancyRow {
  lineId: string
  planCode: string
  productName: string
  productSku: string
  productImageUrl: string | null
  locationCode: string
  expectedQuantity: number
  countedQuantity: number
  variance: number
  variancePct: number
  outOfTolerance: boolean
  adjustmentStatus: InventoryAdjustmentRequest['status'] | null
}

const ADJUSTMENT_STATUS_META: Record<InventoryAdjustmentRequest['status'], { label: string; className: string }> = {
  pending_approval: {
    label: 'Pendiente aprobación',
    className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300',
  },
  approved: {
    label: 'Aprobado',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  rejected: {
    label: 'Rechazado',
    className: 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-zinc-300',
  },
}

const DiscrepancyProductCell = ({ name, sku, imageUrl }: { name: string; sku: string; imageUrl: string | null }) => (
  <div className="flex items-center gap-3">
    <div className="size-8 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
      {imageUrl ? (
        <Image src={imageUrl} alt={name} width={32} height={32} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center">
          <Package className="size-4 text-zinc-400" />
        </div>
      )}
    </div>
    <div className="min-w-0">
      <p className="truncate text-sm font-medium leading-tight">{name}</p>
      <p className="font-mono text-[11px] leading-tight text-muted-foreground">{sku}</p>
    </div>
  </div>
)

export const buildDiscrepancyColumns = (): ColumnDef<DiscrepancyRow>[] => [
  {
    accessorKey: 'productName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
    cell: ({ row }) => (
      <DiscrepancyProductCell
        name={row.original.productName}
        sku={row.original.productSku}
        imageUrl={row.original.productImageUrl}
      />
    ),
  },
  {
    accessorKey: 'locationCode',
    header: 'Ubicación',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.locationCode}</span>,
  },
  {
    accessorKey: 'planCode',
    header: 'Plan',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.planCode}</span>,
  },
  {
    accessorKey: 'expectedQuantity',
    header: () => <div className="text-right">Esperado</div>,
    cell: ({ row }) => <div className="text-right tabular-nums">{row.original.expectedQuantity}</div>,
  },
  {
    accessorKey: 'countedQuantity',
    header: () => <div className="text-right">Contado</div>,
    cell: ({ row }) => <div className="text-right tabular-nums">{row.original.countedQuantity}</div>,
  },
  {
    accessorKey: 'variance',
    header: () => <div className="text-right">Variación</div>,
    cell: ({ row }) => {
      const { variance, variancePct, outOfTolerance } = row.original
      return (
        <div className="text-right">
          <span
            className={cn(
              'font-semibold tabular-nums',
              variance > 0 ? 'text-emerald-600' : 'text-red-600'
            )}
          >
            {variance > 0 ? '+' : ''}
            {variance}
          </span>
          <span
            className={cn(
              'ml-1.5 text-xs',
              outOfTolerance ? 'text-red-600 font-medium' : 'text-muted-foreground'
            )}
          >
            ({variancePct.toFixed(1)}%)
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: 'adjustmentStatus',
    header: 'Ajuste',
    cell: ({ row }) => {
      const status = row.original.adjustmentStatus
      if (!status) return <span className="text-muted-foreground text-xs">Sin generar</span>
      const meta = ADJUSTMENT_STATUS_META[status]
      return (
        <Badge variant="outline" className={cn('text-xs', meta.className)}>
          {meta.label}
        </Badge>
      )
    },
  },
]
