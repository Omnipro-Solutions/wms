'use client'

import { useMemo, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  CheckCircle2,
  ClipboardList,
  Gauge,
  ScanLine,
  Snowflake,
  TriangleAlert,
  Zap,
} from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { selectInventoryAccuracy } from '@/store/selectors'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { useDialogState } from '@/hooks/use-dialog-state'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { SubNav, type SubNavItem } from '@/components/shared/sub-nav'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { buildDiscrepancyColumns, buildPlanColumns, type DiscrepancyRow, type PlanRow } from './columns'
import { CreateCountDialog } from './_components/create-count-dialog'
import { ExecuteCountPanel } from './_components/execute-count-panel'
import { TabPanel } from './_components/tab-panel'
import { EmptyState } from './_components/empty-state'
import { cn } from '@/lib/utils'

type TabValue = 'plans' | 'execute' | 'discrepancies'

const CycleCountPage = () => {
  const state = useWmsStore()
  const {
    cyclicCountPlans,
    cyclicCountLines,
    adjustmentRequests,
    settings,
    startCyclicCount,
    recordCycleCountLine,
    completeCyclicCount,
    cancelCyclicCount,
    generateSuggestedCycleCounts,
  } = state
  const { productName, productSku, getProduct, locationCode, warehouseName } = useStoreHelpers()
  const accuracy = selectInventoryAccuracy(state)

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = (searchParams.get('tab') as TabValue) ?? 'plans'

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const createDialog = useDialogState<true>()

  const frozen = settings.cycleCountFreezeActive

  const goToTab = (tab: TabValue) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'plans') params.delete('tab')
    else params.set('tab', tab)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const inProgressPlans = useMemo(
    () => cyclicCountPlans.filter((p) => p.status === 'in_progress'),
    [cyclicCountPlans]
  )
  const pendingCount = cyclicCountPlans.filter((p) => p.status === 'pending').length
  const activeCount = cyclicCountPlans.filter(
    (p) => p.status === 'pending' || p.status === 'in_progress'
  ).length
  const discrepancyCount = cyclicCountLines.filter(
    (l) => l.countedQuantity !== undefined && l.variance !== 0
  ).length

  const planRows = useMemo<PlanRow[]>(
    () =>
      cyclicCountPlans.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        method: p.method,
        filterValue: p.filterValue,
        warehouseName: warehouseName(p.warehouseId),
        countedItems: p.countedItems,
        totalItems: p.totalItems,
        scheduledDate: p.scheduledDate,
        status: p.status,
        blindCount: p.blindCount,
        auto: p.auto,
      })),
    [cyclicCountPlans, warehouseName]
  )

  const discrepancyRows = useMemo<DiscrepancyRow[]>(() => {
    const plansById = new Map(cyclicCountPlans.map((p) => [p.id, p]))
    return cyclicCountLines
      .filter((l) => l.countedQuantity !== undefined && l.variance !== 0)
      .map((l) => {
        const variancePct = l.expectedQuantity > 0 ? (Math.abs(l.variance ?? 0) / l.expectedQuantity) * 100 : 0
        const adjustment = l.adjustmentRequestId
          ? adjustmentRequests.find((r) => r.id === l.adjustmentRequestId)
          : undefined
        return {
          lineId: l.id,
          planCode: plansById.get(l.planId)?.code ?? l.planId,
          productName: productName(l.productId),
          productSku: productSku(l.productId),
          productImageUrl: getProduct(l.productId)?.imageUrl ?? null,
          locationCode: locationCode(l.locationId),
          expectedQuantity: l.expectedQuantity,
          countedQuantity: l.countedQuantity ?? 0,
          variance: l.variance ?? 0,
          variancePct,
          outOfTolerance: variancePct > settings.cycleCountVarianceTolerancePct,
          adjustmentStatus: adjustment?.status ?? null,
        }
      })
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
  }, [cyclicCountLines, cyclicCountPlans, adjustmentRequests, productName, productSku, getProduct, locationCode, settings.cycleCountVarianceTolerancePct])

  const selectedPlan = selectedPlanId ? inProgressPlans.find((p) => p.id === selectedPlanId) : undefined
  const selectedPlanLines = selectedPlan
    ? cyclicCountLines.filter((l) => l.planId === selectedPlan.id)
    : []

  const guarded = (fn: () => void) => {
    try {
      fn()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Operación no permitida')
    }
  }

  const handleStart = (id: string) =>
    guarded(() => {
      startCyclicCount(id)
      toast.success('Conteo iniciado')
    })

  const handleExecute = (id: string) => {
    setSelectedPlanId(id)
    goToTab('execute')
  }

  const handleCancel = (id: string) =>
    guarded(() => {
      cancelCyclicCount(id)
      toast.info('Plan cancelado')
      if (selectedPlanId === id) setSelectedPlanId(null)
    })

  const handleRecordLine = (lineId: string, qty: number) =>
    guarded(() => {
      recordCycleCountLine(lineId, qty, selectedPlan?.assignedOperatorName ?? 'Operador CD')
    })

  const handleComplete = () => {
    if (!selectedPlan) return
    guarded(() => {
      const linesBefore = cyclicCountLines.filter((l) => l.planId === selectedPlan.id)
      const withVariance = linesBefore.filter((l) => l.countedQuantity !== undefined && l.variance !== 0)
      completeCyclicCount(selectedPlan.id, selectedPlan.assignedOperatorName ?? 'Operador CD')
      if (withVariance.length === 0) {
        toast.success('Conteo completado — sin diferencias')
      } else {
        toast.success(`Conteo completado — ${withVariance.length} diferencia(s) enviada(s) al motor de ajustes`, {
          description: 'Revisa la pestaña «Discrepancias» o /inventory-settings para el detalle de aprobación.',
        })
      }
      setSelectedPlanId(null)
    })
  }

  const handleGenerateSuggested = () => {
    try {
      const created = generateSuggestedCycleCounts()
      if (created.length > 0) toast.success(`${created.length} plan(es) sugerido(s) generado(s)`)
      else toast.info('No hay combinaciones almacén × clase ABC vencidas sin un plan activo')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron generar los planes')
    }
  }

  const planCols = useMemo(
    () => buildPlanColumns(handleStart, handleExecute, handleCancel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const discrepancyCols = useMemo(() => buildDiscrepancyColumns(), [])

  const TABS: SubNavItem[] = [
    { value: 'plans', label: 'Planes', icon: ClipboardList, count: cyclicCountPlans.length },
    { value: 'execute', label: 'Ejecutar conteo', icon: ScanLine, count: inProgressPlans.length },
    { value: 'discrepancies', label: 'Discrepancias', icon: TriangleAlert, count: discrepancyCount },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Conteo Cíclico"
        description="Verifica que el inventario del sistema coincida con el físico sin detener la operación: planes por zona/categoría/ABC/rotación, captura en piso y recálculo automático de la exactitud de inventario (IRA)."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleGenerateSuggested} disabled={!settings.cycleCountAutoSuggestEnabled}>
              <Zap className="mr-1.5 size-4" /> Generar sugeridos
            </Button>
            <Button onClick={() => createDialog.open(true)} disabled={frozen}>
              Nuevo plan
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Gauge} value={`${accuracy.ira}%`} label="IRA" sublabel="exactitud de inventario" tone={accuracy.ira >= 95 ? 'green' : accuracy.ira >= 80 ? 'amber' : 'red'} />
        <KpiCard icon={ClipboardList} value={activeCount} label="Planes activos" sublabel={`${pendingCount} pendientes`} tone={activeCount > 0 ? 'blue' : 'neutral'} />
        <KpiCard icon={ScanLine} value={inProgressPlans.length} label="En ejecución" sublabel="listos para contar" tone={inProgressPlans.length > 0 ? 'blue' : 'neutral'} />
        <KpiCard icon={TriangleAlert} value={discrepancyCount} label="Diferencias detectadas" sublabel="líneas con variación ≠ 0" tone={discrepancyCount > 0 ? 'amber' : 'green'} />
      </div>

      {frozen && (
        <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
          <Snowflake className="mt-0.5 size-4 shrink-0 text-red-600" />
          <div className="text-sm">
            <p className="font-semibold text-red-800 dark:text-red-300">Conteo cíclico congelado</p>
            <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">
              Crear, iniciar, registrar y completar conteos está bloqueado. Desactívalo en
              Configuración → Conteo cíclico.
            </p>
          </div>
        </div>
      )}

      <SubNav items={TABS} defaultValue="plans" />

      {activeTab === 'plans' && (
        <TabPanel
          icon={ClipboardList}
          iconClass="text-blue-500"
          title="Planes de conteo"
          description="Crea planes por zona, categoría, clase ABC o rotación. Inícialos para generar sus líneas y pasar a «Ejecutar conteo»."
        >
          {planRows.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Sin planes de conteo"
              description="Crea un plan nuevo o genera planes sugeridos por clase ABC."
            />
          ) : (
            <DataTable
              columns={planCols}
              data={planRows}
              searchColumn="name"
              searchPlaceholder="Buscar por nombre…"
              emptyMessage="Sin planes de conteo."
            />
          )}
        </TabPanel>
      )}

      {activeTab === 'execute' && (
        <TabPanel
          icon={ScanLine}
          iconClass="text-blue-500"
          title="Ejecutar conteo"
          description="Captura en piso: registra la cantidad contada por posición. Al completar, las diferencias se envían al motor de ajustes existente (mismo umbral de aprobación que /inventory-settings)."
        >
          {selectedPlan ? (
            <ExecuteCountPanel
              plan={selectedPlan}
              lines={selectedPlanLines}
              productName={productName}
              productSku={productSku}
              productImageUrl={(id) => getProduct(id)?.imageUrl}
              locationCode={locationCode}
              onRecordLine={handleRecordLine}
              onComplete={handleComplete}
              onChangePlan={() => setSelectedPlanId(null)}
            />
          ) : inProgressPlans.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Sin planes en progreso"
              description="Inicia un plan pendiente desde la pestaña «Planes» para empezar a contar."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {inProgressPlans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={cn(
                    'rounded-lg border px-4 py-3 text-left transition-colors hover:border-foreground/40 hover:bg-muted/40'
                  )}
                >
                  <p className="font-mono text-xs font-semibold">{plan.code}</p>
                  <p className="mt-0.5 text-sm font-medium">{plan.name}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {plan.countedItems}/{plan.totalItems} contadas · {warehouseName(plan.warehouseId)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </TabPanel>
      )}

      {activeTab === 'discrepancies' && (
        <TabPanel
          icon={TriangleAlert}
          iconClass="text-amber-500"
          title="Discrepancias detectadas"
          description="Líneas contadas con variación distinta de cero, cruzadas con el estado del ajuste que generaron. Fuera de tolerancia resalta según el % configurado en Configuración → Conteo cíclico."
        >
          {discrepancyRows.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Sin discrepancias"
              description="Ningún conteo capturado hasta ahora encontró una diferencia."
            />
          ) : (
            <DataTable
              columns={discrepancyCols}
              data={discrepancyRows}
              searchColumn="productName"
              searchPlaceholder="Buscar por producto…"
              emptyMessage="Sin discrepancias."
              rowClassName={(row: DiscrepancyRow) => cn(row.outOfTolerance && 'bg-red-50/50 dark:bg-red-950/30')}
            />
          )}
        </TabPanel>
      )}

      <CreateCountDialog open={!!createDialog.data} onClose={createDialog.close} />
    </div>
  )
}

export default CycleCountPage
