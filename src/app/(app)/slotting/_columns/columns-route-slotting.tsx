'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { RouteSlottingRecommendation } from '@/types/wms'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type RouteSlottingRow = RouteSlottingRecommendation & {
  productName: string
  productSku: string
  currentLocationCode: string
  candidateLocationCode: string
  onRelocate: () => void
}

export const buildRouteSlottingColumns = (): ColumnDef<RouteSlottingRow>[] => [
  {
    accessorKey: 'productName',
    header: 'Producto',
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.productName}</p>
        <p className="text-muted-foreground font-mono text-xs">{row.original.productSku}</p>
      </div>
    ),
  },
  {
    accessorKey: 'routeLabel',
    header: 'Ruta predominante',
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.routeLabel}</p>
        <p className="text-muted-foreground font-mono text-xs">{row.original.routeCode}</p>
      </div>
    ),
  },
  {
    accessorKey: 'routePickFrequency',
    header: '% picks en ruta',
    cell: ({ row }) => (
      <span className="font-mono text-sm">
        {Math.round(row.original.routePickFrequency * 100)}%
      </span>
    ),
  },
  {
    accessorKey: 'currentLocationCode',
    header: 'Ubicación actual',
    cell: ({ row }) => (
      <div>
        <p className="font-mono text-sm">{row.original.currentLocationCode}</p>
        <p className="text-muted-foreground text-xs">
          {Math.round(row.original.currentDistanceToStagingM)} m al staging
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'candidateLocationCode',
    header: 'Ubicación propuesta',
    cell: ({ row }) => (
      <div>
        <p className="font-mono text-sm">{row.original.candidateLocationCode}</p>
        <p className="text-muted-foreground text-xs">
          {Math.round(row.original.candidateDistanceToStagingM)} m al staging
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'totalDistanceSavedM',
    header: 'Ahorro total',
    cell: ({ row }) => (
      <span className="font-mono text-sm text-emerald-600">
        {Math.round(row.original.totalDistanceSavedM)} m
      </span>
    ),
  },
  {
    accessorKey: 'score',
    header: 'Score',
    cell: ({ row }) => (
      <Badge
        variant="secondary"
        className={cn(
          row.original.score >= 70
            ? 'bg-emerald-100 text-emerald-700'
            : row.original.score >= 40
              ? 'bg-amber-100 text-amber-700'
              : 'bg-gray-100 text-gray-600'
        )}
      >
        {row.original.score}
      </Badge>
    ),
  },
  {
    id: 'acciones',
    header: 'Acción',
    cell: ({ row }) => (
      <Button size="sm" variant="outline" onClick={row.original.onRelocate}>
        Reubicar
      </Button>
    ),
  },
]
