'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { ArrowRight, CheckCircle2, MapPin, Store, Truck, Zap } from 'lucide-react'
import Image from 'next/image'

import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/formatters'
import { statusLabel } from '@/lib/status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { DataTableColumnHeader } from '@/components/data-table'
import type { AbcClass } from '@/types/wms'

// ─── shared helpers ─────────────────────────────────────────────────────────

export const abcBadge = (cls: AbcClass) =>
  ({
    A: 'bg-green-600 text-white hover:bg-green-600 dark:bg-emerald-500',
    B: 'bg-blue-500 text-white hover:bg-blue-500 dark:bg-blue-400',
    C: 'bg-zinc-200 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-500 dark:text-white',
  })[cls]

export const priorityPill: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50',
  medium:
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50',
  low: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-300 dark:border-zinc-700/50',
}
export const priorityLabel: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja' }

const ProductCell = ({
  name,
  imageUrl,
  abcClass,
}: {
  name: string
  imageUrl: string | null
  abcClass: AbcClass
}) => (
  <div className="flex items-center gap-3">
    {imageUrl ? (
      <Image
        src={imageUrl}
        alt={name}
        width={32}
        height={32}
        className="size-8 shrink-0 rounded-md object-cover"
      />
    ) : (
      <div className="bg-muted size-8 shrink-0 rounded-md" />
    )}
    <div>
      <p className="font-medium leading-tight">{name}</p>
      <Badge className={cn('mt-0.5 text-[10px]', abcBadge(abcClass))}>{abcClass}</Badge>
    </div>
  </div>
)

const CoverageCell = ({ current, min }: { current: number; min: number }) => {
  const pct = min > 0 ? Math.min(100, Math.round((current / min) * 100)) : 100
  return (
    <div className="flex items-center gap-2">
      <Progress
        value={pct}
        className={cn(
          'h-2 w-20',
          pct < 50 ? '[&>div]:bg-red-500' : pct < 80 ? '[&>div]:bg-amber-400' : '[&>div]:bg-green-500'
        )}
      />
      <span
        className={cn(
          'w-9 text-xs font-semibold tabular-nums',
          pct < 50
            ? 'text-red-600 dark:text-red-300'
            : pct < 80
              ? 'text-amber-600 dark:text-amber-300'
              : 'text-green-700 dark:text-emerald-300'
        )}
      >
        {pct}%
      </span>
    </div>
  )
}

const PriorityCell = ({ priority }: { priority: string }) => (
  <span
    className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', priorityPill[priority])}
  >
    {priorityLabel[priority] ?? priority}
  </span>
)

const StockCell = ({ current, min }: { current: number; min: number }) => {
  const critical = min > 0 && current < min * 0.5
  return (
    <div className="flex items-baseline gap-1">
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          critical ? 'text-red-600' : 'text-foreground'
        )}
      >
        {formatNumber(current)}
      </span>
      <span className="text-muted-foreground text-xs">/ {formatNumber(min)} mín</span>
    </div>
  )
}

const SuggestedCell = ({ qty }: { qty: number }) => (
  <div className="text-right">
    <span className="text-sm font-bold tabular-nums">{formatNumber(qty)}</span>
    <p className="text-muted-foreground text-[10px]">uds.</p>
  </div>
)

const StatusCell = ({ status, operatorName }: { status: string; operatorName: string | null }) => (
  <div className="flex flex-col">
    <span
      className={cn(
        'text-xs font-medium',
        status === 'completed'
          ? 'text-green-700 dark:text-emerald-300'
          : status === 'assigned' || status === 'in_transit'
            ? 'text-blue-600 dark:text-blue-300'
            : status === 'cancelled'
              ? 'text-zinc-400 dark:text-zinc-500'
              : 'text-amber-600 dark:text-amber-300'
      )}
    >
      {statusLabel(status)}
    </span>
    {operatorName && (
      <p className="text-muted-foreground/70 max-w-28 truncate text-[10px]">{operatorName}</p>
    )}
  </div>
)

// ─── row types ────────────────────────────────────────────────────────────────

export interface NeedRow {
  key: string
  productId: string
  productName: string
  productImageUrl: string | null
  abcClass: AbcClass
  originCode: string
  destinationCode: string
  currentStock: number
  minStock: number
  maxStock: number
  suggestedQuantity: number
  priority: 'high' | 'medium' | 'low'
}

