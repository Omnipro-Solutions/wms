"use client";

import { useState } from "react";
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  PlayCircle,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
} from "lucide-react";
import { useWmsStore } from "@/store/wms-store";
import { useStoreHelpers } from "@/hooks/use-store-helpers";
import { useDialogState } from "@/hooks/use-dialog-state";
import { pickingProgress, missingQuantity } from "@/lib/rules/picking";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/formatters";
import type { PickingTask } from "@/types/wms";

type SortField = "code" | "product" | "location" | "requested" | "status" | "priority";
type SortDir = "asc" | "desc";

interface PickDialogData {
  taskId: string;
  code: string;
  productName: string;
  locationCode: string;
  requestedQuantity: number;
  currentPicked: number;
}

const PRIORITY_COLORS: Record<PickingTask["priority"], string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

const PRIORITY_LABELS: Record<PickingTask["priority"], string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

function SortIcon({ field, active, dir }: { field: string; active: string; dir: SortDir }) {
  if (active !== field) return <ArrowUpDown className="ml-1 inline size-3 opacity-40" />;
  return dir === "asc"
    ? <ChevronUp className="ml-1 inline size-3" />
    : <ChevronDown className="ml-1 inline size-3" />;
}

export default function PickingTasksPage() {
  const state = useWmsStore();
  const { startPicking, completePick, approvePart, rejectPart } = useWmsStore();
  const { productName, locationCode } = useStoreHelpers();

  const [sortField, setSortField] = useState<SortField>("priority");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pickedQty, setPickedQty] = useState("");
  const [reasonId, setReasonId] = useState("");

  const pickDialog = useDialogState<PickDialogData>();

  const partialReasons = state.reasons.filter((r) => r.context === "partial_picking" && r.active);

  const PRIORITY_RANK: Record<PickingTask["priority"], number> = { high: 3, medium: 2, low: 1 };

  const filtered = state.pickingTasks.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const d = sortDir === "asc" ? 1 : -1;
    if (sortField === "code") return a.code.localeCompare(b.code) * d;
    if (sortField === "product") return productName(a.productId).localeCompare(productName(b.productId)) * d;
    if (sortField === "location") return locationCode(a.locationId).localeCompare(locationCode(b.locationId)) * d;
    if (sortField === "requested") return (a.requestedQuantity - b.requestedQuantity) * d;
    if (sortField === "status") return a.status.localeCompare(b.status) * d;
    return (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) * d;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const openPickDialog = (task: PickingTask) => {
    pickDialog.open({
      taskId: task.id,
      code: task.code,
      productName: productName(task.productId),
      locationCode: locationCode(task.locationId),
      requestedQuantity: task.requestedQuantity,
      currentPicked: task.pickedQuantity,
    });
    setPickedQty(String(task.requestedQuantity));
    setReasonId("");
  };

  const handleStartPicking = (taskId: string) => {
    const task = state.pickingTasks.find((t) => t.id === taskId);
    if (!task) return;
    try {
      startPicking(taskId, task.operatorName ?? "Operador");
    } catch (e: unknown) {
      console.error(e);
    }
  };

  const handleCompletePick = () => {
    if (!pickDialog.data) return;
    const n = parseInt(pickedQty, 10);
    if (isNaN(n) || n < 0) { pickDialog.setError("Ingresa una cantidad válida."); return; }
    if (n > pickDialog.data.requestedQuantity) {
      pickDialog.setError(`Máximo: ${pickDialog.data.requestedQuantity}`);
      return;
    }
    const isPartial = n < pickDialog.data.requestedQuantity;
    if (isPartial && !reasonId) { pickDialog.setError("Selecciona un motivo de picking parcial."); return; }
    try {
      completePick(pickDialog.data.taskId, n, isPartial ? reasonId : undefined);
      pickDialog.close();
      setPickedQty("");
      setReasonId("");
    } catch (e: unknown) {
      pickDialog.setError(e instanceof Error ? e.message : "Error al registrar picking");
    }
  };

  const handleApprovePart = (taskId: string) => {
    try { approvePart(taskId); } catch (e: unknown) { console.error(e); }
  };

  const handleRejectPart = (taskId: string) => {
    try { rejectPart(taskId); } catch (e: unknown) { console.error(e); }
  };

  const pendingCount = state.pickingTasks.filter((t) => t.status === "pending" || t.status === "assigned").length;
  const partialCount = state.pickingTasks.filter((t) =>
    ["partially_picked", "partial_with_shortage", "partial_approved", "partial_rejected"].includes(t.status)
  ).length;
  const completedCount = state.pickingTasks.filter((t) => t.status === "completed").length;

  return (
    <>
      <PageHeader
        title="Tareas de picking"
        description="Flujo de 9 estados: pending → assigned → in_progress → parcial / completado. Aprobación de parciales integrada."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pendientes / asignadas</p>
            <p className="text-2xl font-bold tabular-nums text-amber-600">{formatNumber(pendingCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Picking parcial</p>
            <p className="text-2xl font-bold tabular-nums text-blue-600">{formatNumber(partialCount)}</p>
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
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4" /> Tareas
            </CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="assigned">Asignada</SelectItem>
                <SelectItem value="in_progress">En progreso</SelectItem>
                <SelectItem value="partially_picked">Parcialmente pickeada</SelectItem>
                <SelectItem value="partial_with_shortage">Parcial c/faltante</SelectItem>
                <SelectItem value="partial_approved">Parcial aprobada</SelectItem>
                <SelectItem value="partial_rejected">Parcial rechazada</SelectItem>
                <SelectItem value="completed">Completada</SelectItem>
                <SelectItem value="with_issue">Con incidencia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("code")}>
                  Código <SortIcon field="code" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("product")}>
                  Producto <SortIcon field="product" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("location")}>
                  Ubicación <SortIcon field="location" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("priority")}>
                  Prioridad <SortIcon field="priority" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="text-right">Solicitado</TableHead>
                <TableHead className="text-right">Pickeado</TableHead>
                <TableHead className="w-36">Progreso</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("status")}>
                  Estado <SortIcon field="status" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead>Operador</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((task) => {
                const progress = pickingProgress(task.pickedQuantity, task.requestedQuantity);
                const missing = missingQuantity(task.requestedQuantity, task.pickedQuantity);
                const isPartialPending =
                  task.status === "partially_picked" || task.status === "partial_with_shortage";

                return (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.code}</TableCell>
                    <TableCell>{productName(task.productId)}</TableCell>
                    <TableCell className="font-mono text-xs">{locationCode(task.locationId)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${PRIORITY_COLORS[task.priority]}`}>
                        {PRIORITY_LABELS[task.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(task.requestedQuantity)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(task.pickedQuantity)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-2 w-24" />
                        <span className="text-xs tabular-nums text-muted-foreground">{progress}%</span>
                      </div>
                      {missing > 0 && (
                        <p className="mt-0.5 text-xs text-amber-600">Falta: {missing}</p>
                      )}
                    </TableCell>
                    <TableCell><StatusBadge status={task.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {task.operatorName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(task.status === "pending" || task.status === "assigned") && (
                          <Button size="sm" variant="outline" onClick={() => handleStartPicking(task.id)}>
                            <PlayCircle className="mr-1 size-3" />
                            {task.status === "pending" ? "Asignar" : "Iniciar"}
                          </Button>
                        )}
                        {task.status === "in_progress" && (
                          <Button size="sm" onClick={() => openPickDialog(task)}>
                            <CheckCircle2 className="mr-1 size-3" /> Registrar
                          </Button>
                        )}
                        {isPartialPending && (
                          <>
                            <Button size="sm" variant="outline" className="text-green-700 border-green-300"
                              onClick={() => handleApprovePart(task.id)}>
                              <ThumbsUp className="size-3" />
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-700 border-red-300"
                              onClick={() => handleRejectPart(task.id)}>
                              <ThumbsDown className="size-3" />
                            </Button>
                          </>
                        )}
                        {task.status === "partial_rejected" && (
                          <Button size="sm" onClick={() => openPickDialog(task)}>
                            <PlayCircle className="mr-1 size-3" /> Reintentar
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

      <Dialog open={!!pickDialog.data} onOpenChange={(o) => { if (!o) pickDialog.close(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar picking</DialogTitle>
          </DialogHeader>
          {pickDialog.data && (
            <div className="space-y-4 py-2">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Tarea: <span className="font-medium text-foreground">{pickDialog.data.code}</span></p>
                <p>Producto: <span className="font-medium text-foreground">{pickDialog.data.productName}</span></p>
                <p>Ubicación: <span className="font-mono font-medium text-foreground">{pickDialog.data.locationCode}</span></p>
                <p>Solicitado: <span className="font-medium text-foreground">{pickDialog.data.requestedQuantity}</span></p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pick-qty">Cantidad pickeada</Label>
                <Input
                  id="pick-qty"
                  type="number"
                  min={0}
                  max={pickDialog.data.requestedQuantity}
                  value={pickedQty}
                  onChange={(e) => setPickedQty(e.target.value)}
                />
              </div>
              {parseInt(pickedQty, 10) < pickDialog.data.requestedQuantity && pickedQty !== "" && (
                <div className="space-y-1">
                  <Label htmlFor="pick-reason">Motivo picking parcial</Label>
                  <Select value={reasonId} onValueChange={setReasonId}>
                    <SelectTrigger id="pick-reason">
                      <SelectValue placeholder="Seleccionar motivo…" />
                    </SelectTrigger>
                    <SelectContent>
                      {partialReasons.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {pickDialog.error && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <TriangleAlert className="size-3" /> {pickDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={pickDialog.close}>Cancelar</Button>
            <Button onClick={handleCompletePick}>
              <CheckCircle2 className="mr-1 size-4" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
