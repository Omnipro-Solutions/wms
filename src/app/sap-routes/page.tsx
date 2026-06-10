"use client";

import {
  ChevronDown,
  ChevronUp,
  Route,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { useWmsStore } from "@/store/wms-store";
import { useStoreHelpers } from "@/hooks/use-store-helpers";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { SapRoute } from "@/types/wms";

type SortField = "code" | "name" | "carrier" | "routeDate" | "status" | "load";
type SortDir = "asc" | "desc";

function SortIcon({ field, active, dir }: { field: string; active: string; dir: SortDir }) {
  if (active !== field) return null;
  return dir === "asc"
    ? <ChevronUp className="ml-1 inline size-3" />
    : <ChevronDown className="ml-1 inline size-3" />;
}

export default function SapRoutesPage() {
  const state = useWmsStore();
  const { warehouseName } = useStoreHelpers();

  const [sortField, setSortField] = useState<SortField>("routeDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState("all");
  const [carrierFilter, setCarrierFilter] = useState("all");

  const carriers = [...new Set(state.sapRoutes.map((r) => r.carrierName))];

  const filtered = state.sapRoutes.filter((r: SapRoute) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (carrierFilter !== "all" && r.carrierName !== carrierFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const d = sortDir === "asc" ? 1 : -1;
    if (sortField === "code") return a.code.localeCompare(b.code) * d;
    if (sortField === "name") return a.name.localeCompare(b.name) * d;
    if (sortField === "carrier") return a.carrierName.localeCompare(b.carrierName) * d;
    if (sortField === "routeDate") return a.routeDate.localeCompare(b.routeDate) * d;
    if (sortField === "status") return a.status.localeCompare(b.status) * d;
    const loadA = a.capacityKg > 0 ? a.currentLoadKg / a.capacityKg : 0;
    const loadB = b.capacityKg > 0 ? b.currentLoadKg / b.capacityKg : 0;
    return (loadA - loadB) * d;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const inTransitCount = state.sapRoutes.filter((r) => r.status === "in_transit").length;
  const syncedCount = state.sapRoutes.filter((r) => r.status === "synced").length;
  const totalLoad = state.sapRoutes.reduce((s, r) => s + r.currentLoadKg, 0);

  return (
    <>
      <PageHeader
        title="Rutas SAP"
        description="Rutas de transporte sincronizadas desde SAP. Seguimiento de carga, conductor y estado por ruta."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">En tránsito</p>
            <p className="text-2xl font-bold tabular-nums text-blue-600">{formatNumber(inTransitCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Sincronizadas</p>
            <p className="text-2xl font-bold tabular-nums text-green-700">{formatNumber(syncedCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Carga total activa (kg)</p>
            <p className="text-2xl font-bold tabular-nums">{formatNumber(totalLoad)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Route className="size-4" /> Rutas SAP
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={carrierFilter} onValueChange={setCarrierFilter}>
                <SelectTrigger className="h-8 w-44">
                  <SelectValue placeholder="Transportadora" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {carriers.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in_progress">En preparación</SelectItem>
                  <SelectItem value="in_transit">En tránsito</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="synced">Sincronizado</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("code")}>
                  Código <SortIcon field="code" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("name")}>
                  Nombre <SortIcon field="name" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Destinos</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("carrier")}>
                  Transportadora <SortIcon field="carrier" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Truck className="size-3" /> Conductor / Placa
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("routeDate")}>
                  Fecha ruta <SortIcon field="routeDate" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="cursor-pointer w-40" onClick={() => toggleSort("load")}>
                  Ocupación <SortIcon field="load" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("status")}>
                  Estado <SortIcon field="status" active={sortField} dir={sortDir} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((route) => {
                const loadPct = route.capacityKg > 0
                  ? Math.round((route.currentLoadKg / route.capacityKg) * 100)
                  : 0;
                const loadColor = loadPct >= 90
                  ? "[&>div]:bg-red-500"
                  : loadPct >= 70
                  ? "[&>div]:bg-amber-500"
                  : "";

                return (
                  <TableRow key={route.id}>
                    <TableCell className="font-mono text-sm font-medium">{route.code}</TableCell>
                    <TableCell className="font-medium">{route.name}</TableCell>
                    <TableCell className="text-sm">{warehouseName(route.originId)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {route.destinationIds.map((did) => (
                          <Badge key={did} variant="outline" className="text-xs">
                            {warehouseName(did)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{route.carrierName}</TableCell>
                    <TableCell className="text-sm">
                      <p className="font-medium">{route.driverName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{route.truckPlate}</p>
                    </TableCell>
                    <TableCell className="text-sm">{route.routeDate}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={loadPct} className={`h-2 w-20 ${loadColor}`} />
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {formatNumber(route.currentLoadKg)}/{formatNumber(route.capacityKg)} kg
                        </span>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={route.status} /></TableCell>
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
