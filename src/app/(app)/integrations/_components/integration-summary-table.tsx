'use client'

import { Cable } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { IntegrationConnection } from '@/types/wms'
import { STATUS_CONFIG, TYPE_META } from './integration-meta'
import { StatusDot } from './integration-card'

const STATUS_TEXT_COLOR: Record<IntegrationConnection['status'], string> = {
  active: 'text-emerald-700',
  error: 'text-red-700',
  pending_configuration: 'text-amber-700',
  inactive: 'text-slate-500',
}

interface IntegrationSummaryTableProps {
  integrations: IntegrationConnection[]
}

export const IntegrationSummaryTable = ({ integrations }: IntegrationSummaryTableProps) => (
  <Card className="overflow-hidden shadow-xs">
    <CardHeader className="border-b bg-muted/30 px-5 py-3.5">
      <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Cable className="size-4 text-muted-foreground" />
        Resumen de integraciones
      </CardTitle>
    </CardHeader>
    <CardContent className="p-0">
      {integrations.map((integration, idx) => {
        const cfg = STATUS_CONFIG[integration.status]
        const type = TYPE_META[integration.type]
        const TypeIcon = type.icon
        return (
          <div
            key={integration.id}
            className={cn(
              'flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/40',
              idx !== integrations.length - 1 && 'border-b'
            )}
          >
            <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', type.iconBg)}>
              <TypeIcon className={cn('size-4', type.iconColor)} />
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate text-sm font-medium">{integration.name}</span>
              <Badge variant="outline" className={cn('shrink-0 text-[10px]', type.badgeClass)}>
                {type.label}
              </Badge>
            </div>

            <div className="flex shrink-0 items-center gap-5 text-xs">
              <div className="flex items-center gap-1.5">
                <StatusDot status={integration.status} />
                <span className={cn('font-medium', STATUS_TEXT_COLOR[integration.status])}>
                  {cfg.label}
                </span>
              </div>
              <span className="hidden tabular-nums text-muted-foreground sm:block">
                {formatNumber(integration.processedMessages)} msgs
              </span>
              <span className="hidden tabular-nums text-muted-foreground md:block">
                {formatDateTime(integration.lastSyncAt)}
              </span>
              {integration.lastError && (
                <span className="hidden max-w-48 truncate text-red-600 lg:block">
                  {integration.lastError}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </CardContent>
  </Card>
)
