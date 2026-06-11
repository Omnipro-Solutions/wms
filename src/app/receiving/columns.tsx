"use client"

import { type ColumnDef } from "@tanstack/react-table"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Truck,
  XCircle,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { DataTableColumnHeader } from "@/components/data-table"
import { formatNumber } from "@/lib/formatters"
import type { AbcClass } from "@/types/wms"

export interface AsnRow {
  id: string
  code: string
  supplierName: string
  productName: string
  productId: string
  productCategory: string
  abcClass: AbcClass
  appointmentDate: string
  expectedQuantity: number
  receivedQuantity: number
  damagedQuantity: number
  pendingQuantity: number
  progressPct: number
  status: string
  requiresQualityControl: boolean
  crossDocking: boolean
  deliveryCount: number
  canReceive: boolean
  canClose: boolean
  canPutaway: boolean
  canQc: boolean
  isOverdue: boolean
}

export type ActionType = "receive" | "close" | "putaway" | "qc"
type ActionHandler = (type: ActionType, row: AsnRow) => void

// ── Product avatar ────────────────────────────────────────────────────────────

const PRODUCT_IMAGE: Record<string, string> = {
  "p-tshirt":   "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=120&h=120&fit=crop&q=80&auto=format",
  "p-jeans":    "https://images.unsplash.com/photo-1542272604-787c3835535d?w=120&h=120&fit=crop&q=80&auto=format",
  "p-sneakers": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=120&h=120&fit=crop&q=80&auto=format",
  "p-jacket":   "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=120&h=120&fit=crop&q=80&auto=format",
  "p-bag":      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=120&h=120&fit=crop&q=80&auto=format",
  "p-cap":      "https://images.unsplash.com/photo-1521369909029-2afed882baee?w=120&h=120&fit=crop&q=80&auto=format",
  "p-socks":    "https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=120&h=120&fit=crop&q=80&auto=format",
  "p-dress":    "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=120&h=120&fit=crop&q=80&auto=format",
  "p-cargo":    "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=120&h=120&fit=crop&q=80&auto=format",
  "p-hoodie":   "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=120&h=120&fit=crop&q=80&auto=format",
}

const ProductAvatar = ({ productId, name }: { productId: string; name: string }) => {
  const src = PRODUCT_IMAGE[productId]
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="size-11 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted shadow-sm">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} width={44} height={44} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-xs font-bold text-muted-foreground">
            {name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <span className="truncate text-sm font-medium leading-tight">{name}</span>
    </div>
  )
}

// ── ABC badge ─────────────────────────────────────────────────────────────────

const ABC_LABEL: Record<AbcClass, { label: string; color: string }> = {
  A: { label: "Alta rotación",  color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  B: { label: "Media rotación", color: "bg-blue-100    text-blue-700    border-blue-200"    },
  C: { label: "Baja rotación",  color: "bg-zinc-100    text-zinc-600    border-zinc-200"    },
}

const AbcBadge = ({ cls }: { cls: AbcClass }) => {
  const { label, color } = ABC_LABEL[cls]
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn("inline-flex w-fit items-center rounded border px-1.5 py-0.5 text-xs font-semibold", color)}>{cls}</span>
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{label}</span>
    </div>
  )
}

// ── Shared column definitions ─────────────────────────────────────────────────

const codeCol: ColumnDef<AsnRow> = {
  accessorKey: "code",
  header: ({ column }) => <DataTableColumnHeader column={column} title="N° Aviso" />,
  cell: ({ row }) => <span className="font-mono text-xs font-semibold text-muted-foreground">{row.getValue("code")}</span>,
}

const supplierCol: ColumnDef<AsnRow> = {
  accessorKey: "supplierName",
  header: ({ column }) => <DataTableColumnHeader column={column} title="Proveedor" />,
  cell: ({ row }) => <span className="text-sm">{row.getValue("supplierName")}</span>,
}

const productCol: ColumnDef<AsnRow> = {
  accessorKey: "productName",
  header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
  cell: ({ row }) => <ProductAvatar productId={row.original.productId} name={row.original.productName} />,
}

const abcCol: ColumnDef<AsnRow> = {
  accessorKey: "abcClass",
  header: ({ column }) => <DataTableColumnHeader column={column} title="Rotación" />,
  cell: ({ row }) => <AbcBadge cls={row.getValue<AbcClass>("abcClass")} />,
}

