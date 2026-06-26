'use client'

import {
  ArrowLeftRight,
  ArrowRightLeft,
  BoxesIcon,
  CalendarClock,
  Hash,
  MapPin,
  MoveRight,
  Package,
  ShieldAlert,
  Tag,
  Undo2,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatDate, formatDateTime, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { StockMovement } from '@/types/wms'
import { daysUntilExpiry } from '../columns'
import type { InventoryRow } from '../columns'

interface InventoryDetailSheetProps {
  item: InventoryRow | null
  movements: StockMovement[]
  onClose: () => void
}

// ── Movement type config ──────────────────────────────────────────────────────
const MOVEMENT_CONFIG: Record<
  StockMovement['type'],
  { icon: LucideIcon; label: string; color: string; bg: string }
> = {
  receipt: {
    icon: Package,
    label: 'Recepción',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
  },
  putaway: {
    icon: MapPin,
    label: 'Ubicación',
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
  },
  pick: {
    icon: MoveRight,
    label: 'Picking',
    color: 'text-violet-600',
    bg: 'bg-violet-50 border-violet-200',
  },
  transfer: {
    icon: ArrowLeftRight,
    label: 'Traslado',
    color: 'text-sky-600',
    bg: 'bg-sky-50 border-sky-200',
  },
  adjustment: {
    icon: Wrench,
    label: 'Ajuste',
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
  },
  hold: {
    icon: ShieldAlert,
    label: 'Hold',
    color: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-200',
  },
  release: {
    icon: ArrowRightLeft,
    label: 'Liberación',
    color: 'text-teal-600',
    bg: 'bg-teal-50 border-teal-200',
  },
  return: {
    icon: Undo2,
    label: 'Devolución',
    color: 'text-rose-600',
    bg: 'bg-rose-50 border-rose-200',
  },
  scrap: {
    icon: Tag,
    label: 'Baja',
    color: 'text-zinc-500',
    bg: 'bg-zinc-50 border-zinc-200',
  },
}

// ── Detail row ─────────────────────────────────────────────────────────────
const DetailRow = ({
  icon: Icon,
  label,
  value,
  mono,
  className,
}: {
  icon: LucideIcon
  label: string
  value: string | null | undefined
  mono?: boolean
  className?: string
}) => {
  if (!value) return null
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-100">
        <Icon className="text-muted-foreground size-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</p>
        <p className={cn('text-sm font-medium', mono && 'font-mono', className)}>{value}</p>
      </div>
    </div>
  )
}

// ── Movement timeline item ────────────────────────────────────────────────
const MovementItem = ({ mv }: { mv: StockMovement }) => {
  const cfg = MOVEMENT_CONFIG[mv.type]
  const Icon = cfg.icon

  return (
    <div className="flex gap-3">
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full border',
            cfg.bg
          )}
        >
          <Icon className={cn('size-3.5', cfg.color)} />
        </div>
        <div className="bg-border mt-1 w-px flex-1" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-4">
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
          <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
            {formatDateTime(mv.createdAt)}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-medium tabular-nums">
            {mv.type === 'pick' || mv.type === 'transfer' || mv.type === 'scrap' ? '−' : '+'}
            {formatNumber(mv.quantity)} uds.
          </span>
          {mv.lot && (
            <Badge variant="outline" className="font-mono text-[10px]">
              L: {mv.lot}
            </Badge>
          )}
          {mv.serial && (
            <Badge variant="outline" className="font-mono text-[10px]">
              S: {mv.serial}
            </Badge>
          )}
        </div>

        {(mv.fromLocationId || mv.toLocationId) && (
          <p className="text-muted-foreground mt-0.5 text-[11px]">
            {mv.fromLocationId && <span className="font-mono">{mv.fromLocationId}</span>}
            {mv.fromLocationId && mv.toLocationId && <span className="mx-1">→</span>}
            {mv.toLocationId && <span className="font-mono">{mv.toLocationId}</span>}
          </p>
        )}

        <p className="text-muted-foreground mt-0.5 text-[11px]">
          {mv.operatorName} · ref: {mv.referenceType}/{mv.referenceId}
        </p>
      </div>
    </div>
  )
}

