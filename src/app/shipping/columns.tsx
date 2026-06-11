"use client"

import { type ColumnDef } from "@tanstack/react-table"
import { Clock, Truck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { DataTableColumnHeader } from "@/components/data-table"
import { formatNumber } from "@/lib/formatters"
import type { Shipment } from "@/types/wms"

export interface ShippingRow {
  id: string
  orderNumber: string
  customerName: string
  carrierName: string
  sapRouteCode: string
  packageCount: number
  weightKg: number
  trackingNumber: string | null
  otifStatus: Shipment["otifStatus"]
  status: string
  shippedAt: string | null
}

const OTIF_COLORS: Record<Shipment["otifStatus"], string> = {
  on_time: "bg-green-100 text-green-700 border-green-200",
  at_risk: "bg-amber-100 text-amber-700 border-amber-200",
  late: "bg-red-100 text-red-700 border-red-200",
}

const OTIF_LABELS: Record<Shipment["otifStatus"], string> = {
  on_time: "A tiempo",
  at_risk: "En riesgo",
  late: "Tarde",
}

export const buildShippingColumns = (
  onShip: (row: ShippingRow) => void
): ColumnDef<ShippingRow>[] => [
  {
    accessorKey: "orderNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Pedido" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("orderNumber")}</span>
    ),
  },
  {
    accessorKey: "customerName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cliente" />
    ),
  },
  {
    accessorKey: "carrierName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Transportadora" />
    ),
  },
  {
    accessorKey: "sapRouteCode",
    header: "Ruta SAP",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.getValue("sapRouteCode") || "—"}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "packageCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Paquetes" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        {formatNumber(row.getValue("packageCount"))}
      </div>
    ),
  },
  {
    accessorKey: "weightKg",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Peso (kg)" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{row.getValue("weightKg")}</div>
    ),
  },
  {
    accessorKey: "trackingNumber",
    header: "Tracking",
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {row.getValue("trackingNumber") ?? "—"}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "otifStatus",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="OTIF" />
    ),
    cell: ({ row }) => {
      const status = row.getValue<Shipment["otifStatus"]>("otifStatus")
      return (
        <Badge variant="outline" className={`text-xs ${OTIF_COLORS[status]}`}>
          <Clock className="mr-1 inline size-3" />
          {OTIF_LABELS[status]}
        </Badge>
      )
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Estado" />
    ),
    cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
  },
  {
    accessorKey: "shippedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Despachado" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.getValue<string | null>("shippedAt")?.slice(0, 10) ?? "—"}
      </span>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    enableSorting: false,
    cell: ({ row }) => {
      const item = row.original
      if (item.status !== "pending") return null
      return (
        <Button
          size="sm"
          onClick={(e) => { e.stopPropagation(); onShip(item) }}
        >
          <Truck className="mr-1 size-3" /> Despachar
        </Button>
      )
    },
  },
]
