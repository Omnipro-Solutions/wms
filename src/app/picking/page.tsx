'use client'

import { useMemo, useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  Hash,
  Layers,
  LayoutGrid,
  Package,
  Plus,
  ShoppingCart,
  Store,
  TriangleAlert,
  Waves,
  Zap,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { useDialogState } from '@/hooks/use-dialog-state'
import { clusterProgress } from '@/lib/rules/picking'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  buildTaskColumns,
  buildWaveColumns,
  buildWavelessColumns,
  buildBatchColumns,
  buildZoneColumns,
  buildClusterColumns,
  buildPutToStoreColumns,
} from './columns'
import type { TaskAction, ZoneTask } from './columns'
import type {
  BatchTask,
  ClusterTask,
  PickingTask,
  PickingWave,
  PutToStoreTask,
  WavelessOrder,
} from '@/types/wms'
import { TasksTab } from './_components/TasksTab'
import { WavesTab } from './_components/WavesTab'
import { WavelessTab } from './_components/WavelessTab'
import { BatchTab } from './_components/BatchTab'
import { ZoneTab } from './_components/ZoneTab'
import { ClusterTab } from './_components/ClusterTab'
import { PutToStoreTab } from './_components/PutToStoreTab'

// ─── Constants ────────────────────────────────────────────────────────────────

type TabValue = 'tasks' | 'waves' | 'waveless' | 'batch' | 'zone' | 'cluster' | 'put-to-store'

const GROUP_BY_LABELS: Record<PickingWave['groupBy'], string> = {
  zone: 'Zona',
  route: 'Ruta',
  priority: 'Prioridad',
  carrier: 'Transportadora',
  dispatch_window: 'Ventana despacho',
  fulfillment_type: 'Tipo despacho',
}

const ZONE_COLORS: Record<string, string> = {
  A: 'border-green-200 bg-green-100 text-green-800',
  B: 'border-blue-200 bg-blue-100 text-blue-800',
  R: 'border-slate-200 bg-slate-100 text-slate-700',
  S: 'border-orange-200 bg-orange-100 text-orange-800',
  QC: 'border-purple-200 bg-purple-100 text-purple-800',
}

const EMPTY_WAVE_FORM = {
  name: '',
  zone: '',
  groupBy: 'zone' as PickingWave['groupBy'],
  groupValue: '',
  priority: 'medium' as PickingWave['priority'],
  assignedTeam: '',
}

// ─── Dialog data types ────────────────────────────────────────────────────────

interface PickDialogData {
  taskId: string
  code: string
  productName: string
  locationCode: string
  requestedQuantity: number
  requiresSerial: boolean
}

interface ReleaseDialogData {
  waveId: string
  code: string
  name: string
  orderCount: number
  unitCount: number
}

interface BatchPickDialogData {
  batchId: string
  code: string
  productName: string
  locationCode: string
  totalRequested: number
  ordersCount: number
}

interface DepositDialogData {
  clusterId: string
  clusterCode: string
  operatorName?: string
}

interface PtsDistributeData {
  taskId: string
  taskCode: string
  productName: string
  totalPicked: number
}

// ─── Root page ────────────────────────────────────────────────────────────────