export interface TaskRow {
  id: string
  productName: string
  productImageUrl: string | null
  abcClass: AbcClass
  originCode: string
  destinationCode: string
  currentStock: number
  minStock: number
  suggestedQuantity: number
  priority: string
  status: string
  operatorName: string | null
  auto: boolean
  isCritical: boolean
}

export interface StoreNeedRow {
  key: string
  storeName: string
  sourceName: string
  productId: string
  productName: string
  productImageUrl: string | null
  abcClass: AbcClass
  currentStock: number
  minStock: number
  maxStock: number
  suggestedQuantity: number
  priority: 'high' | 'medium' | 'low'
}

export interface StoreTaskRow {
  id: string
  storeName: string
  sourceName: string
  productName: string
  productImageUrl: string | null
  currentStock: number
  minStock: number
  suggestedQuantity: number
  priority: string
  status: string
  operatorName: string | null
  auto: boolean
}

// ─── Necesidades (pick faces bajo mínimo) ──────────────────────────────────────

export const buildNeedColumns = (): ColumnDef<NeedRow>[] => [
  {
    accessorKey: 'productName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
    cell: ({ row }) => (
      <ProductCell
        name={row.original.productName}
        imageUrl={row.original.productImageUrl}
        abcClass={row.original.abcClass}
      />
    ),
  },
  {
    id: 'route',
    header: 'Ruta',
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-xs">
          {row.original.originCode}
        </span>
        <ArrowRight className="text-muted-foreground size-3 shrink-0" />
        <span className="rounded-md border border-green-300 bg-green-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-green-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          {row.original.destinationCode}
        </span>
        <MapPin className="size-3 shrink-0 text-green-600" />
      </div>
    ),
  },
  {
    accessorKey: 'currentStock',
    header: 'Stock actual',
    cell: ({ row }) => <StockCell current={row.original.currentStock} min={row.original.minStock} />,
  },
  {
    accessorKey: 'suggestedQuantity',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="A reponer" className="justify-end" />
    ),
    cell: ({ row }) => <SuggestedCell qty={row.original.suggestedQuantity} />,
  },
  {
    id: 'coverage',
    header: 'Cobertura',
    enableSorting: false,
    cell: ({ row }) => <CoverageCell current={row.original.currentStock} min={row.original.minStock} />,
  },
  {
    accessorKey: 'priority',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Prioridad" />,
    cell: ({ row }) => <PriorityCell priority={row.original.priority} />,
  },
]

// ─── Tareas (reserva → pick face) ──────────────────────────────────────────────

export const buildTaskColumns = (
  onStart: (id: string) => void,
  onComplete: (id: string) => void
): ColumnDef<TaskRow>[] => [
  {
    accessorKey: 'productName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <ProductCell
          name={row.original.productName}
          imageUrl={row.original.productImageUrl}
          abcClass={row.original.abcClass}
        />
        {row.original.auto && (
          <Badge
            variant="outline"
            className="border-violet-200 bg-violet-50 text-[10px] text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300"
          >
            <Zap className="mr-0.5 size-2.5" /> Auto
          </Badge>
        )}
      </div>
    ),
  },
  {
    id: 'route',
    header: 'Ruta',
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-xs">
          {row.original.originCode}
        </span>
        <ArrowRight className="text-muted-foreground size-3 shrink-0" />
        <span className="rounded-md border border-green-300 bg-green-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-green-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          {row.original.destinationCode}
        </span>
      </div>
    ),
  },
  {
    accessorKey: 'currentStock',
    header: 'Stock actual',
    cell: ({ row }) => <StockCell current={row.original.currentStock} min={row.original.minStock} />,
  },
  {
    accessorKey: 'suggestedQuantity',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="A reponer" className="justify-end" />
    ),
    cell: ({ row }) => <SuggestedCell qty={row.original.suggestedQuantity} />,
  },
  {
    accessorKey: 'priority',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Prioridad" />,
    cell: ({ row }) => <PriorityCell priority={row.original.priority} />,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => (
      <StatusCell status={row.original.status} operatorName={row.original.operatorName} />
    ),
  },
  {
    id: 'actions',
    header: '',
    enableSorting: false,
    cell: ({ row }) => {
      const { id, status } = row.original
      if (status === 'completed' || status === 'cancelled')
        return <CheckCircle2 className="size-4 text-green-500" />
      if (status === 'pending')
        return (
          <Button
            size="sm"
            variant="outline"
            className="opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            onClick={() => onStart(id)}
          >
            Iniciar
          </Button>
        )
      if (status === 'assigned')
        return (
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onComplete(id)}>
            <CheckCircle2 className="mr-1 size-3" /> Completar
          </Button>
        )
      return null
    },
  },
]

