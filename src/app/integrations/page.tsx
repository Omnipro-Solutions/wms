'use client'

import {
  AlertCircle,
  Cable,
  CheckCircle2,
  Clock,
  RefreshCw,
  Settings2,
  TriangleAlert,
} from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatNumber } from '@/lib/formatters'
import type { IntegrationConnection } from '@/types/wms'

const TYPE_LABELS: Record<IntegrationConnection['type'], string> = {
  sap: 'SAP ERP',
  ecommerce: 'Ecommerce',
  marketplace: 'Marketplace',
  carrier: 'Transportadora',
  erp: 'ERP',
  oms: 'OMS',
  pos: 'POS',
  supplier: 'Proveedor',
}

const TYPE_COLORS: Record<IntegrationConnection['type'], string> = {
  sap: 'bg-blue-100 text-blue-700 border-blue-200',
  ecommerce: 'bg-purple-100 text-purple-700 border-purple-200',
  marketplace: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  carrier: 'bg-amber-100 text-amber-700 border-amber-200',
  erp: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  oms: 'bg-teal-100 text-teal-700 border-teal-200',
  pos: 'bg-green-100 text-green-700 border-green-200',
  supplier: 'bg-slate-100 text-slate-600 border-slate-200',
}

const STATUS_CONFIG: Record<
  IntegrationConnection['status'],
  { label: string; icon: React.ReactNode; className: string }
> = {
  active: {
    label: 'Activa',
    icon: <CheckCircle2 className="size-4 text-green-600" />,
    className: 'text-green-700 bg-green-50 border-green-200',
  },
  inactive: {
    label: 'Inactiva',
    icon: <Clock className="size-4 text-slate-400" />,
    className: 'text-slate-600 bg-slate-50 border-slate-200',
  },
  error: {
    label: 'Error',
    icon: <AlertCircle className="size-4 text-red-600" />,
    className: 'text-red-700 bg-red-50 border-red-200',
  },
  pending_configuration: {
    label: 'Sin configurar',
    icon: <Settings2 className="size-4 text-amber-600" />,
    className: 'text-amber-700 bg-amber-50 border-amber-200',
  },
}

export default function IntegrationsPage() {
  const state = useWmsStore()

  const activeCount = state.integrations.filter((i) => i.status === 'active').length
  const errorCount = state.integrations.filter((i) => i.status === 'error').length
  const totalMessages = state.integrations.reduce((s, i) => s + i.processedMessages, 0)

  return (
    <>
      <PageHeader
        title="Integraciones"
        description="Conexiones con sistemas externos: SAP, ecommerce, marketplaces, transportadoras y POS."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className={errorCount > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardContent className="pt-6">
            <p className={`text-sm ${errorCount > 0 ? 'text-red-700' : 'text-muted-foreground'}`}>
              Con errores
            </p>
            <p
              className={`text-2xl font-bold tabular-nums ${errorCount > 0 ? 'text-red-700' : ''}`}
            >
              {formatNumber(errorCount)}
            </p>
            {errorCount > 0 && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                <TriangleAlert className="size-3" /> Requieren atención
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Activas</p>
            <p className="text-2xl font-bold text-green-700 tabular-nums">
              {formatNumber(activeCount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Mensajes procesados</p>
            <p className="text-2xl font-bold tabular-nums">{formatNumber(totalMessages)}</p>
          </CardContent>
        </Card>
      </div>

      {errorCount > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-4 pb-4">
            <p className="flex items-center gap-2 text-sm font-medium text-red-700">
              <AlertCircle className="size-4" /> Integraciones con error
            </p>
            <div className="mt-2 space-y-1">
              {state.integrations
                .filter((i) => i.status === 'error')
                .map((i) => (
                  <p key={i.id} className="text-sm text-red-600">
                    <span className="font-medium">{i.name}:</span>{' '}
                    {i.lastError ?? 'Error desconocido'}
                  </p>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {state.integrations.map((integration) => {
          const cfg = STATUS_CONFIG[integration.status]
          return (
            <Card key={integration.id} className={`border ${cfg.className}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{integration.name}</CardTitle>
                    <Badge variant="outline" className={`text-xs ${TYPE_COLORS[integration.type]}`}>
                      {TYPE_LABELS[integration.type]}
                    </Badge>
                  </div>
                  {cfg.icon}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Estado</span>
                  <span className="font-medium">{cfg.label}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Mensajes</span>
                  <span className="font-medium tabular-nums">
                    {formatNumber(integration.processedMessages)}
                  </span>
                </div>
                {integration.lastSyncAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Última sync</span>
                    <span className="text-xs tabular-nums">
                      {integration.lastSyncAt.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                )}
                {integration.lastError && (
                  <p className="rounded bg-red-100 px-2 py-1 text-xs text-red-700">
                    {integration.lastError}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  {integration.status === 'active' && (
                    <Button size="sm" variant="outline" className="flex-1">
                      <RefreshCw className="mr-1 size-3" /> Sincronizar
                    </Button>
                  )}
                  {integration.status === 'error' && (
                    <Button size="sm" className="flex-1">
                      <RefreshCw className="mr-1 size-3" /> Reintentar
                    </Button>
                  )}
                  {integration.status === 'pending_configuration' && (
                    <Button size="sm" variant="outline" className="flex-1">
                      <Settings2 className="mr-1 size-3" /> Configurar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cable className="size-4" /> Resumen de integraciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Mensajes</TableHead>
                <TableHead>Última sincronización</TableHead>
                <TableHead>Último error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.integrations.map((integration) => (
                <TableRow key={integration.id}>
                  <TableCell className="font-medium">{integration.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${TYPE_COLORS[integration.type]}`}>
                      {TYPE_LABELS[integration.type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {STATUS_CONFIG[integration.status].icon}
                      <span className="text-sm">{STATUS_CONFIG[integration.status].label}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(integration.processedMessages)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {integration.lastSyncAt
                      ? integration.lastSyncAt.slice(0, 16).replace('T', ' ')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-red-600">
                    {integration.lastError ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
