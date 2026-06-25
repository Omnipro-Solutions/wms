'use client'

import { useMemo } from 'react'
import { useWmsStore } from '@/store/wms-store'
import {
  selectDashboardKpis,
  selectExpiringItems,
  selectCriticalStockItems,
  selectSlaBreaches,
  selectDashboardChartData,
} from '@/store/selectors'
import { KpiCard } from '@/components/shared/kpi-card'
import { PageHeader } from '@/components/shared/page-header'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { OtifIraGauge } from './_components/otif-ira-gauge'
import { DemandTrendChart } from './_components/demand-trend-chart'
import { OrdersByStatusChart } from './_components/orders-by-status-chart'
import { OperatorProductivityChart } from './_components/operator-productivity-chart'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  Snowflake,
  TrendingDown,
  TrendingUp,
  Truck,
  BarChart3,
} from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const state = useWmsStore()
  const { operator } = useCurrentOperator()
  const kpis = useMemo(() => selectDashboardKpis(state), [state])
  const expiring = useMemo(() => selectExpiringItems(state), [state])
  const criticalStock = useMemo(() => selectCriticalStockItems(state), [state])
  const slaBreaches = useMemo(() => selectSlaBreaches(state, Date.now()), [state])
  const chartData = useMemo(() => selectDashboardChartData(state), [state])

  const breached = slaBreaches.filter((s) => s.isBreached)
  const atRisk = slaBreaches.filter((s) => s.isAtRisk && !s.isBreached)

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={operator ? `Hola, ${operator.name}` : 'Dashboard'}
        description="Resumen operativo del almacén"
      />

      {/* Alert banners */}
      {kpis.inventoryFreezeActive && (
        <div className="flex items-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Snowflake className="h-4 w-4" />
          <span className="font-medium">Inventario congelado.</span>
          <span>Las operaciones de ajuste y movimiento están bloqueadas.</span>
          <Link href="/admin" className="ml-auto underline">Descongelar</Link>
        </div>
      )}
      {breached.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">{breached.length} SLA vencido{breached.length > 1 ? 's' : ''}.</span>
          <span>{breached.map((s) => s.orderNumber).join(', ')}</span>
        </div>
      )}
      {atRisk.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Clock className="h-4 w-4" />
          <span className="font-medium">{atRisk.length} orden{atRisk.length > 1 ? 'es' : ''} en riesgo de SLA.</span>
        </div>
      )}
      {expiring.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">{expiring.length} ítem{expiring.length > 1 ? 's' : ''} por vencer.</span>
          <Link href="/inventory/lot-trace" className="ml-auto underline">Ver lotes</Link>
        </div>
      )}
      {criticalStock.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <TrendingDown className="h-4 w-4" />
          <span className="font-medium">{criticalStock.length} producto{criticalStock.length > 1 ? 's' : ''} en stock crítico.</span>
          <Link href="/inventory" className="ml-auto underline">Ver inventario</Link>
        </div>
      )}

      {/* 6 KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiCard
          icon={Truck}
          label="OTIF"
          value={`${kpis.otif.toFixed(1)}%`}
          tone={kpis.otif >= 90 ? 'green' : kpis.otif >= 80 ? 'amber' : 'red'}
        />
        <KpiCard
          icon={CheckCircle2}
          label="IRA exactitud"
          value={`${kpis.ira.toFixed(1)}%`}
          tone={kpis.ira >= 98 ? 'green' : kpis.ira >= 95 ? 'amber' : 'red'}
        />
        <KpiCard icon={Package} label="Órdenes pendientes" value={kpis.pendingOrders} tone="blue" />
        <KpiCard icon={BarChart3} label="Oleadas activas" value={kpis.activeWaves} tone="neutral" />
        <KpiCard
          icon={Clock}
          label="SLA vencidos"
          value={kpis.slaBreaches}
          tone={kpis.slaBreaches > 0 ? 'red' : 'green'}
        />
        <KpiCard
          icon={TrendingDown}
          label="Stock crítico"
          value={kpis.criticalStockItems}
          tone={kpis.criticalStockItems > 0 ? 'red' : 'neutral'}
        />
      </div>

      {/* Charts 2-column grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <OtifIraGauge gauges={chartData.gauges} />
        <DemandTrendChart weeklyDemand={chartData.weeklyDemand} />
        <OrdersByStatusChart ordersByStatus={chartData.ordersByStatus} />
        <OperatorProductivityChart operatorProductivity={chartData.operatorProductivity} />
      </div>
    </div>
  )
}
