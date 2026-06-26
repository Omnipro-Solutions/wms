'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FlaskConical,
  GitMerge,
  Grid3x3,
  History,
  MoveRight,
  PackageCheck,
  Plus,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import {
  selectSlottingRecommendations,
  selectSlottingImpact,
  selectReplenishmentNeeds,
  selectAffinityRecommendations,
  selectSlottingTrends,
  simulateRelocateAll,
  abcByProduct,
  xyzByProduct,
  misplacedAClassItems,
} from '@/store/selectors'
import type { SimulationSummary } from '@/store/selectors'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { useDialogState } from '@/hooks/use-dialog-state'
import { demandCv, validateRelocation } from '@/lib/rules/slotting'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SubNav, type SubNavItem } from '@/components/shared/sub-nav'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/formatters'
import type { AbcClass, XyzClass, SlottingRecommendation } from '@/types/wms'
import { DataTable } from '@/components/data-table'
import { EmptyState } from './_components/empty-state'
import { TabPanel } from './_components/tab-panel'
import {
  buildOptimizationColumns,
  buildClassificationColumns,
  buildReplenishmentColumns,
  buildAffinityColumns,
  buildHistoryColumns,
  buildSimulationColumns,
  type OptimizationRow,
  type ClassificationRow,
  type ReplenishmentRow,
  type AffinityRow,
  type HistoryRow,
} from './columns'

// ─── local types ──────────────────────────────────────────────────────────────

type TabValue = 'optimization' | 'classification' | 'replenishment' | 'affinity' | 'history'

interface RelocateDialogData {
  itemId: string
  toLocationId: string
  productName: string
  fromCode: string
  toCode: string
  warnings: string[]
  errors: string[]
}

// ─── component ────────────────────────────────────────────────────────────────

