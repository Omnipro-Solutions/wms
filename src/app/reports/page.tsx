"use client";

import {
  Download,
  PackageCheck,
  TrendingUp,
  Truck,
  User,
  Warehouse,
} from "lucide-react";
import { useWmsStore } from "@/store/wms-store";
import { productivityByOperator } from "@/lib/rules/picking";
import { receivingDiscrepancies, pickingDiscrepancies } from "@/lib/rules/reports";
import { otifPercentage } from "@/lib/rules/shipping";
import { availableStock } from "@/lib/rules/inventory";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function exportCsv(headers: string[], rows: (string | number)[][], filename: string) {
  const lines = [headers.join(","), ...rows.map((r) => r.join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const state = useWmsStore();

  const productivity = productivityByOperator(state.pickingTasks);
  const receivingDisc = receivingDiscrepancies(state.asnRecords);
  const pickingDisc = pickingDiscrepancies(state.pickingTasks);
  const allDiscrepancies = [...receivingDisc, ...pickingDisc];
  const otif = otifPercentage(state.shipments);
  const otifColor = otif >= 90 ? "text-green-700" : otif >= 75 ? "text-amber-600" : "text-red-600";

  // Inventory report: aggregate by warehouseId
  const invByWarehouse = state.warehouses.map((wh) => {
    const items = state.inventoryItems.filter((i) => i.warehouseId === wh.id);
    return {
      warehouseId: wh.id,
      warehouseName: wh.name,
      totalOnHand: items.reduce((s, i) => s + i.onHandQuantity, 0),
      totalReserved: items.reduce((s, i) => s + i.reservedQuantity, 0),
      totalHold: items.reduce((s, i) => s + i.holdQuantity, 0),
      totalAvailable: items.reduce((s, i) => s + availableStock(i), 0),
      skuCount: new Set(items.map((i) => i.productId)).size,
    };
  }).filter((r) => r.totalOnHand > 0);

  // Stock movements (last 20)
  const recentMovements = [...state.stockMovements]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);

  const handleExportProductivity = () => {
    exportCsv(
      ["Operador", "Picks completados", "Unidades pickeadas", "Parciales", "Incidencias"],
      productivity.map((r) => [r.operatorName, r.picksCompleted, r.unitsPicked, r.partialCount, r.issueCount]),
      "reporte_productividad.csv"
    );
  };

  const handleExportDiscrepancies = () => {
    exportCsv(
      ["Tipo", "Referencia", "Esperado", "Real", "Diferencia"],
      allDiscrepancies.map((r) => [r.referenceType, r.referenceCode, r.expected, r.actual, r.difference]),
      "reporte_discrepancias.csv"
    );
  };

  const handleExportInventory = () => {
    exportCsv(
      ["Bodega", "En mano", "Reservado", "Retenido", "Disponible", "SKUs"],
      invByWarehouse.map((r) => [r.warehouseName, r.totalOnHand, r.totalReserved, r.totalHold, r.totalAvailable, r.skuCount]),
      "reporte_inventario.csv"
    );
  };

  const handleExportMovements = () => {
    exportCsv(
      ["ID", "Tipo", "Producto", "Cantidad", "Referencia", "Operador", "Fecha"],
      recentMovements.map((m) => {
        const product = state.products.find((p) => p.id === m.productId);
        return [m.id, m.type, product?.name ?? m.productId, m.quantity, m.referenceId, m.operatorName, m.createdAt.slice(0, 16)];
      }),
      "reporte_movimientos.csv"
    );
  };

  const handleExportOtif = () => {
    exportCsv(
      ["Pedido", "Cliente", "Transportadora", "Estado OTIF", "Despachado"],
      state.shipments.map((s) => [s.orderId, s.customerName, s.carrierName, s.otifStatus, s.shippedAt ?? "—"]),
      "reporte_otif.csv"
    );
  };

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Reportes operativos: productividad, discrepancias, inventario, movimientos y OTIF. Exportables a CSV."
      />

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Picks completados</p>
            <p className="text-2xl font-bold tabular-nums">
              {formatNumber(productivity.reduce((s, r) => s + r.picksCompleted, 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Discrepancias activas</p>
            <p className={`text-2xl font-bold tabular-nums ${allDiscrepancies.length > 0 ? "text-red-600" : "text-green-700"}`}>
              {formatNumber(allDiscrepancies.length)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">OTIF</p>
            <p className={`text-2xl font-bold tabular-nums ${otifColor}`}>{formatPercent(otif)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Movimientos registrados</p>
            <p className="text-2xl font-bold tabular-nums">{formatNumber(state.stockMovements.length)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Productivity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="size-4" /> Productividad por operador
            </CardTitle>
            <Button size="sm" variant="outline" onClick={handleExportProductivity}>
              <Download className="mr-1 size-3" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operador</TableHead>
                <TableHead className="text-right">Picks completados</TableHead>
                <TableHead className="text-right">Unidades pickeadas</TableHead>
                <TableHead className="text-right">Parciales</TableHead>
                <TableHead className="text-right">Incidencias</TableHead>
                <TableHead className="text-right">Eficiencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productivity.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Sin datos</TableCell>
                </TableRow>
              )}
              {productivity.map((row) => {
                const total = row.picksCompleted + row.partialCount + row.issueCount;
                const eff = total > 0 ? Math.round((row.picksCompleted / total) * 100) : 0;
                return (
                  <TableRow key={row.operatorName}>
                    <TableCell className="font-medium">{row.operatorName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row.picksCompleted)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row.unitsPicked)}</TableCell>
                    <TableCell className="text-right tabular-nums text-amber-600">{formatNumber(row.partialCount)}</TableCell>
                    <TableCell className="text-right tabular-nums text-red-600">{formatNumber(row.issueCount)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={eff >= 90 ? "text-green-700 font-semibold" : eff >= 70 ? "text-amber-600" : "text-red-600"}>
                        {formatPercent(eff)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Discrepancies */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4" /> Discrepancias (recepción + picking)
            </CardTitle>
            <Button size="sm" variant="outline" onClick={handleExportDiscrepancies}>
              <Download className="mr-1 size-3" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead className="text-right">Esperado</TableHead>
                <TableHead className="text-right">Real</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allDiscrepancies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Sin discrepancias</TableCell>
                </TableRow>
              )}
              {allDiscrepancies.map((row, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">{row.referenceType === "asn" ? "Recepción" : "Picking"}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{row.referenceCode}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(row.expected)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(row.actual)}</TableCell>
                  <TableCell className={`text-right tabular-nums font-semibold ${row.difference < 0 ? "text-red-600" : "text-green-700"}`}>
                    {row.difference > 0 ? "+" : ""}{formatNumber(row.difference)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Inventory by warehouse */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Warehouse className="size-4" /> Inventario por bodega
            </CardTitle>
            <Button size="sm" variant="outline" onClick={handleExportInventory}>
              <Download className="mr-1 size-3" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bodega</TableHead>
                <TableHead className="text-right">SKUs</TableHead>
                <TableHead className="text-right">En mano</TableHead>
                <TableHead className="text-right">Reservado</TableHead>
                <TableHead className="text-right">Retenido</TableHead>
                <TableHead className="text-right">Disponible</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invByWarehouse.map((row) => (
                <TableRow key={row.warehouseId}>
                  <TableCell className="font-medium">{row.warehouseName}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(row.skuCount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(row.totalOnHand)}</TableCell>
                  <TableCell className="text-right tabular-nums text-amber-600">{formatNumber(row.totalReserved)}</TableCell>
                  <TableCell className="text-right tabular-nums text-red-600">{formatNumber(row.totalHold)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-green-700">{formatNumber(row.totalAvailable)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent movements */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageCheck className="size-4" /> Últimos movimientos de stock
            </CardTitle>
            <Button size="sm" variant="outline" onClick={handleExportMovements}>
              <Download className="mr-1 size-3" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentMovements.map((mv) => {
                const product = state.products.find((p) => p.id === mv.productId);
                return (
                  <TableRow key={mv.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{mv.type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{product?.name ?? mv.productId}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatNumber(mv.quantity)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{mv.referenceId}</TableCell>
                    <TableCell className="text-sm">{mv.operatorName}</TableCell>
                    <TableCell className="text-sm">{mv.createdAt.slice(0, 16).replace("T", " ")}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* OTIF */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="size-4" /> OTIF — On Time In Full
            </CardTitle>
            <Button size="sm" variant="outline" onClick={handleExportOtif}>
              <Download className="mr-1 size-3" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-4">
            <p className="text-sm text-muted-foreground">OTIF global:</p>
            <p className={`text-3xl font-bold tabular-nums ${otifColor}`}>{formatPercent(otif)}</p>
            <p className="text-sm text-muted-foreground">
              ({state.shipments.filter((s) => s.otifStatus === "on_time").length} de {state.shipments.length} envíos a tiempo)
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Transportadora</TableHead>
                <TableHead>Estado OTIF</TableHead>
                <TableHead>Despachado</TableHead>
                <TableHead>Paquetes</TableHead>
                <TableHead className="text-right">Peso (kg)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.shipments.map((shipment) => {
                const otifColors: Record<typeof shipment.otifStatus, string> = {
                  on_time: "bg-green-100 text-green-700 border-green-200",
                  at_risk: "bg-amber-100 text-amber-700 border-amber-200",
                  late: "bg-red-100 text-red-700 border-red-200",
                };
                const otifLabels: Record<typeof shipment.otifStatus, string> = {
                  on_time: "A tiempo",
                  at_risk: "En riesgo",
                  late: "Tarde",
                };
                return (
                  <TableRow key={shipment.id}>
                    <TableCell className="font-medium">{shipment.customerName}</TableCell>
                    <TableCell className="text-sm">{shipment.carrierName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${otifColors[shipment.otifStatus]}`}>
                        {otifLabels[shipment.otifStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {shipment.shippedAt ? shipment.shippedAt.slice(0, 10) : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatNumber(shipment.packageCount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(shipment.weightKg)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
