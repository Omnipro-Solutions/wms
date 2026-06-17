'use client'

import { AlertTriangle, Clock, RefreshCw, Settings2, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDateTime, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { IntegrationConnection } from '@/types/wms'
import { STATUS_CONFIG, TYPE_META } from './integration-meta'

const STATUS_BUTTON: Record<IntegrationConnection['status'], React.ReactNode> = {
  active: (
    <Button size="sm" variant="outline" className="h-8 w-full gap-1.5 text-xs font-medium">
      <RefreshCw className="size-3" /> Sincronizar
    </Button>
  ),
  error: (
    <Button size="sm" className="h-8 w-full gap-1.5 bg-red-600 text-xs font-medium text-white hover:bg-red-700">
      <RefreshCw className="size-3" /> Reintentar
    </Button>
  ),
  pending_configuration: (
    <Button size="sm" variant="outline" className="h-8 w-full gap-1.5 text-xs font-medium">
      <Settings2 className="size-3" /> Configurar
    </Button>
  ),
  inactive: (
    <Button size="sm" variant="ghost" className="h-8 w-full gap-1.5 text-xs text-muted-foreground" disabled>
      <WifiOff className="size-3" /> Sin conexión
    </Button>
  ),
}

export const StatusDot = ({ status }: { status: IntegrationConnection['status'] }) => {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className="relative flex size-2.5 shrink-0">
      {cfg.pulsing && (
        <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', cfg.dotClass)} />
      )}
      <span className={cn('relative inline-flex size-2.5 rounded-full', cfg.dotClass)} />
    </span>
  )
}

interface IntegrationCardProps {
  integration: IntegrationConnection
  maxMessages: number
}

export const IntegrationCard = ({ integration, maxMessages }: IntegrationCardProps) => {
  const cfg = STATUS_CONFIG[integration.status]
  const type = TYPE_META[integration.type]
  const TypeIcon = type.icon
  const msgPct = maxMessages > 0 ? (integration.processedMessages / maxMessages) * 100 : 0

  const barColor =
    integration.status === 'error'
      ? 'bg-red-400'
      : integration.status === 'active'
        ? 'bg-emerald-500'
        : 'bg-slate-300'

  return (
    <Card
      className={cn(
        'flex flex-col overflow-hidden shadow-xs transition-all duration-200 hover:shadow-md',
        cfg.cardBorder,
        integration.status === 'error' && 'bg-red-50/30'
      )}
    >
      <CardContent className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', type.iconBg)}>
            <TypeIcon className={cn('size-4', type.iconColor)} />
          </div>
          <div className={cn('flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium', cfg.pillClass)}>
            <StatusDot status={integration.status} />
            {cfg.label}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold leading-tight text-foreground">{integration.name}</p>
          <Badge variant="outline" className={cn('text-[10px] font-medium', type.badgeClass)}>
            {type.label}
          </Badge>
        </div>

        <div className="h-px w-full bg-border/60" />

        <div className="space-y-2.5">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Mensajes</span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatNumber(integration.processedMessages)}
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full transition-all duration-700', barColor)}
                style={{ width: `${Math.max(msgPct, 3)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3" /> Última sync
            </span>
            <span className="tabular-nums text-muted-foreground">
              {integration.lastSyncAt ? formatDateTime(integration.lastSyncAt) : '—'}
            </span>
          </div>
        </div>

        {integration.lastError && (
          <div className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50 px-2.5 py-2">
            <AlertTriangle className="mt-px size-3 shrink-0 text-red-500" />
            <p className="text-[11px] leading-snug text-red-700">{integration.lastError}</p>
          </div>
        )}

        <div className="mt-auto">{STATUS_BUTTON[integration.status]}</div>
      </CardContent>
    </Card>
  )
}
