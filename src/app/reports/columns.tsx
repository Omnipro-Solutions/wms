"use client"

import { type ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/components/data-table"
import { formatNumber, formatPercent } from "@/lib/formatters"

// ─── Productivity ───────────────────────────────────────────────────────────

export interface ProductivityRow {
  operatorName: string
  picksCompleted: number
  unitsPicked: number
  partialCount: number
  issueCount: number
  efficiency: number
}

export const productivityColumns: ColumnDef<ProductivityRow>[] = [
  {
    accessorKey: "operatorName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Operador" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("operatorName")}</span>
    ),
  },
  {
    accessorKey: "picksCompleted",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Picks completados" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{formatNumber(row.getValue("picksCompleted"))}</div>
    ),
  },
  {
    accessorKey: "unitsPicked",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Unidades pickeadas" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{formatNumber(row.getValue("unitsPicked"))}</div>
    ),
  },
  {
    accessorKey: "partialCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Parciales" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums text-amber-600">
        {formatNumber(row.getValue("partialCount"))}
      </div>
    ),
  },
  {
    accessorKey: "issueCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Incidencias" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums text-red-600">
        {formatNumber(row.getValue("issueCount"))}
      </div>
    ),
  },
  {
    accessorKey: "efficiency",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Eficiencia" className="justify-end" />
    ),
    cell: ({ row }) => {
      const eff = row.getValue<number>("efficiency")
      return (
        <div className={`text-right tabular-nums font-semibold ${eff >= 90 ? "text-green-700" : eff >= 70 ? "text-amber-600" : "text-red-600"}`}>
          {formatPercent(eff)}
        </div>
      )
    },
  },
]

// ─── Discrepancies ───────────────────────────────────────────────────────────

export interface DiscrepancyRow {
  id: string
  referenceType: "asn" | "picking"
  referenceCode: string
  expected: number
  actual: number
  difference: number
}

export const discrepancyColumns: ColumnDef<DiscrepancyRow>[] = [
  {
    accessorKey: "referenceType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tipo" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline" className="text-xs capitalize">
        {row.getValue("referenceType") === "asn" ? "Recepción" : "Picking"}
      </Badge>
    ),
  },
  {
    accessorKey: "referenceCode",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Referencia" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.getValue("referenceCode")}</span>
    ),
  },
  {
    accessorKey: "expected",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Esperado" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{formatNumber(row.getValue("expected"))}</div>
    ),
  },
  {
    accessorKey: "actual",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Real" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{formatNumber(row.getValue("actual"))}</div>
    ),
  },
  {
    accessorKey: "difference",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Diferencia" className="justify-end" />
    ),
    cell: ({ row }) => {
      const diff = row.getValue<number>("difference")
      return (
        <div className={`text-right tabular-nums font-semibold ${diff < 0 ? "text-red-600" : "text-green-700"}`}>
          {diff > 0 ? "+" : ""}{formatNumber(diff)}
        </div>
      )
    },
  },
]

// ─── Inventory by warehouse ──────────────────────────────────────────────────

export interface WarehouseInventoryRow {
  warehouseId: string
  warehouseName: string
  skuCount: number
  totalOnHand: number
  totalReserved: number
  totalHold: number
  totalAvailable: number
}

export const warehouseInventoryColumns: ColumnDef<WarehouseInventoryRow>[] = [
  {
    accessorKey: "warehouseName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Bodega" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("warehouseName")}</span>
    ),
  },
  {
    accessorKey: "skuCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="SKUs" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{formatNumber(row.getValue("skuCount"))}</div>
    ),
  },
  {
    accessorKey: "totalOnHand",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="En mano" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{formatNumber(row.getValue("totalOnHand"))}</div>
    ),
  },
  {
    accessorKey: "totalReserved",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Reservado" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums text-amber-600">
        {formatNumber(row.getValue("totalReserved"))}
      </div>
    ),
  },
  {
    accessorKey: "totalHold",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Retenido" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums text-red-600">
        {formatNumber(row.getValue("totalHold"))}
      </div>
    ),
  },
  {
    accessorKey: "totalAvailable",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Disponible" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums font-semibold text-green-700">
        {formatNumber(row.getValue("totalAvailable"))}
      </div>
    ),
  },
]

// ─── Stock movements ─────────────────────────────────────────────────────────

export interface MovementRow {
  id: string
  type: string
  productName: string
  quantity: number
  referenceId: string
  operatorName: string
  createdAt: string
}

export const movementColumns: ColumnDef<MovementRow>[] = [
  {
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tipo" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline" className="text-xs capitalize">
        {row.getValue("type")}
      </Badge>
    ),
  },
  {
    accessorKey: "productName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Producto" />
    ),
    cell: ({ row }) => (
      <span className="text-sm">{row.getValue("productName")}</span>
    ),
  },
  {
    accessorKey: "quantity",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cantidad" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums font-semibold">
        {formatNumber(row.getValue("quantity"))}
      </div>
    ),
  },
  {
    accessorKey: "referenceId",
    header: "Referencia",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.getValue("referenceId")}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "operatorName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Operador" />
    ),
    cell: ({ row }) => (
      <span className="text-sm">{row.getValue("operatorName")}</span>
    ),
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Fecha" />
    ),
    cell: ({ row }) => (
      <span className="text-sm">
        {row.getValue<string>("createdAt").slice(0, 16).replace("T", " ")}
      </span>
    ),
  },
]

// ─── OTIF shipments ──────────────────────────────────────────────────────────

export interface OtifRow {
  id: string
  customerName: string
  carrierName: string
  otifStatus: "on_time" | "at_risk" | "late"
  shippedAt: string | null
  packageCount: number
  weightKg: number
}

const OTIF_COLORS: Record<OtifRow["otifStatus"], string> = {
  on_time: "bg-green-100 text-green-700 border-green-200",
  at_risk: "bg-amber-100 text-amber-700 border-amber-200",
  late: "bg-red-100 text-red-700 border-red-200",
}

const OTIF_LABELS: Record<OtifRow["otifStatus"], string> = {
  on_time: "A tiempo",
  at_risk: "En riesgo",
  late: "Tarde",
}

export const otifColumns: ColumnDef<OtifRow>[] = [
  {
    accessorKey: "customerName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cliente" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("customerName")}</span>
    ),
  },
  {
    accessorKey: "carrierName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Transportadora" />
    ),
    cell: ({ row }) => (
      <span className="text-sm">{row.getValue("carrierName")}</span>
    ),
  },
  {
    accessorKey: "otifStatus",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Estado OTIF" />
    ),
    cell: ({ row }) => {
      const status = row.getValue<OtifRow["otifStatus"]>("otifStatus")
      return (
        <Badge variant="outline" className={`text-xs ${OTIF_COLORS[status]}`}>
          {OTIF_LABELS[status]}
        </Badge>
      )
    },
  },
  {
    accessorKey: "shippedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Despachado" />
    ),
    cell: ({ row }) => (
      <span className="text-sm">
        {row.getValue<string | null>("shippedAt")?.slice(0, 10) ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "packageCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Paquetes" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{formatNumber(row.getValue("packageCount"))}</div>
    ),
  },
  {
    accessorKey: "weightKg",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Peso (kg)" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{formatNumber(row.getValue("weightKg"))}</div>
    ),
  },
]
