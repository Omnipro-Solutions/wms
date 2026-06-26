'use client'

import { useMemo } from 'react'
import { useWmsStore } from '@/store/wms-store'
import { productivityByOperator } from '@/lib/rules/picking'
import { DataTable } from '@/components/data-table'
import { KpiCard } from '@/components/shared/kpi-card'
import { BarChart3, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import type { ProductivityRow } from '@/types/wms'

const columns: ColumnDef<ProductivityRow>[] = [
  { accessorKey: 'operatorName', header: 'Operador' },
  { accessorKey: 'picksCompleted', header: 'Picks completados' },
  { accessorKey: 'unitsPicked', header: 'Unidades' },
  { accessorKey: 'partialCount', header: 'Parciales' },
  { accessorKey: 'issueCount', header: 'Incidencias' },
]

export const ProductivityTab = () => {
  const pickingTasks = useWmsStore((s) => s.pickingTasks)
  const rows = useMemo(() => productivityByOperator(pickingTasks), [pickingTasks])

  const totalPicks = rows.reduce((s, r) => s + r.picksCompleted, 0)
  const totalUnits = rows.reduce((s, r) => s + r.unitsPicked, 0)
  const totalIssues = rows.reduce((s, r) => s + r.issueCount, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <KpiCard icon={CheckCircle2} label="Picks completados" value={totalPicks} tone="green" />
        <KpiCard icon={BarChart3} label="Unidades pickeadas" value={totalUnits} tone="blue" />
        <KpiCard
          icon={AlertTriangle}
          label="Incidencias"
          value={totalIssues}
          tone={totalIssues > 0 ? 'amber' : 'neutral'}
        />
      </div>
      <DataTable columns={columns} data={rows} />
    </div>
  )
}