const flagsCol: ColumnDef<AsnRow> = {
  id: "flags",
  header: "Tipo",
  enableSorting: false,
  cell: ({ row }) => {
    const { requiresQualityControl, crossDocking } = row.original
    if (!requiresQualityControl && !crossDocking) return <span className="text-xs text-muted-foreground">Estándar</span>
    return (
      <div className="flex flex-col gap-1">
        {requiresQualityControl && (
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-xs text-amber-700 gap-1 w-fit">
            <ShieldCheck className="size-3" /> Inspección QC
          </Badge>
        )}
        {crossDocking && (
          <Badge variant="outline" className="border-blue-300 bg-blue-50 text-xs text-blue-700 gap-1 w-fit">
            <Zap className="size-3" /> Cross-Docking
          </Badge>
        )}
      </div>
    )
  },
}

const statusCol: ColumnDef<AsnRow> = {
  accessorKey: "status",
  header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
  cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
}

const progressBarColor = (pct: number) => {
  if (pct === 100) return "bg-emerald-500"
  if (pct >= 50)   return "bg-amber-400"
  return "bg-sky-400"
}

const progressCol: ColumnDef<AsnRow> = {
  id: "progress",
  header: "Avance de recepción",
  enableSorting: false,
  cell: ({ row }) => {
    const { receivedQuantity, expectedQuantity, progressPct } = row.original
    const color = progressBarColor(progressPct)
    return (
      <div className="min-w-36 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{formatNumber(receivedQuantity)} de {formatNumber(expectedQuantity)} uds</span>
          <span className="font-semibold">{progressPct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted">
          <div className={cn("h-2 rounded-full transition-all", color)} style={{ width: `${progressPct}%` }} />
        </div>
      </div>
    )
  },
}

// ── Tab 1: Llegadas programadas (pending + partial) ───────────────────────────

export const buildAppointmentColumns = (onAction: ActionHandler): ColumnDef<AsnRow>[] => [
  codeCol,
  supplierCol,
  productCol,
  abcCol,
  {
    accessorKey: "appointmentDate",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha de cita" />,
    cell: ({ row }) => {
      const { appointmentDate, isOverdue } = row.original
      return (
        <div className="flex items-center gap-1.5">
          {isOverdue
            ? <AlertTriangle className="size-3.5 shrink-0 text-red-500" />
            : <Clock className="size-3.5 shrink-0 text-muted-foreground" />
          }
          <span className={isOverdue ? "font-semibold text-red-600 text-sm" : "text-sm"}>{appointmentDate}</span>
          {isOverdue && <Badge variant="destructive" className="ml-1 text-xs">Atrasada</Badge>}
        </div>
      )
    },
  },
  {
    accessorKey: "expectedQuantity",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Esperadas" className="justify-end" />,
    cell: ({ row }) => <div className="text-right tabular-nums text-sm font-medium">{formatNumber(row.getValue("expectedQuantity"))}</div>,
  },
  {
    id: "partialInfo",
    header: "Entregas",
    enableSorting: false,
    cell: ({ row }) => {
      const { status, deliveryCount, receivedQuantity, expectedQuantity } = row.original
      if (status !== "partial") return <span className="text-xs text-muted-foreground">—</span>
      return (
        <div className="space-y-1">
          <Badge className="bg-blue-100 text-blue-700 border-0 text-xs gap-1 w-fit">
            <Truck className="size-3" /> Entrega parcial
          </Badge>
          <p className="text-xs text-muted-foreground">
            {formatNumber(receivedQuantity)} / {formatNumber(expectedQuantity)} uds · {deliveryCount} {deliveryCount === 1 ? "entrega" : "entregas"}
          </p>
        </div>
      )
    },
  },
  flagsCol,
  {
    id: "actions",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      if (!row.original.canReceive) return null
      const isPartial = row.original.status === "partial"
      return (
        <Button
          size="sm"
          variant={isPartial ? "outline" : "default"}
          onClick={(e) => { e.stopPropagation(); onAction("receive", row.original) }}
        >
          <PackageCheck className="mr-1.5 size-3.5" />
          {isPartial ? "Registrar nueva entrega" : "Iniciar recepción"}
        </Button>
      )
    },
  },
]

// ── Tab 2: Conteo físico (in_progress — truck at dock) ────────────────────────

