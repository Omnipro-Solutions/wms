'use client'

import { useMemo } from 'react'
import { useWmsStore } from '@/store/wms-store'
import { otifPercentage, otifByCarrier } from '@/lib/rules/shipping'
import { DataTable } from '@/components/data-table'
import { KpiCard } from '@/components/shared/kpi-card'
import { Truck, TrendingUp, TrendingDown } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'

interface CarrierOtifRow {
  carrierName: string
  total: number
  onTimeRate: number
}

const columns: ColumnDef<CarrierOtifRow>[] = [
  { accessorKey: 'carrierName', header: 'Transportista' },
  { accessorKey: 'total', header: 'Envíos' },
  {
    accessorKey: 'onTimeRate',
    header: 'OTIF %',
    cell: ({ row }) => (
      <span className={row.original.onTimeRate >= 90 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
        {row.original.onTimeRate.toFixed(1)}%
      </span>
    ),
  },
]

export const OtifTab = () => {
  const shipments = useWmsStore((s) => s.shipments)
  const globalOtif = useMemo(() => otifPercentage(shipments), [shipments])
  const rows = useMemo<CarrierOtifRow[]>(() => otifByCarrier(shipments), [shipments])

  const OtifIcon = globalOtif >= 90 ? TrendingUp : TrendingDown

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <KpiCard
          icon={OtifIcon}
          label="OTIF Global"
          value={`${globalOtif.toFixed(1)}%`}
          tone={globalOtif >= 90 ? 'green' : globalOtif >= 80 ? 'amber' : 'red'}
        />
        <KpiCard icon={Truck} label="Transportistas activos" value={rows.length} tone="neutral" />
      </div>
      <DataTable columns={columns} data={rows} />
    </div>
  )
}
