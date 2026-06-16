'use client'

import { type ColumnDef } from '@tanstack/react-table'
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  MoveRight,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/formatters'
import { statusLabel } from '@/lib/status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { DataTableColumnHeader } from '@/components/data-table'
import type { AbcClass, XyzClass, SlottingRecommendation } from '@/types/wms'
import type { SimulationSummary } from '@/store/selectors'

// ─── shared badge helpers ─────────────────────────────────────────────────────

export const abcBadge = (cls: AbcClass) =>
  ({
    A: 'bg-green-600 text-white hover:bg-green-600',
    B: 'bg-blue-500 text-white hover:bg-blue-500',
    C: 'bg-zinc-200 text-zinc-700 hover:bg-zinc-200',
  })[cls]

export const xyzBadge = (cls: XyzClass) =>
  ({
    X: 'bg-violet-600 text-white hover:bg-violet-600',
    Y: 'bg-orange-400 text-white hover:bg-orange-400',
    Z: 'bg-zinc-200 text-zinc-600 hover:bg-zinc-200',
  })[cls]

export const scoreTone = (score: number) =>
  score >= 70
    ? 'text-green-700 font-bold'
    : score >= 40
      ? 'text-amber-600 font-semibold'
      : 'text-muted-foreground'

export const COMBO_COLOR: Record<string, string> = {
  AX: 'bg-green-100 text-green-800 border-green-300',
  AY: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  AZ: 'bg-amber-100 text-amber-700 border-amber-200',
  BX: 'bg-blue-100 text-blue-700 border-blue-200',
  CZ: 'bg-red-100 text-red-600 border-red-200',
}

const priorityPill: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-zinc-100 text-zinc-600 border-zinc-200',
}
const priorityLabel: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja' }

// ─── row types ────────────────────────────────────────────────────────────────

export interface OptimizationRow {
  id: string
  productId: string
  productName: string
  productImageUrl: string | null
  recommendationHint: string
  abcClass: AbcClass
  xyzClass: XyzClass
  currentLocationId: string
  currentLocationCode: string
  currentLocationGolden: boolean
  suggestedLocationId: string
  suggestedLocationCode: string
  suggestedLocationGolden: boolean
  suggestedLocationIsPickFace: boolean
  score: number
  estimatedDistanceSavedM: number
  estimatedTimeSavedSeconds: number
  rec: SlottingRecommendation
}

export interface ClassificationRow {
  productId: string
  productName: string
  productSku: string
  productImageUrl: string | null
  abcClass: AbcClass
  xyzClass: XyzClass
  unitsSold: number
  pickingFrequency: number
  cv: number
  locationCode: string | null
  locationGolden: boolean
  locationIsPickFace: boolean
}

export interface ReplenishmentRow {
  id: string
  productId: string
  productName: string
  productImageUrl: string | null
  abcClass: AbcClass
  originLocationCode: string
  destinationLocationCode: string
  currentStock: number
  minStock: number
  suggestedQuantity: number
  priority: string
  status: string
  operatorName: string | null
  isCritical: boolean
}

export interface AffinityRow {
  key: string
  productNameA: string
  locationCodeA: string | null
  productNameB: string
  locationCodeB: string | null
  coOccurrences: number
  liftScore: number
  proximityScore: number
  isAlreadyClose: boolean
}

export interface HistoryRow {
  id: string
  index: number
  label: string
  capturedAt: string
  isLatest: boolean
  misplacedAClassCount: number
  misplacedImproved: boolean
  misplacedWorse: boolean
  relocationsAvailable: number
  totalDistanceSavedM: number
  totalTimeSavedMin: number
  aToGoldenCount: number
  czInGoldenCount: number
  pendingReplenishment: number
  affinityPairsNeedingAction: number
}

export type SimulationRow = SimulationSummary['rows'][number]

// ─── optimization columns ─────────────────────────────────────────────────────

