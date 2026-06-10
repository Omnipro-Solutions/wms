"use client";

import {
  AlertTriangle,
  CheckCircle2,
  PlayCircle,
  TriangleAlert,
  Warehouse,
} from "lucide-react";
import { useWmsStore } from "@/store/wms-store";
import { useStoreHelpers } from "@/hooks/use-store-helpers";
import { useDialogState } from "@/hooks/use-dialog-state";
import { needsReplenishment, replenishmentPriority } from "@/lib/rules/replenishment";
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
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/formatters";
import type { ReplenishmentTask } from "@/types/wms";

interface TaskDialogData {
  taskId: string;
  productName: string;
  fromCode: string;
  toCode: string;
  suggestedQty: number;
  action: "start" | "complete";
}

const PRIORITY_COLORS: Record<ReplenishmentTask["priority"], string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

const PRIORITY_LABELS: Record<ReplenishmentTask["priority"], string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export default function ReplenishmentPage() {
  const state = useWmsStore();
  const { startReplenishment, completeReplenishment } = useWmsStore();
  const { productName, locationCode } = useStoreHelpers();

  const taskDialog = useDialogState<TaskDialogData>();

  const openTaskDialog = (task: ReplenishmentTask, action: "start" | "complete") => {
    taskDialog.open({
      taskId: task.id,
      productName: productName(task.productId),
      fromCode: locationCode(task.originLocationId),
      toCode: locationCode(task.destinationLocationId),
      suggestedQty: task.suggestedQuantity,
      action,
    });
  };

  const handleConfirm = () => {
    if (!taskDialog.data) return;
    try {
      if (taskDialog.data.action === "start") {
        startReplenishment(taskDialog.data.taskId, "Operador");
      } else {
        completeReplenishment(taskDialog.data.taskId);
      }
      taskDialog.close();
    } catch (e: unknown) {
      taskDialog.setError(e instanceof Error ? e.message : "Error en la operación");
    }
  };

  // Sort: high priority first, then by currentStock/minStock ratio ascending
  const sorted = [...state.replenishmentTasks].sort((a, b) => {
    const RANK: Record<ReplenishmentTask["priority"], number> = { high: 3, medium: 2, low: 1 };
    if (RANK[b.priority] !== RANK[a.priority]) return RANK[b.priority] - RANK[a.priority];
    const ratioA = a.minStock > 0 ? a.currentStock / a.minStock : 1;
    const ratioB = b.minStock > 0 ? b.currentStock / b.minStock : 1;
    return ratioA - ratioB;
  });

  const highCount = state.replenishmentTasks.filter((t) => t.priority === "high" && t.status !== "completed").length;
  const pendingCount = state.replenishmentTasks.filter((t) => t.status === "pending").length;
  const completedCount = state.replenishmentTasks.filter((t) => t.status === "completed").length;

  return (
    <>
      <PageHeader
        title="Abastecimiento (Replenishment)"
        description="Reposición de pick faces desde reserva. Prioridad calculada en vivo desde stock mínimo."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className={highCount > 0 ? "border-red-200 bg-red-50" : ""}>
          <CardContent className="pt-6">
            <p className={`text-sm ${highCount > 0 ? "text-red-700" : "text-muted-foreground"}`}>
              Prioridad alta
            </p>
            <p className={`text-2xl font-bold tabular-nums ${highCount > 0 ? "text-red-700" : ""}`}>
              {formatNumber(highCount)}
            </p>
            {highCount > 0 && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="size-3" /> Requieren atención inmediata
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pendientes</p>
            <p className="text-2xl font-bold tabular-nums text-amber-600">{formatNumber(pendingCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Completadas</p>
            <p className="text-2xl font-bold tabular-nums text-green-700">{formatNumber(completedCount)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Warehouse className="size-4" /> Tareas de reposición
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Destino (pick face)</TableHead>
                <TableHead className="text-right">Stock actual</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead className="text-right">Máximo</TableHead>
                <TableHead className="text-right">Sugerido</TableHead>
                <TableHead className="w-32">Nivel</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((task) => {
                const livePriority = replenishmentPriority(
                  task.currentStock,
                  task.minStock,
                  state.settings.replenishmentHighFactor
                );
                const needsRep = needsReplenishment(task.currentStock, task.minStock);
                const stockPercent = task.maxStock > 0
                  ? Math.round((task.currentStock / task.maxStock) * 100)
                  : 0;

                return (
                  <TableRow key={task.id} className={livePriority === "high" && task.status !== "completed" ? "bg-red-50/40" : ""}>
                    <TableCell className="font-medium">{productName(task.productId)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${PRIORITY_COLORS[livePriority]}`}>
                        {PRIORITY_LABELS[livePriority]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{locationCode(task.originLocationId)}</TableCell>
                    <TableCell className="font-mono text-xs">{locationCode(task.destinationLocationId)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${needsRep && task.status !== "completed" ? "font-semibold text-red-600" : ""}`}>
                      {formatNumber(task.currentStock)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatNumber(task.minStock)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatNumber(task.maxStock)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatNumber(task.suggestedQuantity)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={stockPercent}
                          className={`h-2 w-20 ${stockPercent < 30 ? "[&>div]:bg-red-500" : stockPercent < 60 ? "[&>div]:bg-amber-500" : ""}`}
                        />
                        <span className="text-xs tabular-nums text-muted-foreground">{stockPercent}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {task.operatorName ?? "—"}
                    </TableCell>
                    <TableCell><StatusBadge status={task.status} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {task.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => openTaskDialog(task, "start")}>
                            <PlayCircle className="mr-1 size-3" /> Asignar
                          </Button>
                        )}
                        {task.status === "assigned" && (
                          <Button size="sm" onClick={() => openTaskDialog(task, "complete")}>
                            <CheckCircle2 className="mr-1 size-3" /> Completar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!taskDialog.data} onOpenChange={(o) => { if (!o) taskDialog.close(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {taskDialog.data?.action === "start" ? "Asignar tarea de reposición" : "Completar reposición"}
            </DialogTitle>
          </DialogHeader>
          {taskDialog.data && (
            <div className="space-y-4 py-2">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Producto: <span className="font-medium text-foreground">{taskDialog.data.productName}</span></p>
                <p>Desde: <span className="font-mono font-medium text-foreground">{taskDialog.data.fromCode}</span></p>
                <p>Hacia: <span className="font-mono font-medium text-foreground">{taskDialog.data.toCode}</span></p>
                <p>Cantidad sugerida: <span className="font-medium text-foreground">{taskDialog.data.suggestedQty} uds.</span></p>
              </div>
              {taskDialog.data.action === "complete" && (
                <p className="text-sm text-muted-foreground">
                  Se moverán <strong>{taskDialog.data.suggestedQty} uds.</strong> desde la reserva al pick face y se registrará el movimiento en el log de auditoría.
                </p>
              )}
              {taskDialog.error && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <TriangleAlert className="size-3" /> {taskDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={taskDialog.close}>Cancelar</Button>
            <Button onClick={handleConfirm}>
              <CheckCircle2 className="mr-1 size-4" />
              {taskDialog.data?.action === "start" ? "Confirmar asignación" : "Confirmar reposición"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
