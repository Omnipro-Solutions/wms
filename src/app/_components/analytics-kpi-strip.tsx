"use client"

import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useDashboardFilters } from "./dashboard-filters"
import { getMockKpis } from "./dashboard-mock-data"

export const AnalyticsKpiStrip = () => {
  const { warehouseId, days } = useDashboardFilters()
  const kpis = getMockKpis(warehouseId, days)

  const otifColor =
    kpis.otif >= 90
      ? "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300"
      : kpis.otif >= 80
        ? "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        : "bg-destructive/10 text-destructive"

  const iraColor =
    kpis.ira >= 95
      ? "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300"
      : kpis.ira >= 90
        ? "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        : "bg-destructive/10 text-destructive"

  const alertsColor =
    kpis.criticalAlerts > 0
      ? "bg-destructive/10 text-destructive"
      : "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300"

  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
      <div className="grid divide-y *:data-[slot=card]:rounded-none *:data-[slot=card]:ring-0 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="font-normal text-sm">Órdenes Pendientes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-2xl leading-none tracking-tight">{kpis.pendingOrders}</div>
              <Badge className="bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                <ArrowUpRight />
                pendientes
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <span>
                picking activo <span className="text-foreground">{kpis.ordersInPicking}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-normal text-sm">En Picking</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-2xl leading-none tracking-tight">{kpis.ordersInPicking}</div>
              <Badge className="bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                <ArrowUpRight />
                activas
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <span>
                parciales <span className="text-foreground">{kpis.partialPickingTasks}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-normal text-sm">OTIF</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-2xl leading-none tracking-tight">{kpis.otif.toFixed(1)}%</div>
              <Badge className={cn(otifColor)}>
                {kpis.otif >= 90 ? <ArrowUpRight /> : <ArrowDownRight />}
                objetivo 90%
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <span>On time in full</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-normal text-sm">IRA</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-2xl leading-none tracking-tight">{kpis.ira.toFixed(1)}%</div>
              <Badge className={cn(iraColor)}>
                {kpis.ira >= 95 ? <ArrowUpRight /> : <ArrowDownRight />}
                objetivo 95%
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <span>Inventory Record Accuracy</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-normal text-sm">Alertas Críticas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-2xl leading-none tracking-tight">{kpis.criticalAlerts}</div>
              <Badge className={cn(alertsColor)}>
                {kpis.criticalAlerts > 0 ? <ArrowUpRight /> : <ArrowDownRight />}
                {kpis.criticalAlerts > 0 ? "activas" : "sin alertas"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <span>
                SLA breaches <span className="text-foreground">{kpis.slaBreaches}</span>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