export const buildReceivingColumns = (onAction: ActionHandler): ColumnDef<AsnRow>[] => [
  codeCol,
  supplierCol,
  productCol,
  abcCol,
  {
    id: "quantities",
    header: "Esperado / Recibido / Pendiente",
    enableSorting: false,
    cell: ({ row }) => {
      const { expectedQuantity, receivedQuantity, pendingQuantity, deliveryCount } = row.original
      return (
        <div className="space-y-1 min-w-44">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground w-20 text-xs">Esperado</span>
            <span className="font-medium tabular-nums">{formatNumber(expectedQuantity)} uds</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground w-20 text-xs">Recibido</span>
            <span className="font-medium tabular-nums text-emerald-600">{formatNumber(receivedQuantity)} uds</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground w-20 text-xs">Pendiente</span>
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700 tabular-nums">
              {formatNumber(pendingQuantity)} uds
            </span>
          </div>
          {deliveryCount > 0 && (
            <p className="text-[10px] text-muted-foreground">{deliveryCount} {deliveryCount === 1 ? "entrega previa" : "entregas previas"}</p>
          )}
        </div>
      )
    },
  },
  progressCol,
  flagsCol,
  {
    id: "actions",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex flex-col gap-1.5">
        {row.original.canReceive && (
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); onAction("receive", row.original) }}
          >
            <PackageCheck className="mr-1.5 size-3.5" />
            Registrar conteo
          </Button>
        )}
        {row.original.canClose && (
          <Button
            size="sm"
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={(e) => { e.stopPropagation(); onAction("close", row.original) }}
          >
            <XCircle className="mr-1.5 size-3.5" />
            Cerrar con diferencia
          </Button>
        )}
      </div>
    ),
  },
]

// ── Tab 3: Control de Calidad ─────────────────────────────────────────────────

export const buildQcColumns = (onAction: ActionHandler): ColumnDef<AsnRow>[] => [
  codeCol,
  supplierCol,
  productCol,
  abcCol,
  {
    id: "qcProgress",
    header: "Unidades recibidas",
    enableSorting: false,
    cell: ({ row }) => {
      const { receivedQuantity, expectedQuantity } = row.original
      return (
        <span className="tabular-nums text-sm font-medium">
          {formatNumber(receivedQuantity)}
          <span className="text-muted-foreground font-normal"> / {formatNumber(expectedQuantity)} uds</span>
        </span>
      )
    },
  },
  {
    id: "qcStatus",
    header: "Estado inspección",
    enableSorting: false,
    cell: () => (
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 gap-1 text-xs">
        <ShieldCheck className="size-3" /> Pendiente de inspección
      </Badge>
    ),
  },
  {
    id: "actions",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <Button
        size="sm"
        className="bg-amber-500 hover:bg-amber-600 text-white"
        onClick={(e) => { e.stopPropagation(); onAction("qc", row.original) }}
      >
        <ShieldCheck className="mr-1.5 size-3.5" />
        Inspeccionar lote
      </Button>
    ),
  },
]

// ── Tab 4: Ubicación (Putaway) ────────────────────────────────────────────────

export const buildPutawayColumns = (onAction: ActionHandler): ColumnDef<AsnRow>[] => [
  codeCol,
  supplierCol,
  productCol,
  abcCol,
  {
    id: "putawayQty",
    header: "Uds en área de ingreso",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="tabular-nums text-sm font-medium">{formatNumber(row.original.receivedQuantity)} uds</span>
    ),
  },
  {
    id: "cdFlag",
    header: "Destino",
    enableSorting: false,
    cell: ({ row }) => {
      if (row.original.crossDocking) {
        return (
          <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 text-xs gap-1">
            <Zap className="size-3" /> Salida directa
          </Badge>
        )
      }
      return <span className="text-xs text-muted-foreground">Almacén</span>
    },
  },
  statusCol,
  {
    id: "actions",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      if (!row.original.canPutaway) {
        if (row.original.status === "completed") {
          return <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600"><CheckCircle2 className="size-3.5" /> Ubicado</span>
        }
        return null
      }
      return (
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={(e) => { e.stopPropagation(); onAction("putaway", row.original) }}
        >
          <MapPin className="mr-1.5 size-3.5" />
          {row.original.crossDocking ? "Enviar a salida" : "Asignar ubicación"}
        </Button>
      )
    },
  },
]
