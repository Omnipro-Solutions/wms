"use client";

import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { useWmsStore } from "@/store/wms-store";
import { useStoreHelpers } from "@/hooks/use-store-helpers";
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
import type { ReturnOrder } from "@/types/wms";

type SortField = "rma" | "customer" | "type" | "disposition" | "status";
type SortDir = "asc" | "desc";

interface AdvanceReturnDialogData {
  returnId: string;
  rmaCode: string;
  customerName: string;
  currentStatus: string;
  nextStatus: string;
  disposition: string;
}

const TYPE_LABELS: Record<ReturnOrder["type"], string> = {
  customer_to_store: "Cliente → Tienda",
  customer_store_to_dc: "Cliente/Tienda → DC",
  store_to_dc: "Tienda → DC",
  store_to_store: "Tienda → Tienda",
  dc_to_supplier: "DC → Proveedor",
};

const DISPOSITION_COLORS: Record<ReturnOrder["disposition"], string> = {
  restock: "bg-green-100 text-green-700 border-green-200",
  scrap: "bg-red-100 text-red-700 border-red-200",
  quality_control: "bg-amber-100 text-amber-700 border-amber-200",
  repair: "bg-blue-100 text-blue-700 border-blue-200",
  rejected: "bg-slate-100 text-slate-600 border-slate-200",
};

const DISPOSITION_LABELS: Record<ReturnOrder["disposition"], string> = {
  restock: "Reingresar",
  scrap: "Desecho",
  quality_control: "Control calidad",
  repair: "Reparación",
  rejected: "Rechazada",
};

const NEXT_STATUS_MAP: Partial<Record<string, string>> = {
  requested: "received_at_store",
  received_at_store: "in_transit_to_dc",
  in_transit_to_dc: "received_at_dc",
  received_at_dc: "under_validation",
  under_validation: "next_by_disposition",
  sent_to_quality_control: "next_by_disposition",
  sent_to_repair: "reentered",
  reentered: "closed",
  sent_to_scrap: "closed",
  rejected: "closed",
};

const TERMINAL_STATUSES = new Set(["closed", "rejected"]);

const STATUS_LABELS: Record<string, string> = {
  requested: "Solicitada",
  received_at_store: "Recibida en tienda",
  in_transit_to_dc: "En tránsito al DC",
  received_at_dc: "Recibida en DC",
  under_validation: "En validación",
  sent_to_quality_control: "En control calidad",
  reentered: "Reingresada",
  sent_to_repair: "En reparación",
  sent_to_scrap: "En desecho",
  rejected: "Rechazada",
  closed: "Cerrada",
};

function SortIcon({ field, active, dir }: { field: string; active: string; dir: SortDir }) {
  if (active !== field) return null;
  return dir === "asc"
    ? <ChevronUp className="ml-1 inline size-3" />
    : <ChevronDown className="ml-1 inline size-3" />;
}

function resolveNextStatus(ret: ReturnOrder): string | null {
  const raw = NEXT_STATUS_MAP[ret.status];
  if (!raw) return null;
  if (raw !== "next_by_disposition") return raw;
  if (ret.disposition === "restock") return "reentered";
  if (ret.disposition === "scrap") return "sent_to_scrap";
  if (ret.disposition === "repair") return "sent_to_repair";
  return "sent_to_quality_control";
}

