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
  MapPin,
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
import { KpiCard } from '@/components/shared/kpi-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatNumber } from '@/lib/formatters'
import { TabPanel } from '@/app/receiving/_components/tab-panel'
import { EmptyState } from '@/app/receiving/_components/empty-state'
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
          <TabPanel
            icon={ClipboardList}
            iconClass="text-amber-500"
            title="Tareas de picking"
            description="Tareas individuales asignadas a operadores. Inicia, registra la cantidad pickeada y aprueba o rechaza parciales."
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <KpiCard
                icon={ClipboardList}
                value={pendingTaskCount}
                label="Pendientes / asignadas"
                sublabel="Por iniciar o en espera"
                tone="amber"
              />
              <KpiCard
                icon={Package}
                value={partialTaskCount}
                label="Picking parcial"
                sublabel="Requieren aprobación o reintento"
                tone="blue"
              />
              <KpiCard
                icon={CheckCircle2}
                value={completedTaskCount}
                label="Completadas"
                sublabel="Finalizadas en esta sesión"
                tone="green"
              />
            </div>
            {state.pickingTasks.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Sin tareas de picking"
                description="Las tareas generadas por oleadas o pedidos waveless aparecerán aquí."
              />
            ) : (
              <DataTable
                columns={taskCols}
                data={filteredTasks}
                searchColumn="code"
                searchPlaceholder="Buscar por código o producto…"
                emptyMessage="Sin tareas para el filtro seleccionado."
                filters={
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="assigned">Asignada</SelectItem>
                      <SelectItem value="in_progress">En progreso</SelectItem>
                      <SelectItem value="partially_picked">Parcialmente pickeada</SelectItem>
                      <SelectItem value="partial_with_shortage">Parcial c/faltante</SelectItem>
                      <SelectItem value="partial_approved">Parcial aprobada</SelectItem>
                      <SelectItem value="partial_rejected">Parcial rechazada</SelectItem>
                      <SelectItem value="completed">Completada</SelectItem>
                      <SelectItem value="with_issue">Con incidencia</SelectItem>
                    </SelectContent>
                  </Select>
                }
              />
            )}
          </TabPanel>
        </TabsContent>

        {/* ── Oleadas ─────────────────────────────────────────────────────── */}
        <TabsContent value="waves">
          <TabPanel
            icon={Waves}
            iconClass="text-blue-500"
            title="Oleadas de picking"
            description="Agrupa pedidos en oleadas para optimizar rutas. Libera una oleada para habilitar las tareas asociadas."
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <KpiCard
                icon={Waves}
                value={activeWaveCount}
                label="Oleadas activas"
                sublabel="En progreso ahora"
                tone="blue"
              />
              <KpiCard
                icon={Layers}
                value={draftWaveCount}
                label="En borrador"
                sublabel="Pendientes de liberar"
                tone="amber"
              />
              <KpiCard
                icon={Package}
                value={waveActiveUnits}
                label="Unidades en oleadas activas"
                sublabel="Suma de todas en progreso"
                tone="neutral"
              />
            </div>
            {state.pickingWaves.length === 0 ? (
              <EmptyState
                icon={Waves}
                title="Sin oleadas registradas"
                description="Crea una oleada para agrupar pedidos pendientes y optimizar el picking."
              />
            ) : (
              <DataTable
                columns={waveCols}
                data={state.pickingWaves}
                searchColumn="name"
                searchPlaceholder="Buscar oleada…"
                emptyMessage="No hay oleadas registradas."
                actions={
                  <Button onClick={() => setCreateWaveOpen(true)}>
                    <Plus className="mr-1 size-4" /> Nueva oleada
                  </Button>
                }
              />
            )}
            {state.pickingWaves.length > 0 && (
              <div className="mt-4 flex justify-end">
                <Button onClick={() => setCreateWaveOpen(true)}>
                  <Plus className="mr-1 size-4" /> Nueva oleada
                </Button>
              </div>
            )}

            {state.pickingWaves
              .filter((w) => w.status === 'in_progress')
              .map((wave) => (
                <Card key={wave.id} className="mt-4">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Waves className="size-4 text-blue-600" />
                      {wave.code} — {wave.name}
                      <Badge variant="secondary" className="ml-2">
                        En progreso
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Canal</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Líneas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {wave.orderIds.map((oid) => {
                          const order = state.commerceOrders.find((o) => o.id === oid)
                          if (!order) return null
                          return (
                            <TableRow key={oid}>
                              <TableCell className="font-mono text-xs font-semibold">
                                {order.orderNumber}
                              </TableCell>
                              <TableCell className="text-sm">{order.customerName}</TableCell>
                              <TableCell className="text-muted-foreground text-sm capitalize">
                                {order.channel}
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={order.status} />
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {order.items.length}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
          </TabPanel>
        </TabsContent>

        {/* ── Waveless ────────────────────────────────────────────────────── */}
        <TabsContent value="waveless">
          <TabPanel
            icon={Zap}
            iconClass="text-yellow-500"
            title="Pedidos waveless"
            description="Pedidos VIP o urgentes que se procesan de forma independiente sin esperar a que se forme una oleada."
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <KpiCard
                icon={Zap}
                value={pendingWlCount}
                label="Pendientes"
                sublabel="Sin operador asignado"
                tone="amber"
              />
              <KpiCard
                icon={ClipboardList}
                value={activeWlCount}
                label="En progreso"
                sublabel="Operadores activos"
                tone="blue"
              />
              <KpiCard
                icon={CheckCircle2}
                value={completedWlCount}
                label="Completados"
                sublabel="Finalizados hoy"
                tone="green"
              />
            </div>
            <Card className="mb-4 border-yellow-200 bg-yellow-50">
              <CardContent className="flex items-start gap-3 pt-4">
                <Zap className="mt-0.5 size-4 shrink-0 text-yellow-600" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">¿Cuándo usar waveless?</p>
                  <p className="mt-1 text-yellow-700">
                    Ideal para pedidos VIP, same-day delivery o cualquier pedido urgente que no
                    puede esperar a que se forme una oleada.
                  </p>
                </div>
              </CardContent>
            </Card>
            {state.wavelessOrders.length === 0 ? (
              <EmptyState
                icon={Zap}
                title="Sin pedidos waveless"
                description="Agrega pedidos urgentes para procesarlos de forma independiente."
              />
            ) : (
              <DataTable
                columns={wavelessCols}
                data={state.wavelessOrders}
                searchColumn="orderNumber"
                searchPlaceholder="Buscar pedido…"
                emptyMessage="No hay pedidos waveless."
                actions={
                  <Button onClick={() => createWlDialog.open({ placeholder: true })}>
                    <Plus className="mr-1 size-4" /> Agregar pedido
                  </Button>
                }
              />
            )}
            {state.wavelessOrders.length === 0 && (
              <div className="mt-4 flex justify-end">
                <Button onClick={() => createWlDialog.open({ placeholder: true })}>
                  <Plus className="mr-1 size-4" /> Agregar pedido
                </Button>
              </div>
            )}
          </TabPanel>
        </TabsContent>

        {/* ── Batch ───────────────────────────────────────────────────────── */}
        <TabsContent value="batch">
          <TabPanel
            icon={Package}
            iconClass="text-blue-500"
            title="Batch picking"
            description="Lotes que agrupan el mismo producto de múltiples pedidos. El picker recoge el total en una visita y distribuye en sorting."
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-4">
              <KpiCard
                icon={Package}
                value={pendingBatchCount}
                label="Pendientes"
                sublabel="Sin iniciar"
                tone="amber"
              />
              <KpiCard
                icon={ClipboardList}
                value={activeBatchCount}
                label="En progreso"
                sublabel="En el muelle"
                tone="blue"
              />
              <KpiCard
                icon={CheckCircle2}
                value={completedBatchCount}
                label="Completadas"
                sublabel="Finalizados"
                tone="green"
              />
              <KpiCard
                icon={Layers}
                value={totalBatchUnits}
                label="Unidades totales"
                sublabel="Suma de todos los lotes"
                tone="neutral"
              />
            </div>
            <Card className="mb-4 border-blue-200 bg-blue-50">
              <CardContent className="flex items-start gap-3 pt-4">
                <Package className="mt-0.5 size-4 shrink-0 text-blue-600" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">¿Cómo funciona el batch picking?</p>
                  <p className="mt-1 text-blue-700">
                    Cada lote agrupa tareas del mismo producto y ubicación de múltiples pedidos. El
                    picker recoge el total en una sola visita y luego distribuye en sorting.
                  </p>
                </div>
              </CardContent>
            </Card>
            {state.batchTasks.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Sin lotes de picking"
                description="Los lotes se generan automáticamente al liberar oleadas con estrategia batch."
              />
            ) : (
              <DataTable
                columns={batchCols}
                data={state.batchTasks}
                searchColumn="code"
                searchPlaceholder="Buscar lote…"
                emptyMessage="No hay lotes de picking registrados."
              />
            )}
            {state.batchTasks
              .filter((b) => b.status === 'in_progress')
              .map((batch) => {
                const tasks = state.pickingTasks.filter((t) => batch.pickingTaskIds.includes(t.id))
                if (tasks.length === 0) return null
                return (
                  <Card key={batch.id} className="mt-4">
                    <CardContent className="pt-4">
                      <p className="mb-3 text-sm font-medium">{batch.code} — Pedidos incluidos</p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tarea</TableHead>
                            <TableHead>Pedido</TableHead>
                            <TableHead className="text-right">Solicitado</TableHead>
                            <TableHead>Estado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tasks.map((t) => (
                            <TableRow key={t.id}>
                              <TableCell className="font-mono text-xs font-semibold">
                                {t.code}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {state.commerceOrders.find((o) => o.id === t.orderId)
                                  ?.orderNumber ?? t.orderId}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {t.requestedQuantity}
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={t.status} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )
              })}
          </TabPanel>
        </TabsContent>

        {/* ── Por zona ────────────────────────────────────────────────────── */}
        <TabsContent value="zone">
          <TabPanel
            icon={LayoutGrid}
            iconClass="text-zinc-500"
            title="Picking por zona"
            description="Vista de progreso por zona de almacén. Identifica zonas con tareas pendientes y pedidos listos para consolidar."
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-4">
              <KpiCard
                icon={ClipboardList}
                value={
                  tasksWithZone.filter((t) => t.status === 'pending' || t.status === 'assigned')
                    .length
                }
                label="Tareas pendientes"
                sublabel="Por iniciar o asignar"
                tone="amber"
              />
              <KpiCard
                icon={Package}
                value={tasksWithZone.filter((t) => t.status === 'in_progress').length}
                label="En progreso"
                sublabel="Siendo pickeadas"
                tone="blue"
              />
              <KpiCard
                icon={MapPin}
                value={zones.length}
                label="Zonas activas"
                sublabel="Con al menos una tarea"
                tone="neutral"
              />
              <KpiCard
                icon={CheckCircle2}
                value={consolidationCount}
                label="Listos p/ consolidar"
                sublabel="Todos los items recogidos"
                tone="green"
              />
            </div>

            {consolidationCount > 0 && (
              <Card className="mb-4 border-green-300 bg-green-50">
                <CardContent className="flex items-start gap-3 pt-4">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-700" />
                  <div className="text-sm text-green-800">
                    <p className="font-medium">
                      {consolidationCount} pedido(s) listo(s) para consolidar
                    </p>
                    <p className="mt-1 text-green-700">
                      Todos los ítems han sido recogidos. Trasládalos al área de staging para
                      empaque.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {zoneStats.map(({ zone, completed, total, totalUnits, pickedUnits, operators }) => {
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0
                return (
                  <Card key={zone}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <MapPin className="size-4" /> Zona {zone}
                        </span>
                        <Badge variant="outline" className={cn('text-xs', ZONE_COLORS[zone] ?? '')}>
                          {completed}/{total} tareas
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Progress value={pct} className="h-2" />
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Unidades</p>
                          <p className="font-medium tabular-nums">
                            {formatNumber(pickedUnits)}/{formatNumber(totalUnits)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Operadores</p>
                          <p className="text-xs font-medium">
                            {operators.length > 0 ? operators.join(', ') : '—'}
                          </p>
                        </div>
                      </div>
                      {pct === 100 && (
                        <div className="flex items-center gap-1 text-xs text-green-700">
                          <CheckCircle2 className="size-3" /> Zona completada
                        </div>
                      )}
                      {pct > 0 && pct < 100 && (
                        <div className="flex items-center gap-1 text-xs text-amber-700">
                          <TriangleAlert className="size-3" /> {total - completed} tarea(s)
                          pendiente(s)
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {tasksWithZone.length === 0 ? (
              <EmptyState
                icon={LayoutGrid}
                title="Sin tareas por zona"
                description="Las tareas de picking aparecerán organizadas por zona cuando sean generadas."
              />
            ) : (
              <DataTable
                columns={zoneCols}
                data={tasksWithZone}
                searchColumn="code"
                searchPlaceholder="Buscar tarea…"
                emptyMessage="No hay tareas de picking."
              />
            )}
          </TabPanel>
        </TabsContent>

        {/* ── Cluster ─────────────────────────────────────────────────────── */}
        <TabsContent value="cluster">
          <TabPanel
            icon={ShoppingCart}
            iconClass="text-purple-500"
            title="Cluster picking"
            description="El picker sale con un carrito con N contenedores. Al llegar a cada ubicación deposita las unidades en el contenedor correcto."
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <KpiCard
                icon={ShoppingCart}
                value={pendingClusterCount}
                label="Clusters pendientes"
                sublabel="Sin iniciar"
                tone="amber"
              />
              <KpiCard
                icon={ClipboardList}
                value={activeClusterCount}
                label="En progreso"
                sublabel="Operadores activos"
                tone="blue"
              />
              <KpiCard
                icon={CheckCircle2}
                value={completedClusterCount}
                label="Completados"
                sublabel="Clusters finalizados"
                tone="green"
              />
            </div>
            <Card className="mb-4 border-purple-200 bg-purple-50">
              <CardContent className="flex items-start gap-3 pt-4">
                <ShoppingCart className="mt-0.5 size-4 shrink-0 text-purple-600" />
                <div className="text-sm text-purple-800">
                  <p className="font-medium">¿Cómo funciona el cluster picking?</p>
                  <p className="mt-1 text-purple-700">
                    El picker sale con un carrito con N contenedores (uno por pedido). Al llegar a
                    cada ubicación deposita las unidades en el contenedor correcto.
                  </p>
                </div>
              </CardContent>
            </Card>
            {state.clusterTasks.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="Sin clusters registrados"
                description="Los clusters se generan al liberar oleadas con estrategia de cluster picking."
              />
            ) : (
              <DataTable
                columns={clusterCols}
                data={state.clusterTasks}
                searchColumn="code"
                searchPlaceholder="Buscar cluster…"
                emptyMessage="No hay clusters registrados."
              />
            )}
            {state.clusterTasks
              .filter((c) => c.status === 'in_progress')
              .map((cluster) => (
                <Card key={cluster.id} className="mt-4">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <ShoppingCart className="size-4 text-blue-600" />
                        {cluster.code} — {cluster.operatorName ?? 'Sin operador'}
                      </span>
                      <Badge variant="secondary">{clusterProgress(cluster)}% completado</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {cluster.slots.map((slot) => {
                        const slotTotal = slot.items.reduce((s, i) => s + i.requested, 0)
                        const slotDeposited = slot.items.reduce((s, i) => s + i.deposited, 0)
                        const slotPct =
                          slotTotal > 0 ? Math.round((slotDeposited / slotTotal) * 100) : 0
                        return (
                          <div
                            key={slot.orderId}
                            className={cn(
                              'space-y-2 rounded-lg border p-3',
                              slot.completed ? 'border-green-300 bg-green-50' : 'border-border'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{slot.containerLabel}</span>
                              <Badge variant="outline" className="text-xs">
                                {slot.orderNumber}
                              </Badge>
                            </div>
                            <Progress value={slotPct} className="h-1.5" />
                            <div className="space-y-1">
                              {slot.items.map((item) => (
                                <div key={item.productId} className="flex justify-between text-xs">
                                  <span className="text-muted-foreground max-w-30 truncate">
                                    {helpers.productName(item.productId)}
                                  </span>
                                  <span
                                    className={cn(
                                      'font-medium tabular-nums',
                                      item.deposited >= item.requested && 'text-green-700'
                                    )}
                                  >
                                    {item.deposited}/{item.requested}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {slot.completed && (
                              <div className="flex items-center gap-1 text-xs text-green-700">
                                <CheckCircle2 className="size-3" /> Contenedor completo
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </TabPanel>
        </TabsContent>

        {/* ── Put-to-store ─────────────────────────────────────────────────── */}
        <TabsContent value="put-to-store">
          <TabPanel
            icon={Store}
            iconClass="text-teal-500"
            title="Put-to-store"
            description="Se recoge el total de un SKU y luego se distribuye a cada tienda según su cuota. Reduce el tiempo de picking en 40-60% para reposiciones."
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-4">
              <KpiCard
                icon={Store}
                value={pendingPtsCount}
                label="Pendientes"
                sublabel="Sin iniciar"
                tone="amber"
              />
              <KpiCard
                icon={Building2}
                value={activePtsCount}
                label="En distribución"
                sublabel="Asignando a tiendas"
                tone="blue"
              />
              <KpiCard
                icon={CheckCircle2}
                value={completedPtsCount}
                label="Completadas"
                sublabel="Distribución finalizada"
                tone="green"
              />
              <KpiCard
                icon={Package}
                value={totalPtsUnits}
                label="Unidades totales"
                sublabel="Suma de todas las tareas"
                tone="neutral"
              />
            </div>
            <Card className="mb-4 border-teal-200 bg-teal-50">
              <CardContent className="flex items-start gap-3 pt-4">
                <Store className="mt-0.5 size-4 shrink-0 text-teal-600" />
                <div className="text-sm text-teal-800">
                  <p className="font-medium">¿Cómo funciona put-to-store?</p>
                  <p className="mt-1 text-teal-700">
                    Se recoge el total de un SKU (ej: 180 pares de medias) y luego se distribuye a
                    cada tienda según su cuota. Reduce el tiempo en 40-60%.
                  </p>
                </div>
              </CardContent>
            </Card>
            {state.putToStoreTasks.length === 0 ? (
              <EmptyState
                icon={Store}
                title="Sin tareas put-to-store"
                description="Las tareas de distribución a tiendas aparecerán aquí al ser generadas."
              />
            ) : (
              <DataTable
                columns={putToStoreCols}
                data={state.putToStoreTasks}
                searchColumn="code"
                searchPlaceholder="Buscar tarea PTS…"
                emptyMessage="No hay tareas put-to-store registradas."
              />
            )}
            {state.putToStoreTasks
              .filter((t) => t.status === 'in_progress')
              .map((task) => {
                const totalDistributed = task.allocations.reduce(
                  (s, a) => s + a.distributedQuantity,
                  0
                )
                const totalRequested = task.allocations.reduce((s, a) => s + a.requestedQuantity, 0)
                const globalPct =
                  totalRequested > 0 ? Math.round((totalDistributed / totalRequested) * 100) : 0
                return (
                  <Card key={task.id} className="mt-4">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Building2 className="size-4 text-blue-600" />
                          {task.code} — {helpers.productName(task.productId)}
                        </span>
                        <Badge variant="secondary">{globalPct}% distribuido</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Progress value={globalPct} className="mb-4 h-2" />
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {task.allocations.map((alloc) => {
                          const allocPct =
                            alloc.requestedQuantity > 0
                              ? Math.round(
                                  (alloc.distributedQuantity / alloc.requestedQuantity) * 100
                                )
                              : 0
                          return (
                            <div
                              key={alloc.storeId}
                              className={cn(
                                'space-y-2 rounded-lg border p-3',
                                allocPct === 100 ? 'border-green-300 bg-green-50' : 'border-border'
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className="truncate text-sm font-medium">
                                  {alloc.storeName}
                                </span>
                                {allocPct === 100 && (
                                  <CheckCircle2 className="size-3 text-green-600" />
                                )}
                              </div>
                              <Progress value={allocPct} className="h-1.5" />
                              <p className="text-muted-foreground text-xs tabular-nums">
                                {formatNumber(alloc.distributedQuantity)} /{' '}
                                {formatNumber(alloc.requestedQuantity)} uds
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
          </TabPanel>
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
