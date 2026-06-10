"use client";

import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Grid3x3,
  MapPin,
  MoveRight,
  TriangleAlert,
} from "lucide-react";
import { useWmsStore } from "@/store/wms-store";
import {
  selectSlottingRecommendations,
  abcByProduct,
  misplacedAClassItems,
} from "@/store/selectors";
import { classifyXyz } from "@/lib/rules/slotting";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/formatters";

export default function SlottingPage() {
  const state = useWmsStore();
  const { relocateInventory } = useWmsStore();

  const abc = abcByProduct(state);
  const recommendations = selectSlottingRecommendations(state);
  const misplaced = misplacedAClassItems(state);

  const [confirmDialog, setConfirmDialog] = useState<{
    itemId: string;
    toLocationId: string;
    productName: string;
    fromCode: string;
    toCode: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [relocated, setRelocated] = useState<Set<string>>(new Set());

  const productName = (id: string) => state.products.find((p) => p.id === id)?.name ?? id;
  const locationCode = (id: string) => state.locations.find((l) => l.id === id)?.code ?? id;

  function xyzClass(productId: string) {
    const d = state.demandStats.find((s) => s.productId === productId);
    if (!d) return "Z";
    return classifyXyz(d.demandSamples, state.settings.xyzCvX, state.settings.xyzCvY);
  }

  function openConfirm(rec: ReturnType<typeof selectSlottingRecommendations>[0]) {
    const item = state.inventoryItems.find((i) => i.productId === rec.productId && i.locationId === rec.currentLocationId);
    if (!item) return;
    setConfirmDialog({
      itemId: item.id,
      toLocationId: rec.suggestedLocationId,
      productName: productName(rec.productId),
      fromCode: locationCode(rec.currentLocationId),
      toCode: locationCode(rec.suggestedLocationId),
    });
    setError("");
  }

  function handleRelocate() {
    if (!confirmDialog) return;
    try {
      relocateInventory(confirmDialog.itemId, confirmDialog.toLocationId, "Operador Slotting");
      setRelocated((prev) => new Set([...prev, confirmDialog.itemId]));
      setConfirmDialog(null);
      setError("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al reubicar");
    }
  }

  // Only show recommendations not yet relocated this session
  const activeRecs = recommendations.filter(
    (r) => !relocated.has(state.inventoryItems.find((i) => i.productId === r.productId && i.locationId === r.currentLocationId)?.id ?? "")
  );

  return (
    <>
      <PageHeader
        title="Slotting — Optimización de ubicaciones"
        description="Clasificación ABC/XYZ calculada en vivo desde la demanda. Recomendaciones de reubicación con impacto estimado."
      />

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <p className="text-sm text-amber-700">SKUs clase A mal ubicados</p>
            <p className="text-3xl font-bold tabular-nums text-amber-800">{misplaced.length}</p>
            <p className="mt-1 text-xs text-amber-600">Fuera de golden zone</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Oportunidades de reubicación</p>
            <p className="text-3xl font-bold tabular-nums">{activeRecs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Distancia total a ahorrar</p>
            <p className="text-3xl font-bold tabular-nums">
              {formatNumber(activeRecs.reduce((s, r) => s + r.estimatedDistanceSavedM, 0))} m
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ABC/XYZ Classification table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Grid3x3 className="size-4" /> Clasificación ABC/XYZ por producto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Clase ABC</TableHead>
                <TableHead>Clase XYZ</TableHead>
                <TableHead className="text-right">Unidades vendidas</TableHead>
                <TableHead className="text-right">Frec. picking</TableHead>
                <TableHead>Ubicación actual</TableHead>
                <TableHead>Golden</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.demandStats
                .sort((a, b) => b.pickingFrequency - a.pickingFrequency)
                .map((d) => {
                  const product = state.products.find((p) => p.id === d.productId);
                  const abcClass = abc[d.productId] ?? "C";
                  const xyzC = xyzClass(d.productId);
                  const item = state.inventoryItems.find((i) => i.productId === d.productId);
                  const loc = item ? state.locations.find((l) => l.id === item.locationId) : null;
                  return (
                    <TableRow key={d.productId}>
                      <TableCell className="font-medium">{product?.name ?? d.productId}</TableCell>
                      <TableCell className="font-mono text-xs">{product?.sku ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={abcClass === "A" ? "default" : abcClass === "B" ? "secondary" : "outline"}
                          className={abcClass === "A" ? "bg-green-600" : ""}
                        >
                          {abcClass}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={xyzC === "X" ? "default" : xyzC === "Y" ? "secondary" : "outline"}
                          className={xyzC === "X" ? "bg-blue-600" : xyzC === "Y" ? "" : "text-muted-foreground"}
                        >
                          {xyzC}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(d.unitsSold)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(d.pickingFrequency)}</TableCell>
                      <TableCell className="font-mono text-xs">{loc?.code ?? "—"}</TableCell>
                      <TableCell>
                        {loc?.golden ? (
                          <CheckCircle2 className="size-4 text-green-600" />
                        ) : (
                          <TriangleAlert className="size-4 text-amber-500" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Relocation recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MoveRight className="size-4" /> Recomendaciones de reubicación
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeRecs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
              <CheckCircle2 className="size-8 text-green-500" />
              <p className="text-sm">Sin oportunidades de reubicación — slotting óptimo.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Clase</TableHead>
                  <TableHead>Ubicación actual</TableHead>
                  <TableHead />
                  <TableHead>Ubicación sugerida</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Ahorro distancia</TableHead>
                  <TableHead className="text-right">
                    <Clock className="inline size-3" /> Ahorro tiempo
                  </TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeRecs.map((rec) => {
                  const sugLoc = state.locations.find((l) => l.id === rec.suggestedLocationId);
                  return (
                    <TableRow key={rec.id}>
                      <TableCell className="font-medium">{productName(rec.productId)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={rec.abcClass === "A" ? "default" : rec.abcClass === "B" ? "secondary" : "outline"}
                          className={rec.abcClass === "A" ? "bg-green-600" : ""}
                        >
                          {rec.abcClass}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{locationCode(rec.currentLocationId)}</TableCell>
                      <TableCell>
                        <ArrowRight className="size-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="size-3 text-green-600" />
                          <span className="font-mono text-xs">{locationCode(rec.suggestedLocationId)}</span>
                          {sugLoc?.golden && (
                            <Badge variant="outline" className="ml-1 text-xs text-green-700 border-green-300">
                              golden
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span
                          className={
                            rec.score >= 60
                              ? "font-bold text-green-700"
                              : rec.score >= 30
                              ? "text-amber-600"
                              : "text-muted-foreground"
                          }
                        >
                          {rec.score}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(rec.estimatedDistanceSavedM)} m
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(rec.estimatedTimeSavedSeconds)} s
                      </TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => openConfirm(rec)}>
                          <MoveRight className="mr-1 size-3" /> Reubicar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirm relocation dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={(o) => { if (!o) { setConfirmDialog(null); setError(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar reubicación</DialogTitle>
          </DialogHeader>
          {confirmDialog && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Producto: <span className="font-medium text-foreground">{confirmDialog.productName}</span>
              </p>
              <div className="flex items-center gap-3 rounded-md border p-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Actual</p>
                  <p className="font-mono font-semibold">{confirmDialog.fromCode}</p>
                </div>
                <ArrowRight className="size-5 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Destino</p>
                  <p className="font-mono font-semibold text-green-700">{confirmDialog.toCode}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Esta acción moverá todo el stock a la nueva ubicación y registrará un movimiento de tipo <strong>putaway</strong> en el log de auditoría.
              </p>
              {error && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <TriangleAlert className="size-3" /> {error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmDialog(null); setError(""); }}>Cancelar</Button>
            <Button onClick={handleRelocate}>
              <CheckCircle2 className="mr-1 size-4" /> Confirmar reubicación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
