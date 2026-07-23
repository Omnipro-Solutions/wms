'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ClipboardList, BarChart3, Users } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { SubNav, type SubNavItem } from '@/components/shared/sub-nav'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { buildLaborQueue, suggestInterleavedRoutes, productivityByAllSources } from '@/lib/rules/labor'
import { buildQueueColumns, buildProductivityColumns, buildOperatorColumns } from './columns'
import { QueueTab } from './_components/QueueTab'
import { ProductivityTab } from './_components/ProductivityTab'
import { OperatorsTab } from './_components/OperatorsTab'
import type { LaborQueueItem } from '@/types/wms'

const ASSIGNABLE_ROLES: Record<LaborQueueItem['sourceType'], string[]> = {
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
  const [assignOperatorName, setAssignOperatorName] = useState('')

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

  const assignableOperators = useMemo(() => {
    if (!assignItem) return []
    const roles = ASSIGNABLE_ROLES[assignItem.sourceType]
    return operators.filter((o) => o.active && roles.includes(o.role))
  }, [assignItem, operators])

  const handleOpenAssign = (item: LaborQueueItem) => {
    setAssignItem(item)
    setAssignOperatorName(item.operatorName ?? '')
  }

  const handleConfirmAssign = () => {
    if (!assignItem || !assignOperatorName) return
    if (assignItem.sourceType === 'picking') startPicking(assignItem.id, assignOperatorName)
    if (assignItem.sourceType === 'replenishment') startReplenishment(assignItem.id, assignOperatorName)
    if (assignItem.sourceType === 'putaway') assignPutaway(assignItem.id, assignOperatorName)
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

      <Dialog open={!!assignItem} onOpenChange={(o) => { if (!o) setAssignItem(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Asignar operario</DialogTitle>
            <DialogDescription>
              {assignItem ? `Tarea ${assignItem.code} (${assignItem.sourceType})` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={assignOperatorName} onValueChange={setAssignOperatorName}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un operario" />
              </SelectTrigger>
              <SelectContent>
                {assignableOperators.map((op) => (
                  <SelectItem key={op.id} value={op.name}>
                    {op.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {assignItem?.productId && (
              <p className="text-muted-foreground mt-2 text-xs">
                Producto: {productName(assignItem.productId)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignItem(null)}>Cancelar</Button>
            <Button disabled={!assignOperatorName} onClick={handleConfirmAssign}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default LaborPage