export const buildOptimizationColumns = (
  onRelocate: (rec: SlottingRecommendation) => void
): ColumnDef<OptimizationRow>[] => [
  {
    accessorKey: 'productName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
    cell: ({ row }) => {
      const { productName, productImageUrl, recommendationHint } = row.original
      return (
        <div className="flex items-center gap-3">
          {productImageUrl ? (
            <Image
              src={productImageUrl}
              alt={productName}
              width={36}
              height={36}
              className="size-9 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="bg-muted size-9 shrink-0 rounded-md" />
          )}
          <div>
            <p className="font-medium leading-tight">{productName}</p>
            <p className="text-muted-foreground text-xs font-normal">{recommendationHint}</p>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: 'abcClass',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Clase" />,
    cell: ({ row }) => {
      const { abcClass, xyzClass } = row.original
      return (
        <div className="flex flex-wrap items-center gap-1">
          <Badge className={cn('text-xs', abcBadge(abcClass))}>{abcClass}</Badge>
          <Badge className={cn('text-xs', xyzBadge(xyzClass))}>{xyzClass}</Badge>
        </div>
      )
    },
  },
  {
    accessorKey: 'currentLocationCode',
    header: 'Ubicación actual',
    cell: ({ row }) => {
      const { currentLocationCode, currentLocationGolden } = row.original
      return (
        <span
          className={cn(
            'rounded px-1.5 py-0.5 font-mono text-xs',
            currentLocationGolden
              ? 'bg-amber-100 text-amber-800'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {currentLocationCode}
        </span>
      )
    },
  },
  {
    id: 'arrow',
    header: '',
    enableSorting: false,
    cell: () => <ArrowRight className="text-muted-foreground size-3.5" />,
  },
  {
    accessorKey: 'suggestedLocationCode',
    header: 'Destino sugerido',
    cell: ({ row }) => {
      const { suggestedLocationCode, suggestedLocationGolden, suggestedLocationIsPickFace } =
        row.original
      return (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-md border px-2 py-1 font-mono text-xs font-semibold',
              suggestedLocationGolden
                ? 'border-green-300 bg-green-100 text-green-800'
                : suggestedLocationIsPickFace
                  ? 'border-blue-200 bg-blue-50 text-blue-800'
                  : 'border-zinc-200 bg-muted text-muted-foreground'
            )}
          >
            {suggestedLocationCode}
          </span>
          {suggestedLocationGolden && (
            <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              <MapPin className="size-2.5" /> golden
            </span>
          )}
          {suggestedLocationIsPickFace && !suggestedLocationGolden && (
            <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
              pick face
            </span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'score',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Score" className="justify-end" />
    ),
    cell: ({ row }) => {
      const { score } = row.original
      return (
        <div className="flex items-center justify-end gap-2">
          <div className="w-16">
            <Progress
              value={score}
              className={cn(
                'h-2',
                score >= 70
                  ? '[&>div]:bg-green-500'
                  : score >= 40
                    ? '[&>div]:bg-amber-400'
                    : '[&>div]:bg-zinc-400'
              )}
            />
          </div>
          <span className={cn('w-7 text-right text-sm tabular-nums font-semibold', scoreTone(score))}>
            {score}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: 'estimatedDistanceSavedM',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Dist. ahorro" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="flex flex-col items-end">
        <span className="tabular-nums text-sm font-semibold">
          {formatNumber(row.original.estimatedDistanceSavedM)} m
        </span>
        <span className="text-muted-foreground text-[10px]">menos recorrido</span>
      </div>
    ),
  },
  {
    accessorKey: 'estimatedTimeSavedSeconds',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tiempo" className="justify-end" />
    ),
    cell: ({ row }) => {
      const timeSavedMin = Math.round(row.original.estimatedTimeSavedSeconds / 60)
      return (
        <div className="flex flex-col items-end">
          <span className="tabular-nums text-sm font-semibold">
            {timeSavedMin > 0
              ? `${timeSavedMin} min`
              : `${row.original.estimatedTimeSavedSeconds} s`}
          </span>
          <span className="text-muted-foreground text-[10px]">por ciclo</span>
        </div>
      )
    },
  },
  {
    id: 'actions',
    header: '',
    enableSorting: false,
    cell: ({ row }) => (
      <Button
        size="sm"
        variant="outline"
        className="opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        onClick={() => onRelocate(row.original.rec)}
      >
        <MoveRight className="mr-1 size-3" /> Reubicar
      </Button>
    ),
  },
]

// ─── classification columns ───────────────────────────────────────────────────

export const buildClassificationColumns = (): ColumnDef<ClassificationRow>[] => [
  {
    accessorKey: 'productName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
    cell: ({ row }) => {
      const { productName, productSku, productImageUrl } = row.original
      return (
        <div className="flex items-center gap-3">
          {productImageUrl ? (
            <Image
              src={productImageUrl}
              alt={productName}
              width={36}
              height={36}
              className="size-9 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="bg-muted size-9 shrink-0 rounded-md" />
          )}
          <div>
            <p className="font-medium leading-tight">{productName}</p>
            <p className="text-muted-foreground font-mono text-[11px]">{productSku || '—'}</p>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: 'abcClass',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Clase" />,
    cell: ({ row }) => {
      const { abcClass, xyzClass } = row.original
      return (
        <div className="flex items-center gap-1">
          <Badge className={cn('text-xs', abcBadge(abcClass))}>{abcClass}</Badge>
          <Badge className={cn('text-xs', xyzBadge(xyzClass))}>{xyzClass}</Badge>
        </div>
      )
    },
  },
  {
    id: 'combo',
    header: 'Combinación',
    enableSorting: false,
    cell: ({ row }) => {
      const { abcClass, xyzClass } = row.original
      const combo = `${abcClass}${xyzClass}`
      const comboColor = COMBO_COLOR[combo] ?? 'bg-zinc-100 text-zinc-600 border-zinc-200'
      return (
        <span className={cn('rounded-md border px-2 py-0.5 text-xs font-bold', comboColor)}>
          {combo}
        </span>
      )
    },
  },
  {
    accessorKey: 'unitsSold',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Uds. vendidas" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="flex flex-col items-end">
        <span className="tabular-nums text-sm font-semibold">
          {formatNumber(row.original.unitsSold)}
        </span>
        <span className="text-muted-foreground text-[10px]">uds.</span>
      </div>
    ),
  },
  {
    accessorKey: 'pickingFrequency',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Frec. picking" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="flex flex-col items-end">
        <span className="tabular-nums text-sm font-semibold">
          {formatNumber(row.original.pickingFrequency)}
        </span>
        <span className="text-muted-foreground text-[10px]">picks</span>
      </div>
    ),
  },
  {
    accessorKey: 'cv',
    header: 'Variabilidad',
    cell: ({ row }) => {
      const { cv } = row.original
      const cvPct = Math.min(100, cv * 60)
      const cvTone =
        cv < 0.2 ? 'text-green-700' : cv < 0.5 ? 'text-amber-600' : 'text-red-600'
      const cvBarColor =
        cv < 0.2
          ? '[&>div]:bg-green-500'
          : cv < 0.5
            ? '[&>div]:bg-amber-400'
            : '[&>div]:bg-red-500'
      return (
        <div className="flex items-center gap-2">
          <Progress value={cvPct} className={cn('h-2 w-20', cvBarColor)} />
          <span className={cn('w-8 text-xs tabular-nums font-semibold', cvTone)}>
            {cv.toFixed(2)}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: 'locationCode',
    header: 'Ubicación',
    cell: ({ row }) => {
      const { locationCode, locationGolden, locationIsPickFace } = row.original
      return (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-md border px-2 py-1 font-mono text-xs font-semibold',
              locationGolden
                ? 'border-amber-300 bg-amber-100 text-amber-800'
                : locationIsPickFace
                  ? 'border-blue-200 bg-blue-50 text-blue-800'
                  : 'border-zinc-200 bg-muted text-muted-foreground'
            )}
          >
            {locationCode ?? '—'}
          </span>
          {locationGolden ? (
            <span className="flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
              <CheckCircle2 className="size-2.5" /> golden
            </span>
          ) : (
            <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
              <TriangleAlert className="size-2.5" />
            </span>
          )}
        </div>
      )
    },
  },
]

// ─── replenishment columns ────────────────────────────────────────────────────

export const buildReplenishmentColumns = (
  onStart: (taskId: string) => void,
  onComplete: (taskId: string) => void
): ColumnDef<ReplenishmentRow>[] => [
  {
    accessorKey: 'productName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
    cell: ({ row }) => {
      const { productName, productImageUrl, abcClass } = row.original
      return (
        <div className="flex items-center gap-3">
          {productImageUrl ? (
            <Image
              src={productImageUrl}
              alt={productName}
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="bg-muted size-8 shrink-0 rounded-md" />
          )}
          <div>
            <p className="font-medium leading-tight">{productName}</p>
            <Badge className={cn('mt-0.5 text-[10px]', abcBadge(abcClass))}>{abcClass}</Badge>
          </div>
        </div>
      )
    },
  },
  {
    id: 'route',
    header: 'Ruta',
    enableSorting: false,
    cell: ({ row }) => {
      const { originLocationCode, destinationLocationCode } = row.original
      return (
        <div className="flex items-center gap-1.5">
          <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-xs">
            {originLocationCode}
          </span>
          <ArrowRight className="text-muted-foreground size-3 shrink-0" />
          <span className="rounded-md border border-green-300 bg-green-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-green-800">
            {destinationLocationCode}
          </span>
          <MapPin className="size-3 shrink-0 text-green-600" />
        </div>
      )
    },
  },
  {
    accessorKey: 'currentStock',
    header: 'Stock actual',
    cell: ({ row }) => {
      const { currentStock, minStock, isCritical } = row.original
      return (
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              'tabular-nums text-sm font-semibold',
              isCritical ? 'text-red-600' : 'text-foreground'
            )}
          >
            {formatNumber(currentStock)}
          </span>
          <span className="text-muted-foreground text-xs">/ {formatNumber(minStock)} mín</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'suggestedQuantity',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="A reponer" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right">
        <span className="tabular-nums text-sm font-bold">
          {formatNumber(row.original.suggestedQuantity)}
        </span>
        <p className="text-muted-foreground text-[10px]">uds.</p>
      </div>
    ),
  },
  {
    id: 'coverage',
    header: 'Cobertura',
    enableSorting: false,
    cell: ({ row }) => {
      const { currentStock, minStock } = row.original
      const coveragePct =
        minStock > 0 ? Math.min(100, Math.round((currentStock / minStock) * 100)) : 100
      return (
        <div className="flex items-center gap-2">
          <Progress
            value={coveragePct}
            className={cn(
              'h-2 w-20',
              coveragePct < 30
                ? '[&>div]:bg-red-500'
                : coveragePct < 60
                  ? '[&>div]:bg-amber-400'
                  : '[&>div]:bg-green-500'
            )}
          />
          <span
            className={cn(
              'w-9 text-xs tabular-nums font-semibold',
              coveragePct < 30
                ? 'text-red-600'
                : coveragePct < 60
                  ? 'text-amber-600'
                  : 'text-green-700'
            )}
          >
            {coveragePct}%
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: 'priority',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Prioridad" />,
    cell: ({ row }) => {
      const { priority } = row.original
      return (
        <span
          className={cn(
            'rounded-full border px-2.5 py-0.5 text-xs font-semibold',
            priorityPill[priority]
          )}
        >
          {priorityLabel[priority] ?? priority}
        </span>
      )
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => {
      const { status, operatorName } = row.original
      return (
        <div className="flex flex-col">
          <span
            className={cn(
              'text-xs font-medium',
              status === 'completed'
                ? 'text-green-700'
                : status === 'assigned'
                  ? 'text-blue-600'
                  : status === 'cancelled'
                    ? 'text-zinc-400'
                    : 'text-amber-600'
            )}
          >
            {statusLabel(status)}
          </span>
          {operatorName && (
            <p className="text-muted-foreground/70 max-w-28 truncate text-[10px]">{operatorName}</p>
          )}
        </div>
      )
    },
  },
  {
    id: 'actions',
    header: '',
    enableSorting: false,
    cell: ({ row }) => {
      const { id, status } = row.original
      const isTerminal = status === 'completed' || status === 'cancelled'
      if (isTerminal) return <CheckCircle2 className="size-4 text-green-500" />
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
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => onComplete(id)}
          >
            <CheckCircle2 className="mr-1 size-3" /> Completar
          </Button>
        )
      return null
    },
  },
]

// ─── affinity columns ─────────────────────────────────────────────────────────

export const buildAffinityColumns = (): ColumnDef<AffinityRow>[] => [
  {
    accessorKey: 'productNameA',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Par de productos" />,
    cell: ({ row }) => {
      const { productNameA, locationCodeA, productNameB, locationCodeB } = row.original
      return (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">{productNameA}</p>
            {locationCodeA ? (
              <span className="bg-muted text-muted-foreground rounded px-1 py-0.5 font-mono text-[10px]">
                {locationCodeA}
              </span>
            ) : (
              <span className="text-muted-foreground text-[10px]">—</span>
            )}
          </div>
          <ArrowRight className="text-muted-foreground size-3.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">{productNameB}</p>
            {locationCodeB ? (
              <span className="bg-muted text-muted-foreground rounded px-1 py-0.5 font-mono text-[10px]">
                {locationCodeB}
              </span>
            ) : (
              <span className="text-muted-foreground text-[10px]">—</span>
            )}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: 'coOccurrences',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Co-picks" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="flex flex-col items-end">
        <span className="tabular-nums text-sm font-semibold">{row.original.coOccurrences}</span>
        <span className="text-muted-foreground text-[10px]">órdenes</span>
      </div>
    ),
  },
  {
    accessorKey: 'liftScore',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Lift" className="justify-end" />
    ),
    cell: ({ row }) => {
      const { liftScore } = row.original
      const liftTone =
        liftScore >= 3
          ? 'bg-violet-100 text-violet-800 border-violet-200'
          : liftScore >= 1.5
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-zinc-100 text-zinc-600 border-zinc-200'
      return (
        <div className="flex justify-end">
          <span className={cn('rounded-md border px-2 py-0.5 text-xs font-bold tabular-nums', liftTone)}>
            {liftScore.toFixed(1)}×
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: 'proximityScore',
    header: 'Proximidad',
    cell: ({ row }) => {
      const { proximityScore, isAlreadyClose } = row.original
      return (
        <div className="flex items-center gap-2">
          <Progress
            value={proximityScore}
            className={cn(
              'h-2 w-20',
              isAlreadyClose ? '[&>div]:bg-green-500' : '[&>div]:bg-violet-500'
            )}
          />
          <span
            className={cn(
              'w-7 text-xs tabular-nums font-semibold',
              isAlreadyClose ? 'text-green-700' : 'text-violet-700'
            )}
          >
            {proximityScore}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: 'isAlreadyClose',
    header: 'Estado',
    cell: ({ row }) => {
      const { isAlreadyClose } = row.original
      return isAlreadyClose ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
          <CheckCircle2 className="size-3" /> Próximos
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
          <TriangleAlert className="size-3" /> Acercar
        </span>
      )
    },
  },
]

// ─── history columns ──────────────────────────────────────────────────────────

export const buildHistoryColumns = (): ColumnDef<HistoryRow>[] => [
  {
    accessorKey: 'label',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Captura" />,
    cell: ({ row }) => {
      const { index, label, capturedAt, isLatest } = row.original
      return (
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground mt-0.5 w-5 shrink-0 text-right tabular-nums text-xs">
            #{index}
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold leading-tight">{label}</p>
              {isLatest && (
                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
                  actual
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-[10px]">{capturedAt}</p>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: 'misplacedAClassCount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="SKUs A mal ubic." className="justify-center" />
    ),
    cell: ({ row }) => {
      const { misplacedAClassCount, misplacedImproved, misplacedWorse } = row.original
      return (
        <div className="flex items-center justify-center gap-1">
          {misplacedImproved && <TrendingDown className="size-3 text-green-500" />}
          {misplacedWorse && <TrendingUp className="size-3 text-red-500" />}
          <span
            className={cn(
              'tabular-nums text-sm font-semibold',
              misplacedImproved ? 'text-green-600' : misplacedWorse ? 'text-red-600' : 'text-foreground'
            )}
          >
            {misplacedAClassCount}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: 'relocationsAvailable',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Reubicaciones" className="justify-center" />
    ),
    cell: ({ row }) => (
      <div className="text-center">
        <span className="tabular-nums text-sm">{row.original.relocationsAvailable}</span>
      </div>
    ),
  },
  {
    accessorKey: 'totalDistanceSavedM',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Ahorro distancia" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="flex flex-col items-end">
        <span className="tabular-nums text-sm font-semibold">
          {formatNumber(row.original.totalDistanceSavedM)} m
        </span>
        <span className="text-muted-foreground text-[10px]">recorrido</span>
      </div>
    ),
  },
  {
    accessorKey: 'totalTimeSavedMin',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Ahorro tiempo" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="flex flex-col items-end">
        <span className="tabular-nums text-sm font-semibold">{row.original.totalTimeSavedMin} min</span>
        <span className="text-muted-foreground text-[10px]">por turno</span>
      </div>
    ),
  },
  {
    id: 'goldenZone',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Golden zone" className="justify-center" />
    ),
    enableSorting: false,
    cell: ({ row }) => {
      const { aToGoldenCount, czInGoldenCount } = row.original
      return (
        <div className="flex items-center justify-center gap-2">
          <span className="flex flex-col items-center">
            <span className="tabular-nums text-sm font-semibold text-green-700">{aToGoldenCount}</span>
            <span className="text-muted-foreground text-[10px]">A↑</span>
          </span>
          <span className="text-muted-foreground text-xs">/</span>
          <span className="flex flex-col items-center">
            <span
              className={cn(
                'tabular-nums text-sm font-semibold',
                czInGoldenCount > 0 ? 'text-amber-600' : 'text-muted-foreground'
              )}
            >
              {czInGoldenCount}
            </span>
            <span className="text-muted-foreground text-[10px]">CZ↓</span>
          </span>
        </div>
      )
    },
  },
  {
    id: 'alerts',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Alertas" className="justify-center" />
    ),
    enableSorting: false,
    cell: ({ row }) => {
      const { pendingReplenishment, affinityPairsNeedingAction } = row.original
      return (
        <div className="flex items-center justify-center gap-2">
          <span className="flex flex-col items-center">
            <span
              className={cn(
                'tabular-nums text-sm font-semibold',
                pendingReplenishment > 0 ? 'text-red-600' : 'text-muted-foreground'
              )}
            >
              {pendingReplenishment}
            </span>
            <span className="text-muted-foreground text-[10px]">reabast.</span>
          </span>
          <span className="text-muted-foreground text-xs">/</span>
          <span className="flex flex-col items-center">
            <span
              className={cn(
                'tabular-nums text-sm font-semibold',
                affinityPairsNeedingAction > 0 ? 'text-violet-600' : 'text-muted-foreground'
              )}
            >
              {affinityPairsNeedingAction}
            </span>
            <span className="text-muted-foreground text-[10px]">afinidad</span>
          </span>
        </div>
      )
    },
  },
]

// ─── simulation columns ───────────────────────────────────────────────────────

export const buildSimulationColumns = (): ColumnDef<SimulationRow>[] => [
  {
    accessorKey: 'productName',
    header: 'Producto',
    cell: ({ row }) => (
      <span className="text-sm font-medium">{row.original.productName}</span>
    ),
  },
  {
    id: 'class',
    header: 'Clase',
    enableSorting: false,
    cell: ({ row }) => {
      const { abcClass, xyzClass } = row.original
      return (
        <div className="flex items-center gap-1">
          <Badge className={cn('text-xs', abcBadge(abcClass))}>{abcClass}</Badge>
          <Badge className={cn('text-xs', xyzBadge(xyzClass))}>{xyzClass}</Badge>
        </div>
      )
    },
  },
  {
    accessorKey: 'fromCode',
    header: 'Actual',
    cell: ({ row }) => (
      <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-xs">
        {row.original.fromCode}
      </span>
    ),
  },
  {
    id: 'simArrow',
    header: '',
    enableSorting: false,
    cell: () => <ArrowRight className="text-muted-foreground size-3.5" />,
  },
  {
    accessorKey: 'toCode',
    header: 'Destino',
    cell: ({ row }) => {
      const { toCode, isGoldenMove } = row.original
      return (
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'rounded px-1.5 py-0.5 font-mono text-xs font-semibold',
              isGoldenMove ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'
            )}
          >
            {toCode}
          </span>
          {isGoldenMove && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-green-600">
              <MapPin className="size-3" /> golden
            </span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'score',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Score" className="justify-end" />
    ),
    cell: ({ row }) => {
      const { score } = row.original
      return (
        <div className="flex items-center justify-end gap-2">
          <Progress value={score} className="h-1.5 w-12" />
          <span className={cn('text-xs tabular-nums', scoreTone(score))}>{score}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'distanceSavedM',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Dist. ahorro" className="justify-end" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm">{formatNumber(row.original.distanceSavedM)} m</span>
    ),
  },
]
