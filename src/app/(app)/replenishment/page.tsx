'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowDownToLine,
  CheckCircle2,
  ClipboardList,
  Plus,
  RefreshCcw,
  Snowflake,
  Store,
  PackageCheck,
  TriangleAlert,
  Truck,
  Zap,
} from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import {
  abcByProduct,
  selectReplenishmentNeeds,
  selectStoreReplenishmentNeeds,
} from '@/store/selectors'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { SubNav, type SubNavItem } from '@/components/shared/sub-nav'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TabPanel } from './_components/tab-panel'
import { EmptyState } from './_components/empty-state'
import {
  buildNeedColumns,
  buildStoreNeedColumns,
  buildStoreTaskColumns,
  buildTaskColumns,
  type NeedRow,
  type StoreNeedRow,
  type StoreTaskRow,
  type TaskRow,
} from './columns'

type TabValue = 'needs' | 'tasks' | 'stores'

const ReplenishmentPage = () => {
  const state = useWmsStore()
  const {
    replenishmentTasks,
    storeReplenishmentTasks,
    settings,
    generateReplenishmentTasks,
    startReplenishment,
    completeReplenishment,
    generateStoreReplenishmentTasks,
    startStoreReplenishment,
    completeStoreReplenishment,
  } = state
  const { productName, locationCode, warehouseName, getProduct } = useStoreHelpers()

  const searchParams = useSearchParams()
  const activeTab = (searchParams.get('tab') as TabValue) ?? 'needs'

  const [generating, setGenerating] = useState(false)

  const abc = useMemo(() => abcByProduct(state), [state])
  const needs = useMemo(() => selectReplenishmentNeeds(state), [state])
  const storeNeeds = useMemo(() => selectStoreReplenishmentNeeds(state), [state])

  // Necesidades intra-CD (pick faces bajo mínimo, sin tarea activa).
  const needRows = useMemo<NeedRow[]>(
    () =>
      needs.map((n, i) => ({
        key: `${n.pickFaceLocationId}-${n.productId}-${i}`,
        productId: n.productId,
        productName: productName(n.productId),
        productImageUrl: getProduct(n.productId)?.imageUrl ?? null,
        abcClass: n.abcClass,
        originCode: locationCode(n.reserveLocationId),
        destinationCode: locationCode(n.pickFaceLocationId),
        currentStock: n.currentStock,
        minStock: n.minStock,
        maxStock: n.maxStock,
        suggestedQuantity: n.suggestedQuantity,
        priority: n.priority,
      })),
    [needs, productName, locationCode, getProduct]
  )

  // Tareas intra-CD (reserva → pick face).
  const taskRows = useMemo<TaskRow[]>(
    () =>
      replenishmentTasks.map((t) => ({
        id: t.id,
        productName: productName(t.productId),
        productImageUrl: getProduct(t.productId)?.imageUrl ?? null,
        abcClass: abc[t.productId] ?? 'C',
        originCode: locationCode(t.originLocationId),
        destinationCode: locationCode(t.destinationLocationId),
        currentStock: t.currentStock,
        minStock: t.minStock,
        suggestedQuantity: t.suggestedQuantity,
        priority: t.priority,
        status: t.status,
        operatorName: t.operatorName ?? null,
        auto: t.auto ?? false,
        isCritical: t.priority === 'high' && t.status !== 'completed',
      })),
    [replenishmentTasks, productName, locationCode, getProduct, abc]
  )

  // Necesidades de tienda pendientes de generar tarea.
  const pendingStoreNeeds = useMemo(() => storeNeeds.filter((n) => !n.hasActiveTask), [storeNeeds])

  const storeNeedRows = useMemo<StoreNeedRow[]>(
    () =>
      pendingStoreNeeds.map((n, i) => ({
        key: `${n.storeWarehouseId}-${n.productId}-${i}`,
        storeName: warehouseName(n.storeWarehouseId),
        sourceName: warehouseName(n.sourceWarehouseId),
        productId: n.productId,
        productName: productName(n.productId),
        productImageUrl: getProduct(n.productId)?.imageUrl ?? null,
        abcClass: n.abcClass,
        currentStock: n.currentStock,
        minStock: n.minStock,
        maxStock: n.maxStock,
        suggestedQuantity: n.suggestedQuantity,
        priority: n.priority,
      })),
    [pendingStoreNeeds, warehouseName, productName, getProduct]
  )

  const storeTaskRows = useMemo<StoreTaskRow[]>(
    () =>
      storeReplenishmentTasks.map((t) => ({
        id: t.id,
        storeName: warehouseName(t.storeWarehouseId),
        sourceName: warehouseName(t.sourceWarehouseId),
        productName: productName(t.productId),
        productImageUrl: getProduct(t.productId)?.imageUrl ?? null,
        currentStock: t.currentStock,
        minStock: t.minStock,
        suggestedQuantity: t.suggestedQuantity,
        priority: t.priority,
        status: t.status,
        operatorName: t.operatorName ?? null,
        auto: t.auto,
      })),
    [storeReplenishmentTasks, warehouseName, productName, getProduct]
  )

  // KPIs
  const pendingTasks = replenishmentTasks.filter(
    (t) => t.status === 'pending' || t.status === 'assigned'
  ).length
  const criticalNeeds = needs.filter((n) => n.priority === 'high').length
  const frozen = settings.replenishmentFreezeActive

  // ── Reabastecimiento automático a tiendas (retail) ──
  // Cuando el toggle está activo, las necesidades de tienda se convierten en tareas
  // automáticamente al entrar al módulo (demostrable desde /replenishment-settings).
  useEffect(() => {
    if (!settings.replenishmentAutoStoreEnabled) return
    if (frozen) return
    if (pendingStoreNeeds.length === 0) return
    const created = generateStoreReplenishmentTasks()
    if (created.length > 0) {
      toast.info('Reabastecimiento automático a tiendas', {
        description: `${created.length} tarea(s) DC→tienda generada(s) por el motor automático.`,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.replenishmentAutoStoreEnabled, pendingStoreNeeds.length, frozen])

  // ── Handlers ──
  const handleGenerate = () => {
    if (frozen) return toast.error('Reabastecimiento congelado')
    setGenerating(true)
    try {
      const created = generateReplenishmentTasks()
      if (created.length > 0)
        toast.success(`${created.length} tarea(s) de reposición generada(s)`, {
          description: 'Revisa la pestaña «Tareas» para asignarlas.',
        })
      else toast.info('No hay pick faces bajo mínimo sin tarea activa')
    } finally {
      setGenerating(false)
    }
  }

  const guarded = (fn: () => void) => {
    try {
      fn()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Operación no permitida')
    }
  }

  const handleStart = (id: string) =>
    guarded(() => {
      startReplenishment(id, 'Operador CD')
      toast.success('Tarea asignada — en curso')
    })
  const handleComplete = (id: string) =>
    guarded(() => {
      completeReplenishment(id)
      toast.success('Pick face repuesto', { description: 'Stock movido de reserva a pick face.' })
    })

  const handleGenerateStore = () => {
    if (frozen) return toast.error('Reabastecimiento congelado')
    setGenerating(true)
    try {
      const created = generateStoreReplenishmentTasks()
      if (created.length > 0)
        toast.success(`${created.length} tarea(s) DC→tienda generada(s)`)
      else toast.info('No hay tiendas bajo mínimo sin tarea activa')
    } finally {
      setGenerating(false)
    }
  }

  const handleStartStore = (id: string) =>
    guarded(() => {
      startStoreReplenishment(id, 'Operador CD')
      toast.success('Despacho a tienda en tránsito')
    })
  const handleCompleteStore = (id: string) =>
    guarded(() => {
      completeStoreReplenishment(id)
      toast.success('Tienda surtida', { description: 'Stock recibido en la sala de venta.' })
    })

  // Column builders capture handlers that only invoke stable Zustand actions, so a
  // one-time memo is safe (the handlers never need to be refreshed).
  const needCols = useMemo(() => buildNeedColumns(), [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const taskCols = useMemo(() => buildTaskColumns(handleStart, handleComplete), [])
  const storeNeedCols = useMemo(() => buildStoreNeedColumns(), [])
  const storeTaskCols = useMemo(
    () => buildStoreTaskColumns(handleStartStore, handleCompleteStore),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const TABS: SubNavItem[] = [
    { value: 'needs', label: 'Necesidades', icon: TriangleAlert, count: needs.length },
    { value: 'tasks', label: 'Tareas', icon: ClipboardList, count: pendingTasks },
    { value: 'stores', label: 'Tiendas', icon: Store, count: pendingStoreNeeds.length },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reabastecimiento"
        description="Mantiene surtidas las pick faces (reserva → pick face) y las tiendas (CD → tienda). Detecta stock bajo mínimo, prioriza y genera las tareas de reposición a tiempo."
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={TriangleAlert}
          value={needs.length}
          label="Pick faces bajo mínimo"
          sublabel={criticalNeeds > 0 ? `${criticalNeeds} críticas` : 'CD'}
          tone={needs.length > 0 ? 'red' : 'green'}
        />
        <KpiCard
          icon={ClipboardList}
          value={pendingTasks}
          label="Tareas CD pendientes"
          sublabel="reserva → pick face"
          tone={pendingTasks > 0 ? 'amber' : 'neutral'}
        />
        <KpiCard
          icon={Store}
          value={pendingStoreNeeds.length}
          label="Tiendas bajo mínimo"
          sublabel="CD → tienda"
          tone={pendingStoreNeeds.length > 0 ? 'red' : 'green'}
        />
        <KpiCard
          icon={Zap}
          value={settings.replenishmentAutoStoreEnabled ? 'ON' : 'OFF'}
          label="Auto tiendas"
          sublabel={settings.replenishmentAutoStoreEnabled ? 'activo' : 'manual'}
          tone={settings.replenishmentAutoStoreEnabled ? 'blue' : 'neutral'}
        />
      </div>

      {/* Freeze banner */}
      {frozen && (
        <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
          <Snowflake className="mt-0.5 size-4 shrink-0 text-red-600" />
          <div className="text-sm">
            <p className="font-semibold text-red-800 dark:text-red-300">
              Reabastecimiento congelado
            </p>
            <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">
              Generar, asignar y completar tareas está bloqueado. Desactívalo en Configuración →
              Reabastecimiento.
            </p>
          </div>
        </div>
      )}

      <SubNav items={TABS} defaultValue="needs" />

      {/* ════════ Necesidades ════════ */}
      {activeTab === 'needs' && (
        <TabPanel
          icon={TriangleAlert}
          iconClass="text-amber-500"
          title="Pick faces bajo mínimo"
          description="Posiciones de picking cuyo stock cayó por debajo del mínimo (por SKU o por ubicación) y aún no tienen tarea activa. Genera las tareas para reponer desde reserva."
          action={
            needRows.length > 0 ? (
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={generating || frozen}
                className="shrink-0 bg-amber-600 hover:bg-amber-700"
              >
                {generating ? (
                  <RefreshCcw className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 size-3.5" />
                )}
                Generar {needRows.length} tarea{needRows.length > 1 ? 's' : ''}
              </Button>
            ) : undefined
          }
        >
          {needRows.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Todo surtido"
              description="Todas las pick faces están sobre su nivel mínimo de stock."
            />
          ) : (
            <DataTable
              columns={needCols}
              data={needRows}
              searchColumn="productName"
              searchPlaceholder="Buscar por producto…"
              emptyMessage="Sin necesidades."
            />
          )}
        </TabPanel>
      )}

      {/* ════════ Tareas ════════ */}
      {activeTab === 'tasks' && (
        <TabPanel
          icon={ClipboardList}
          iconClass="text-blue-500"
          title="Tareas de reposición (reserva → pick face)"
          description="Flujo en dos pasos: Iniciar (asigna la tarea a un operador) → Completar (mueve el stock y deja asiento en el libro de movimientos)."
        >
          {taskRows.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Sin tareas"
              description="Genera tareas desde la pestaña «Necesidades»."
            />
          ) : (
            <DataTable
              columns={taskCols}
              data={taskRows}
              searchColumn="productName"
              searchPlaceholder="Buscar por producto…"
              emptyMessage="Sin tareas de reabastecimiento."
              rowClassName={(row: TaskRow) =>
                cn('group', row.isCritical && 'bg-red-50/50 dark:bg-red-950/30')
              }
            />
          )}
        </TabPanel>
      )}

      {/* ════════ Tiendas (retail) ════════ */}
      {activeTab === 'stores' && (
        <div className="space-y-4">
          <TabPanel
            icon={Store}
            iconClass="text-emerald-500"
            title="Reabastecimiento a tiendas (retail)"
            description="Tiendas cuyo stock en sala cayó por debajo del mínimo definido por política (tienda × SKU). Se surten desde el CD origen."
            action={
              storeNeedRows.length > 0 ? (
                <Button
                  size="sm"
                  onClick={handleGenerateStore}
                  disabled={generating || frozen}
                  className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
                >
                  {generating ? (
                    <RefreshCcw className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <Truck className="mr-1.5 size-3.5" />
                  )}
                  Generar {storeNeedRows.length} tarea{storeNeedRows.length > 1 ? 's' : ''}
                </Button>
              ) : undefined
            }
          >
            {settings.replenishmentAutoStoreEnabled && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs dark:border-blue-900/50 dark:bg-blue-950/30">
                <Zap className="size-3.5 shrink-0 text-blue-600" />
                <span className="text-blue-700 dark:text-blue-300">
                  <strong>Modo automático activo:</strong> las necesidades de tienda se convierten en
                  tareas sin intervención manual.
                </span>
              </div>
            )}
            {storeNeedRows.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Tiendas surtidas"
                description="Ninguna tienda con política activa está por debajo de su mínimo."
              />
            ) : (
              <DataTable
                columns={storeNeedCols}
                data={storeNeedRows}
                searchColumn="productName"
                searchPlaceholder="Buscar por producto…"
                emptyMessage="Sin necesidades de tienda."
              />
            )}
          </TabPanel>

          <TabPanel
            icon={ArrowDownToLine}
            iconClass="text-blue-500"
            title="Tareas de surtido a tienda"
            description="Flujo en dos pasos: Despachar (sale del CD y queda en tránsito) → Recibir (aterriza en la sala de venta de la tienda). Cada paso deja asiento en el libro de movimientos."
          >
            {storeTaskRows.length === 0 ? (
              <EmptyState
                icon={PackageCheck}
                title="Sin tareas de tienda"
                description="Genera tareas arriba o activa el modo automático en Configuración."
              />
            ) : (
              <DataTable
                columns={storeTaskCols}
                data={storeTaskRows}
                searchColumn="storeName"
                searchPlaceholder="Buscar por tienda…"
                emptyMessage="Sin tareas."
                rowClassName={() => 'group'}
              />
            )}
          </TabPanel>
        </div>
      )}
    </div>
  )
}

export default ReplenishmentPage