const SlottingPage = () => {
  const state = useWmsStore()
  const {
    relocateInventory,
    startReplenishment,
    completeReplenishment,
    generateReplenishmentTasks,
    relocateAll,
    captureSlottingSnapshot,
  } = useWmsStore()
  const { productName, locationCode } = useStoreHelpers()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeTab = (searchParams.get('tab') as TabValue) ?? 'optimization'

  const SLOTTING_TABS: SubNavItem[] = [
    { value: 'optimization', label: 'Recomendaciones' },
    { value: 'classification', label: 'Clasificación ABC/XYZ' },
    { value: 'replenishment', label: 'Reposición' },
    { value: 'affinity', label: 'Afinidad' },
    { value: 'history', label: 'Historial' },
  ]

  const abc = useMemo(() => abcByProduct(state), [state])
  const xyz = useMemo(() => xyzByProduct(state), [state])
  const recommendations = useMemo(() => selectSlottingRecommendations(state), [state])
  const misplaced = useMemo(() => misplacedAClassItems(state), [state])
  const replenishmentNeeds = useMemo(() => selectReplenishmentNeeds(state), [state])
  const affinityRecs = useMemo(() => selectAffinityRecommendations(state), [state])
  const trends = useMemo(() => selectSlottingTrends(state), [state])

  const relocateDialog = useDialogState<RelocateDialogData>()
  const [relocated, setRelocated] = useState<Set<string>>(new Set())
  const [abcFilter, setAbcFilter] = useState<string>('all')
  const [xyzFilter, setXyzFilter] = useState<string>('all')
  const [generating, setGenerating] = useState(false)
  const [lastGenerated, setLastGenerated] = useState(0)
  const [simulation, setSimulation] = useState<SimulationSummary | null>(null)
  const [applyingAll, setApplyingAll] = useState(false)
  const [snapshotLabel, setSnapshotLabel] = useState('')
  const [capturingSnapshot, setCapturingSnapshot] = useState(false)

  const activeRecs = useMemo(
    () =>
      recommendations.filter((r) => {
        const item = state.inventoryItems.find(
          (i) => i.productId === r.productId && i.locationId === r.currentLocationId
        )
        return item && !relocated.has(item.id)
      }),
    [recommendations, state.inventoryItems, relocated]
  )

  const impact = useMemo(() => selectSlottingImpact(state, activeRecs), [state, activeRecs])

  const pendingReplenishment = useMemo(
    () =>
      state.replenishmentTasks.filter((t) => t.status === 'pending' || t.status === 'assigned')
        .length,
    [state.replenishmentTasks]
  )

  const affinityPending = useMemo(
    () => affinityRecs.filter((r) => !r.isAlreadyClose),
    [affinityRecs]
  )

  // ── derived table rows ────────────────────────────────────────────────────

  const optimizationRows = useMemo<OptimizationRow[]>(
    () =>
      activeRecs.map((rec) => {
        const product = state.products.find((p) => p.id === rec.productId)
        const srcLoc = state.locations.find((l) => l.id === rec.currentLocationId)
        const destLoc = state.locations.find((l) => l.id === rec.suggestedLocationId)
        return {
          id: rec.id,
          productId: rec.productId,
          productName: productName(rec.productId),
          productImageUrl: product?.imageUrl ?? null,
          recommendationHint: rec.recommendation.split('—')[1]?.trim() ?? '',
          abcClass: rec.abcClass,
          xyzClass: rec.xyzClass,
          currentLocationId: rec.currentLocationId,
          currentLocationCode: locationCode(rec.currentLocationId),
          currentLocationGolden: srcLoc?.golden ?? false,
          suggestedLocationId: rec.suggestedLocationId,
          suggestedLocationCode: locationCode(rec.suggestedLocationId),
          suggestedLocationGolden: destLoc?.golden ?? false,
          suggestedLocationIsPickFace: destLoc?.isPickFace ?? false,
          score: rec.score,
          estimatedDistanceSavedM: rec.estimatedDistanceSavedM,
          estimatedTimeSavedSeconds: rec.estimatedTimeSavedSeconds,
          rec,
        }
      }),
    [activeRecs, state.products, state.locations, productName, locationCode]
  )

  const filteredDemandStats = useMemo(
    () =>
      state.demandStats
        .slice()
        .sort((a, b) => b.pickingFrequency - a.pickingFrequency)
        .filter((d) => {
          const a = abc[d.productId] ?? 'C'
          const x = xyz[d.productId] ?? 'Z'
          if (abcFilter !== 'all' && a !== abcFilter) return false
          if (xyzFilter !== 'all' && x !== xyzFilter) return false
          return true
        }),
    [state.demandStats, abc, xyz, abcFilter, xyzFilter]
  )

  const classificationRows = useMemo<ClassificationRow[]>(
    () =>
      filteredDemandStats.map((d) => {
        const product = state.products.find((p) => p.id === d.productId)
        const abcClass: AbcClass = abc[d.productId] ?? 'C'
        const xyzClass: XyzClass = xyz[d.productId] ?? 'Z'
        const item = state.inventoryItems.find((i) => i.productId === d.productId)
        const loc = item ? state.locations.find((l) => l.id === item.locationId) : null
        return {
          productId: d.productId,
          productName: product?.name ?? d.productId,
          productSku: product?.sku ?? '',
          productImageUrl: product?.imageUrl ?? null,
          abcClass,
          xyzClass,
          unitsSold: d.unitsSold,
          pickingFrequency: d.pickingFrequency,
          cv: demandCv(d.demandSamples),
          locationCode: loc?.code ?? null,
          locationGolden: loc?.golden ?? false,
          locationIsPickFace: loc?.isPickFace ?? false,
        }
      }),
    [filteredDemandStats, state.products, state.inventoryItems, state.locations, abc, xyz]
  )

  const replenishmentRows = useMemo<ReplenishmentRow[]>(
    () =>
      state.replenishmentTasks
        .slice()
        .sort(
          (a, b) =>
            (({ high: 0, medium: 1, low: 2 })[a.priority] ?? 2) -
            ({ high: 0, medium: 1, low: 2 }[b.priority] ?? 2)
        )
        .map((task) => {
          const product = state.products.find((p) => p.id === task.productId)
          const abcClass: AbcClass = abc[task.productId] ?? 'C'
          const coveragePct =
            task.minStock > 0
              ? Math.min(100, Math.round((task.currentStock / task.minStock) * 100))
              : 100
          return {
            id: task.id,
            productId: task.productId,
            productName: productName(task.productId),
            productImageUrl: product?.imageUrl ?? null,
            abcClass,
            originLocationCode: locationCode(task.originLocationId),
            destinationLocationCode: locationCode(task.destinationLocationId),
            currentStock: task.currentStock,
            minStock: task.minStock,
            suggestedQuantity: task.suggestedQuantity,
            priority: task.priority,
            status: task.status,
            operatorName: task.operatorName ?? null,
            isCritical: coveragePct < 30,
          }
        }),
    [state.replenishmentTasks, state.products, abc, productName, locationCode]
  )

  const affinityRows = useMemo<AffinityRow[]>(
    () =>
      affinityRecs.map((rec) => ({
        key: `${rec.pair.productA}|${rec.pair.productB}`,
        productNameA: rec.productNameA,
        locationCodeA: rec.locationCodeA,
        productNameB: rec.productNameB,
        locationCodeB: rec.locationCodeB,
        coOccurrences: rec.pair.coOccurrences,
        liftScore: rec.pair.liftScore,
        proximityScore: rec.pair.proximityScore,
        isAlreadyClose: rec.isAlreadyClose,
      })),
    [affinityRecs]
  )

  const historyRows = useMemo<HistoryRow[]>(() => {
    const reversed = [...state.slottingSnapshots].reverse()
    return reversed.map((snap, idx) => {
      const prev = reversed[idx + 1]
      return {
        id: snap.id,
        index: state.slottingSnapshots.length - idx,
        label: snap.label,
        capturedAt: snap.capturedAt,
        isLatest: idx === 0,
        misplacedAClassCount: snap.misplacedAClassCount,
        misplacedImproved: prev ? snap.misplacedAClassCount < prev.misplacedAClassCount : false,
        misplacedWorse: prev ? snap.misplacedAClassCount > prev.misplacedAClassCount : false,
        relocationsAvailable: snap.relocationsAvailable,
        totalDistanceSavedM: snap.totalDistanceSavedM,
        totalTimeSavedMin: snap.totalTimeSavedMin,
        aToGoldenCount: snap.aToGoldenCount,
        czInGoldenCount: snap.czInGoldenCount,
        pendingReplenishment: snap.pendingReplenishment,
        affinityPairsNeedingAction: snap.affinityPairsNeedingAction,
      }
    })
  }, [state.slottingSnapshots])

  const openRelocateDialog = useCallback(
    (rec: SlottingRecommendation) => {
      const item = state.inventoryItems.find(
        (i) => i.productId === rec.productId && i.locationId === rec.currentLocationId
      )
      if (!item) return
      const product = state.products.find((p) => p.id === rec.productId)
      const destination = state.locations.find((l) => l.id === rec.suggestedLocationId)
      if (!product || !destination) return

      const destinationHasOtherProduct = state.inventoryItems.some(
        (i) =>
          i.locationId === rec.suggestedLocationId &&
          i.productId !== rec.productId &&
          i.onHandQuantity > 0
      )

      const validation = validateRelocation({
        product: { unitWeightKg: product.unitWeightKg, name: product.name },
        destination: {
          code: destination.code,
          isBlocked: destination.isBlocked,
          maxWeightKg: destination.maxWeightKg,
          golden: destination.golden,
          isPickFace: destination.isPickFace,
        },
        abcClass: rec.abcClass,
        xyzClass: rec.xyzClass,
        destinationHasOtherProduct,
      })

      relocateDialog.open({
        itemId: item.id,
        toLocationId: rec.suggestedLocationId,
        productName: productName(rec.productId),
        fromCode: locationCode(rec.currentLocationId),
        toCode: locationCode(rec.suggestedLocationId),
        warnings: validation.warnings,
        errors: validation.errors,
      })
    },
    [state, productName, locationCode, relocateDialog]
  )

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleRelocate = () => {
    if (!relocateDialog.data) return
    if (relocateDialog.data.errors.length > 0) return
    try {
      relocateInventory(
        relocateDialog.data.itemId,
        relocateDialog.data.toLocationId,
        'Operador Slotting'
      )
      setRelocated((prev) => new Set([...prev, relocateDialog.data!.itemId]))
      relocateDialog.close()
    } catch (e: unknown) {
      relocateDialog.setError(e instanceof Error ? e.message : 'Error al reubicar')
    }
  }

  const handleStartReplenishment = useCallback(
    (taskId: string) => {
      try {
        startReplenishment(taskId, 'Operador Slotting')
      } catch {
        /* guard */
      }
    },
    [startReplenishment]
  )

  const handleCompleteReplenishment = useCallback(
    (taskId: string) => {
      try {
        completeReplenishment(taskId)
      } catch {
        /* guard */
      }
    },
    [completeReplenishment]
  )

  // ── memoized columns ──────────────────────────────────────────────────────

  const optimizationCols = useMemo(
    () => buildOptimizationColumns(openRelocateDialog),
    [openRelocateDialog]
  )
  const classificationCols = useMemo(() => buildClassificationColumns(), [])
  const replenishmentCols = useMemo(
    () => buildReplenishmentColumns(handleStartReplenishment, handleCompleteReplenishment),
    [handleStartReplenishment, handleCompleteReplenishment]
  )
  const affinityCols = useMemo(() => buildAffinityColumns(), [])
  const historyCols = useMemo(() => buildHistoryColumns(), [])
  const simulationCols = useMemo(() => buildSimulationColumns(), [])

  const handleGenerateTasks = () => {
    setGenerating(true)
    try {
      const created = generateReplenishmentTasks()
      setLastGenerated(created.length)
    } finally {
      setGenerating(false)
    }
  }

  const handleSimulateAll = () => {
    const summary = simulateRelocateAll(state, activeRecs)
    setSimulation(summary)
  }

  const handleCaptureSnapshot = () => {
    setCapturingSnapshot(true)
    try {
      const label = snapshotLabel.trim() || `Estado ${state.slottingSnapshots.length + 1}`
      captureSlottingSnapshot(label)
      setSnapshotLabel('')
    } finally {
      setCapturingSnapshot(false)
    }
  }

  const handleApplyAll = () => {
    if (!simulation) return
    setApplyingAll(true)
    try {
      const count = relocateAll(activeRecs, 'Slotting Automático')
      setRelocated((prev) => {
        const next = new Set(prev)
        for (const rec of activeRecs) {
          const item = state.inventoryItems.find(
            (i) => i.productId === rec.productId && i.locationId === rec.currentLocationId
          )
          if (item) next.add(item.id)
        }
        return next
      })
      setSimulation(null)
      setLastGenerated(count)
    } finally {
      setApplyingAll(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Slotting — Optimización de ubicaciones"
        description="Clasificación ABC/XYZ en vivo · Recomendaciones con score dinámico · Gestión de reabastecimiento"
      />

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          icon={TriangleAlert}
          value={misplaced.length}
          label="SKUs clase A mal ubicados"
          sublabel="Fuera de golden zone"
          tone="amber"
        />
        <KpiCard
          icon={MoveRight}
          value={impact.relocationsCount}
          label="Reubicaciones sugeridas"
          sublabel="Con impacto positivo en picking"
          tone={impact.relocationsCount > 0 ? 'blue' : 'green'}
        />
        <KpiCard
          icon={Clock}
          value={impact.totalTimeSavedMin}
          label="Min. ahorro estimado/turno"
          sublabel={`${formatNumber(impact.totalDistanceSavedM)} m recorrido menos`}
          tone="green"
        />
        <KpiCard
          icon={PackageCheck}
          value={pendingReplenishment}
          label="Reabastecimientos pendientes"
          sublabel="Pick faces bajo mínimo"
          tone={pendingReplenishment > 0 ? 'red' : 'neutral'}
        />
      </div>

      {/* ── SubNav ── */}
      <SubNav items={SLOTTING_TABS} defaultValue="optimization" />

      {/* ════════ Tab: Optimización ════════ */}
      {activeTab === 'optimization' && (
        <div className="space-y-4">
          <TabPanel
            icon={Zap}
            iconClass="text-blue-500"
            title="Optimización de ubicaciones"
            description="Recomendaciones de reubicación con score dinámico. Los ítems clase A se priorizan hacia la golden zone para reducir el recorrido del picker."
            action={
              activeRecs.length > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-blue-300 bg-white text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:bg-zinc-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
                  onClick={handleSimulateAll}
                >
                  <FlaskConical className="mr-1.5 size-3.5" />
                  Simular {activeRecs.length} reubicación{activeRecs.length > 1 ? 'es' : ''}
                </Button>
              ) : undefined
            }
          >
            {activeRecs.length > 0 && (
              <div className="mb-4 grid gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 sm:grid-cols-3 dark:border-blue-900/50 dark:bg-blue-950/40">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
                    <MoveRight className="size-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Distancia total a ahorrar</p>
                    <p className="text-lg font-bold text-blue-800 tabular-nums dark:text-blue-300">
                      {formatNumber(impact.totalDistanceSavedM)} m
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
                    <Clock className="size-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Tiempo ahorrado por turno</p>
                    <p className="text-lg font-bold text-blue-800 tabular-nums dark:text-blue-300">
                      {impact.totalTimeSavedMin} min
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
                    <MoveRight className="size-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Clase A → golden zone</p>
                    <p className="text-lg font-bold text-blue-800 tabular-nums dark:text-blue-300">
                      {impact.aClassToGoldenCount} SKUs
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeRecs.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Slotting óptimo"
                description="Sin oportunidades de reubicación activas."
              />
            ) : (
              <DataTable
                columns={optimizationCols}
                data={optimizationRows}
                searchColumn="productName"
                searchPlaceholder="Buscar por producto…"
                emptyMessage="Sin recomendaciones de reubicación."
              />
            )}
          </TabPanel>
        </div>
      )}

      {/* ════════ Tab: Clasificación ABC/XYZ ════════ */}
      {activeTab === 'classification' && (
        <div>
          <TabPanel
            icon={Grid3x3}
            iconClass="text-zinc-500"
            title="Clasificación ABC/XYZ por producto"
            description="Vista consolidada de rotación de inventario. Clase A = alto valor/volumen, Clase X = demanda estable."
            action={
              <div className="flex gap-2">
                <Select value={abcFilter} onValueChange={setAbcFilter}>
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue placeholder="Clase ABC" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas ABC</SelectItem>
                    <SelectItem value="A">Clase A</SelectItem>
                    <SelectItem value="B">Clase B</SelectItem>
                    <SelectItem value="C">Clase C</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={xyzFilter} onValueChange={setXyzFilter}>
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue placeholder="Clase XYZ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas XYZ</SelectItem>
                    <SelectItem value="X">Clase X</SelectItem>
                    <SelectItem value="Y">Clase Y</SelectItem>
                    <SelectItem value="Z">Clase Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          >
            {filteredDemandStats.length === 0 ? (
              <EmptyState
                icon={Grid3x3}
                title="Sin resultados"
                description="Ningún producto coincide con los filtros seleccionados."
              />
            ) : (
              <DataTable
                columns={classificationCols}
                data={classificationRows}
                searchColumn="productName"
                searchPlaceholder="Buscar por producto o SKU…"
                emptyMessage="Sin productos clasificados."
              />
            )}
          </TabPanel>
        </div>
      )}

      {/* ════════ Tab: Reabastecimiento ════════ */}
      {activeTab === 'replenishment' && (
        <div className="space-y-4">
          <TabPanel
            icon={PackageCheck}
            iconClass="text-blue-500"
            title="Tareas de reabastecimiento de pick faces"
            description="Pick faces con stock bajo mínimo. Genera tareas para que los operadores repongan desde el almacén de reserva."
            action={
              replenishmentNeeds.length > 0 ? (
                <Button
                  size="sm"
                  onClick={handleGenerateTasks}
                  disabled={generating}
                  className="shrink-0 bg-amber-600 hover:bg-amber-700"
                >
                  {generating ? (
                    <RefreshCcw className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <Plus className="mr-1.5 size-3.5" />
                  )}
                  Generar {replenishmentNeeds.length} tarea
                  {replenishmentNeeds.length > 1 ? 's' : ''}
                </Button>
              ) : undefined
            }
          >
            {replenishmentNeeds.length > 0 && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/40">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-800 dark:text-amber-300">
                    {replenishmentNeeds.length} pick face
                    {replenishmentNeeds.length > 1 ? 's' : ''} bajo mínimo sin tarea activa
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                    {replenishmentNeeds.filter((n) => n.priority === 'high').length} críticas (stock
                    &lt; {Math.round(state.settings.replenishmentHighFactor * 100)}% del mínimo)
                    {lastGenerated > 0 && (
                      <span className="ml-2 font-medium text-green-700 dark:text-emerald-300">
                        · {lastGenerated} tarea{lastGenerated > 1 ? 's' : ''} generada
                        {lastGenerated > 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {state.replenishmentTasks.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Sin tareas de reabastecimiento"
                description="Todos los pick faces están sobre su nivel mínimo de stock."
              />
            ) : (
              <DataTable
                columns={replenishmentCols}
                data={replenishmentRows}
                searchColumn="productName"
                searchPlaceholder="Buscar por producto…"
                emptyMessage="Sin tareas de reabastecimiento."
                rowClassName={(row: ReplenishmentRow) =>
                  cn('group', row.isCritical && 'bg-red-50/50 dark:bg-red-950/30')
                }
              />
            )}
          </TabPanel>
        </div>
      )}

      {/* ════════ Tab: Afinidad ════════ */}
      {activeTab === 'affinity' && (
        <div className="space-y-4">
          <TabPanel
            icon={GitMerge}
            iconClass="text-violet-500"
            title="Pares con mayor co-picking"
            description="Productos pedidos juntos frecuentemente deberían estar en ubicaciones próximas para reducir el recorrido del picker. El score combina tasa de co-ocurrencia y lift estadístico."
          >
            {affinityRecs.length === 0 ? (
              <EmptyState
                icon={GitMerge}
                title="Sin datos de co-picking"
                description="Se necesitan órdenes con múltiples productos para calcular afinidades."
              />
            ) : (
              <>
                <div className="text-muted-foreground mb-3 flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-full bg-green-500" />
                    Ya próximos
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-full bg-violet-500" />
                    Acercar recomendado
                  </span>
                </div>
                <DataTable
                  columns={affinityCols}
                  data={affinityRows}
                  searchColumn="productNameA"
                  searchPlaceholder="Buscar por producto…"
                  emptyMessage="Sin pares de afinidad."
                  rowClassName={(row: AffinityRow) => (row.isAlreadyClose ? 'bg-green-50/40 dark:bg-emerald-950/30' : '')}
                />
              </>
            )}
          </TabPanel>

          {affinityPending.filter((r) => r.distanceBetweenM !== null).length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pt-4 pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  Acciones recomendadas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {affinityPending
                  .filter((r) => r.distanceBetweenM !== null)
                  .map((rec) => (
                    <div
                      key={`${rec.pair.productA}|${rec.pair.productB}`}
                      className="flex items-start gap-3 rounded-lg border border-violet-100 bg-violet-50/50 px-4 py-3 text-sm dark:border-violet-800/50 dark:bg-violet-950/40"
                    >
                      <GitMerge className="mt-0.5 size-4 shrink-0 text-violet-500" />
                      <div className="flex-1">
                        <p className="text-violet-900 dark:text-violet-200">{rec.suggestion}</p>
                        {rec.distanceBetweenM !== null && (
                          <p className="mt-0.5 text-xs text-violet-600 dark:text-violet-300">
                            Distancia actual entre ubicaciones:{' '}
                            <strong>{rec.distanceBetweenM} m</strong>
                            {' · '}Co-ocurrencias: <strong>{rec.pair.coOccurrences}</strong> órdenes
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full border border-violet-200 bg-white px-2 py-0.5 text-xs font-semibold text-violet-700 dark:border-violet-800/50 dark:bg-zinc-900 dark:text-violet-300">
                        Score {rec.pair.proximityScore}
                      </span>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ════════ Tab: Historial ════════ */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <TabPanel
            icon={History}
            iconClass="text-zinc-500"
            title="Historial de capturas"
            description="Captura el estado actual de los KPIs para hacer seguimiento de la mejora a lo largo del tiempo."
            action={
              <div className="flex items-center gap-2">
                <Input
                  value={snapshotLabel}
                  onChange={(e) => setSnapshotLabel(e.target.value)}
                  placeholder="Etiqueta (opcional)"
                  className="h-8 w-44 text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCaptureSnapshot}
                  disabled={capturingSnapshot}
                >
                  {capturingSnapshot ? (
                    <RefreshCcw className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <Plus className="mr-1.5 size-3.5" />
                  )}
                  Capturar
                </Button>
              </div>
            }
          >
            {state.slottingSnapshots.length >= 2 && (
              <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: 'SKUs A mal ubicados',
                    delta: trends.misplacedDelta,
                    pct: trends.misplacedPct,
                    invertColor: true,
                  },
                  {
                    label: 'Reubicaciones disponibles',
                    delta: trends.relocationsAvailableDelta,
                    pct: null,
                    invertColor: true,
                  },
                  {
                    label: 'Distancia a ahorrar',
                    delta: trends.distanceSavedDelta,
                    pct: null,
                    invertColor: true,
                    suffix: ' m',
                  },
                  {
                    label: 'Reabastecimientos pendientes',
                    delta: trends.pendingReplenishmentDelta,
                    pct: null,
                    invertColor: true,
                  },
                ].map(({ label, delta, pct, invertColor, suffix }) => {
                  const improved = invertColor ? (delta ?? 0) < 0 : (delta ?? 0) > 0
                  const neutral = delta === 0 || delta === null
                  return (
                    <div
                      key={label}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border p-4',
                        neutral
                          ? 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'
                          : improved
                            ? 'border-green-200 bg-green-50 dark:border-emerald-900/50 dark:bg-emerald-950/40'
                            : 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40'
                      )}
                    >
                      {neutral ? (
                        <span className="text-zinc-400">—</span>
                      ) : improved ? (
                        <TrendingDown className="size-5 shrink-0 text-green-600" />
                      ) : (
                        <TrendingUp className="size-5 shrink-0 text-red-500" />
                      )}
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
                        <p
                          className={cn(
                            'text-lg font-bold tabular-nums',
                            neutral ? 'text-zinc-400 dark:text-zinc-500' : improved ? 'text-green-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'
                          )}
                        >
                          {delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}${suffix ?? ''}`}
                          {pct !== null && delta !== null && (
                            <span className="ml-1 text-xs font-normal">
                              ({pct > 0 ? '+' : ''}
                              {pct}%)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {state.slottingSnapshots.length === 0 ? (
              <EmptyState
                icon={History}
                title="Sin capturas todavía"
                description="Usa el botón «Capturar» para registrar el estado actual y hacer seguimiento de la mejora."
              />
            ) : (
              <DataTable
                columns={historyCols}
                data={historyRows}
                searchColumn="label"
                searchPlaceholder="Buscar captura…"
                emptyMessage="Sin capturas registradas."
                rowClassName={(row: HistoryRow) => (row.isLatest ? 'bg-blue-50/30 dark:bg-blue-950/20' : '')}
              />
            )}
          </TabPanel>
        </div>
      )}

      {/* ════════ Simulation dialog ════════ */}
      <Dialog
        open={!!simulation}
        onOpenChange={(o) => {
          if (!o) setSimulation(null)
        }}
      >
        <DialogContent className="max-w-5xl! gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b bg-linear-to-r from-blue-50 to-indigo-50 px-6 py-5 dark:from-blue-950/40 dark:to-indigo-950/40">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="size-4 text-blue-600" />
              Simulación de impacto — {simulation?.rows.length ?? 0} reubicaciones
            </DialogTitle>
            <p className="text-muted-foreground mt-1 text-xs">
              Vista previa de los cambios antes de aplicarlos. Ningún stock se mueve hasta
              confirmar.
            </p>
          </DialogHeader>

          {simulation && (
            <>
              <div className="grid grid-cols-2 divide-x border-b sm:grid-cols-4">
                {[
                  {
                    label: 'Distancia ahorrada',
                    value: `${formatNumber(simulation.totalDistanceSavedM)} m`,
                  },
                  { label: 'Tiempo/turno', value: `${simulation.totalTimeSavedMin} min` },
                  { label: 'A → golden zone', value: `${simulation.aToGoldenCount} SKUs` },
                  { label: 'CZ liberan golden', value: `${simulation.czOutOfGoldenCount} SKUs` },
                ].map(({ label, value }) => (
                  <div key={label} className="px-4 py-3 text-center">
                    <p className="text-muted-foreground text-xs">{label}</p>
                    <p className="text-sm font-bold tabular-nums">{value}</p>
                  </div>
                ))}
              </div>

              <div className="max-h-auto overflow-y-auto p-6">
                <DataTable
                  columns={simulationCols}
                  data={simulation.rows}
                  emptyMessage="Sin reubicaciones en la simulación."
                  showViewOptions={false}
                  defaultPageSize={50}
                />
              </div>
            </>
          )}

          <DialogFooter className="bg-muted/20 mb-0! border-t p-6">
            <Button variant="outline" onClick={() => setSimulation(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleApplyAll}
              disabled={applyingAll}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {applyingAll ? (
                <RefreshCcw className="mr-1.5 size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 size-4" />
              )}
              Aplicar {simulation?.rows.length ?? 0} reubicaciones
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════ Confirm relocation dialog ════════ */}
      <Dialog
        open={!!relocateDialog.data}
        onOpenChange={(o) => {
          if (!o) relocateDialog.close()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MoveRight className="size-4" />
              Confirmar reubicación
            </DialogTitle>
          </DialogHeader>

          {relocateDialog.data && (
            <div className="space-y-4 py-1">
              <p className="text-muted-foreground text-sm">
                Producto:{' '}
                <span className="text-foreground font-semibold">
                  {relocateDialog.data.productName}
                </span>
              </p>

              <div className="bg-muted/30 flex items-center gap-3 rounded-lg border p-4">
                <div className="flex-1 text-center">
                  <p className="text-muted-foreground mb-1 text-xs">Ubicación actual</p>
                  <p className="font-mono text-base font-semibold">
                    {relocateDialog.data.fromCode}
                  </p>
                </div>
                <ArrowRight className="text-muted-foreground size-5 shrink-0" />
                <div className="flex-1 text-center">
                  <p className="text-muted-foreground mb-1 text-xs">Destino</p>
                  <p className="font-mono text-base font-bold text-green-700 dark:text-emerald-300">
                    {relocateDialog.data.toCode}
                  </p>
                </div>
              </div>

              {relocateDialog.data.errors.length > 0 && (
                <div className="space-y-1.5 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/40">
                  {relocateDialog.data.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                      {err}
                    </div>
                  ))}
                </div>
              )}

              {relocateDialog.data.warnings.length > 0 && (
                <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/40">
                  {relocateDialog.data.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {relocateDialog.data.errors.length === 0 &&
                relocateDialog.data.warnings.length === 0 && (
                  <p className="text-muted-foreground text-sm">
                    Se moverá todo el stock a la nueva ubicación y se registrará un movimiento{' '}
                    <strong>putaway</strong> en el log de auditoría.
                  </p>
                )}

              {relocateDialog.error && (
                <p className="text-destructive flex items-center gap-1 text-sm">
                  <TriangleAlert className="size-3" /> {relocateDialog.error}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={relocateDialog.close}>
              Cancelar
            </Button>
            <Button onClick={handleRelocate} disabled={!!relocateDialog.data?.errors.length}>
              <CheckCircle2 className="mr-1 size-4" /> Confirmar reubicación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SlottingPage
