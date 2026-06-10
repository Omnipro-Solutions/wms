"use client";

import {
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  Tag,
} from "lucide-react";
import { useState } from "react";
import { useWmsStore } from "@/store/wms-store";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { WmsLabel } from "@/types/wms";

type SortField = "code" | "type" | "reference" | "status" | "createdAt" | "createdBy";
type SortDir = "asc" | "desc";

const TYPE_LABELS: Record<WmsLabel["type"], string> = {
  product: "Producto",
  location: "Ubicación",
  box: "Caja",
  pallet: "Pallet",
  shipping: "Envío",
  return: "Devolución",
};

const TYPE_COLORS: Record<WmsLabel["type"], string> = {
  product: "bg-blue-100 text-blue-700 border-blue-200",
  location: "bg-slate-100 text-slate-700 border-slate-200",
  box: "bg-amber-100 text-amber-700 border-amber-200",
  pallet: "bg-orange-100 text-orange-700 border-orange-200",
  shipping: "bg-green-100 text-green-700 border-green-200",
  return: "bg-red-100 text-red-700 border-red-200",
};

function SortIcon({ field, active, dir }: { field: string; active: string; dir: SortDir }) {
  if (active !== field) return null;
  return dir === "asc"
    ? <ChevronUp className="ml-1 inline size-3" />
    : <ChevronDown className="ml-1 inline size-3" />;
}

export default function LabelsPage() {
  const state = useWmsStore();

  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = state.labels.filter((l) => {
    if (typeFilter !== "all" && l.type !== typeFilter) return false;
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const d = sortDir === "asc" ? 1 : -1;
    if (sortField === "code") return a.code.localeCompare(b.code) * d;
    if (sortField === "type") return a.type.localeCompare(b.type) * d;
    if (sortField === "reference") return a.reference.localeCompare(b.reference) * d;
    if (sortField === "status") return a.status.localeCompare(b.status) * d;
    if (sortField === "createdBy") return a.createdBy.localeCompare(b.createdBy) * d;
    return a.createdAt.localeCompare(b.createdAt) * d;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const byType = Object.keys(TYPE_LABELS).map((t) => ({
    type: t as WmsLabel["type"],
    count: state.labels.filter((l) => l.type === t).length,
  }));

  const completedCount = state.labels.filter((l) => l.status === "completed").length;
  const pendingCount = state.labels.filter((l) => l.status === "pending").length;

  return (
    <>
      <PageHeader
        title="Etiquetas"
        description="Gestión de etiquetas de producto, ubicación, caja, pallet, envío y devolución."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total etiquetas</p>
            <p className="text-2xl font-bold tabular-nums">{state.labels.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Generadas</p>
            <p className="text-2xl font-bold tabular-nums text-green-700">{completedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pendientes</p>
            <p className="text-2xl font-bold tabular-nums text-amber-600">{pendingCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {byType.map(({ type, count }) => (
          <Card key={type} className="cursor-pointer" onClick={() => setTypeFilter(typeFilter === type ? "all" : type)}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{TYPE_LABELS[type]}</p>
              <p className="text-xl font-bold tabular-nums">{count}</p>
              {typeFilter === type && (
                <p className="mt-1 text-xs text-primary font-medium">Filtrando</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="size-4" /> Etiquetas
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-40">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {Object.entries(TYPE_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="completed">Completada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
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
                <TableHead className="cursor-pointer" onClick={() => toggleSort("type")}>
                  Tipo <SortIcon field="type" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("reference")}>
                  Referencia <SortIcon field="reference" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("status")}>
                  Estado <SortIcon field="status" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("createdBy")}>
                  Creada por <SortIcon field="createdBy" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("createdAt")}>
                  Fecha <SortIcon field="createdAt" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((label) => (
                <TableRow key={label.id}>
                  <TableCell className="font-mono text-sm font-medium">{label.code}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${TYPE_COLORS[label.type]}`}>
                      {TYPE_LABELS[label.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{label.reference}</TableCell>
                  <TableCell><StatusBadge status={label.status} /></TableCell>
                  <TableCell className="text-sm">{label.createdBy}</TableCell>
                  <TableCell className="text-sm">{label.createdAt.slice(0, 16).replace("T", " ")}</TableCell>
                  <TableCell>
                    {label.status === "completed" && (
                      <Button size="sm" variant="outline">
                        <Download className="mr-1 size-3" /> Reimprimir
                      </Button>
                    )}
                    {label.status === "pending" && (
                      <Button size="sm">
                        <RefreshCw className="mr-1 size-3" /> Generar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
