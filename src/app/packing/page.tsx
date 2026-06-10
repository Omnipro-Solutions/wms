"use client";

import {
  CheckCircle2,
  Package,
  ScanLine,
  Tag,
  TriangleAlert,
} from "lucide-react";
import { useWmsStore } from "@/store/wms-store";
import { useDialogState } from "@/hooks/use-dialog-state";
import { PageHeader } from "@/components/shared/page-header";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/formatters";
import { useState } from "react";
import type { PackingOrder } from "@/types/wms";

interface PackDialogData {
  packingOrderId: string;
  customerName: string;
  expectedItems: number;
  suggestedBox: string;
}

const VERIFICATION_COLORS: Record<PackingOrder["verificationStatus"], string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  verified: "bg-green-100 text-green-700 border-green-200",
  mismatch: "bg-red-100 text-red-700 border-red-200",
};

const VERIFICATION_LABELS: Record<PackingOrder["verificationStatus"], string> = {
  pending: "Pendiente",
  verified: "Verificado",
  mismatch: "Discrepancia",
};

export default function PackingPage() {
  const state = useWmsStore();
  const { completePacking, generateLabel } = useWmsStore();

  const [scannedQty, setScannedQty] = useState("");
  const packDialog = useDialogState<PackDialogData>();

  const openPackDialog = (order: PackingOrder) => {
    packDialog.open({
      packingOrderId: order.id,
      customerName: order.customerName,
      expectedItems: order.expectedItems,
      suggestedBox: order.suggestedBox,
    });
    setScannedQty(String(order.expectedItems));
  };

  const handleCompletePacking = () => {
    if (!packDialog.data) return;
    const n = parseInt(scannedQty, 10);
    if (isNaN(n) || n < 0) { packDialog.setError("Ingresa una cantidad válida."); return; }
    try {
      completePacking(packDialog.data.packingOrderId, n);
      packDialog.close();
      setScannedQty("");
    } catch (e: unknown) {
      packDialog.setError(e instanceof Error ? e.message : "Error al verificar packing");
    }
  };

  const handleGenerateLabel = (packingOrderId: string) => {
    try { generateLabel(packingOrderId); } catch (e: unknown) { console.error(e); }
  };

  const pendingCount = state.packingOrders.filter((p) => p.verificationStatus === "pending").length;
  const verifiedCount = state.packingOrders.filter((p) => p.verificationStatus === "verified").length;
  const mismatchCount = state.packingOrders.filter((p) => p.verificationStatus === "mismatch").length;

  return (
    <>
      <PageHeader
        title="Packing"
        description="Verifica el contenido de los paquetes contra el picking. Genera etiquetas de despacho cuando la verificación es exitosa."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pendientes de verificar</p>
            <p className="text-2xl font-bold tabular-nums text-amber-600">{formatNumber(pendingCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Verificados</p>
            <p className="text-2xl font-bold tabular-nums text-green-700">{formatNumber(verifiedCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Con discrepancia</p>
            <p className="text-2xl font-bold tabular-nums text-red-600">{formatNumber(mismatchCount)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="size-4" /> Órdenes de packing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Esperado</TableHead>
                <TableHead className="text-right">Escaneado</TableHead>
                <TableHead className="w-32">Progreso</TableHead>
                <TableHead>Caja sugerida</TableHead>
                <TableHead className="text-right">Peso (kg)</TableHead>
                <TableHead>Verificación</TableHead>
                <TableHead>Etiqueta</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.packingOrders.map((pk) => {
                const progress = pk.expectedItems > 0
                  ? Math.round((pk.scannedItems / pk.expectedItems) * 100)
                  : 0;
                const order = state.commerceOrders.find((o) => o.id === pk.orderId);

                return (
                  <TableRow key={pk.id}>
                    <TableCell className="font-medium">
                      {order?.orderNumber ?? pk.orderId}
                    </TableCell>
                    <TableCell>{pk.customerName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(pk.expectedItems)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(pk.scannedItems)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={progress}
                          className={`h-2 w-20 ${pk.verificationStatus === "mismatch" ? "[&>div]:bg-red-500" : ""}`}
                        />
                        <span className="text-xs tabular-nums text-muted-foreground">{progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{pk.suggestedBox}</TableCell>
                    <TableCell className="text-right tabular-nums">{pk.weightKg}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${VERIFICATION_COLORS[pk.verificationStatus]}`}>
                        {VERIFICATION_LABELS[pk.verificationStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {pk.labelGenerated
                        ? <Badge variant="secondary" className="text-xs text-green-700">Generada</Badge>
                        : <span className="text-xs text-muted-foreground">—</span>
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {pk.verificationStatus === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => openPackDialog(pk)}>
                            <ScanLine className="mr-1 size-3" /> Verificar
                          </Button>
                        )}
                        {pk.verificationStatus === "verified" && !pk.labelGenerated && (
                          <Button size="sm" onClick={() => handleGenerateLabel(pk.id)}>
                            <Tag className="mr-1 size-3" /> Etiquetar
                          </Button>
                        )}
                        {pk.verificationStatus === "mismatch" && (
                          <Button size="sm" variant="outline" className="text-red-700 border-red-300"
                            onClick={() => openPackDialog(pk)}>
                            <ScanLine className="mr-1 size-3" /> Re-verificar
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

      <Dialog open={!!packDialog.data} onOpenChange={(o) => { if (!o) packDialog.close(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verificar packing</DialogTitle>
          </DialogHeader>
          {packDialog.data && (
            <div className="space-y-4 py-2">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Cliente: <span className="font-medium text-foreground">{packDialog.data.customerName}</span></p>
                <p>Caja sugerida: <span className="font-medium text-foreground">{packDialog.data.suggestedBox}</span></p>
                <p>Ítems esperados: <span className="font-medium text-foreground">{packDialog.data.expectedItems}</span></p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pack-qty">Ítems escaneados</Label>
                <Input
                  id="pack-qty"
                  type="number"
                  min={0}
                  value={scannedQty}
                  onChange={(e) => setScannedQty(e.target.value)}
                />
              </div>
              {packDialog.data && parseInt(scannedQty, 10) !== packDialog.data.expectedItems && scannedQty !== "" && (
                <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  <TriangleAlert className="size-4 shrink-0" />
                  <p>
                    Discrepancia detectada: esperado {packDialog.data.expectedItems}, escaneado {scannedQty}.
                    Se registrará como <strong>mismatch</strong>.
                  </p>
                </div>
              )}
              {packDialog.error && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <TriangleAlert className="size-3" /> {packDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={packDialog.close}>Cancelar</Button>
            <Button onClick={handleCompletePacking}>
              <CheckCircle2 className="mr-1 size-4" /> Confirmar verificación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
