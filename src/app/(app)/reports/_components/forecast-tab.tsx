'use client'

import { useMemo } from 'react'
import { useWmsStore } from '@/store/wms-store'
import { forecastDemand } from '@/lib/rules/forecast'
import { DataTable } from '@/components/data-table'
import { KpiCard } from '@/components/shared/kpi-card'
import { TrendingUp } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { Badge } from '@/components/ui/badge'

interface ForecastRow {
  productName: string
  avgDemand: number
  p1: number
  p2: number
  p3: number
  p4: number
  trend: 'up' | 'down' | 'stable'
}

const columns: ColumnDef<ForecastRow>[] = [
  { accessorKey: 'productName', header: 'Producto' },
  { accessorKey: 'avgDemand', header: 'Demanda prom.' },
  { accessorKey: 'p1', header: 'P+1' },
  { accessorKey: 'p2', header: 'P+2' },
  { accessorKey: 'p3', header: 'P+3' },
  { accessorKey: 'p4', header: 'P+4' },
  {
    accessorKey: 'trend',
    header: 'Tendencia',
    cell: ({ row }) => {
      const t = row.original.trend
      return (
        <Badge variant={t === 'down' ? 'destructive' : t === 'up' ? 'default' : 'secondary'}>
          {t === 'up' ? '↑ Subiendo' : t === 'down' ? '↓ Bajando' : '→ Estable'}
        </Badge>
      )
    },
  },
]

export const ForecastTab = () => {
  const productDemandStats = useWmsStore((s) => s.demandStats)
  const { productName } = useStoreHelpers()

  const rows = useMemo<ForecastRow[]>(() => {
    const top10 = [...productDemandStats]
      .sort((a, b) => b.pickingFrequency - a.pickingFrequency)
      .slice(0, 10)

    return top10.map((stat) => {
      const samples = stat.demandSamples ?? []
      const forecasted = forecastDemand(samples, 4)
      const [p1, p2, p3, p4] = forecasted
      const avg = samples.length ? samples.reduce((sum: number, v: number) => sum + v, 0) / samples.length : 0
      const trend: ForecastRow['trend'] = p4 > avg * 1.05 ? 'up' : p4 < avg * 0.95 ? 'down' : 'stable'

      return {
        productName: productName(stat.productId),
        avgDemand: Math.round(avg),
        p1: Math.round(p1 ?? 0),
        p2: Math.round(p2 ?? 0),
        p3: Math.round(p3 ?? 0),
        p4: Math.round(p4 ?? 0),
        trend,
      }
    })
  }, [productDemandStats])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <KpiCard icon={TrendingUp} label="SKUs proyectados" value={rows.length} tone="blue" />
      </div>
      <DataTable columns={columns} data={rows} />
    </div>
  )
}