// ─── Tiendas: necesidades (DC→tienda) ──────────────────────────────────────────

export const buildStoreNeedColumns = (): ColumnDef<StoreNeedRow>[] => [
  {
    accessorKey: 'storeName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tienda" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Store className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium">{row.original.storeName}</span>
      </div>
    ),
  },
  {
    accessorKey: 'productName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
    cell: ({ row }) => (
      <ProductCell
        name={row.original.productName}
        imageUrl={row.original.productImageUrl}
        abcClass={row.original.abcClass}
      />
    ),
  },
  {
    id: 'source',
    header: 'Surte desde',
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5 text-xs">
        <Truck className="size-3.5 shrink-0 text-blue-500" />
        <span className="text-muted-foreground">{row.original.sourceName}</span>
      </div>
    ),
  },
  {
    accessorKey: 'currentStock',
    header: 'Stock en sala',
    cell: ({ row }) => <StockCell current={row.original.currentStock} min={row.original.minStock} />,
  },
  {
    accessorKey: 'suggestedQuantity',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="A surtir" className="justify-end" />
    ),
    cell: ({ row }) => <SuggestedCell qty={row.original.suggestedQuantity} />,
  },
  {
    id: 'coverage',
    header: 'Cobertura',
    enableSorting: false,
    cell: ({ row }) => <CoverageCell current={row.original.currentStock} min={row.original.minStock} />,
  },
  {
    accessorKey: 'priority',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Prioridad" />,
    cell: ({ row }) => <PriorityCell priority={row.original.priority} />,
  },
]

// ─── Tiendas: tareas (DC→tienda) ───────────────────────────────────────────────

export const buildStoreTaskColumns = (
  onStart: (id: string) => void,
  onComplete: (id: string) => void
): ColumnDef<StoreTaskRow>[] => [
  {
    accessorKey: 'storeName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tienda" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Store className="size-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium leading-tight">{row.original.storeName}</p>
          <p className="text-muted-foreground flex items-center gap-1 text-[10px]">
            <Truck className="size-2.5" /> {row.original.sourceName}
          </p>
        </div>
        {row.original.auto && (
          <Badge
            variant="outline"
            className="border-violet-200 bg-violet-50 text-[10px] text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300"
          >
            <Zap className="mr-0.5 size-2.5" /> Auto
          </Badge>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'productName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        {row.original.productImageUrl ? (
          <Image
            src={row.original.productImageUrl}
            alt={row.original.productName}
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="bg-muted size-8 shrink-0 rounded-md" />
        )}
        <span className="text-sm font-medium">{row.original.productName}</span>
      </div>
    ),
  },
  {
    accessorKey: 'suggestedQuantity',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="A surtir" className="justify-end" />
    ),
    cell: ({ row }) => <SuggestedCell qty={row.original.suggestedQuantity} />,
  },
  {
    accessorKey: 'priority',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Prioridad" />,
    cell: ({ row }) => <PriorityCell priority={row.original.priority} />,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => (
      <StatusCell status={row.original.status} operatorName={row.original.operatorName} />
    ),
  },
  {
    id: 'actions',
    header: '',
    enableSorting: false,
    cell: ({ row }) => {
      const { id, status } = row.original
      if (status === 'completed' || status === 'cancelled')
        return <CheckCircle2 className="size-4 text-green-500" />
      if (status === 'pending')
        return (
          <Button
            size="sm"
            variant="outline"
            className="opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            onClick={() => onStart(id)}
          >
            Despachar
          </Button>
        )
      if (status === 'in_transit')
        return (
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onComplete(id)}>
            <CheckCircle2 className="mr-1 size-3" /> Recibir
          </Button>
        )
      return null
    },
  },
]
