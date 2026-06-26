'use client'

import { Activity, AlertCircle, Wifi, WifiOff, Zap } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { IntegrationCard } from './_components/integration-card'
import { IntegrationSummaryTable } from './_components/integration-summary-table'

export default function IntegrationsPage() {
  const integrations = useWmsStore((s) => s.integrations)

  const activeCount = integrations.filter((i) => i.status === 'active').length
  const errorCount = integrations.filter((i) => i.status === 'error').length
  const totalMessages = integrations.reduce((s, i) => s + i.processedMessages, 0)
  const maxMessages = Math.max(...integrations.map((i) => i.processedMessages), 1)
  const errorIntegrations = integrations.filter((i) => i.status === 'error')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Integraciones"
        description="Conexiones con sistemas externos: SAP, ecommerce, marketplaces, transportadoras y POS."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          icon={errorCount > 0 ? WifiOff : Wifi}
          value={errorCount}
          label="Con errores"
          sublabel={errorCount > 0 ? 'Requieren atención inmediata' : 'Sin problemas activos'}
          tone={errorCount > 0 ? 'red' : 'neutral'}
        />
        <KpiCard icon={Activity} value={activeCount} label="Activas" sublabel="Conexiones operativas" tone="green" />
        <KpiCard icon={Zap} value={totalMessages} label="Mensajes procesados" sublabel="Total acumulado" tone="blue" />
      </div>

      {errorIntegrations.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="size-4 text-red-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-red-800">
              {errorIntegrations.length === 1
                ? '1 integración requiere atención'
                : `${errorIntegrations.length} integraciones requieren atención`}
            </p>
            <div className="mt-1 space-y-0.5">
              {errorIntegrations.map((i) => (
                <p key={i.id} className="text-xs text-red-700">
                  <span className="font-semibold">{i.name}:</span> {i.lastError ?? 'Error desconocido'}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {integrations.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} maxMessages={maxMessages} />
        ))}
      </div>

      <IntegrationSummaryTable integrations={integrations} />
    </div>
  )
}
