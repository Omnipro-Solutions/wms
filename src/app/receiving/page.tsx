"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  PackageCheck,
  ShieldCheck,
  TriangleAlert,
  Truck,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

import { useWmsStore } from "@/store/wms-store"
import { selectSlottingRecommendations, abcByProduct } from "@/store/selectors"
import { useStoreHelpers } from "@/hooks/use-store-helpers"
import { useDialogState } from "@/hooks/use-dialog-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/data-table"
import {
  buildAppointmentColumns,
  buildReceivingColumns,
  buildQcColumns,
  buildPutawayColumns,
  type AsnRow,
} from "./columns"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReceiveDialogData {
  asnId: string
  asnCode: string
  productName: string
  supplierName: string
  expectedTotal: number       // total esperado en el ASN
  receivedSoFar: number       // ya recibido en entregas anteriores
  pendingQty: number          // expectedTotal - receivedSoFar
  deliveryCount: number
  requiresQC: boolean
  isCrossDocking: boolean
}

interface CloseDialogData {
  asnId: string
  asnCode: string
  productName: string
  supplierName: string
  expectedTotal: number
  receivedSoFar: number
  missingQty: number
}

interface PutawayDialogData {
  asnId: string
  productName: string
  asnCode: string
  suggestedLocationId: string | null
  abcClass: string
  isCrossDocking: boolean
}

interface QcDialogData {
  asnId: string
  productName: string
  asnCode: string
  blockedQty: number
  supplierName: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DISCREPANCY_REASONS = [
  { value: "short_shipped",  label: "Proveedor envió menos de lo pactado" },
  { value: "damaged",        label: "Unidades llegaron dañadas" },
  { value: "refused",        label: "Unidades rechazadas por calidad" },
  { value: "count_error",    label: "Error de conteo" },
]

const TODAY = "2026-06-10"

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: LucideIcon
  value: number
  label: string
  sublabel?: string
  tone: "blue" | "red" | "amber" | "green" | "neutral"
  alert?: boolean
}

const TONE_STYLES: Record<KpiCardProps["tone"], { bg: string; icon: string; value: string }> = {
  blue:    { bg: "bg-blue-50    border-blue-100",    icon: "text-blue-500",    value: "text-blue-700"    },
  red:     { bg: "bg-red-50     border-red-100",     icon: "text-red-500",     value: "text-red-700"     },
  amber:   { bg: "bg-amber-50   border-amber-100",   icon: "text-amber-500",   value: "text-amber-700"   },
  green:   { bg: "bg-emerald-50 border-emerald-100", icon: "text-emerald-500", value: "text-emerald-700" },
  neutral: { bg: "bg-zinc-50    border-zinc-100",    icon: "text-zinc-400",    value: "text-zinc-600"    },
}

const KpiCard = ({ icon: Icon, value, label, sublabel, tone, alert }: KpiCardProps) => {
  const styles = TONE_STYLES[tone]
  return (
    <div className={cn("relative rounded-xl border p-4 flex items-center gap-4", styles.bg)}>
      {alert && value > 0 && (
        <span className="absolute right-3 top-3 flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-red-500" />
        </span>
      )}
      <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm border", styles.bg)}>
        <Icon className={cn("size-6", styles.icon)} />
      </div>
      <div className="min-w-0">
        <p className={cn("text-3xl font-bold leading-none tabular-nums", styles.value)}>{value}</p>
        <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
      </div>
    </div>
  )
}

// ─── Tab panel wrapper ────────────────────────────────────────────────────────

interface TabPanelProps {
  icon: LucideIcon
  iconClass: string
  title: string
  description: string
  children: React.ReactNode
}

const TabPanel = ({ icon: Icon, iconClass, title, description, children }: TabPanelProps) => (
  <Card className="border-0 shadow-sm">
    <CardHeader className="pb-2 pt-4">
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 size-5 shrink-0", iconClass)} />
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
)

// ─── Shared sub-components ────────────────────────────────────────────────────

const ErrorBanner = ({ message }: { message: string }) => (
  <p className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
    <TriangleAlert className="size-3.5 shrink-0" /> {message}
  </p>
)

// ─── Dialog summary header (shared between receive & close dialogs) ───────────