const PickingPage = () => {
  const state = useWmsStore()
  const { startPicking, completePick, approvePart, rejectPart } = useWmsStore()
  const { releaseWave, createWave } = useWmsStore()
  const { createWavelessOrder, startWavelessOrder } = useWmsStore()
  const { startBatchTask, completeBatchTask } = useWmsStore()
  const { startClusterTask, depositToSlot, completeClusterTask } = useWmsStore()
  const { startPutToStore, distributeToStore, completePutToStore } = useWmsStore()
  const helpers = useStoreHelpers()
  const router = useRouter()
  const searchParams = useSearchParams()

  const activeTab = (searchParams.get('tab') as TabValue) ?? 'tasks'

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', value)
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  // ── Task dialog ────────────────────────────────────────────────────────────
  const [pickedQty, setPickedQty] = useState('')
  const [reasonId, setReasonId] = useState('')
  const [capturedSerial, setCapturedSerial] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const pickDialog = useDialogState<PickDialogData>()

  const partialReasons = state.reasons.filter((r) => r.context === 'partial_picking' && r.active)

  const openPickDialog = useCallback(
    (task: PickingTask) => {
      const product = state.products.find((p) => p.id === task.productId)
      pickDialog.open({
        taskId: task.id,
        code: task.code,
        productName: helpers.productName(task.productId),
        locationCode: helpers.locationCode(task.locationId),
        requestedQuantity: task.requestedQuantity,
        requiresSerial: product?.trackBy === 'serial',
      })
      setPickedQty(String(task.requestedQuantity))
      setReasonId('')
      setCapturedSerial('')
    },
    [state.products, helpers, pickDialog]
  )

  const handleTaskAction = useCallback(
    (action: TaskAction) => {
      if (action.type === 'start') {
        const task = state.pickingTasks.find((t) => t.id === action.taskId)
        if (!task) return
        try {
          startPicking(action.taskId, task.operatorName ?? 'Operador')
        } catch (e) {
          console.error(e)
        }
      } else if (action.type === 'register' || action.type === 'retry') {
        openPickDialog(action.task)
      } else if (action.type === 'approve') {
        try {
          approvePart(action.taskId)
        } catch (e) {
          console.error(e)
        }
      } else if (action.type === 'reject') {
        try {
          rejectPart(action.taskId)
        } catch (e) {
          console.error(e)
        }
      }
    },
    [state.pickingTasks, startPicking, openPickDialog, approvePart, rejectPart]
  )

  const handleCompletePick = useCallback(() => {
    if (!pickDialog.data) return
    const n = parseInt(pickedQty, 10)
    if (isNaN(n) || n < 0) {
      pickDialog.setError('Ingresa una cantidad válida.')
      return
    }
    if (n > pickDialog.data.requestedQuantity) {
      pickDialog.setError(`Máximo: ${pickDialog.data.requestedQuantity}`)
      return
    }
    const isPartial = n < pickDialog.data.requestedQuantity
    if (isPartial && !reasonId) {
      pickDialog.setError('Selecciona un motivo de picking parcial.')
      return
    }
    if (pickDialog.data.requiresSerial && n > 0 && !capturedSerial.trim()) {
      pickDialog.setError('Este producto requiere captura de serial.')
      return
    }
    try {
      completePick(
        pickDialog.data.taskId,
        n,
        isPartial ? reasonId : undefined,
        capturedSerial.trim() || undefined
      )
      pickDialog.close()
      setPickedQty('')
      setReasonId('')
      setCapturedSerial('')
    } catch (e: unknown) {
      pickDialog.setError(e instanceof Error ? e.message : 'Error al registrar picking')
    }
  }, [pickDialog, pickedQty, reasonId, capturedSerial, completePick])

  // ── KPI counts for tasks ───────────────────────────────────────────────────
  const pendingTaskCount = useMemo(
    () =>
      state.pickingTasks.filter((t) => t.status === 'pending' || t.status === 'assigned').length,
    [state.pickingTasks]
  )
  const partialTaskCount = useMemo(
    () =>
      state.pickingTasks.filter((t) =>
        [
          'partially_picked',
          'partial_with_shortage',
          'partial_approved',
          'partial_rejected',
        ].includes(t.status)
      ).length,
    [state.pickingTasks]
  )
  const completedTaskCount = useMemo(
    () => state.pickingTasks.filter((t) => t.status === 'completed').length,
    [state.pickingTasks]
  )

  const filteredTasks = useMemo(
    () =>
      statusFilter === 'all'
        ? state.pickingTasks
        : state.pickingTasks.filter((t) => t.status === statusFilter),
    [state.pickingTasks, statusFilter]
  )

  const taskCols = useMemo(
    () => buildTaskColumns(helpers.productName, helpers.locationCode, handleTaskAction),
    [helpers.productName, helpers.locationCode, handleTaskAction]
  )

  // ── Wave dialog ────────────────────────────────────────────────────────────
  const releaseDialog = useDialogState<ReleaseDialogData>()
  const [createWaveOpen, setCreateWaveOpen] = useState(false)
  const [waveForm, setWaveForm] = useState(EMPTY_WAVE_FORM)
  const [waveFormError, setWaveFormError] = useState('')

  const activeWaveCount = useMemo(
    () => state.pickingWaves.filter((w) => w.status === 'in_progress').length,
    [state.pickingWaves]
  )
  const draftWaveCount = useMemo(
    () => state.pickingWaves.filter((w) => w.status === 'draft').length,
    [state.pickingWaves]
  )
  const waveActiveUnits = useMemo(
    () =>
      state.pickingWaves
        .filter((w) => w.status === 'in_progress')
        .reduce((s, w) => s + w.unitCount, 0),
    [state.pickingWaves]
  )

  const handleReleaseWave = useCallback(() => {
    if (!releaseDialog.data) return
    try {
      releaseWave(releaseDialog.data.waveId)
      releaseDialog.close()
    } catch (e: unknown) {
      releaseDialog.setError(e instanceof Error ? e.message : 'Error al liberar oleada')
    }
  }, [releaseDialog, releaseWave])

  const handleCreateWave = useCallback(() => {
    setWaveFormError('')
    if (!waveForm.name.trim()) {
      setWaveFormError('El nombre es obligatorio')
      return
    }
    if (!waveForm.groupValue.trim()) {
      setWaveFormError('El valor de agrupación es obligatorio')
      return
    }
    const pendingOrders = state.commerceOrders.filter(
      (o) => o.status === 'pending' || o.status === 'assigned'
    )
    try {
      createWave({
        code: `WAVE-${String(state.pickingWaves.length + 1).padStart(3, '0')}`,
        name: waveForm.name.trim(),
        zone: waveForm.zone.trim() || 'A',
        groupBy: waveForm.groupBy,
        groupValue: waveForm.groupValue.trim(),
        priority: waveForm.priority,
        assignedTeam: waveForm.assignedTeam.trim() || undefined,
        orderCount: pendingOrders.length,
        unitCount: pendingOrders.reduce(
          (s, o) => s + o.items.reduce((si, i) => si + i.requestedQuantity, 0),
          0
        ),
        orderIds: pendingOrders.map((o) => o.id),
      })
      setCreateWaveOpen(false)
      setWaveForm(EMPTY_WAVE_FORM)
    } catch (e: unknown) {
      setWaveFormError(e instanceof Error ? e.message : 'Error al crear oleada')
    }
  }, [waveForm, state.commerceOrders, state.pickingWaves, createWave])

  const waveCols = useMemo(
    () =>
      buildWaveColumns((wave) =>
        releaseDialog.open({
          waveId: wave.id,
          code: wave.code,
          name: wave.name,
          orderCount: wave.orderCount,
          unitCount: wave.unitCount,
        })
      ),
    [releaseDialog]
  )

  // ── Waveless ───────────────────────────────────────────────────────────────
  const createWlDialog = useDialogState<{ placeholder: true }>()
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [wlPriority, setWlPriority] = useState<WavelessOrder['priority']>('high')

  const existingWlIds = useMemo(
    () => new Set(state.wavelessOrders.map((w) => w.orderId)),
    [state.wavelessOrders]
  )
  const eligibleOrders = useMemo(
    () =>
      state.commerceOrders.filter(
        (o) => (o.status === 'pending' || o.status === 'assigned') && !existingWlIds.has(o.id)
      ),
    [state.commerceOrders, existingWlIds]
  )

  const pendingWlCount = useMemo(
    () => state.wavelessOrders.filter((w) => w.status === 'pending').length,
    [state.wavelessOrders]
  )
  const activeWlCount = useMemo(
    () => state.wavelessOrders.filter((w) => w.status === 'in_progress').length,
    [state.wavelessOrders]
  )
  const completedWlCount = useMemo(
    () => state.wavelessOrders.filter((w) => w.status === 'completed').length,
    [state.wavelessOrders]
  )

  const handleCreateWl = useCallback(() => {
    if (!selectedOrderId) {
      createWlDialog.setError('Selecciona un pedido')
      return
    }
    try {
      createWavelessOrder(selectedOrderId, wlPriority)
      createWlDialog.close()
      setSelectedOrderId('')
      setWlPriority('high')
    } catch (e: unknown) {
      createWlDialog.setError(e instanceof Error ? e.message : 'Error al crear pedido waveless')
    }
  }, [selectedOrderId, wlPriority, createWlDialog, createWavelessOrder])

  const wavelessCols = useMemo(
    () =>
      buildWavelessColumns((wl) => {
        try {
          startWavelessOrder(wl.id, 'Operador')
        } catch (e) {
          console.error(e)
        }
      }),
    [startWavelessOrder]
  )

  // ── Batch ──────────────────────────────────────────────────────────────────
  const batchPickDialog = useDialogState<BatchPickDialogData>()
  const [batchPickedQty, setBatchPickedQty] = useState('')

  const openBatchPickDialog = useCallback(
    (batch: BatchTask) => {
      batchPickDialog.open({
        batchId: batch.id,
        code: batch.code,
        productName: helpers.productName(batch.productId),
        locationCode: helpers.locationCode(batch.locationId),
        totalRequested: batch.totalRequestedQuantity,
        ordersCount: batch.pickingTaskIds.length,
      })
      setBatchPickedQty(String(batch.totalRequestedQuantity))
    },
    [helpers, batchPickDialog]
  )

  const handleCompleteBatch = useCallback(() => {
    if (!batchPickDialog.data) return
    const n = parseInt(batchPickedQty, 10)
    if (isNaN(n) || n < 0) {
      batchPickDialog.setError('Cantidad inválida')
      return
    }
    if (n > batchPickDialog.data.totalRequested) {
      batchPickDialog.setError(`Máximo: ${batchPickDialog.data.totalRequested}`)
      return
    }
    try {
      completeBatchTask(batchPickDialog.data.batchId, n)
      batchPickDialog.close()
      setBatchPickedQty('')
    } catch (e: unknown) {
      batchPickDialog.setError(e instanceof Error ? e.message : 'Error al registrar batch')
    }
  }, [batchPickDialog, batchPickedQty, completeBatchTask])

  const pendingBatchCount = useMemo(
    () => state.batchTasks.filter((b) => b.status === 'pending').length,
    [state.batchTasks]
  )
  const activeBatchCount = useMemo(
    () => state.batchTasks.filter((b) => b.status === 'in_progress').length,
    [state.batchTasks]
  )
  const completedBatchCount = useMemo(
    () => state.batchTasks.filter((b) => b.status === 'completed').length,
    [state.batchTasks]
  )
  const totalBatchUnits = useMemo(
    () => state.batchTasks.reduce((s, b) => s + b.totalRequestedQuantity, 0),
    [state.batchTasks]
  )

  const batchCols = useMemo(
    () =>
      buildBatchColumns(
        helpers.productName,
        helpers.locationCode,
        (b) => {
          try {
            startBatchTask(b.id, 'Operador')
          } catch (e) {
            console.error(e)
          }
        },
        openBatchPickDialog
      ),
    [helpers.productName, helpers.locationCode, startBatchTask, openBatchPickDialog]
  )

  // ── Zone ───────────────────────────────────────────────────────────────────
  const tasksWithZone = useMemo<ZoneTask[]>(
    () =>
      state.pickingTasks.map((t) => {
        const loc = state.locations.find((l) => l.id === t.locationId)
        return { ...t, zone: loc?.zone ?? '?' }
      }),
    [state.pickingTasks, state.locations]
  )

  const zones = useMemo(
    () => [...new Set(tasksWithZone.map((t) => t.zone))].sort(),
    [tasksWithZone]
  )

  const zoneStats = useMemo(
    () =>
      zones.map((zone) => {
        const tasks = tasksWithZone.filter((t) => t.zone === zone)
        const completed = tasks.filter(
          (t) => t.status === 'completed' || t.status === 'partial_approved'
        ).length
        const total = tasks.length
        const totalUnits = tasks.reduce((s, t) => s + t.requestedQuantity, 0)
        const pickedUnits = tasks.reduce((s, t) => s + t.pickedQuantity, 0)
        const operators = [...new Set(tasks.map((t) => t.operatorName).filter(Boolean))]
        return { zone, completed, total, totalUnits, pickedUnits, operators }
      }),
    [zones, tasksWithZone]
  )

  const consolidationCount = useMemo(() => {
    const readyOrderIds = new Set<string>()
    for (const orderId of new Set(tasksWithZone.map((t) => t.orderId))) {
      const orderTasks = tasksWithZone.filter((t) => t.orderId === orderId)
      if (
        orderTasks.length > 1 &&
        orderTasks.every((t) => t.status === 'completed' || t.status === 'partial_approved')
      ) {
        readyOrderIds.add(orderId)
      }
    }
    return readyOrderIds.size
  }, [tasksWithZone])

  const zoneCols = useMemo(
    () => buildZoneColumns(helpers.productName, helpers.locationCode),
    [helpers.productName, helpers.locationCode]
  )

  // ── Cluster ────────────────────────────────────────────────────────────────
  const depositDialog = useDialogState<DepositDialogData>()
  const [selectedClusterOrderId, setSelectedClusterOrderId] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [depositQty, setDepositQty] = useState('1')

  const activeCluster = depositDialog.data
    ? state.clusterTasks.find((c) => c.id === depositDialog.data!.clusterId)
    : null

  const openDepositDialog = useCallback(
    (cluster: ClusterTask) => {
      depositDialog.open({
        clusterId: cluster.id,
        clusterCode: cluster.code,
        operatorName: cluster.operatorName,
      })
      setSelectedClusterOrderId('')
      setSelectedProductId('')
      setDepositQty('1')
    },
    [depositDialog]
  )

  const handleDeposit = useCallback(() => {
    if (!depositDialog.data || !activeCluster) return
    if (!selectedClusterOrderId) {
      depositDialog.setError('Selecciona un contenedor')
      return
    }
    if (!selectedProductId) {
      depositDialog.setError('Selecciona un producto')
      return
    }
    const qty = parseInt(depositQty, 10)
    if (isNaN(qty) || qty <= 0) {
      depositDialog.setError('Cantidad inválida')
      return
    }
    try {
      depositToSlot(depositDialog.data.clusterId, selectedClusterOrderId, selectedProductId, qty)
      setSelectedClusterOrderId('')
      setSelectedProductId('')
      setDepositQty('1')
      depositDialog.clearError()
    } catch (e: unknown) {
      depositDialog.setError(e instanceof Error ? e.message : 'Error al depositar')
    }
  }, [
    depositDialog,
    activeCluster,
    selectedClusterOrderId,
    selectedProductId,
    depositQty,
    depositToSlot,
  ])

  const handleCompleteCluster = useCallback(() => {
    if (!depositDialog.data) return
    try {
      completeClusterTask(depositDialog.data.clusterId)
      depositDialog.close()
    } catch (e: unknown) {
      depositDialog.setError(e instanceof Error ? e.message : 'Error al completar cluster')
    }
  }, [depositDialog, completeClusterTask])

  const slotItems =
    activeCluster?.slots.find((s) => s.orderId === selectedClusterOrderId)?.items ?? []

  const pendingClusterCount = useMemo(
    () => state.clusterTasks.filter((c) => c.status === 'pending').length,
    [state.clusterTasks]
  )
  const activeClusterCount = useMemo(
    () => state.clusterTasks.filter((c) => c.status === 'in_progress').length,
    [state.clusterTasks]
  )
  const completedClusterCount = useMemo(
    () => state.clusterTasks.filter((c) => c.status === 'completed').length,
    [state.clusterTasks]
  )

  const clusterCols = useMemo(
    () =>
      buildClusterColumns((c) => {
        try {
          startClusterTask(c.id, 'Operador')
        } catch (e) {
          console.error(e)
        }
      }, openDepositDialog),
    [startClusterTask, openDepositDialog]
  )

  // ── Put-to-store ───────────────────────────────────────────────────────────
  const distributeDialog = useDialogState<PtsDistributeData>()
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({})

  const activeDistTask = distributeDialog.data
    ? state.putToStoreTasks.find((t) => t.id === distributeDialog.data!.taskId)
    : null

  const openDistributeDialog = useCallback(
    (task: PutToStoreTask) => {
      const initial: Record<string, string> = {}
      task.allocations.forEach((a) => {
        initial[a.storeId] = ''
      })
      setQtyInputs(initial)
      distributeDialog.open({
        taskId: task.id,
        taskCode: task.code,
        productName: helpers.productName(task.productId),
        totalPicked: task.totalPickedQuantity,
      })
    },
    [helpers, distributeDialog]
  )

  const handleDistributeToStore = useCallback(
    (storeId: string) => {
      if (!distributeDialog.data) return
      const qty = parseInt(qtyInputs[storeId] ?? '0', 10)
      if (isNaN(qty) || qty <= 0) {
        distributeDialog.setError('Cantidad inválida')
        return
      }
      try {
        distributeToStore(distributeDialog.data.taskId, storeId, qty)
        setQtyInputs((prev) => ({ ...prev, [storeId]: '' }))
        distributeDialog.clearError()
      } catch (e: unknown) {
        distributeDialog.setError(e instanceof Error ? e.message : 'Error al distribuir')
      }
    },
    [distributeDialog, qtyInputs, distributeToStore]
  )

  const handleCompletePts = useCallback(() => {
    if (!distributeDialog.data) return
    try {
      completePutToStore(distributeDialog.data.taskId)
      distributeDialog.close()
    } catch (e: unknown) {
      distributeDialog.setError(e instanceof Error ? e.message : 'Error al completar')
    }
  }, [distributeDialog, completePutToStore])

  const pendingPtsCount = useMemo(
    () => state.putToStoreTasks.filter((t) => t.status === 'pending').length,
    [state.putToStoreTasks]
  )
  const activePtsCount = useMemo(
    () => state.putToStoreTasks.filter((t) => t.status === 'in_progress').length,
    [state.putToStoreTasks]
  )
  const completedPtsCount = useMemo(
    () => state.putToStoreTasks.filter((t) => t.status === 'completed').length,
    [state.putToStoreTasks]
  )
  const totalPtsUnits = useMemo(
    () => state.putToStoreTasks.reduce((s, t) => s + t.totalPickedQuantity, 0),
    [state.putToStoreTasks]
  )

  const putToStoreCols = useMemo(
    () =>
      buildPutToStoreColumns(
        helpers.productName,
        (t) => {
          try {
            startPutToStore(t.id, 'Operador')
          } catch (e) {
            console.error(e)
          }
        },
        openDistributeDialog
      ),
    [helpers.productName, startPutToStore, openDistributeDialog]
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Picking & Fulfillment"
        description="Gestión completa del proceso de picking: tareas individuales, oleadas, estrategias de optimización y distribución a tiendas."
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="bg-muted/60 mb-4 h-auto flex-wrap gap-1">
          <TabsTrigger
            value="tasks"
            className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <ClipboardList className="size-4" />
            Tareas
            {pendingTaskCount > 0 && (
              <Badge
                variant="outline"
                className="ml-1 h-5 min-w-5 border-amber-300 bg-amber-50 px-1.5 text-xs text-amber-700"
              >
                {pendingTaskCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="waves"
            className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Waves className="size-4" />
            Oleadas
            {activeWaveCount > 0 && (
              <Badge
                variant="outline"
                className="ml-1 h-5 min-w-5 border-blue-200 bg-blue-50 px-1.5 text-xs text-blue-600"
              >
                {activeWaveCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="waveless"
            className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Zap className="size-4" />
            Waveless
            {activeWlCount > 0 && (
              <Badge
                variant="outline"
                className="ml-1 h-5 min-w-5 border-blue-200 bg-blue-50 px-1.5 text-xs text-blue-600"
              >
                {activeWlCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="batch"
            className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Package className="size-4" />
            Batch
            {activeBatchCount > 0 && (
              <Badge
                variant="outline"
                className="ml-1 h-5 min-w-5 border-blue-200 bg-blue-50 px-1.5 text-xs text-blue-600"
              >
                {activeBatchCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="zone"
            className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <LayoutGrid className="size-4" />
            Por zona
            {consolidationCount > 0 && (
              <Badge
                variant="outline"
                className="ml-1 h-5 min-w-5 border-emerald-200 bg-emerald-50 px-1.5 text-xs text-emerald-700"
              >
                {consolidationCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="cluster"
            className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <ShoppingCart className="size-4" />
            Cluster
            {activeClusterCount > 0 && (
              <Badge
                variant="outline"
                className="ml-1 h-5 min-w-5 border-blue-200 bg-blue-50 px-1.5 text-xs text-blue-600"
              >
                {activeClusterCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="put-to-store"
            className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Store className="size-4" />
            Put-to-store
            {activePtsCount > 0 && (
              <Badge
                variant="outline"
                className="ml-1 h-5 min-w-5 border-blue-200 bg-blue-50 px-1.5 text-xs text-blue-600"
              >
                {activePtsCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tareas ──────────────────────────────────────────────────────── */}
        <TabsContent value="tasks">
          <TasksTab
            pickingTasks={state.pickingTasks}
            filteredTasks={filteredTasks}
            pendingTaskCount={pendingTaskCount}
            partialTaskCount={partialTaskCount}
            completedTaskCount={completedTaskCount}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            taskCols={taskCols}
          />
        </TabsContent>

        {/* ── Oleadas ─────────────────────────────────────────────────────── */}
        <TabsContent value="waves">
          <WavesTab
            pickingWaves={state.pickingWaves}
            commerceOrders={state.commerceOrders}
            activeWaveCount={activeWaveCount}
            draftWaveCount={draftWaveCount}
            waveActiveUnits={waveActiveUnits}
            waveCols={waveCols}
            onCreateWave={() => setCreateWaveOpen(true)}
          />
        </TabsContent>

        {/* ── Waveless ────────────────────────────────────────────────────── */}
        <TabsContent value="waveless">
          <WavelessTab
            wavelessOrders={state.wavelessOrders}
            pendingWlCount={pendingWlCount}
            activeWlCount={activeWlCount}
            completedWlCount={completedWlCount}
            wavelessCols={wavelessCols}
            onAddOrder={() => createWlDialog.open({ placeholder: true })}
          />
        </TabsContent>

        {/* ── Batch ───────────────────────────────────────────────────────── */}
        <TabsContent value="batch">
          <BatchTab
            batchTasks={state.batchTasks}
            pickingTasks={state.pickingTasks}
            commerceOrders={state.commerceOrders}
            pendingBatchCount={pendingBatchCount}
            activeBatchCount={activeBatchCount}
            completedBatchCount={completedBatchCount}
            totalBatchUnits={totalBatchUnits}
            batchCols={batchCols}
          />
        </TabsContent>

        {/* ── Por zona ────────────────────────────────────────────────────── */}
        <TabsContent value="zone">
          <ZoneTab
            tasksWithZone={tasksWithZone}
            zoneStats={zoneStats}
            zones={zones}
            consolidationCount={consolidationCount}
            zoneCols={zoneCols}
          />
        </TabsContent>

        {/* ── Cluster ─────────────────────────────────────────────────────── */}
        <TabsContent value="cluster">
          <ClusterTab
            clusterTasks={state.clusterTasks}
            pendingClusterCount={pendingClusterCount}
            activeClusterCount={activeClusterCount}
            completedClusterCount={completedClusterCount}
            clusterCols={clusterCols}
            getProductName={helpers.productName}
          />
        </TabsContent>

        {/* ── Put-to-store ─────────────────────────────────────────────────── */}
        <TabsContent value="put-to-store">
          <PutToStoreTab
            putToStoreTasks={state.putToStoreTasks}
            pendingPtsCount={pendingPtsCount}
            activePtsCount={activePtsCount}
            completedPtsCount={completedPtsCount}
            totalPtsUnits={totalPtsUnits}
            putToStoreCols={putToStoreCols}
            getProductName={helpers.productName}
          />
        </TabsContent>
      </Tabs>

      {/* ── Pick dialog ────────────────────────────────────────────────────── */}
      <Dialog
        open={!!pickDialog.data}
        onOpenChange={(o) => {
          if (!o) pickDialog.close()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar picking</DialogTitle>
          </DialogHeader>
          {pickDialog.data && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/40 space-y-1 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground">
                  Tarea:{' '}
                  <span className="text-foreground font-mono font-semibold">
                    {pickDialog.data.code}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Producto:{' '}
                  <span className="text-foreground font-medium">{pickDialog.data.productName}</span>
                </p>
                <p className="text-muted-foreground">
                  Ubicación:{' '}
                  <span className="text-foreground font-mono">{pickDialog.data.locationCode}</span>
                </p>
                <p className="text-muted-foreground">
                  Solicitado:{' '}
                  <span className="text-foreground font-medium">
                    {pickDialog.data.requestedQuantity} uds
                  </span>
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pick-qty">Cantidad pickeada</Label>
                <Input
                  id="pick-qty"
                  type="number"
                  min={0}
                  max={pickDialog.data.requestedQuantity}
                  value={pickedQty}
                  onChange={(e) => setPickedQty(e.target.value)}
                />
              </div>
              {pickDialog.data.requiresSerial && (
                <div className="space-y-1">
                  <Label htmlFor="pick-serial" className="flex items-center gap-1">
                    <Hash className="size-3" /> Serial del producto
                    <span className="text-destructive ml-0.5">*</span>
                  </Label>
                  <Input
                    id="pick-serial"
                    placeholder="Escanear o ingresar serial…"
                    value={capturedSerial}
                    onChange={(e) => setCapturedSerial(e.target.value)}
                    className="font-mono"
                  />
                </div>
              )}
              {parseInt(pickedQty, 10) < (pickDialog.data?.requestedQuantity ?? 0) &&
                pickedQty !== '' && (
                  <div className="space-y-1">
                    <Label htmlFor="pick-reason">Motivo picking parcial</Label>
                    <Select value={reasonId} onValueChange={setReasonId}>
                      <SelectTrigger id="pick-reason" className="w-full">
                        <SelectValue placeholder="Seleccionar motivo…" />
                      </SelectTrigger>
                      <SelectContent>
                        {partialReasons.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              {pickDialog.error && (
                <p className="text-destructive flex items-center gap-1 text-sm">
                  <TriangleAlert className="size-3" /> {pickDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={pickDialog.close}>
              Cancelar
            </Button>
            <Button onClick={handleCompletePick}>
              <CheckCircle2 className="mr-1 size-4" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Release wave dialog ────────────────────────────────────────────── */}
      <Dialog
        open={!!releaseDialog.data}
        onOpenChange={(o) => {
          if (!o) releaseDialog.close()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Liberar oleada</DialogTitle>
          </DialogHeader>
          {releaseDialog.data && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/40 space-y-1 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground">
                  Oleada:{' '}
                  <span className="text-foreground font-mono font-semibold">
                    {releaseDialog.data.code}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Nombre:{' '}
                  <span className="text-foreground font-medium">{releaseDialog.data.name}</span>
                </p>
                <p className="text-muted-foreground">
                  Pedidos:{' '}
                  <span className="text-foreground font-medium">
                    {releaseDialog.data.orderCount}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Unidades:{' '}
                  <span className="text-foreground font-medium">
                    {releaseDialog.data.unitCount}
                  </span>
                </p>
              </div>
              <p className="text-muted-foreground text-sm">
                Liberar cambiará el estado a <strong>En progreso</strong> y habilitará las tareas
                asociadas.
              </p>
              {releaseDialog.error && (
                <p className="text-destructive flex items-center gap-1 text-sm">
                  <TriangleAlert className="size-3" /> {releaseDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={releaseDialog.close}>
              Cancelar
            </Button>
            <Button onClick={handleReleaseWave}>
              <CheckCircle2 className="mr-1 size-4" /> Confirmar liberación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create wave dialog ─────────────────────────────────────────────── */}
      <Dialog
        open={createWaveOpen}
        onOpenChange={(o) => {
          setCreateWaveOpen(o)
          if (!o) setWaveFormError('')
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="size-4" /> Crear oleada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="wave-name">Nombre *</Label>
              <Input
                id="wave-name"
                placeholder="Ej: Oleada tarde zona B"
                value={waveForm.name}
                onChange={(e) => setWaveForm({ ...waveForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Agrupación</Label>
                <Select
                  value={waveForm.groupBy}
                  onValueChange={(v) =>
                    setWaveForm({ ...waveForm, groupBy: v as PickingWave['groupBy'] })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GROUP_BY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="wave-gv">Valor de agrupación *</Label>
                <Input
                  id="wave-gv"
                  placeholder="Ej: A, ecommerce…"
                  value={waveForm.groupValue}
                  onChange={(e) => setWaveForm({ ...waveForm, groupValue: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Prioridad</Label>
                <Select
                  value={waveForm.priority}
                  onValueChange={(v) =>
                    setWaveForm({ ...waveForm, priority: v as PickingWave['priority'] })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="low">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="wave-team">Equipo asignado</Label>
                <Input
                  id="wave-team"
                  placeholder="Ej: Equipo 2"
                  value={waveForm.assignedTeam}
                  onChange={(e) => setWaveForm({ ...waveForm, assignedTeam: e.target.value })}
                />
              </div>
            </div>
            {waveFormError && (
              <p className="text-destructive flex items-center gap-1 text-sm">
                <TriangleAlert className="size-3" /> {waveFormError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateWaveOpen(false)
                setWaveFormError('')
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreateWave}>
              <Plus className="mr-1 size-4" /> Crear oleada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create waveless dialog ─────────────────────────────────────────── */}
      <Dialog
        open={!!createWlDialog.data}
        onOpenChange={(o) => {
          if (!o) createWlDialog.close()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="size-4" /> Agregar pedido waveless
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Pedido</Label>
              {eligibleOrders.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No hay pedidos pendientes disponibles.
                </p>
              ) : (
                <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar pedido…" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleOrders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.orderNumber} — {o.customerName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <Label>Prioridad</Label>
              <Select
                value={wlPriority}
                onValueChange={(v) => setWlPriority(v as WavelessOrder['priority'])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {createWlDialog.error && (
              <p className="text-destructive flex items-center gap-1 text-sm">
                <TriangleAlert className="size-3" /> {createWlDialog.error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={createWlDialog.close}>
              Cancelar
            </Button>
            <Button onClick={handleCreateWl} disabled={eligibleOrders.length === 0}>
              <CheckCircle2 className="mr-1 size-4" /> Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Batch pick dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={!!batchPickDialog.data}
        onOpenChange={(o) => {
          if (!o) batchPickDialog.close()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar batch picking</DialogTitle>
          </DialogHeader>
          {batchPickDialog.data && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/40 space-y-1 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground">
                  Lote:{' '}
                  <span className="text-foreground font-mono font-semibold">
                    {batchPickDialog.data.code}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Producto:{' '}
                  <span className="text-foreground font-medium">
                    {batchPickDialog.data.productName}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Ubicación:{' '}
                  <span className="text-foreground font-mono">
                    {batchPickDialog.data.locationCode}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Pedidos agrupados:{' '}
                  <span className="text-foreground font-medium">
                    {batchPickDialog.data.ordersCount}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Total solicitado:{' '}
                  <span className="text-foreground font-medium">
                    {batchPickDialog.data.totalRequested} uds
                  </span>
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="batch-qty">Cantidad recogida</Label>
                <Input
                  id="batch-qty"
                  type="number"
                  min={0}
                  max={batchPickDialog.data.totalRequested}
                  value={batchPickedQty}
                  onChange={(e) => setBatchPickedQty(e.target.value)}
                />
              </div>
              {batchPickDialog.error && (
                <p className="text-destructive flex items-center gap-1 text-sm">
                  <TriangleAlert className="size-3" /> {batchPickDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={batchPickDialog.close}>
              Cancelar
            </Button>
            <Button onClick={handleCompleteBatch}>
              <CheckCircle2 className="mr-1 size-4" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Deposit cluster dialog ─────────────────────────────────────────── */}
      <Dialog
        open={!!depositDialog.data}
        onOpenChange={(o) => {
          if (!o) depositDialog.close()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Depositar en contenedor</DialogTitle>
          </DialogHeader>
          {activeCluster && (
            <div className="space-y-4 py-2">
              <p className="text-muted-foreground text-sm">
                Cluster:{' '}
                <span className="text-foreground font-mono font-semibold">
                  {depositDialog.data?.clusterCode}
                </span>
              </p>
              <div className="space-y-1">
                <Label>Contenedor (pedido)</Label>
                <div className="grid gap-2">
                  {activeCluster.slots.map((slot) => (
                    <button
                      key={slot.orderId}
                      type="button"
                      onClick={() => {
                        setSelectedClusterOrderId(slot.orderId)
                        setSelectedProductId('')
                      }}
                      className={cn(
                        'flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors',
                        selectedClusterOrderId === slot.orderId
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-border hover:bg-muted/40'
                      )}
                    >
                      <span className="font-medium">{slot.containerLabel}</span>
                      <span className="text-muted-foreground">{slot.orderNumber}</span>
                      {slot.completed && <CheckCircle2 className="size-3 text-green-600" />}
                    </button>
                  ))}
                </div>
              </div>
              {selectedClusterOrderId && slotItems.length > 0 && (
                <div className="space-y-1">
                  <Label>Producto</Label>
                  <div className="grid gap-2">
                    {slotItems.map((item) => (
                      <button
                        key={item.productId}
                        type="button"
                        onClick={() => setSelectedProductId(item.productId)}
                        className={cn(
                          'flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors',
                          selectedProductId === item.productId
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-border hover:bg-muted/40'
                        )}
                      >
                        <span>{helpers.productName(item.productId)}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {item.deposited}/{item.requested} uds
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {selectedProductId && (
                <div className="space-y-1">
                  <Label htmlFor="deposit-qty">Cantidad a depositar</Label>
                  <Input
                    id="deposit-qty"
                    type="number"
                    min={1}
                    value={depositQty}
                    onChange={(e) => setDepositQty(e.target.value)}
                  />
                </div>
              )}
              {depositDialog.error && (
                <p className="text-destructive flex items-center gap-1 text-sm">
                  <TriangleAlert className="size-3" /> {depositDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={depositDialog.close}>
              Cancelar
            </Button>
            {activeCluster && clusterProgress(activeCluster) === 100 ? (
              <Button onClick={handleCompleteCluster}>
                <CheckCircle2 className="mr-1 size-4" /> Completar cluster
              </Button>
            ) : (
              <Button
                onClick={handleDeposit}
                disabled={!selectedClusterOrderId || !selectedProductId}
              >
                <ShoppingCart className="mr-1 size-4" /> Depositar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Distribute PTS dialog ──────────────────────────────────────────── */}
      <Dialog
        open={!!distributeDialog.data}
        onOpenChange={(o) => {
          if (!o) distributeDialog.close()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-4" /> Distribuir a tiendas
            </DialogTitle>
          </DialogHeader>
          {activeDistTask && distributeDialog.data && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/40 space-y-1 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground">
                  Tarea:{' '}
                  <span className="text-foreground font-mono font-semibold">
                    {distributeDialog.data.taskCode}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Producto:{' '}
                  <span className="text-foreground font-medium">
                    {distributeDialog.data.productName}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Total disponible:{' '}
                  <span className="text-foreground font-medium">
                    {distributeDialog.data.totalPicked} uds
                  </span>
                </p>
              </div>
              <div className="space-y-3">
                {activeDistTask.allocations.map((alloc) => {
                  const remaining = alloc.requestedQuantity - alloc.distributedQuantity
                  const done = remaining <= 0
                  return (
                    <div key={alloc.storeId} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{alloc.storeName}</span>
                        <span
                          className={cn(
                            'text-xs tabular-nums',
                            done ? 'text-green-700' : 'text-muted-foreground'
                          )}
                        >
                          {alloc.distributedQuantity}/{alloc.requestedQuantity} uds{done && ' ✓'}
                        </span>
                      </div>
                      {!done && (
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={remaining}
                            placeholder={`Máx: ${remaining}`}
                            value={qtyInputs[alloc.storeId] ?? ''}
                            onChange={(e) =>
                              setQtyInputs((prev) => ({ ...prev, [alloc.storeId]: e.target.value }))
                            }
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDistributeToStore(alloc.storeId)}
                          >
                            OK
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {distributeDialog.error && (
                <p className="text-destructive flex items-center gap-1 text-sm">
                  <TriangleAlert className="size-3" /> {distributeDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={distributeDialog.close}>
              Cerrar
            </Button>
            <Button
              onClick={handleCompletePts}
              disabled={
                !activeDistTask ||
                !activeDistTask.allocations.every(
                  (a) => a.distributedQuantity >= a.requestedQuantity
                )
              }
            >
              <CheckCircle2 className="mr-1 size-4" /> Completar distribución
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default PickingPage
