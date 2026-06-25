'use client'

import { AlertTriangle, CheckCircle2, Clock, DollarSign, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { KpiCard } from '@/components/shared/kpi-card'
import { formatDate, formatNumber, formatPercent } from '@/lib/formatters'
import { otifBreakdown, otifByCarrier, costByCarrier, type OtifAlert } from '@/lib/rules/shipping'
import { cn } from '@/lib/utils'
import type { Shipment } from '@/types/wms'

interface Props {
  shipments: Shipment[]
  alerts: OtifAlert[]
  today: string
}

const OTIF_COLORS = {
  on_time: 'bg-green-100 text-green-700 border-green-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50',
  at_risk: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50',
  late: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50',
}

const OTIF_LABELS = {
  on_time: 'A tiempo',
  at_risk: 'En riesgo',
  late: 'Tarde',
}

const ProgressBar = ({ value, color }: { value: number; color: string }) => (
  <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
    <div
      className={cn('h-full rounded-full transition-all', color)}
      style={{ width: `${Math.min(100, value)}%` }}
    />
  </div>
)

export const OtifDashboard = ({ shipments, alerts, today }: Props) => {
  const breakdown = otifBreakdown(shipments)
  const total = shipments.length
  const carrierOtif = otifByCarrier(shipments)
  const carrierCost = costByCarrier(shipments)

  const onTimePct = total > 0 ? Math.round((breakdown.on_time / total) * 100) : 0
  const atRiskPct = total > 0 ? Math.round((breakdown.at_risk / total) * 100) : 0
  const latePct = total > 0 ? Math.round((breakdown.late / total) * 100) : 0

  return (
    <div className="space-y-6">
      {/* OTIF KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          icon={CheckCircle2}
          value={breakdown.on_time}
          label="A tiempo"
          sublabel={`${formatPercent(onTimePct)} del total`}
          tone="green"
        />
        <KpiCard
          icon={Clock}
          value={breakdown.at_risk}
          label="En riesgo"
          sublabel={`${formatPercent(atRiskPct)} del total`}
          tone="amber"
          alert={breakdown.at_risk > 0}
        />
        <KpiCard
          icon={AlertTriangle}
          value={breakdown.late}
          label="Con retraso"
          sublabel={`${formatPercent(latePct)} del total`}
          tone="red"
          alert={breakdown.late > 0}
        />
      </div>

      {/* OTIF bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="size-4" /> Distribución OTIF global
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-green-700 dark:text-emerald-300 font-medium">A tiempo</span>
              <span className="tabular-nums">{breakdown.on_time} ({formatPercent(onTimePct)})</span>
            </div>
            <ProgressBar value={onTimePct} color="bg-green-500" />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-amber-600 dark:text-amber-300 font-medium">En riesgo</span>
              <span className="tabular-nums">{breakdown.at_risk} ({formatPercent(atRiskPct)})</span>
            </div>
            <ProgressBar value={atRiskPct} color="bg-amber-400" />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-red-600 dark:text-red-300 font-medium">Con retraso</span>
              <span className="tabular-nums">{breakdown.late} ({formatPercent(latePct)})</span>
            </div>
            <ProgressBar value={latePct} color="bg-red-500" />
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-4" />
              Alertas OTIF — {alerts.length} envío{alerts.length !== 1 ? 's' : ''} requieren atención
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Transportadora</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Prometido</TableHead>
                  <TableHead>Estimado</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Días</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((a) => (
                  <TableRow key={a.shipmentId}>
                    <TableCell className="font-mono text-sm font-medium">{a.orderNumber}</TableCell>
                    <TableCell className="text-sm">{a.customerName}</TableCell>
                    <TableCell className="text-sm">{a.carrierName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{a.serviceLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(a.promisedDate)}</TableCell>
                    <TableCell className="text-sm">{formatDate(a.estimatedDeliveryDate)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn('text-xs', OTIF_COLORS[a.otifStatus])}
                      >
                        {OTIF_LABELS[a.otifStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          a.daysOverdue > 0 ? 'text-red-600 dark:text-red-300' : 'text-amber-600 dark:text-amber-300'
                        )}
                      >
                        {a.daysOverdue > 0 ? `+${a.daysOverdue}` : a.daysOverdue === 0 ? 'Hoy' : `${a.daysOverdue}`}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Performance por carrier */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="size-4" /> OTIF por transportadora
            </CardTitle>
          </CardHeader>
          <CardContent>
            {carrierOtif.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin datos.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transportadora</TableHead>
                    <TableHead className="text-right">Envíos</TableHead>
                    <TableHead className="text-right">OTIF %</TableHead>
                    <TableHead className="w-32">Barra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carrierOtif
                    .sort((a, b) => b.onTimeRate - a.onTimeRate)
                    .map((c) => (
                      <TableRow key={c.carrierId}>
                        <TableCell className="font-medium">{c.carrierName}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(c.total)}</TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              'font-bold tabular-nums',
                              c.onTimeRate >= 90
                                ? 'text-green-700 dark:text-emerald-300'
                                : c.onTimeRate >= 70
                                  ? 'text-amber-600 dark:text-amber-300'
                                  : 'text-red-600 dark:text-red-300'
                            )}
                          >
                            {formatPercent(c.onTimeRate)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <ProgressBar
                            value={c.onTimeRate}
                            color={
                              c.onTimeRate >= 90
                                ? 'bg-green-500'
                                : c.onTimeRate >= 70
                                  ? 'bg-amber-400'
                                  : 'bg-red-500'
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Costo por carrier */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <DollarSign className="size-4" /> Costo cotizado por transportadora (USD)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {carrierCost.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin datos.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transportadora</TableHead>
                    <TableHead className="text-right">Envíos</TableHead>
                    <TableHead className="text-right">Total USD</TableHead>
                    <TableHead className="text-right">Promedio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carrierCost.map((c) => (
                    <TableRow key={c.carrierId}>
                      <TableCell className="font-medium">{c.carrierName}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(c.shipmentCount)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        ${c.totalCost.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right tabular-nums text-sm">
                        ${c.shipmentCount > 0 ? (c.totalCost / c.shipmentCount).toFixed(2) : '0.00'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
