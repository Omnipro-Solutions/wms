'use client'

import { BarChart3, Gauge, Trophy, Zap } from 'lucide-react'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/data-table'
import { TabPanel } from '@/app/(app)/receiving/_components/tab-panel'
import { EmptyState } from '@/app/(app)/receiving/_components/empty-state'
import type { ColumnDef } from '@tanstack/react-table'
import type { ProductivityRow } from '@/types/wms'

interface Props {
  rows: ProductivityRow[]
  productivityCols: ColumnDef<ProductivityRow>[]
}

export const ProductivityTab = ({ rows, productivityCols }: Props) => {
  const totalPicks = rows.reduce((sum, r) => sum + r.picksCompleted, 0)
  const totalUnits = rows.reduce((sum, r) => sum + r.unitsPicked, 0)
  const topPerformer = [...rows].sort((a, b) => b.unitsPicked - a.unitsPicked)[0]

  return (
    <TabPanel
      icon={BarChart3}
      iconClass="text-emerald-500"
      title="Productividad"
      description="Desempeño por operario a través de picking, putaway y reposición. El color de las unidades refleja la meta configurada en Config. Mano de obra."
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <KpiCard icon={Zap} value={totalPicks} label="Picks completados" tone="blue" />
        <KpiCard icon={Gauge} value={totalUnits} label="Unidades procesadas" tone="green" />
        <KpiCard
          icon={Trophy}
          value={topPerformer?.operatorName ?? '—'}
          label="Top performer"
          tone="amber"
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Sin datos de productividad"
          description="Completa tareas de picking, putaway o reposición para ver la productividad por operario."
        />
      ) : (
        <DataTable columns={productivityCols} data={rows} searchColumn="operatorName" searchPlaceholder="Buscar operario…" />
      )}
    </TabPanel>
  )
}
