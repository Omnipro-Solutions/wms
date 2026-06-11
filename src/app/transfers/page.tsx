"use client"

import { useMemo, useState } from "react"
import { ArrowRight, ArrowRightLeft, CheckCircle2, TriangleAlert } from "lucide-react"

import { useWmsStore } from "@/store/wms-store"
import { useStoreHelpers } from "@/hooks/use-store-helpers"
import { useDialogState } from "@/hooks/use-dialog-state"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatNumber } from "@/lib/formatters"
import { buildTransferColumns, type TransferRow } from "./columns"

interface AdvanceDialogData {
  transferId: string
  code: string
  currentStatus: string
  nextStatus: string
  originName: string
  destinationName: string
}

const NEXT_MAP: Partial<Record<string, string>> = {
  draft: "pending",
  pending: "in_progress",
  in_progress: "in_transit",
  in_transit: "completed",
  partial: "completed",
}

const TERMINAL_STATUSES = new Set(["completed", "cancelled"])

export default function TransfersPage() {
  const state = useWmsStore()
  const { advanceTransfer } = useWmsStore()
  const { warehouseName, productName } = useStoreHelpers()

  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const advanceDialog = useDialogState<AdvanceDialogData>()

  const rows = useMemo<TransferRow[]>(
    () =>
      state.transfers.map((t) => ({
        id: t.id,
        code: t.code,
        type: t.type,
        originName: warehouseName(t.originId),
        destinationName: warehouseName(t.destinationId),
        linesCount: t.items.length,
        estimatedArrivalDate: t.estimatedArrivalDate,
        status: t.status,
        canAdvance: !TERMINAL_STATUSES.has(t.status) && !!NEXT_MAP[t.status],
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.transfers]
  )

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (typeFilter !== "all" && r.type !== typeFilter) return false
        if (statusFilter !== "all" && r.status !== statusFilter) return false
        return true
      }),
    [rows, typeFilter, statusFilter]
  )

  const activeTransfers = useMemo(
    () => state.transfers.filter((t) => !TERMINAL_STATUSES.has(t.status)),
    [state.transfers]
  )

  const inTransitCount = state.transfers.filter((t) => t.status === "in_transit").length
  const pendingCount = state.transfers.filter((t) => t.status === "draft" || t.status === "pending").length
  const completedCount = state.transfers.filter((t) => t.status === "completed").length

  const openAdvanceDialog = (row: TransferRow) => {
    const next = NEXT_MAP[row.status]
    if (!next) return
    advanceDialog.open({
      transferId: row.id,
      code: row.code,
      currentStatus: row.status,
      nextStatus: next,
      originName: row.originName,
      destinationName: row.destinationName,
    })
  }

  const handleAdvance = () => {
    if (!advanceDialog.data) return
    try {
      advanceTransfer(advanceDialog.data.transferId, "Operador")
      advanceDialog.close()
    } catch (e: unknown) {
      advanceDialog.setError(e instanceof Error ? e.message : "Error al avanzar traslado")
    }
  }

  const columns = useMemo(
    () => buildTransferColumns(openAdvanceDialog),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const filtersNode = (
    <>
      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="h-8 w-44">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los tipos</SelectItem>
          <SelectItem value="dc_to_store">DC → Tienda</SelectItem>
          <SelectItem value="store_to_store">Tienda → Tienda</SelectItem>
          <SelectItem value="store_to_dc">Tienda → DC</SelectItem>
          <SelectItem value="dc_to_dc">DC → DC</SelectItem>
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="h-8 w-44">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="draft">Borrador</SelectItem>
          <SelectItem value="pending">Pendiente</SelectItem>
          <SelectItem value="in_progress">En preparación</SelectItem>
          <SelectItem value="in_transit">En tránsito</SelectItem>
          <SelectItem value="completed">Completado</SelectItem>
          <SelectItem value="cancelled">Cancelado</SelectItem>
        </SelectContent>
      </Select>
    </>
  )

  return (
    <>
      <PageHeader
        title="Traslados"
        description="Movimientos entre bodegas y tiendas. Avanza el estado del traslado a lo largo del ciclo DC↔Tienda."
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
            <p className="text-sm text-muted-foreground">Pendientes / en preparación</p>
            <p className="text-2xl font-bold tabular-nums text-amber-600">{formatNumber(pendingCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Completados</p>
            <p className="text-2xl font-bold tabular-nums text-green-700">{formatNumber(completedCount)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="mb-1 flex items-center gap-2 text-base font-semibold">
            <ArrowRightLeft className="size-4" /> Órdenes de traslado
          </div>
          <DataTable
            columns={columns}
            data={filteredRows}
            searchColumn="code"
            searchPlaceholder="Buscar código..."
            filters={filtersNode}
            emptyMessage="No hay traslados con los filtros seleccionados."
          />
        </CardContent>
      </Card>

      {activeTransfers.map((transfer) => (
        <Card key={transfer.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ArrowRightLeft className="size-4 text-blue-600" />
              {transfer.code} — Líneas
              <StatusBadge status={transfer.status} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Solicitado</TableHead>
                  <TableHead className="text-right">Pickeado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfer.items.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{productName(line.productId)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(line.requestedQuantity)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {line.pickedQuantity ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <Dialog
        open={!!advanceDialog.data}
        onOpenChange={(o) => { if (!o) advanceDialog.close() }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avanzar estado del traslado</DialogTitle>
          </DialogHeader>
          {advanceDialog.data && (
            <div className="space-y-4 py-2">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Traslado: <span className="font-medium text-foreground">{advanceDialog.data.code}</span></p>
                <p>Ruta: <span className="font-medium text-foreground">
                  {advanceDialog.data.originName} → {advanceDialog.data.destinationName}
                </span></p>
              </div>
              <div className="flex items-center gap-3 rounded-md border p-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Estado actual</p>
                  <StatusBadge status={advanceDialog.data.currentStatus} />
                </div>
                <ArrowRight className="size-5 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Nuevo estado</p>
                  <StatusBadge status={advanceDialog.data.nextStatus} />
                </div>
              </div>
              {advanceDialog.data.nextStatus === "completed" && (
                <p className="text-sm text-muted-foreground">
                  Al completar se registrarán movimientos de inventario de tipo <strong>transfer</strong> por cada línea.
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
  )
}