const DialogSummaryRow = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={cn("font-medium text-sm", mono && "font-mono font-semibold")}>{value}</p>
  </div>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReceivingPage() {
  const state = useWmsStore()
  const { receiveAsn, putawayItem, closeAsnWithDiscrepancy } = state
  const { productName: getProductName, locationCode } = useStoreHelpers()

  const abc = useMemo(() => abcByProduct(state), [state.demandStats, state.inventoryItems])
  const recommendations = useMemo(() => selectSlottingRecommendations(state), [state.inventoryItems, state.locations, state.demandStats])

  // ── Receive dialog state ─────────────────────────────────────────────────
  const [goodQty,           setGoodQty]           = useState("")
  const [damagedQty,        setDamagedQty]        = useState("")
  const [discrepancyReason, setDiscrepancyReason] = useState("")
  const [closeIntent,       setCloseIntent]       = useState<"leave_open" | "close_now">("leave_open")

  // ── Close-with-discrepancy dialog state ──────────────────────────────────
  const [closeReason,       setCloseReason]       = useState("")

  // ── Putaway / QC state ───────────────────────────────────────────────────
  const [selectedLocation,  setSelectedLocation]  = useState("")

  const receiveDialog = useDialogState<ReceiveDialogData>()
  const closeDialog   = useDialogState<CloseDialogData>()
  const putawayDialog = useDialogState<PutawayDialogData>()
  const qcDialog      = useDialogState<QcDialogData>()

  const allLocations = useMemo(
    () => state.locations.filter((l) => l.type === "pick" || l.type === "staging" || l.type === "reserve"),
    [state.locations]
  )

  const getSuggestedLocationId = (asnId: string): string | null => {
    const asn = state.asnRecords.find((a) => a.id === asnId)
    if (!asn) return null
    const rec = recommendations.find((r) => r.productId === asn.productId)
    return rec?.suggestedLocationId ?? asn.suggestedPutawayLocationId ?? null
  }

  const rows = useMemo<AsnRow[]>(
    () =>
      state.asnRecords.map((asn) => {
        const product = state.products.find((p) => p.id === asn.productId)
        return {
          id:                      asn.id,
          code:                    asn.code,
          supplierName:            asn.supplierName,
          productName:             getProductName(asn.productId),
          productId:               asn.productId,
          productCategory:         product?.category ?? "Otros",
          abcClass:                abc[asn.productId] ?? "C",
          appointmentDate:         asn.appointmentDate,
          expectedQuantity:        asn.expectedQuantity,
          receivedQuantity:        asn.receivedQuantity,
          damagedQuantity:         asn.damagedQuantity,
          pendingQuantity:         asn.expectedQuantity - asn.receivedQuantity,
          progressPct:             Math.round((asn.receivedQuantity / asn.expectedQuantity) * 100),
          status:                  asn.status,
          requiresQualityControl:  asn.requiresQualityControl,
          crossDocking:            asn.crossDocking,
          deliveryCount:           asn.deliveryCount,
          canReceive:              asn.status === "pending" || asn.status === "partial" || asn.status === "in_progress",
          canClose:                asn.status === "partial" || asn.status === "in_progress",
          canPutaway:              !asn.requiresQualityControl && (asn.status === "partial" || asn.status === "completed"),
          canQc:                   asn.requiresQualityControl && asn.status === "partial",
          isOverdue:               asn.appointmentDate < TODAY && asn.status !== "completed" && asn.status !== "cancelled" && asn.status !== "short_received",
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.asnRecords, state.products]
  )

  // Tab filters — single pass derives all row subsets and KPI counts
  const { appointmentRows, receivingRows, qcRows, putawayRows, overdueCount, completedToday } = useMemo(() => {
    const appointmentRows: AsnRow[] = []
    const receivingRows:   AsnRow[] = []
    const qcRows:          AsnRow[] = []
    const putawayRows:     AsnRow[] = []
    let overdueCount   = 0
    let completedToday = 0

    for (const r of rows) {
      if (r.status === "pending" || r.status === "partial") appointmentRows.push(r)
      if (r.status === "in_progress") receivingRows.push(r)
      if (r.requiresQualityControl && (r.status === "partial" || r.status === "completed")) qcRows.push(r)
      if (!r.requiresQualityControl && (r.status === "partial" || r.status === "completed")) putawayRows.push(r)
      if (r.isOverdue) overdueCount++
      if (r.status === "completed" || r.status === "short_received") completedToday++
    }

    return { appointmentRows, receivingRows, qcRows, putawayRows, overdueCount, completedToday }
  }, [rows])

  // ── Dialog openers ────────────────────────────────────────────────────────

  const openReceiveDialog = (row: AsnRow) => {
    receiveDialog.open({
      asnId:         row.id,
      asnCode:       row.code,
      productName:   row.productName,
      supplierName:  row.supplierName,
      expectedTotal: row.expectedQuantity,
      receivedSoFar: row.receivedQuantity,
      pendingQty:    row.pendingQuantity,
      deliveryCount: row.deliveryCount,
      requiresQC:    row.requiresQualityControl,
      isCrossDocking: row.crossDocking,
    })
    setGoodQty(String(row.pendingQuantity))
    setDamagedQty("0")
    setDiscrepancyReason("")
    setCloseIntent("leave_open")
  }

  const openCloseDialog = (row: AsnRow) => {
    closeDialog.open({
      asnId:         row.id,
      asnCode:       row.code,
      productName:   row.productName,
      supplierName:  row.supplierName,
      expectedTotal: row.expectedQuantity,
      receivedSoFar: row.receivedQuantity,
      missingQty:    row.pendingQuantity,
    })
    setCloseReason("")
  }

  const openPutawayDialog = (row: AsnRow) => {
    const sug = getSuggestedLocationId(row.id)
    putawayDialog.open({
      asnId:               row.id,
      asnCode:             row.code,
      productName:         row.productName,
      suggestedLocationId: sug,
      abcClass:            row.abcClass,
      isCrossDocking:      row.crossDocking,
    })
    setSelectedLocation(sug ?? "")
  }

  const openQcDialog = (row: AsnRow) =>
    qcDialog.open({
      asnId:        row.id,
      productName:  row.productName,
      asnCode:      row.code,
      blockedQty:   row.receivedQuantity,
      supplierName: row.supplierName,
    })

  const handleAction = (type: "receive" | "close" | "putaway" | "qc", row: AsnRow) => {
    if (type === "receive")      openReceiveDialog(row)
    else if (type === "close")   openCloseDialog(row)
    else if (type === "putaway") openPutawayDialog(row)
    else                         openQcDialog(row)
  }

  // ── Submit handlers ───────────────────────────────────────────────────────

  const handleReceiveSubmit = () => {
    if (!receiveDialog.data) return
    const good    = parseInt(goodQty,    10)
    const damaged = parseInt(damagedQty, 10) || 0
    const total   = (isNaN(good) ? 0 : good) + damaged
    const pending = receiveDialog.data.pendingQty

    if (isNaN(good) || good < 0) {
      receiveDialog.setError("Ingresa un número válido en «Unidades en buen estado».")
      return
    }
    if (damaged < 0) {
      receiveDialog.setError("Las unidades dañadas no pueden ser negativas.")
      return
    }
    if (total <= 0) {
      receiveDialog.setError("Debes contar al menos 1 unidad para registrar la entrega.")
      return
    }
    if (total > pending) {
      receiveDialog.setError(`El total contado (${total}) supera las unidades pendientes (${pending}). Revisa los valores.`)
      return
    }
    if (total < pending && !discrepancyReason) {
      receiveDialog.setError("Faltan unidades. Selecciona el motivo de la diferencia.")
      return
    }
    try {
      receiveAsn(receiveDialog.data.asnId, good, "Operador", damaged)
      // If operator chose to close the ASN with remaining discrepancy
      if (closeIntent === "close_now" && total < pending && discrepancyReason) {
        closeAsnWithDiscrepancy(receiveDialog.data.asnId, discrepancyReason, "Operador")
      }
      receiveDialog.close()
      setGoodQty("")
      setDamagedQty("")
      setDiscrepancyReason("")
      setCloseIntent("leave_open")
    } catch (e: unknown) {
      receiveDialog.setError(e instanceof Error ? e.message : "Error inesperado. Intenta de nuevo.")
    }
  }

  const handleCloseSubmit = () => {
    if (!closeDialog.data) return
    if (!closeReason) {
      closeDialog.setError("Selecciona el motivo para cerrar el ASN con diferencia.")
      return
    }
    try {
      closeAsnWithDiscrepancy(closeDialog.data.asnId, closeReason, "Supervisor")
      closeDialog.close()
      setCloseReason("")
    } catch (e: unknown) {
      closeDialog.setError(e instanceof Error ? e.message : "Error al cerrar el ASN.")
    }
  }

  const handlePutawaySubmit = () => {
    if (!putawayDialog.data) return
    if (!selectedLocation) { putawayDialog.setError("Selecciona una ubicación."); return }
    try {
      putawayItem(putawayDialog.data.asnId, selectedLocation, "Operador")
      putawayDialog.close()
      setSelectedLocation("")
    } catch (e: unknown) {
      putawayDialog.setError(e instanceof Error ? e.message : "Error en putaway")
    }
  }

  const handleQcApprove = () => {
    if (!qcDialog.data) return
    try {
      putawayItem(qcDialog.data.asnId, "loc-stageout", "Operador")
      qcDialog.close()
    } catch (e: unknown) {
      qcDialog.setError(e instanceof Error ? e.message : "Error al aprobar QC")
    }
  }

  // ── Column definitions ────────────────────────────────────────────────────
  const appointmentCols = buildAppointmentColumns(handleAction)
  const receivingCols   = buildReceivingColumns(handleAction)
  const qcCols          = buildQcColumns(handleAction)
  const putawayCols     = buildPutawayColumns(handleAction)

  // ── Receive dialog derived values ─────────────────────────────────────────
  const goodQtyNum    = parseInt(goodQty,    10) || 0
  const damagedQtyNum = parseInt(damagedQty, 10) || 0
  const totalCounted  = goodQtyNum + damagedQtyNum
  const pendingQty    = receiveDialog.data?.pendingQty ?? 0
  const isOverCount   = totalCounted > pendingQty
  const isDiscrepancy = totalCounted > 0 && totalCounted < pendingQty
  const missingInForm = pendingQty - totalCounted
  const canSubmit     = totalCounted > 0 && !isOverCount && (!isDiscrepancy || !!discrepancyReason)

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Recepción — Inbound"
        description="Flujo completo de entrada de mercancía: programación de citas, conteo físico, inspección de calidad y ubicación en almacén."
      />

      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon={Truck}        value={appointmentRows.length} label="Llegadas programadas"      sublabel="Pendientes y parciales"               tone="blue"    />
        <KpiCard icon={AlertTriangle} value={overdueCount}          label="Entregas con atraso"        sublabel={overdueCount > 0 ? "Requieren atención" : "Sin atrasos"} tone={overdueCount > 0 ? "red" : "neutral"} alert />
        <KpiCard icon={ShieldCheck}  value={qcRows.length}          label="En inspección de calidad"   sublabel="Lotes bloqueados hasta aprobación"     tone={qcRows.length > 0 ? "amber" : "neutral"} />
        <KpiCard icon={PackageCheck} value={completedToday}         label="Recepciones cerradas"       sublabel="Completadas o cerradas con diferencia"  tone="green"   />
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="citas">
        <TabsList className="mb-4 h-auto flex-wrap gap-1 bg-muted/60">
          <TabsTrigger value="citas" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Truck className="size-4" />
            Llegadas programadas
            {appointmentRows.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">{appointmentRows.length}</Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="recibiendo" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <PackageCheck className="size-4" />
            Conteo físico
            {receivingRows.length > 0 && (
              <Badge className="ml-1 h-5 min-w-5 px-1.5 text-xs bg-amber-100 text-amber-700 border-0">{receivingRows.length}</Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="qc" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <ShieldCheck className="size-4" />
            Inspección de calidad
            {qcRows.length > 0 && (
              <Badge className="ml-1 h-5 min-w-5 px-1.5 text-xs bg-amber-500 text-white border-0">{qcRows.length}</Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="putaway" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <MapPin className="size-4" />
            Ubicación en almacén
            {putawayRows.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">{putawayRows.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1 — Llegadas programadas (pending + partial) */}
        <TabsContent value="citas">
          <TabPanel
            icon={Truck}
            iconClass="text-blue-500"
            title="Llegadas programadas"
            description="ASNs confirmados con el proveedor. Los marcados como «Entrega parcial» ya tienen una recepción previa — el proveedor enviará más mercancía. Inicia una nueva entrega cuando llegue el camión."
          >
            <DataTable
              columns={appointmentCols}
              data={appointmentRows}
              searchColumn="productName"
              searchPlaceholder="Buscar por producto o proveedor…"
              emptyMessage="Sin llegadas programadas. Todos los avisos están en proceso o completados."
            />
          </TabPanel>
        </TabsContent>

        {/* Tab 2 — Conteo físico (in_progress: truck at dock) */}
        <TabsContent value="recibiendo">
          <TabPanel
            icon={PackageCheck}
            iconClass="text-amber-500"
            title="Conteo físico activo"
            description="Camiones actualmente en el muelle. Registra las unidades contadas en esta entrega. Si el proveedor no enviará más, usa «Cerrar ASN con diferencia» para documentar la falta y generar el reporte OTIF."
          >
            <DataTable
              columns={receivingCols}
              data={receivingRows}
              searchColumn="productName"
              searchPlaceholder="Buscar por producto o proveedor…"
              emptyMessage="Sin recepciones activas en el muelle. Inicia una desde «Llegadas programadas»."
            />
          </TabPanel>
        </TabsContent>

        {/* Tab 3 — QC */}
        <TabsContent value="qc">
          <TabPanel
            icon={ShieldCheck}
            iconClass="text-amber-500"
            title="Inspección de calidad (QC)"
            description="Mercancía bloqueada en zona de calidad. Debe ser aprobada antes de ingresar al inventario disponible."
          >
            {qcRows.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                  <ShieldCheck className="size-8 opacity-40" />
                </div>
                <p className="text-sm font-medium">Sin lotes pendientes de inspección</p>
                <p className="text-xs">Los lotes con bandera QC aparecerán aquí al ser recibidos.</p>
              </div>
            ) : (
              <DataTable columns={qcCols} data={qcRows} searchColumn="productName" searchPlaceholder="Buscar…" emptyMessage="Sin lotes pendientes de QC." />
            )}
          </TabPanel>
        </TabsContent>

        {/* Tab 4 — Putaway */}
        <TabsContent value="putaway">
          <TabPanel
            icon={MapPin}
            iconClass="text-emerald-600"
            title="Ubicación en almacén (Putaway)"
            description="Mercancía lista para ser ubicada. El sistema recomienda la posición óptima según rotación del producto."
          >
            <DataTable columns={putawayCols} data={putawayRows} searchColumn="productName" searchPlaceholder="Buscar…" emptyMessage="Sin mercancía esperando ubicación." />
          </TabPanel>
        </TabsContent>
      </Tabs>

      {/* ══════════════════════════════════════════════════════════════════════
          DIALOG — Registrar entrega / conteo físico
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!receiveDialog.data} onOpenChange={(o) => { if (!o) receiveDialog.close() }}>
        <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden">

          {/* ── Header with accent bar ── */}
          <div className="border-b bg-linear-to-r from-amber-50 to-orange-50 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 border border-amber-200">
                  <PackageCheck className="size-5 text-amber-600" />
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold leading-snug">
                    Registrar entrega
                    {receiveDialog.data && receiveDialog.data.deliveryCount > 0 && (
                      <Badge variant="outline" className="ml-2 text-xs font-normal border-amber-300 text-amber-700 bg-white">
                        Entrega #{receiveDialog.data.deliveryCount + 1}
                      </Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                    Solo las unidades en buen estado ingresan al inventario disponible.
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* ── ASN meta strip ── */}
            {receiveDialog.data && (
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="text-muted-foreground">N° Aviso: <span className="font-mono font-semibold text-foreground">{receiveDialog.data.asnCode}</span></span>
                <span className="text-muted-foreground">Proveedor: <span className="font-medium text-foreground">{receiveDialog.data.supplierName}</span></span>
                <span className="text-muted-foreground">Producto: <span className="font-medium text-foreground">{receiveDialog.data.productName}</span></span>
              </div>
            )}
          </div>

          {receiveDialog.data && (
            <div className="px-6 py-5 space-y-5">

              {/* ── Pending + progress side by side ── */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 flex items-center gap-4 rounded-xl border-2 border-amber-200 bg-amber-50 px-5 py-4">
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Pendiente esta entrega</p>
                    <p className="mt-1 text-5xl font-bold tabular-nums leading-none text-amber-800">{receiveDialog.data.pendingQty}</p>
                    <p className="mt-1 text-xs text-amber-600">unidades por contar</p>
                  </div>
                  {receiveDialog.data.deliveryCount > 0 && (
                    <div className="shrink-0 text-center rounded-lg bg-amber-100 border border-amber-200 px-3 py-2">
                      <p className="text-2xl font-bold tabular-nums text-amber-700 leading-none">{receiveDialog.data.deliveryCount}</p>
                      <p className="mt-1 text-[10px] text-amber-600 font-medium">entregas<br/>previas</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col justify-center rounded-xl border bg-muted/30 px-4 py-4 gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Recibido</p>
                    <p className="text-xl font-bold tabular-nums text-emerald-600 leading-none">{receiveDialog.data.receivedSoFar}</p>
                  </div>
                  <div className="h-px bg-border" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Total esperado</p>
                    <p className="text-xl font-bold tabular-nums text-foreground leading-none">{receiveDialog.data.expectedTotal}</p>
                  </div>
                </div>
              </div>

              {/* ── Count inputs ── */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 rounded-xl border bg-emerald-50/50 p-4">
                  <Label htmlFor="rcv-good" className="text-sm font-semibold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                    Buen estado
                  </Label>
                  <Input
                    id="rcv-good"
                    type="number"
                    min={0}
                    value={goodQty}
                    onChange={(e) => { setGoodQty(e.target.value); receiveDialog.clearError?.() }}
                    className={cn("text-3xl font-bold h-16 text-center tabular-nums bg-white border-2", isOverCount ? "border-destructive" : "border-emerald-200 focus-visible:ring-emerald-300")}
                    autoFocus
                  />
                  <p className="text-xs text-emerald-700">Ingresan al inventario disponible</p>
                </div>
                <div className="space-y-2 rounded-xl border bg-red-50/50 p-4">
                  <Label htmlFor="rcv-damaged" className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5 text-red-500" />
                    Dañadas
                  </Label>
                  <Input
                    id="rcv-damaged"
                    type="number"
                    min={0}
                    value={damagedQty}
                    onChange={(e) => { setDamagedQty(e.target.value); receiveDialog.clearError?.() }}
                    className={cn("text-3xl font-bold h-16 text-center tabular-nums bg-white border-2", isOverCount ? "border-destructive" : "border-red-200 focus-visible:ring-red-300")}
                  />
                  <p className="text-xs text-red-600">Se registran, no entran al inventario</p>
                </div>
              </div>

              {/* ── Real-time feedback ── */}
              {totalCounted > 0 && (
                isOverCount ? (
                  <div className="flex items-start gap-3 rounded-xl border-2 border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-semibold">Total contado ({totalCounted}) supera lo pendiente ({pendingQty})</p>
                      <p className="text-xs mt-0.5 opacity-80">Reduce la cantidad en alguno de los campos.</p>
                    </div>
                  </div>
                ) : isDiscrepancy ? (
                  <div className="flex items-start gap-3 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                    <div>
                      <p className="font-semibold">Diferencia detectada — faltan {missingInForm} unidades</p>
                      <p className="text-xs text-amber-700 mt-0.5">Total contado: {totalCounted} de {pendingQty} pendientes.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                    <div>
                      <p className="font-semibold">Conteo completo — {totalCounted} de {pendingQty} unidades</p>
                      {damagedQtyNum > 0 && <p className="text-xs mt-0.5 text-emerald-700">{damagedQtyNum} dañadas registradas, no entrarán al stock.</p>}
                    </div>
                  </div>
                )
              )}

              {/* ── Discrepancy reason ── */}
              {isDiscrepancy && (
                <div className="space-y-2">
                  <Label htmlFor="disc-reason" className="text-sm font-medium">
                    Motivo de la diferencia <span className="text-destructive">*</span>
                  </Label>
                  <Select value={discrepancyReason} onValueChange={(v) => { setDiscrepancyReason(v); receiveDialog.clearError?.() }}>
                    <SelectTrigger id="disc-reason" className={cn("h-10", !discrepancyReason && receiveDialog.error && "border-destructive")}>
                      <SelectValue placeholder="¿Por qué llegaron menos unidades?" />
                    </SelectTrigger>
                    <SelectContent>
                      {DISCREPANCY_REASONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* ── Close intent radios ── */}
              {isDiscrepancy && discrepancyReason && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">¿Qué deseas hacer con las {missingInForm} unidades faltantes?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all",
                      closeIntent === "leave_open" ? "border-blue-400 bg-blue-50 shadow-sm" : "border-border hover:border-blue-200 hover:bg-blue-50/40"
                    )}>
                      <input type="radio" name="close-intent" value="leave_open" checked={closeIntent === "leave_open"} onChange={() => setCloseIntent("leave_open")} className="mt-0.5 accent-blue-600" />
                      <div>
                        <p className="text-sm font-semibold leading-snug">Dejar el ASN abierto</p>
                        <p className="text-xs text-muted-foreground mt-1">El proveedor enviará las {missingInForm} unidades restantes en otro camión.</p>
                      </div>
                    </label>
                    <label className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all",
                      closeIntent === "close_now" ? "border-amber-400 bg-amber-50 shadow-sm" : "border-border hover:border-amber-200 hover:bg-amber-50/40"
                    )}>
                      <input type="radio" name="close-intent" value="close_now" checked={closeIntent === "close_now"} onChange={() => setCloseIntent("close_now")} className="mt-0.5 accent-amber-600" />
                      <div>
                        <p className="text-sm font-semibold leading-snug">Cerrar ASN con diferencia</p>
                        <p className="text-xs text-muted-foreground mt-1">No se esperan más entregas. Se genera reporte OTIF con {missingInForm} uds faltantes.</p>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {receiveDialog.error && <ErrorBanner message={receiveDialog.error} />}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-6 py-4">
            <Button variant="outline" onClick={receiveDialog.close}>Cancelar</Button>
            <Button onClick={handleReceiveSubmit} disabled={!canSubmit} className={cn(closeIntent === "close_now" && "bg-amber-600 hover:bg-amber-700")}>
              <CheckCircle2 className="mr-1.5 size-4" />
              {closeIntent === "close_now" ? "Confirmar y cerrar ASN" : "Confirmar entrega"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          DIALOG — Cerrar ASN con diferencia (acción de supervisor)
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!closeDialog.data} onOpenChange={(o) => { if (!o) closeDialog.close() }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <XCircle className="size-5 text-red-500" />
              Cerrar ASN con diferencia
            </DialogTitle>
            <DialogDescription className="text-sm">
              Acción de supervisor. Cierra definitivamente el ASN con las unidades que llegaron. Se genera reporte de incumplimiento para el proveedor (OTIF).
            </DialogDescription>
          </DialogHeader>

          {closeDialog.data && (
            <div className="space-y-5 py-1">

              <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border bg-muted/30 p-4 text-sm sm:grid-cols-4">
                <DialogSummaryRow label="N° Aviso"  value={closeDialog.data.asnCode} mono />
                <DialogSummaryRow label="Proveedor" value={closeDialog.data.supplierName} />
                <DialogSummaryRow label="Producto"  value={closeDialog.data.productName} />
                <div>
                  <p className="text-xs text-muted-foreground">Recibido / Esperado</p>
                  <p className="text-sm font-semibold">
                    <span className="text-emerald-600">{closeDialog.data.receivedSoFar}</span>
                    <span className="text-muted-foreground font-normal"> / {closeDialog.data.expectedTotal} uds</span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border-2 border-red-200 bg-red-50 px-5 py-4">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" />
                <div>
                  <p className="font-semibold text-red-900">Faltan {closeDialog.data.missingQty} unidades</p>
                  <p className="text-sm text-red-700 mt-1">
                    El ASN quedará cerrado con <strong>{closeDialog.data.receivedSoFar}</strong> de <strong>{closeDialog.data.expectedTotal}</strong> unidades esperadas.
                    Esta acción no se puede revertir.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="close-reason" className="text-sm font-medium">
                  Motivo del cierre con diferencia <span className="text-destructive">*</span>
                </Label>
                <Select value={closeReason} onValueChange={(v) => { setCloseReason(v); closeDialog.clearError?.() }}>
                  <SelectTrigger id="close-reason" className={cn(!closeReason && closeDialog.error && "border-destructive")}>
                    <SelectValue placeholder="Selecciona el motivo…" />
                  </SelectTrigger>
                  <SelectContent>
                    {DISCREPANCY_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Obligatorio. Se incluye en el reporte OTIF enviado al proveedor.</p>
              </div>

              {closeDialog.error && <ErrorBanner message={closeDialog.error} />}
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={closeDialog.close}>Cancelar</Button>
            <Button variant="destructive" onClick={handleCloseSubmit} disabled={!closeReason}>
              <XCircle className="mr-1.5 size-4" /> Cerrar ASN con diferencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          DIALOG — Control de Calidad
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!qcDialog.data} onOpenChange={(o) => { if (!o) qcDialog.close() }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="size-5 text-amber-500" />
              Inspección de calidad
            </DialogTitle>
            <DialogDescription className="text-sm">
              Aprueba o rechaza el lote. Al aprobar, el stock pasa al área de ingreso para ser ubicado.
            </DialogDescription>
          </DialogHeader>

          {qcDialog.data && (
            <div className="space-y-5 py-1">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border bg-muted/30 p-4 text-sm sm:grid-cols-4">
                <DialogSummaryRow label="N° Aviso"  value={qcDialog.data.asnCode} mono />
                <DialogSummaryRow label="Proveedor" value={qcDialog.data.supplierName} />
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Producto</p>
                  <p className="font-medium">{qcDialog.data.productName}</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border-2 border-amber-200 bg-amber-50 px-5 py-4">
                <div>
                  <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Unidades bloqueadas en zona QC</p>
                  <p className="text-4xl font-bold tabular-nums text-amber-800 mt-0.5">{qcDialog.data.blockedQty}</p>
                </div>
                <ShieldCheck className="size-10 text-amber-300" />
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <div className="text-sm text-emerald-900">
                    <p className="font-semibold">Aprobar lote</p>
                    <p className="mt-0.5 text-xs text-emerald-700">Las {qcDialog.data.blockedQty} unidades salen de zona QC y pasan al área de ingreso para ser ubicadas. El stock quedará disponible para picking.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
                  <div className="text-sm text-red-900">
                    <p className="font-semibold">Rechazar lote</p>
                    <p className="mt-0.5 text-xs text-red-700">Las unidades permanecen bloqueadas. Se debe coordinar devolución o destrucción con el proveedor.</p>
                  </div>
                </div>
              </div>

              {qcDialog.error && <ErrorBanner message={qcDialog.error} />}
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={qcDialog.close}>Cancelar</Button>
            <Button variant="destructive" onClick={qcDialog.close}>
              <AlertTriangle className="mr-1.5 size-4" /> Rechazar lote
            </Button>
            <Button onClick={handleQcApprove} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="mr-1.5 size-4" /> Aprobar lote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          DIALOG — Ubicación en almacén (Putaway)
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!putawayDialog.data} onOpenChange={(o) => { if (!o) putawayDialog.close() }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <MapPin className="size-5 text-emerald-600" />
              Asignar ubicación en almacén
            </DialogTitle>
            <DialogDescription className="text-sm">
              El sistema sugiere la posición óptima según la frecuencia de rotación del producto.
            </DialogDescription>
          </DialogHeader>

          {putawayDialog.data && (
            <div className="space-y-5 py-1">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border bg-muted/30 p-4 text-sm sm:grid-cols-3">
                <DialogSummaryRow label="N° Aviso"  value={putawayDialog.data.asnCode} mono />
                <DialogSummaryRow label="Rotación"  value={`Clase ${putawayDialog.data.abcClass}`} />
                <DialogSummaryRow label="Producto"  value={putawayDialog.data.productName} />
              </div>

              {putawayDialog.data.isCrossDocking && (
                <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  <Zap className="mt-0.5 size-4 shrink-0" />
                  <span><strong>Salida rápida (Cross-Docking):</strong> este lote tiene una orden de salida pendiente. Al confirmar irá directamente al área de despacho.</span>
                </div>
              )}

              {putawayDialog.data.suggestedLocationId ? (
                <div className="space-y-3">
                  <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Posición recomendada</p>
                        <p className="mt-1 text-4xl font-bold tracking-tight text-emerald-800">
                          {locationCode(putawayDialog.data.suggestedLocationId)}
                        </p>
                        <p className="mt-1 text-xs text-emerald-600">
                          Optimiza tiempos de picking — producto clase {putawayDialog.data.abcClass}
                        </p>
                      </div>
                      <CheckCircle2 className="mt-1 size-8 shrink-0 text-emerald-400" />
                    </div>
                    <Button
                      className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => { if (putawayDialog.data?.suggestedLocationId) setSelectedLocation(putawayDialog.data.suggestedLocationId) }}
                    >
                      Confirmar posición recomendada
                      <ArrowRight className="ml-1.5 size-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-px flex-1 bg-border" />
                    o selecciona otra posición
                    <div className="h-px flex-1 bg-border" />
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <ClipboardCheck className="mt-0.5 size-4 shrink-0" />
                  <span>Sin posición recomendada. Selecciona la ubicación manualmente.</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="pa-loc" className="text-sm font-medium flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-muted-foreground" />
                  Posición de destino <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedLocation} onValueChange={(v) => { setSelectedLocation(v); putawayDialog.clearError?.() }}>
                  <SelectTrigger id="pa-loc" className={cn(!selectedLocation && putawayDialog.error && "border-destructive")}>
                    <SelectValue placeholder="Selecciona una posición en el almacén…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allLocations.map((l) => {
                      const isSuggested = l.id === putawayDialog.data?.suggestedLocationId
                      return (
                        <SelectItem key={l.id} value={l.id}>
                          <span className="flex items-center gap-2">
                            {isSuggested && <span className="text-emerald-500 font-bold">★</span>}
                            <span className="font-mono">{l.code}</span>
                            <span className="text-muted-foreground">— Zona {l.zone}</span>
                            {l.golden && (
                              <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-600 px-1 py-0">Golden</Badge>
                            )}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {putawayDialog.error && <ErrorBanner message={putawayDialog.error} />}
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={putawayDialog.close}>Cancelar</Button>
            <Button onClick={handlePutawaySubmit} disabled={!selectedLocation}>
              <MapPin className="mr-1.5 size-4" />
              {putawayDialog.data?.isCrossDocking ? "Enviar a área de despacho" : "Confirmar ubicación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
