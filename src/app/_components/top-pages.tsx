"use client"

import { useWmsStore } from "@/store/wms-store"
import { selectDashboardKpis, selectSlaBreaches } from "@/store/selectors"
import { useShallow } from "zustand/react/shallow"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

type AlertRow = {
  id: string
  label: string
  detail: string
  urgency: "critica" | "advertencia" | "info"
}

export const TopPages = () => {
  const kpis = useWmsStore(selectDashboardKpis)
  const { slaBreaches, integrationErrors } = useWmsStore(
    useShallow((s) => ({
      slaBreaches: selectSlaBreaches(s, Date.now()),
      integrationErrors: s.integrations.filter((i) => i.status === "error"),
    }))
  )

  if (!kpis) return null

  const alerts: AlertRow[] = []

  for (const sla of slaBreaches) {
    alerts.push({
      id: `sla-${sla.orderId}`,
      label: sla.isBreached ? "SLA Incumplido" : "SLA en Riesgo",
      detail: `Orden ${sla.orderId} — ${sla.elapsedHours}h / ${sla.maxHours}h (${sla.breachPercent}%)`,
      urgency: sla.isBreached ? "critica" : "advertencia",
    })
  }

  for (const integ of integrationErrors) {
    alerts.push({
      id: `integ-${integ.id}`,
      label: "Error de Integración",
      detail: integ.name,
      urgency: "critica",
    })
  }

  if (kpis.criticalStockItems > 0) {
    alerts.push({
      id: "stock-critical",
      label: "Stock Crítico",
      detail: `${kpis.criticalStockItems} producto(s) bajo mínimo`,
      urgency: "critica",
    })
  }

  if (kpis.expiringItems > 0) {
    alerts.push({
      id: "expiring",
      label: "Próximos a Vencer",
      detail: `${kpis.expiringItems} ítem(s) con vencimiento próximo`,
      urgency: "advertencia",
    })
  }

  if (kpis.inventoryOnHold > 0) {
    alerts.push({
      id: "hold",
      label: "Inventario en Hold",
      detail: `${kpis.inventoryOnHold} unidades bloqueadas`,
      urgency: "info",
    })
  }

  const urgencyBadge = (urgency: AlertRow["urgency"]) => {
    if (urgency === "critica")
      return <Badge className="bg-destructive/10 text-destructive">Crítica</Badge>
    if (urgency === "advertencia")
      return (
        <Badge className="bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          Advertencia
        </Badge>
      )
    return <Badge variant="outline">Info</Badge>
  }

  return (
    <Card className="h-full gap-2">
      <CardHeader>
        <CardTitle className="font-normal">Alertas y SLA</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
          <TableHeader className="[&_tr]:border-border/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 font-normal">Alerta</TableHead>
              <TableHead className="h-8 font-normal">Detalle</TableHead>
              <TableHead className="h-8 w-28 text-right font-normal">Urgencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr]:border-border/50">
            {alerts.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="py-4 text-center text-muted-foreground text-sm">
                  Sin alertas críticas
                </TableCell>
              </TableRow>
            ) : (
              alerts.map((alert) => (
                <TableRow className="hover:bg-transparent" key={alert.id}>
                  <TableCell className="py-4 font-medium">{alert.label}</TableCell>
                  <TableCell className="max-w-0 truncate text-muted-foreground">{alert.detail}</TableCell>
                  <TableCell className="text-right">{urgencyBadge(alert.urgency)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
