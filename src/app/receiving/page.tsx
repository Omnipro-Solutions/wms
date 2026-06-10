"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MapPin,
  PackageCheck,
  TriangleAlert,
} from "lucide-react";
import { useWmsStore } from "@/store/wms-store";
import { selectSlottingRecommendations, abcByProduct } from "@/store/selectors";

function SortIcon({
  field,
  active,
  dir,
}: {
  field: string;
  active: string;
  dir: "asc" | "desc";
}) {
  if (active !== field) return null;
  return dir === "asc" ? <ChevronUp className="ml-1 inline size-3" /> : <ChevronDown className="ml-1 inline size-3" />;
}
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

type SortField = "code" | "appointmentDate" | "status";
type SortDir = "asc" | "desc";

export default function ReceivingPage() {
  const state = useWmsStore();
  const { receiveAsn, putawayItem } = useWmsStore();

  const abc = abcByProduct(state);
  const recommendations = selectSlottingRecommendations(state);

  const [sortField, setSortField] = useState<SortField>("appointmentDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [receiveDialog, setReceiveDialog] = useState<{ asnId: string; max: number } | null>(null);
  const [putawayDialog, setPutawayDialog] = useState<{ asnId: string } | null>(null);
  const [receivedQty, setReceivedQty] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [error, setError] = useState("");

  const sorted = [...state.asnRecords].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortField === "code") return a.code.localeCompare(b.code) * dir;
    if (sortField === "appointmentDate") return a.appointmentDate.localeCompare(b.appointmentDate) * dir;
    return a.status.localeCompare(b.status) * dir;
  });

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  const productName = (id: string) => state.products.find((p) => p.id === id)?.name ?? id;
  const pickLocations = state.locations.filter((l) => l.type === "pick" || l.type === "staging" || l.type === "quality_control");

  // Putaway location suggestion from slotting
  function suggestedLocation(asnId: string) {
    const asn = state.asnRecords.find((a) => a.id === asnId);
    if (!asn) return null;
    const rec = recommendations.find((r) => r.productId === asn.productId);
    if (rec) return rec.suggestedLocationId;
    return asn.suggestedPutawayLocationId ?? null;
  }

  function handleReceiveSubmit() {
    if (!receiveDialog) return;
    const qty = parseInt(receivedQty, 10);
    if (!qty || qty <= 0) { setError("Ingresa una cantidad válida."); return; }
    if (qty > receiveDialog.max) { setError(`Máximo pendiente: ${receiveDialog.max}`); return; }
    try {
      receiveAsn(receiveDialog.asnId, qty, "Operador");
      setReceiveDialog(null);
      setReceivedQty("");
      setError("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al recibir");
    }
  }

  function handlePutawaySubmit() {
    if (!putawayDialog || !selectedLocation) { setError("Selecciona una ubicación."); return; }
    try {
      putawayItem(putawayDialog.asnId, selectedLocation, "Operador");
      setPutawayDialog(null);
      setSelectedLocation("");
      setError("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al hacer putaway");
    }
  }

  return (
    <>
      <PageHeader
        title="Recepciones (ASN)"
        description="Gestiona la recepción de mercancía y el putaway dirigido por slotting."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageCheck className="size-4" /> Avisos de despacho (ASN)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("code")}
                >
                  Código <SortIcon field="code" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Clase ABC</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("appointmentDate")}
                >
                  Cita <SortIcon field="appointmentDate" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="text-right">Esperado</TableHead>
                <TableHead className="text-right">Recibido</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("status")}
                >
                  Estado <SortIcon field="status" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead>Flags</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((asn) => {
                const abcClass = abc[asn.productId] ?? "C";
                const pending = asn.expectedQuantity - asn.receivedQuantity;
                return (
                  <TableRow key={asn.id}>
                    <TableCell className="font-medium">{asn.code}</TableCell>
                    <TableCell>{asn.supplierName}</TableCell>
                    <TableCell>{productName(asn.productId)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={abcClass === "A" ? "default" : abcClass === "B" ? "secondary" : "outline"}
                      >
                        {abcClass}
                      </Badge>
                    </TableCell>
                    <TableCell>{asn.appointmentDate}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(asn.expectedQuantity)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(asn.receivedQuantity)}</TableCell>
                    <TableCell><StatusBadge status={asn.status} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {asn.requiresQualityControl && (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">QC</Badge>
                        )}
                        {asn.crossDocking && (
                          <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">CD</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {(asn.status === "pending" || asn.status === "partial") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReceiveDialog({ asnId: asn.id, max: pending });
                              setReceivedQty(String(pending));
                              setError("");
                            }}
                          >
                            Recibir
                          </Button>
                        )}
                        {(asn.status === "partial" || asn.status === "completed") && (
                          <Button
                            size="sm"
                            onClick={() => {
                              const sug = suggestedLocation(asn.id);
                              setSelectedLocation(sug ?? "");
                              setPutawayDialog({ asnId: asn.id });
                              setError("");
                            }}
                          >
                            <MapPin className="mr-1 size-3" /> Putaway
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

      {/* Receive Dialog */}
      <Dialog open={!!receiveDialog} onOpenChange={(o) => { if (!o) { setReceiveDialog(null); setError(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar recepción</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="rcv-qty">Cantidad recibida (máx: {receiveDialog?.max})</Label>
              <Input
                id="rcv-qty"
                type="number"
                min={1}
                max={receiveDialog?.max}
                value={receivedQty}
                onChange={(e) => setReceivedQty(e.target.value)}
              />
            </div>
            {error && (
              <p className="flex items-center gap-1 text-sm text-destructive">
                <TriangleAlert className="size-3" /> {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReceiveDialog(null); setError(""); }}>Cancelar</Button>
            <Button onClick={handleReceiveSubmit}>
              <CheckCircle2 className="mr-1 size-4" /> Confirmar recepción
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Putaway Dialog */}
      <Dialog open={!!putawayDialog} onOpenChange={(o) => { if (!o) { setPutawayDialog(null); setError(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="size-4" /> Putaway dirigido
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {putawayDialog && (() => {
              const sug = suggestedLocation(putawayDialog.asnId);
              const asn = state.asnRecords.find((a) => a.id === putawayDialog.asnId);
              const abcClass = asn ? abc[asn.productId] : "C";
              return sug ? (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
                  <p className="font-medium text-blue-800">Sugerencia de slotting (Clase {abcClass})</p>
                  <p className="text-blue-700">
                    Ubicar en <strong>{state.locations.find((l) => l.id === sug)?.code}</strong> para
                    optimizar distancia de picking.
                  </p>
                </div>
              ) : null;
            })()}
            <div className="space-y-1">
              <Label htmlFor="pa-loc">Ubicación de destino</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger id="pa-loc">
                  <SelectValue placeholder="Seleccionar ubicación…" />
                </SelectTrigger>
                <SelectContent>
                  {pickLocations.map((l) => {
                    const isSuggested = putawayDialog && l.id === suggestedLocation(putawayDialog.asnId);
                    return (
                      <SelectItem key={l.id} value={l.id}>
                        {l.code} — {l.zone}
                        {isSuggested ? " ★ Sugerida" : ""}
                        {l.golden ? " (golden)" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {error && (
              <p className="flex items-center gap-1 text-sm text-destructive">
                <TriangleAlert className="size-3" /> {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPutawayDialog(null); setError(""); }}>Cancelar</Button>
            <Button onClick={handlePutawaySubmit}>
              <CheckCircle2 className="mr-1 size-4" /> Confirmar putaway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