// ── Sheet ─────────────────────────────────────────────────────────────────
export const InventoryDetailSheet = ({ item, movements, onClose }: InventoryDetailSheetProps) => {
  if (!item) return null

  const itemMovements = movements
    .filter((mv) => mv.productId === item.productId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const expiryDays = item.expirationDate ? daysUntilExpiry(item.expirationDate) : null
  const expiryLabel =
    expiryDays === null
      ? null
      : expiryDays < 0
        ? `Venció hace ${Math.abs(expiryDays)} días`
        : expiryDays === 0
          ? 'Vence hoy'
          : `${expiryDays} días restantes`

  const expiryColor =
    expiryDays === null
      ? ''
      : expiryDays < 0
        ? 'text-destructive'
        : expiryDays <= 14
          ? 'text-amber-600'
          : expiryDays <= 30
            ? 'text-yellow-600'
            : 'text-emerald-600'

  return (
    <Sheet
      open={!!item}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        {/* ── Header ── */}
        <SheetHeader className="border-b px-5 py-4">
          <div className="flex items-center gap-3 pr-6">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-zinc-50">
              <BoxesIcon className="text-muted-foreground size-5" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate">{item.productName}</SheetTitle>
              <SheetDescription className="font-mono text-xs">{item.productSku}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-5 px-5 py-4">
            {/* ── Status + Estado ── */}
            <div className="flex items-center gap-2">
              <StatusBadge status={item.status} />
              <Badge variant="outline" className="text-xs">
                {item.productCategory}
              </Badge>
            </div>

            {/* ── Trazabilidad ── */}
            <div className="space-y-3">
              <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Trazabilidad
              </p>
              <div className="space-y-2.5">
                <DetailRow icon={MapPin} label="Ubicación" value={item.locationCode} mono />
                <DetailRow icon={Hash} label="Lote" value={item.lot} mono />
                <DetailRow icon={Tag} label="Serial" value={item.serial} mono />
                {item.expirationDate && (
                  <DetailRow
                    icon={CalendarClock}
                    label="Vencimiento"
                    value={`${formatDate(item.expirationDate)}${expiryLabel ? ` · ${expiryLabel}` : ''}`}
                    className={expiryColor}
                  />
                )}
              </div>
            </div>

            <Separator />

            {/* ── Stock breakdown ── */}
            <div className="space-y-3">
              <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Distribución de stock
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    label: 'En mano',
                    value: item.onHandQuantity,
                    color: 'text-foreground',
                  },
                  { label: 'Disponible', value: item.available, color: 'text-emerald-600' },
                  { label: 'Reservado', value: item.reservedQuantity, color: 'text-blue-600' },
                  { label: 'Hold', value: item.holdQuantity, color: 'text-amber-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg border px-3 py-2">
                    <p className="text-muted-foreground text-[11px]">{label}</p>
                    <p className={cn('text-lg font-bold tabular-nums', color)}>
                      {formatNumber(value)}
                    </p>
                  </div>
                ))}
              </div>
              {/* Stacked bar */}
              {item.onHandQuantity > 0 && (
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                  {item.available > 0 && (
                    <div
                      className="bg-emerald-400"
                      style={{ width: `${(item.available / item.onHandQuantity) * 100}%` }}
                    />
                  )}
                  {item.reservedQuantity > 0 && (
                    <div
                      className="bg-blue-400"
                      style={{ width: `${(item.reservedQuantity / item.onHandQuantity) * 100}%` }}
                    />
                  )}
                  {item.holdQuantity > 0 && (
                    <div
                      className="bg-amber-400"
                      style={{ width: `${(item.holdQuantity / item.onHandQuantity) * 100}%` }}
                    />
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* ── Movement history ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Historial de movimientos
                </p>
                <Badge variant="outline" className="text-xs">
                  {itemMovements.length} registros
                </Badge>
              </div>

              {itemMovements.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  Sin movimientos registrados.
                </p>
              ) : (
                <div className="mt-2">
                  {itemMovements.map((mv) => (
                    <MovementItem key={mv.id} mv={mv} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
