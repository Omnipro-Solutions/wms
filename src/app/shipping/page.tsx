"use client";

import {
  CheckCircle2,
  Clock,
  Truck,
  TriangleAlert,
} from "lucide-react";
import { useWmsStore } from "@/store/wms-store";
import { useDialogState } from "@/hooks/use-dialog-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { otifPercentage } from "@/lib/rules/shipping";
import type { Shipment } from "@/types/wms";

interface ShipDialogData {
  shipmentId: string;
  customerName: string;
  carrierName: string;
  packageCount: number;
  weightKg: number;
}

const OTIF_COLORS: Record<Shipment["otifStatus"], string> = {
  on_time: "bg-green-100 text-green-700 border-green-200",
  at_risk: "bg-amber-100 text-amber-700 border-amber-200",
  late: "bg-red-100 text-red-700 border-red-200",
};

const OTIF_LABELS: Record<Shipment["otifStatus"], string> = {
  on_time: "A tiempo",
  at_risk: "En riesgo",
  late: "Tarde",
};

export default function ShippingPage() {
  const state = useWmsStore();
  const { shipOrder } = useWmsStore();

  const shipDialog = useDialogState<ShipDialogData>();

  const openShipDialog = (shipment: Shipment) => {
    shipDialog.open({
      shipmentId: shipment.id,
      customerName: shipment.customerName,
      carrierName: shipment.carrierName,
      packageCount: shipment.packageCount,
      weightKg: shipment.weightKg,
    });
  };

  const handleShip = () => {
    if (!shipDialog.data) return;
    try {
      shipOrder(shipDialog.data.shipmentId, "Operador");
      shipDialog.close();
    } catch (e: unknown) {
      shipDialog.setError(e instanceof Error ? e.message : "Error al despachar");
    }
  };

  const otif = otifPercentage(state.shipments);
  const inTransitCount = state.shipments.filter((s) => s.status === "in_transit").length;
  const pendingCount = state.shipments.filter((s) => s.status === "pending").length;

  return (
    <>
      <PageHeader
        title="Shipping — Despacho"
        description="Gestiona el despacho de envíos. Supervisa OTIF y estado de entrega por transportadora."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">OTIF estimado</p>
            <p className={`text-2xl font-bold tabular-nums ${otif >= 90 ? "text-green-700" : otif >= 75 ? "text-amber-600" : "text-red-600"}`}>
              {formatPercent(otif)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">En tránsito</p>
            <p className="text-2xl font-bold tabular-nums text-blue-600">{formatNumber(inTransitCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pendientes de despacho</p>
            <p className="text-2xl font-bold tabular-nums text-amber-600">{formatNumber(pendingCount)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="size-4" /> Envíos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Transportadora</TableHead>
                <TableHead>Ruta SAP</TableHead>
                <TableHead className="text-right">Paquetes</TableHead>
                <TableHead className="text-right">Peso (kg)</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>OTIF</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Despachado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.shipments.map((sh) => {
                const order = state.commerceOrders.find((o) => o.id === sh.orderId);
                const route = sh.sapRouteId
                  ? state.sapRoutes.find((r) => r.id === sh.sapRouteId)
                  : null;

                return (
                  <TableRow key={sh.id}>
                    <TableCell className="font-medium">
                      {order?.orderNumber ?? sh.orderId}
                    </TableCell>
                    <TableCell>{sh.customerName}</TableCell>
                    <TableCell>{sh.carrierName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {route ? route.code : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(sh.packageCount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{sh.weightKg}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {sh.trackingNumber ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${OTIF_COLORS[sh.otifStatus]}`}>
                        <Clock className="mr-1 inline size-3" />
                        {OTIF_LABELS[sh.otifStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell><StatusBadge status={sh.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {sh.shippedAt ? sh.shippedAt.slice(0, 10) : "—"}
                    </TableCell>
                    <TableCell>
                      {sh.status === "pending" && (
                        <Button size="sm" onClick={() => openShipDialog(sh)}>
                          <Truck className="mr-1 size-3" /> Despachar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!shipDialog.data} onOpenChange={(o) => { if (!o) shipDialog.close(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar despacho</DialogTitle>
          </DialogHeader>
          {shipDialog.data && (
            <div className="space-y-4 py-2">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Cliente: <span className="font-medium text-foreground">{shipDialog.data.customerName}</span></p>
                <p>Transportadora: <span className="font-medium text-foreground">{shipDialog.data.carrierName}</span></p>
                <p>Paquetes: <span className="font-medium text-foreground">{shipDialog.data.packageCount}</span></p>
                <p>Peso total: <span className="font-medium text-foreground">{shipDialog.data.weightKg} kg</span></p>
              </div>
              <p className="text-sm text-muted-foreground">
                Esta acción cambiará el estado del envío a <strong>En tránsito</strong> y generará el número de tracking.
              </p>
              {shipDialog.error && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <TriangleAlert className="size-3" /> {shipDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={shipDialog.close}>Cancelar</Button>
            <Button onClick={handleShip}>
              <CheckCircle2 className="mr-1 size-4" /> Confirmar despacho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
