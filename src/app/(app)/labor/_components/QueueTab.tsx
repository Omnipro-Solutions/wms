'use client'

import { ClipboardList, Route, Shuffle, UserX, Users } from 'lucide-react'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TabPanel } from '@/app/(app)/receiving/_components/tab-panel'
import { EmptyState } from '@/app/(app)/receiving/_components/empty-state'
import type { ColumnDef } from '@tanstack/react-table'
import type { LaborQueueItem } from '@/types/wms'

interface Props {
  allItems: LaborQueueItem[]
  filteredItems: LaborQueueItem[]
  sourceTypeFilter: string
  onSourceTypeFilterChange: (value: string) => void
  activeOperatorCount: number
  queueCols: ColumnDef<LaborQueueItem>[]
  onAutoDistribute: () => void
}

export const QueueTab = ({
  allItems,
  filteredItems,
  sourceTypeFilter,
  onSourceTypeFilterChange,
  activeOperatorCount,
  queueCols,
  onAutoDistribute,
}: Props) => {
  const unassignedCount = allItems.filter((i) => !i.operatorName).length
  const unassignedFilteredCount = filteredItems.filter((i) => !i.operatorName).length
  const withRouteCount = allItems.filter((i) => i.suggestedRouteId).length

  return (
    <TabPanel
      icon={ClipboardList}
      iconClass="text-blue-500"
      title="Cola de tareas"
      description="Vista unificada de tareas de picking, putaway y reposición pendientes de completar. Asigna o reasigna un operario sin salir de esta vista."
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <KpiCard icon={ClipboardList} value={allItems.length} label="Total pendientes" tone="blue" />
        <KpiCard icon={UserX} value={unassignedCount} label="Sin asignar" tone="amber" />
        <KpiCard icon={Route} value={withRouteCount} label="Ruta combinada sugerida" tone="green" />
        <KpiCard icon={Users} value={activeOperatorCount} label="Operarios activos" tone="neutral" />
      </div>
      {allItems.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Sin tareas pendientes"
          description="Las tareas de picking, putaway y reposición pendientes aparecerán aquí."
        />
      ) : (
        <DataTable
          columns={queueCols}
          data={filteredItems}
          searchColumn="code"
          searchPlaceholder="Buscar por código o producto…"
          emptyMessage="Sin tareas para el filtro seleccionado."
          filters={
            <Select value={sourceTypeFilter} onValueChange={onSourceTypeFilterChange}>
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="picking">Picking</SelectItem>
                <SelectItem value="putaway">Putaway</SelectItem>
                <SelectItem value="replenishment">Reposición</SelectItem>
              </SelectContent>
            </Select>
          }
          actions={
            <Button onClick={onAutoDistribute} disabled={unassignedFilteredCount === 0}>
              <Shuffle className="mr-1 size-4" /> Distribuir automáticamente
            </Button>
          }
        />
      )}
    </TabPanel>
  )
}
