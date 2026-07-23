'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ClipboardList, BarChart3, Users } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { SubNav, type SubNavItem } from '@/components/shared/sub-nav'
import { AssignOperatorDialog } from '@/components/shared/assign-operator-dialog'
import { buildLaborQueue, suggestInterleavedRoutes, productivityByAllSources } from '@/lib/rules/labor'
import { buildQueueColumns, buildProductivityColumns, buildOperatorColumns } from './columns'
import { QueueTab } from './_components/QueueTab'
import { ProductivityTab } from './_components/ProductivityTab'
import { OperatorsTab } from './_components/OperatorsTab'
import type { LaborQueueItem, Operator } from '@/types/wms'

const ASSIGNABLE_ROLES: Record<LaborQueueItem['sourceType'], Operator['role'][]> = {
  picking: ['picker'],
  putaway: ['receiver'],
  replenishment: ['picker'],
}

const LaborPage = () => {
  const state = useWmsStore()
  const { productName, locationCode } = useStoreHelpers()
  const { startPicking, startReplenishment, assignPutaway, locations, operators } = state

  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'queue'

  const [sourceTypeFilter, setSourceTypeFilter] = useState('all')
  const [assignItem, setAssignItem] = useState<LaborQueueItem | null>(null)

  const rawQueue = useMemo(
    () => buildLaborQueue(state.pickingTasks, state.replenishmentTasks, state.asnRecords),
    [state.pickingTasks, state.replenishmentTasks, state.asnRecords]
  )

  const getLocationForInterleaving = (id: string) => locations.find((l) => l.id === id)

  const queue = useMemo(
    () =>
      state.settings.laborInterleavingEnabled
        ? suggestInterleavedRoutes(rawQueue, getLocationForInterleaving, state.settings.laborInterleavingMaxDistanceM)
        : rawQueue,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawQueue, state.settings.laborInterleavingEnabled, state.settings.laborInterleavingMaxDistanceM]
  )

  const filteredQueue = useMemo(
    () => (sourceTypeFilter === 'all' ? queue : queue.filter((i) => i.sourceType === sourceTypeFilter)),
    [queue, sourceTypeFilter]
  )

  const activeOperatorCount = useMemo(
    () => new Set(queue.filter((i) => i.operatorName).map((i) => i.operatorName)).size,
    [queue]
  )

  const handleOpenAssign = (item: LaborQueueItem) => {
    setAssignItem(item)
  }

  const currentAssignOperatorId = useMemo(() => {
    if (!assignItem?.operatorName) return undefined
    return operators.find((o) => o.name === assignItem.operatorName)?.id
  }, [assignItem, operators])

  const handleConfirmAssign = (operator: Operator) => {
    if (!assignItem) return
    try {
      if (assignItem.sourceType === 'picking') startPicking(assignItem.id, operator.name, operator.id)
      if (assignItem.sourceType === 'replenishment')
        startReplenishment(assignItem.id, operator.name, operator.id)
      if (assignItem.sourceType === 'putaway') assignPutaway(assignItem.id, operator.name, operator.id)
    } catch (e) {
      console.error(e)
    }
    setAssignItem(null)
  }

  const queueCols = useMemo(
    () => buildQueueColumns(productName, locationCode, handleOpenAssign),
    [productName, locationCode]
  )

  const productivityRows = useMemo(
    () => productivityByAllSources(state.pickingTasks, state.replenishmentTasks, state.asnRecords),
    [state.pickingTasks, state.replenishmentTasks, state.asnRecords]
  )

  const productivityCols = useMemo(
    () => buildProductivityColumns(state.settings.laborTargetUnitsPerHour),
    [state.settings.laborTargetUnitsPerHour]
  )

  const operatorRows = useMemo(
    () =>
      operators.map((op) => ({
        id: op.id,
        name: op.name,
        role: op.role,
        active: op.active,
        currentLoad: queue.filter((i) => i.operatorName === op.name).length,
      })),
    [operators, queue]
  )

  const operatorCols = useMemo(() => buildOperatorColumns(), [])

  const laborTabs: SubNavItem[] = [
    { value: 'queue', label: 'Cola de tareas', icon: ClipboardList, count: queue.length || undefined },
    { value: 'productivity', label: 'Productividad', icon: BarChart3 },
    { value: 'operators', label: 'Turnos y operarios', icon: Users },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Mano de obra"
        description="Cola unificada de tareas de picking, putaway y reposición, productividad por operario y visibilidad de carga de trabajo."
      />

      <SubNav items={laborTabs} defaultValue="queue" />

      {activeTab === 'queue' && (
        <QueueTab
          allItems={queue}
          filteredItems={filteredQueue}
          sourceTypeFilter={sourceTypeFilter}
          onSourceTypeFilterChange={setSourceTypeFilter}
          activeOperatorCount={activeOperatorCount}
          queueCols={queueCols}
        />
      )}

      {activeTab === 'productivity' && (
        <ProductivityTab rows={productivityRows} productivityCols={productivityCols} />
      )}

      {activeTab === 'operators' && (
        <OperatorsTab rows={operatorRows} operatorCols={operatorCols} />
      )}

      <AssignOperatorDialog
        open={!!assignItem}
        onOpenChange={(o) => { if (!o) setAssignItem(null) }}
        roles={assignItem ? ASSIGNABLE_ROLES[assignItem.sourceType] : []}
        currentOperatorId={currentAssignOperatorId}
        entityLabel={assignItem ? `Tarea ${assignItem.code} (${assignItem.sourceType})` : ''}
        onConfirm={handleConfirmAssign}
      />
    </div>
  )
}

export default LaborPage
