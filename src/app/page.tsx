"use client";

import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  Grid3x3,
  PackageCheck,
  Route,
  ShoppingCart,
  TrendingUp,
  Truck,
  Undo2,
  Waves,
} from "lucide-react";
import { useWmsStore } from "@/store/wms-store";
import { selectDashboardKpis, selectSlottingRecommendations } from "@/store/selectors";
import { useStoreHelpers } from "@/hooks/use-store-helpers";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber, formatPercent } from "@/lib/formatters";

export default function DashboardPage() {
  const state = useWmsStore();
  const { productName, locationCode } = useStoreHelpers();
  const kpis = selectDashboardKpis(state);
  const recommendations = selectSlottingRecommendations(state).slice(0, 4);
  const recentOrders = [...state.commerceOrders]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title="Dashboard operativo"
        description="Visión general de la operación de bodega y logística."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Pedidos pendientes" value={kpis.pendingOrders} icon={ShoppingCart} description="Pendientes de operación" />
        <KpiCard title="Pedidos en picking" value={kpis.ordersInPicking} icon={ClipboardList} />
        <KpiCard title="Picking parcial" value={kpis.partialPickingTasks} icon={ClipboardList} description="Tareas parciales" />
        <KpiCard title="Oleadas activas" value={kpis.activeWaves} icon={Waves} />
        <KpiCard title="Recepciones pendientes" value={kpis.pendingReceipts} icon={PackageCheck} />
        <KpiCard title="Devoluciones en tránsito" value={kpis.returnsInTransit} icon={Undo2} />
        <KpiCard title="Inventario en espera" value={formatNumber(kpis.inventoryOnHold)} icon={Boxes} description="Unidades en hold" />
        <KpiCard title="Rutas activas" value={kpis.activeRoutes} icon={Route} />
        <KpiCard title="OTIF estimado" value={formatPercent(kpis.otif)} icon={TrendingUp} />
        <KpiCard title="SKUs mal ubicados" value={kpis.misplacedAClassSkus} icon={Grid3x3} description="Clase A fuera de golden zone" />
        <KpiCard title="Alertas críticas" value={kpis.criticalAlerts} icon={AlertTriangle} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pedidos recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.orderNumber}</TableCell>
                    <TableCell>{o.customerName}</TableCell>
                    <TableCell className="capitalize">{o.channel}</TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Grid3x3 className="size-4" /> Salud de slotting
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin oportunidades de reubicación.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Clase</TableHead>
                    <TableHead>Sugerida</TableHead>
                    <TableHead className="text-right">Ahorro (m)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recommendations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{productName(r.productId)}</TableCell>
                      <TableCell>{r.abcClass}</TableCell>
                      <TableCell>{locationCode(r.suggestedLocationId)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(r.estimatedDistanceSavedM)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="size-4" /> Rutas SAP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Transportadora</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.sapRoutes.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell>{r.carrierName}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Salud de integraciones</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Integración</TableHead>
                  <TableHead>Mensajes</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.integrations.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell className="tabular-nums">{formatNumber(i.processedMessages)}</TableCell>
                    <TableCell><StatusBadge status={i.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
