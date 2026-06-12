'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, Clock, Package } from 'lucide-react'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatNumber, formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { AbcClass } from '@/types/wms'

export interface InventoryRow {
  id: string
  productId: string
  productName: string
  productSku: string
  productCategory: string
  productImageUrl?: string
  locationId: string
  locationCode: string
  lot: string | null
  serial: string | null
  expirationDate: string | null
  abcClass: AbcClass
  onHandQuantity: number
  reservedQuantity: number
  holdQuantity: number
  available: number
  status: string
}

// ── ABC styles ────────────────────────────────────────────────────────────────
const ABC_STYLES: Record<
  AbcClass,
  { dot: string; pill: string; label: string; description: string }
> = {
  A: {
    dot: 'bg-emerald-500',
    pill: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    label: 'Clase A',
    description: 'Alta rotación — top 80% de ventas',
  },
  B: {
    dot: 'bg-amber-400',
    pill: 'border-amber-200 bg-amber-50 text-amber-700',
    label: 'Clase B',
    description: 'Rotación media — 80–95% de ventas',
  },
  C: {
    dot: 'bg-zinc-300',
    pill: 'border-zinc-200 bg-zinc-50 text-zinc-500',
    label: 'Clase C',
    description: 'Baja rotación — cola del 95%',
  },
}

// ── Expiry helpers ────────────────────────────────────────────────────────────
export const daysUntilExpiry = (date: string): number => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(date)
  exp.setHours(0, 0, 0, 0)
  return Math.round((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

const EXPIRY_WINDOW = 90 // days used for progress bar max reference

// ── Sub-components ────────────────────────────────────────────────────────────

const ProductCell = ({
  name,
  sku,
  imageUrl,
}: {
  name: string
  sku: string
  category: string
  imageUrl?: string
}) => (
  <div className="flex items-center gap-3">
    <div className="size-10 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
      {imageUrl ? (
        <Image src={imageUrl} alt={name} width={40} height={40} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center">
          <Package className="size-5 text-zinc-400" />
        </div>
      )}
    </div>
    <div className="min-w-0">
      <p className="truncate text-sm font-medium leading-tight">{name}</p>
      <p className="font-mono text-[11px] leading-tight text-muted-foreground">{sku}</p>
    </div>
  </div>
)

const AbcCell = ({ cls }: { cls: AbcClass }) => {
  const s = ABC_STYLES[cls]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'inline-flex cursor-default items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold',
            s.pill
          )}
        >
          <span className={cn('size-1.5 rounded-full', s.dot)} />
          {cls}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="font-medium">{s.label}</p>
        <p className="text-background/70">{s.description}</p>
      </TooltipContent>
    </Tooltip>
  )
}

const ExpiryCell = ({ date }: { date: string | null }) => {
  if (!date) {
    return <span className="text-muted-foreground text-xs">—</span>
  }

  const days = daysUntilExpiry(date)
  const isExpired = days < 0
  const isCritical = days >= 0 && days <= 14
  const isWarning = days > 14 && days <= 30
  const isOk = days > 30

  // Progress bar: how much "safe time" remains (capped at EXPIRY_WINDOW days)
  const progressPct = isExpired ? 0 : Math.min(100, Math.round((days / EXPIRY_WINDOW) * 100))
  const progressVariant = isExpired
    ? 'destructive'
    : isCritical
      ? 'destructive'
      : isWarning
        ? 'warning'
        : 'success'

  const daysLabel = isExpired
    ? `Venció hace ${Math.abs(days)}d`
    : days === 0
      ? 'Vence hoy'
      : `${days}d restantes`

  return (
    <div className="flex min-w-30 flex-col gap-1">
      {/* Date + icon row */}
      <div className="flex items-center gap-1.5">
        {isExpired && <AlertTriangle className="text-destructive size-3 shrink-0" />}
        {isCritical && <AlertTriangle className="size-3 shrink-0 text-amber-500" />}
        {isWarning && <Clock className="size-3 shrink-0 text-yellow-500" />}
        <span
          className={cn(
            'text-xs font-medium tabular-nums',
            isExpired && 'text-destructive',
            isCritical && 'text-amber-600',
            isWarning && 'text-yellow-600',
            isOk && 'text-muted-foreground'
          )}
        >
          {formatDate(date)}
        </span>
      </div>
      {/* Progress bar */}
      <Progress value={progressPct} variant={progressVariant} className="h-1" />
      {/* Days label */}
      <span
        className={cn(
          'text-[10px] leading-tight tabular-nums',
          isExpired && 'text-destructive font-semibold',
          isCritical && 'font-semibold text-amber-600',
          isWarning && 'text-yellow-600',
          isOk && 'text-muted-foreground'
        )}
      >
        {daysLabel}
      </span>
    </div>
  )
}

