"use client";

import {
  CheckCircle2,
  PlayCircle,
  TriangleAlert,
  Waves,
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
import { formatNumber } from "@/lib/formatters";
import type { PickingWave } from "@/types/wms";

interface ReleaseDialogData {
  waveId: string;
  code: string;
  name: string;
  orderCount: number;
  unitCount: number;
}

const GROUP_BY_LABELS: Record<PickingWave["groupBy"], string> = {
  zone: "Zona",
  route: "Ruta",
  priority: "Prioridad",
  carrier: "Transportadora",
  dispatch_window: "Ventana despacho",
  fulfillment_type: "Tipo despacho",
};

const PRIORITY_COLORS: Record<PickingWave["priority"], string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

const PRIORITY_LABELS: Record<PickingWave["priority"], string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export default function PickingWavesPage() {
  const state = useWmsStore();
  const { releaseWave } = useWmsStore();

  const releaseDialog = useDialogState<ReleaseDialogData>();

  const openReleaseDialog = (wave: PickingWave) => {
    releaseDialog.open({
      waveId: wave.id,
      code: wave.code,
      name: wave.name,
      orderCount: wave.orderCount,
      unitCount: wave.unitCount,
    });
  };

  const handleRelease = () => {
    if (!releaseDialog.data) return;
    try {
      releaseWave(releaseDialog.data.waveId);
      releaseDialog.close();
    } catch (e: unknown) {
      releaseDialog.setError(e instanceof Error ? e.message : "Error al liberar oleada");
    }
  };

  const activeCount = state.pickingWaves.filter((w) => w.status === "in_progress").length;
  const draftCount = state.pickingWaves.filter((w) => w.status === "draft").length;
  const totalUnits = state.pickingWaves
    .filter((w) => w.status === "in_progress")
    .reduce((s, w) => s + w.unitCount, 0);

  return (
    <>
      <PageHeader
        title="Oleadas de picking"
        description="Agrupa pedidos por zona, ruta o prioridad. Libera oleadas para iniciar el picking en equipo."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Oleadas activas</p>
            <p className="text-2xl font-bold tabular-nums text-blue-600">{formatNumber(activeCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">En borrador</p>
            <p className="text-2xl font-bold tabular-nums text-amber-600">{formatNumber(draftCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Unidades en oleadas activas</p>
            <p className="text-2xl font-bold tabular-nums">{formatNumber(totalUnits)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Waves className="size-4" /> Oleadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Agrupación</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead>Creada</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.pickingWaves.map((wave) => {

                return (
                  <TableRow key={wave.id}>
                    <TableCell className="font-medium">{wave.code}</TableCell>
                    <TableCell>{wave.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {GROUP_BY_LABELS[wave.groupBy]}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{wave.groupValue}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${PRIORITY_COLORS[wave.priority]}`}>
                        {PRIORITY_LABELS[wave.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(wave.orderCount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(wave.unitCount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {wave.assignedTeam ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{wave.createdAt.slice(0, 10)}</TableCell>
                    <TableCell><StatusBadge status={wave.status} /></TableCell>
                    <TableCell>
                      {wave.status === "draft" && (
                        <Button size="sm" onClick={() => openReleaseDialog(wave)}>
                          <PlayCircle className="mr-1 size-3" /> Liberar
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

      {/* Wave detail card — orders inside the wave */}
      {state.pickingWaves.filter((w) => w.status === "in_progress").map((wave) => (
        <Card key={wave.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Waves className="size-4 text-blue-600" />
              {wave.code} — {wave.name}
              <Badge variant="secondary" className="ml-2">En progreso</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Líneas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wave.orderIds.map((oid) => {
                  const order = state.commerceOrders.find((o) => o.id === oid);
                  if (!order) return null;
                  return (
                    <TableRow key={oid}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{order.customerName}</TableCell>
                      <TableCell className="capitalize text-sm text-muted-foreground">{order.channel}</TableCell>
                      <TableCell><StatusBadge status={order.status} /></TableCell>
                      <TableCell className="text-right tabular-nums">{order.items.length}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!releaseDialog.data} onOpenChange={(o) => { if (!o) releaseDialog.close(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar oleada</DialogTitle>
          </DialogHeader>
          {releaseDialog.data && (
            <div className="space-y-4 py-2">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Oleada: <span className="font-medium text-foreground">{releaseDialog.data.code}</span></p>
                <p>Nombre: <span className="font-medium text-foreground">{releaseDialog.data.name}</span></p>
                <p>Pedidos incluidos: <span className="font-medium text-foreground">{releaseDialog.data.orderCount}</span></p>
                <p>Unidades totales: <span className="font-medium text-foreground">{releaseDialog.data.unitCount}</span></p>
              </div>
              <p className="text-sm text-muted-foreground">
                Liberar cambiará el estado de la oleada a <strong>En progreso</strong> y habilitará las tareas de picking asociadas.
              </p>
              {releaseDialog.error && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <TriangleAlert className="size-3" /> {releaseDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={releaseDialog.close}>Cancelar</Button>
            <Button onClick={handleRelease}>
              <CheckCircle2 className="mr-1 size-4" /> Confirmar liberación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