export default function ReturnsPage() {
  const state = useWmsStore();
  const { advanceReturn } = useWmsStore();
  const { warehouseName, productName } = useStoreHelpers();

  const [sortField, setSortField] = useState<SortField>("rma");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [dispositionFilter, setDispositionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const advanceDialog = useDialogState<AdvanceReturnDialogData>();

  const filtered = state.returnOrders.filter((r) => {
    if (dispositionFilter !== "all" && r.disposition !== dispositionFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const d = sortDir === "asc" ? 1 : -1;
    if (sortField === "rma") return a.rmaCode.localeCompare(b.rmaCode) * d;
    if (sortField === "customer") return a.customerName.localeCompare(b.customerName) * d;
    if (sortField === "type") return a.type.localeCompare(b.type) * d;
    if (sortField === "disposition") return a.disposition.localeCompare(b.disposition) * d;
    return a.status.localeCompare(b.status) * d;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const openAdvanceDialog = (ret: ReturnOrder) => {
    const next = resolveNextStatus(ret);
    if (!next) return;
    advanceDialog.open({
      returnId: ret.id,
      rmaCode: ret.rmaCode,
      customerName: ret.customerName,
      currentStatus: ret.status,
      nextStatus: next,
      disposition: ret.disposition,
    });
  };

  const handleAdvance = () => {
    if (!advanceDialog.data) return;
    try {
      advanceReturn(advanceDialog.data.returnId, "Operador");
      advanceDialog.close();
    } catch (e: unknown) {
      advanceDialog.setError(e instanceof Error ? e.message : "Error al avanzar devolución");
    }
  };

  const inTransitCount = state.returnOrders.filter((r) => r.status === "in_transit_to_dc").length;
  const validationCount = state.returnOrders.filter((r) =>
    r.status === "under_validation" || r.status === "sent_to_quality_control"
  ).length;
  const closedCount = state.returnOrders.filter((r) => r.status === "closed").length;

  return (
    <>
      <PageHeader
        title="Devoluciones"
        description="Flujo de 11 estados: desde la solicitud del cliente hasta el cierre (reingreso, desecho o reparación)."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">En tránsito al DC</p>
            <p className="text-2xl font-bold tabular-nums text-blue-600">{formatNumber(inTransitCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">En validación / QC</p>
            <p className="text-2xl font-bold tabular-nums text-amber-600">{formatNumber(validationCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Cerradas</p>
            <p className="text-2xl font-bold tabular-nums text-green-700">{formatNumber(closedCount)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Undo2 className="size-4" /> Devoluciones (RMA)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={dispositionFilter} onValueChange={setDispositionFilter}>
                <SelectTrigger className="h-8 w-44">
                  <SelectValue placeholder="Disposición" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las disposiciones</SelectItem>
                  <SelectItem value="restock">Reingresar</SelectItem>
                  <SelectItem value="scrap">Desecho</SelectItem>
                  <SelectItem value="quality_control">Control calidad</SelectItem>
                  <SelectItem value="repair">Reparación</SelectItem>
                  <SelectItem value="rejected">Rechazada</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-52">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("rma")}>
                  RMA <SortIcon field="rma" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("customer")}>
                  Cliente <SortIcon field="customer" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("type")}>
                  Tipo <SortIcon field="type" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead>Origen</TableHead>
                <TableHead />
                <TableHead>Destino</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("disposition")}>
                  Disposición <SortIcon field="disposition" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("status")}>
                  Estado <SortIcon field="status" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((ret) => {
                const reason = state.reasons.find((r) => r.id === ret.reasonId);
                const next = resolveNextStatus(ret);
                return (
                  <TableRow key={ret.id}>
                    <TableCell className="font-medium">{ret.rmaCode}</TableCell>
                    <TableCell>{ret.customerName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {TYPE_LABELS[ret.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{warehouseName(ret.originId)}</TableCell>
                    <TableCell><ArrowRight className="size-4 text-muted-foreground" /></TableCell>
                    <TableCell className="text-sm">{warehouseName(ret.destinationId)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${DISPOSITION_COLORS[ret.disposition]}`}>
                        {DISPOSITION_LABELS[ret.disposition]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {reason?.label ?? "—"}
                    </TableCell>
                    <TableCell><StatusBadge status={ret.status} /></TableCell>
                    <TableCell>
                      {!TERMINAL_STATUSES.has(ret.status) && next && (
                        <Button size="sm" onClick={() => openAdvanceDialog(ret)}>
                          Avanzar
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

      {/* Lines detail for non-closed returns */}
      {sorted.filter((r) => !TERMINAL_STATUSES.has(r.status)).map((ret) => (
        <Card key={ret.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Undo2 className="size-4 text-amber-600" />
              {ret.rmaCode} — {ret.customerName}
              <StatusBadge status={ret.status} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ret.items.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{productName(line.productId)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(line.requestedQuantity)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!advanceDialog.data} onOpenChange={(o) => { if (!o) advanceDialog.close(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avanzar devolución</DialogTitle>
          </DialogHeader>
          {advanceDialog.data && (
            <div className="space-y-4 py-2">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>RMA: <span className="font-medium text-foreground">{advanceDialog.data.rmaCode}</span></p>
                <p>Cliente: <span className="font-medium text-foreground">{advanceDialog.data.customerName}</span></p>
                <p>Disposición: <span className="font-medium text-foreground capitalize">{advanceDialog.data.disposition}</span></p>
              </div>
              <div className="flex items-center gap-3 rounded-md border p-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Estado actual</p>
                  <p className="mt-1 text-sm font-medium">{STATUS_LABELS[advanceDialog.data.currentStatus] ?? advanceDialog.data.currentStatus}</p>
                </div>
                <ArrowRight className="size-5 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Nuevo estado</p>
                  <p className="mt-1 text-sm font-medium text-primary">{STATUS_LABELS[advanceDialog.data.nextStatus] ?? advanceDialog.data.nextStatus}</p>
                </div>
              </div>
              {advanceDialog.data.nextStatus === "reentered" && (
                <p className="text-sm text-muted-foreground">
                  Al reingresar se registrará un movimiento de tipo <strong>return</strong> en el log de auditoría.
                </p>
              )}
              {advanceDialog.error && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <TriangleAlert className="size-3" /> {advanceDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={advanceDialog.close}>Cancelar</Button>
            <Button onClick={handleAdvance}>
              <CheckCircle2 className="mr-1 size-4" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
