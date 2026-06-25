'use client'

import { useMemo } from 'react'
import { useWmsStore } from '@/store/wms-store'
import { selectInventoryAccuracy } from '@/store/selectors'
import { DataTable } from '@/components/data-table'
import { KpiCard } from '@/components/shared/kpi-card'
import { ShieldCheck, PackageX } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { useStoreHelpers } from '@/hooks/use-store-helpers'

interface ScrapRow {
  id: string
  productName: string
  quantity: number
  reasonName: string
  createdAt: string
}

const columns: ColumnDef<ScrapRow>[] = [
  { accessorKey: 'productName', header: 'Producto' },
  { accessorKey: 'quantity', header: 'Cantidad' },
  { accessorKey: 'reasonName', header: 'Razón' },
  { accessorKey: 'createdAt', header: 'Fecha' },
]

export const InventoryTab = () => {
  const state = useWmsStore()
  const { productName } = useStoreHelpers()
  const accuracy = useMemo(() => selectInventoryAccuracy(state), [state])

  // ponytail: ScrapRecord.lines holds per-product lines; flatten to one row per line
  const scrapRows = useMemo<ScrapRow[]>(() => {
    const reasons = state.reasons
    return state.scrapRecords.flatMap((record) =>
      record.lines.map((line) => ({
        id: `${record.id}-${line.returnLineId}`,
        productName: productName(line.productId),
        quantity: line.quantity,
        reasonName: reasons.find((r) => r.id === line.reasonId)?.label ?? line.reasonId,
        createdAt: record.createdAt.slice(0, 10),
      }))
    )
  }, [state.scrapRecords, state.reasons])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <KpiCard
          icon={ShieldCheck}
          label="IRA — Exactitud de inventario"
          value={`${accuracy.ira.toFixed(1)}%`}
          tone={accuracy.ira >= 98 ? 'green' : accuracy.ira >= 95 ? 'amber' : 'red'}
        />
        <KpiCard icon={PackageX} label="Registros de merma" value={scrapRows.length} tone="neutral" />
      </div>
      <h3 className="text-sm font-medium text-muted-foreground">Mermas y averías</h3>
      <DataTable columns={columns} data={scrapRows} />
    </div>
  )
}