interface StockCellProps {
  onHand: number
  reserved: number
  hold: number
  available: number
}

const StockCell = ({ onHand, reserved, hold, available }: StockCellProps) => {
  if (onHand === 0) return <span className="text-muted-foreground text-xs">—</span>

  const reservedPct = Math.round((reserved / onHand) * 100)
  const holdPct = Math.round((hold / onHand) * 100)
  const availablePct = Math.max(0, 100 - reservedPct - holdPct)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex min-w-35 cursor-default flex-col gap-1.5">
          {/* Stacked bar */}
          <div className="flex h-1.5 w-full flex-wrap overflow-hidden rounded-full bg-zinc-100">
            {availablePct > 0 && (
              <div
                className="bg-emerald-400 transition-all"
                style={{ width: `${availablePct}%` }}
              />
            )}
            {reservedPct > 0 && (
              <div className="bg-blue-400 transition-all" style={{ width: `${reservedPct}%` }} />
            )}
            {holdPct > 0 && (
              <div className="bg-amber-400 transition-all" style={{ width: `${holdPct}%` }} />
            )}
          </div>
          {/* Numbers row */}
          <div className="flex items-center gap-2 text-[11px] tabular-nums">
            <span className="font-semibold text-emerald-700">{formatNumber(available)}</span>
            <span className="text-muted-foreground">disp.</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-zinc-500">{formatNumber(onHand)}</span>
            <span className="text-muted-foreground">total</span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className="flex-col justify-start space-y-1 p-3">
        <div className="flex justify-normal gap-2 text-xs">
          <span className="size-2 rounded-full bg-emerald-400" />
          <span>Disponible</span>
          <span className="ml-auto font-mono font-medium">{formatNumber(available)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="size-2 rounded-full bg-blue-400" />
          <span>Reservado</span>
          <span className="ml-auto font-mono font-medium">{formatNumber(reserved)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="size-2 rounded-full bg-amber-400" />
          <span>Hold</span>
          <span className="ml-auto font-mono font-medium">{formatNumber(hold)}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2 border-t pt-1.5 text-xs">
          <span className="size-2 rounded-full bg-zinc-300" />
          <span className="font-medium">Total en mano</span>
          <span className="ml-auto font-mono font-semibold">{formatNumber(onHand)}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

// ── Column definitions ────────────────────────────────────────────────────────
type ActionType = 'hold' | 'release' | 'adjust' | 'relocate'
type ActionHandler = (type: ActionType, row: InventoryRow) => void

export const buildInventoryColumns = (onAction: ActionHandler): ColumnDef<InventoryRow>[] => [
  {
    accessorKey: 'productName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
    cell: ({ row }) => (
      <ProductCell
        name={row.original.productName}
        sku={row.original.productSku}
        category={row.original.productCategory}
        imageUrl={row.original.productImageUrl}
      />
    ),
  },
  {
    accessorKey: 'locationCode',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Ubicación" />,
    cell: ({ row }) => (
      <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
        {row.getValue('locationCode')}
      </span>
    ),
  },
  {
    accessorKey: 'abcClass',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Clase" />,
    cell: ({ row }) => <AbcCell cls={row.getValue<AbcClass>('abcClass')} />,
  },
  {
    id: 'lotSerial',
    accessorFn: (row) => row.lot ?? row.serial ?? '',
    header: 'Lote / Serial',
    cell: ({ row }) => {
      const { lot, serial } = row.original
      if (!lot && !serial) return <span className="text-muted-foreground text-xs">—</span>
      return (
        <Badge variant="outline" className="font-mono text-[11px]">
          {lot ? `L: ${lot}` : `S: ${serial}`}
        </Badge>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'expirationDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Vencimiento" />,
    cell: ({ row }) => <ExpiryCell date={row.getValue('expirationDate')} />,
    sortingFn: (a, b) => {
      const da = a.original.expirationDate
      const db = b.original.expirationDate
      if (!da && !db) return 0
      if (!da) return 1
      if (!db) return -1
      return da < db ? -1 : da > db ? 1 : 0
    },
  },
  {
    id: 'stock',
    accessorKey: 'onHandQuantity',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Stock" />,
    cell: ({ row }) => (
      <StockCell
        onHand={row.original.onHandQuantity}
        reserved={row.original.reservedQuantity}
        hold={row.original.holdQuantity}
        available={row.original.available}
      />
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
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              onAction('relocate', item)
            }}
          >
            Reubicar
          </Button>
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
