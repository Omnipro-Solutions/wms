"use client";

import { useState } from "react";
import {
  ArrowUpDown,
  Boxes,
  ChevronDown,
  ChevronUp,
  Filter,
  TriangleAlert,
} from "lucide-react";
import { useWmsStore } from "@/store/wms-store";
import { availableStock, abcByProduct } from "@/store/selectors";
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

type SortField = "product" | "location" | "onHand" | "available" | "status";
type SortDir = "asc" | "desc";

type ActionType = "hold" | "release" | "adjust";

interface ActionDialogData {
  type: ActionType;
  itemId: string;
  productName: string;
  currentOnHand: number;
  currentHold: number;
}

const DIALOG_TITLES: Record<ActionType, string> = {
  hold: "Poner en espera (hold)",
  release: "Liberar del hold",
  adjust: "Ajuste de inventario",
};

function SortIcon({
  field,
  active,
  dir,
}: {
  field: string;
  active: string;
  dir: SortDir;
}) {
  if (active !== field) return <ArrowUpDown className="ml-1 inline size-3 opacity-40" />;
  return dir === "asc"
    ? <ChevronUp className="ml-1 inline size-3" />
    : <ChevronDown className="ml-1 inline size-3" />;
}

export default function InventoryPage() {
  const state = useWmsStore();
  const { holdInventory, releaseInventory, adjustInventory } = useWmsStore();
  const { productName, locationCode } = useStoreHelpers();

  const abc = abcByProduct(state);

  const [sortField, setSortField] = useState<SortField>("product");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState("all");
  const [qty, setQty] = useState("");

  const actionDialog = useDialogState<ActionDialogData>();

  const filtered = state.inventoryItems.filter((i) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    return i.onHandQuantity > 0;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortField === "product") return productName(a.productId).localeCompare(productName(b.productId)) * dir;
    if (sortField === "location") return locationCode(a.locationId).localeCompare(locationCode(b.locationId)) * dir;
    if (sortField === "onHand") return (a.onHandQuantity - b.onHandQuantity) * dir;
    if (sortField === "available") return (availableStock(a) - availableStock(b)) * dir;
    return a.status.localeCompare(b.status) * dir;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const openActionDialog = (type: ActionType, item: typeof filtered[0]) => {
    actionDialog.open({
      type,
      itemId: item.id,
      productName: productName(item.productId),
      currentOnHand: item.onHandQuantity,
      currentHold: item.holdQuantity,
    });
    setQty(type === "adjust" ? String(item.onHandQuantity) : "");
  };

  const handleSubmit = () => {
    if (!actionDialog.data) return;
    const n = parseInt(qty, 10);
    if (isNaN(n) || n < 0) { actionDialog.setError("Ingresa una cantidad válida."); return; }
    try {
      if (actionDialog.data.type === "hold") holdInventory(actionDialog.data.itemId, n, "Operador");
      else if (actionDialog.data.type === "release") releaseInventory(actionDialog.data.itemId, n, "Operador");
      else adjustInventory(actionDialog.data.itemId, n, "Operador");
      actionDialog.close();
      setQty("");
    } catch (e: unknown) {
      actionDialog.setError(e instanceof Error ? e.message : "Error en la operación");
    }
  };

  const totalOnHand = filtered.reduce((s, i) => s + i.onHandQuantity, 0);
  const totalAvailable = filtered.reduce((s, i) => s + availableStock(i), 0);
  const totalHold = filtered.reduce((s, i) => s + i.holdQuantity, 0);

  return (
    <>
      <PageHeader
        title="Inventario"
        description="Stock en tiempo real. Fuente única de verdad calculada desde el store central."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total en mano</p>
            <p className="text-2xl font-bold tabular-nums">{formatNumber(totalOnHand)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Disponible</p>
            <p className="text-2xl font-bold tabular-nums text-green-700">{formatNumber(totalAvailable)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">En espera (hold)</p>
            <p className="text-2xl font-bold tabular-nums text-amber-600">{formatNumber(totalHold)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Boxes className="size-4" /> Posiciones de inventario
            </CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="available">Disponible</SelectItem>
                  <SelectItem value="on_hold">En espera</SelectItem>
                  <SelectItem value="reserved">Reservado</SelectItem>
                  <SelectItem value="in_transit">En tránsito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("product")}>
                  Producto <SortIcon field="product" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("location")}>
                  Ubicación <SortIcon field="location" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead>Clase</TableHead>
                <TableHead>Lote / Serial</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("onHand")}>
                  En mano <SortIcon field="onHand" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="text-right">Reservado</TableHead>
                <TableHead className="text-right">Hold</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("available")}>
                  Disponible <SortIcon field="available" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("status")}>
                  Estado <SortIcon field="status" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((item) => {
                const available = availableStock(item);
                const abcClass = abc[item.productId] ?? "C";
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{productName(item.productId)}</TableCell>
                    <TableCell className="font-mono text-xs">{locationCode(item.locationId)}</TableCell>
                    <TableCell>
                      <Badge variant={abcClass === "A" ? "default" : abcClass === "B" ? "secondary" : "outline"}>
                        {abcClass}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.lot ? `L: ${item.lot}` : item.serial ? `S: ${item.serial}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(item.onHandQuantity)}</TableCell>
                    <TableCell className="text-right tabular-nums text-blue-600">{formatNumber(item.reservedQuantity)}</TableCell>
                    <TableCell className="text-right tabular-nums text-amber-600">{formatNumber(item.holdQuantity)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-green-700">
                      {formatNumber(available)}
                    </TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {item.status !== "on_hold" && (
                          <Button size="sm" variant="outline" onClick={() => openActionDialog("hold", item)}>
                            Hold
                          </Button>
                        )}
                        {item.holdQuantity > 0 && (
                          <Button size="sm" variant="outline" onClick={() => openActionDialog("release", item)}>
                            Liberar
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openActionDialog("adjust", item)}>
                          Ajustar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!actionDialog.data} onOpenChange={(o) => { if (!o) actionDialog.close(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.data ? DIALOG_TITLES[actionDialog.data.type] : ""}
            </DialogTitle>
          </DialogHeader>
          {actionDialog.data && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Producto:{" "}
                <span className="font-medium text-foreground">{actionDialog.data.productName}</span>
              </p>
              {actionDialog.data.type === "adjust" && (
                <p className="text-sm text-muted-foreground">
                  Stock actual en mano:{" "}
                  <span className="font-medium text-foreground">{actionDialog.data.currentOnHand}</span>
                </p>
              )}
              {actionDialog.data.type === "release" && (
                <p className="text-sm text-muted-foreground">
                  Cantidad en hold:{" "}
                  <span className="font-medium text-foreground">{actionDialog.data.currentHold}</span>
                </p>
              )}
              <div className="space-y-1">
                <Label htmlFor="inv-qty">
                  {actionDialog.data.type === "adjust" ? "Nueva cantidad en mano" : "Cantidad"}
                </Label>
                <Input
                  id="inv-qty"
                  type="number"
                  min={0}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>
              {actionDialog.error && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <TriangleAlert className="size-3" /> {actionDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={actionDialog.close}>Cancelar</Button>
            <Button onClick={handleSubmit}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
