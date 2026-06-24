'use client'

import { useMemo, useState } from 'react'
import {
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  PackageSearch,
  Search,
  Snowflake,
  TriangleAlert,
  Warehouse,
  XCircle,
} from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { availableStock, abcByProduct, selectInventoryAccuracy } from '@/store/selectors'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { useDialogState } from '@/hooks/use-dialog-state'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { InventoryDetailSheet } from './_components/inventory-detail-sheet'
import { buildInventoryColumns, daysUntilExpiry, type InventoryRow } from './columns'

type ActionType = 'hold' | 'release' | 'adjust' | 'relocate'
type BulkActionType = 'hold_lot' | 'hold_location'

interface ActionDialogData {
  type: ActionType
  itemId: string
  productName: string
  currentOnHand: number
  currentHold: number
  locationId: string
}

interface BulkDialogData {
  type: BulkActionType
}

const DIALOG_TITLES: Record<ActionType, string> = {
  hold: 'Poner en espera (hold)',
  release: 'Liberar del hold',
  adjust: 'Ajuste de inventario',
  relocate: 'Reubicar inventario',
}

const BULK_DIALOG_TITLES: Record<BulkActionType, string> = {
  hold_lot: 'Hold masivo por lote',
  hold_location: 'Hold masivo por ubicación',
}

const EXPIRY_FILTER_DAYS = 30

export default function InventoryPage() {
  const state = useWmsStore()
  const {
    holdInventory,
    releaseInventory,
    adjustInventory,
    relocateInventory,
    holdByLot,
    holdByLocation,
    locations,
    products,
    unitsOfMeasure,
    adjustmentRequests,
    approveAdjustment,
    rejectAdjustment,
    settings,
  } = state
  const { productName, productSku, locationCode } = useStoreHelpers()

  const abc = abcByProduct(state)
  const accuracy = selectInventoryAccuracy(state)

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectingId, setRejectingId] = useState('')
  const [rejectNote, setRejectNote] = useState('')

  const handleOpenReject = (id: string) => {
    setRejectingId(id)
    setRejectNote('')
    setRejectDialogOpen(true)
  }

  const handleConfirmReject = () => {
    if (!rejectNote.trim()) return
    rejectAdjustment(rejectingId, 'Supervisor', rejectNote.trim())
    setRejectDialogOpen(false)
  }

  const pendingAdj = adjustmentRequests.filter((r) => r.status === 'pending_approval')

  const [productFilter, setProductFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expiryFilter, setExpiryFilter] = useState('all')
  const [lotFilter, setLotFilter] = useState('')
  const [qty, setQty] = useState('')
  const [relocateLocationId, setRelocateLocationId] = useState('')
  const [holdReasonId, setHoldReasonId] = useState('')
  const [bulkLotInput, setBulkLotInput] = useState('')
  const [bulkLocationId, setBulkLocationId] = useState('')
  const [selectedItem, setSelectedItem] = useState<InventoryRow | null>(null)

  const actionDialog = useDialogState<ActionDialogData>()
  const bulkDialog = useDialogState<BulkDialogData>()

  const holdReasons = state.reasons.filter((r) => r.context === 'hold' && r.active)

  const rows = useMemo<InventoryRow[]>(
    () =>
      state.inventoryItems
        .filter((i) => i.onHandQuantity > 0)
        .map((i) => {
          const product = state.products.find((p) => p.id === i.productId)
          return {
            id: i.id,
            productId: i.productId,
            productName: productName(i.productId),
            productSku: productSku(i.productId),
            productCategory: product?.category ?? '',
            productImageUrl: product?.imageUrl,
            locationId: i.locationId,
            locationCode: locationCode(i.locationId),
            lot: i.lot ?? null,
            serial: i.serial ?? null,
            expirationDate: i.expirationDate ?? null,
            abcClass: abc[i.productId] ?? 'C',
            onHandQuantity: i.onHandQuantity,
            reservedQuantity: i.reservedQuantity,
            holdQuantity: i.holdQuantity,
            available: availableStock(i),
            status: i.status,
            baseUomAbbr: unitsOfMeasure.find((u) => u.id === product?.baseUomId)?.abbreviation,
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.inventoryItems]
  )

  const filteredRows = useMemo(() => {
    let result = statusFilter === 'all' ? rows : rows.filter((r) => r.status === statusFilter)
    if (expiryFilter === 'expired') {
      result = result.filter(
        (r) => r.expirationDate !== null && daysUntilExpiry(r.expirationDate) < 0
      )
    } else if (expiryFilter === 'soon') {
      result = result.filter(
        (r) =>
          r.expirationDate !== null &&
          daysUntilExpiry(r.expirationDate) >= 0 &&
          daysUntilExpiry(r.expirationDate) <= EXPIRY_FILTER_DAYS
      )
    }
    if (lotFilter.trim()) {
      const q = lotFilter.trim().toLowerCase()
      result = result.filter(
        (r) => r.lot?.toLowerCase().includes(q) || r.serial?.toLowerCase().includes(q)
      )
    }
    if (productFilter.trim()) {
      const q = productFilter.trim().toLowerCase()
      result = result.filter(
        (r) => r.productName.toLowerCase().includes(q) || r.productSku.toLowerCase().includes(q)
      )
    }
    return result
  }, [rows, statusFilter, expiryFilter, lotFilter, productFilter])

  // ── KPI derivations ──────────────────────────────────────────────────────────
  const totalOnHand = rows.reduce((s, i) => s + i.onHandQuantity, 0)
  const totalAvailable = rows.reduce((s, i) => s + i.available, 0)
  const totalHold = rows.reduce((s, i) => s + i.holdQuantity, 0)

  const expiredCount = rows.filter(
    (r) => r.expirationDate !== null && daysUntilExpiry(r.expirationDate) < 0
  ).length
  const expiringSoonCount = rows.filter(
    (r) =>
      r.expirationDate !== null &&
      daysUntilExpiry(r.expirationDate) >= 0 &&
      daysUntilExpiry(r.expirationDate) <= EXPIRY_FILTER_DAYS
  ).length

  // ── Item action dialog ────────────────────────────────────────────────────
  const openActionDialog = (type: ActionType, item: InventoryRow) => {
    actionDialog.open({
      type,
      itemId: item.id,
      productName: item.productName,
      currentOnHand: item.onHandQuantity,
      currentHold: item.holdQuantity,
      locationId: item.locationId,
    })
    setQty(type === 'adjust' ? String(item.onHandQuantity) : '')
    setRelocateLocationId('')
    setHoldReasonId('')
  }

  const handleSubmit = () => {
    if (!actionDialog.data) return
    const { type, itemId, locationId } = actionDialog.data
    try {
      if (type === 'relocate') {
        if (!relocateLocationId) {
          actionDialog.setError('Selecciona una ubicación destino.')
          return
        }
        if (relocateLocationId === locationId) {
          actionDialog.setError('La ubicación destino debe ser diferente a la actual.')
          return
        }
        relocateInventory(itemId, relocateLocationId, 'Operador')
      } else {
        const n = parseInt(qty, 10)
        if (isNaN(n) || n < 0) {
          actionDialog.setError('Ingresa una cantidad válida.')
          return
        }
        if (type === 'hold') holdInventory(itemId, n, 'Operador', holdReasonId || undefined)
        else if (type === 'release') releaseInventory(itemId, n, 'Operador')
        else state.requestAdjustment(itemId, n, 'Operador')
      }
      actionDialog.close()
      setQty('')
      setRelocateLocationId('')
      setHoldReasonId('')
    } catch (e: unknown) {
      actionDialog.setError(e instanceof Error ? e.message : 'Error en la operación')
    }
  }

  // ── Bulk action dialog ────────────────────────────────────────────────────
  const openBulkDialog = (type: BulkActionType) => {
    bulkDialog.open({ type })
    setBulkLotInput('')
    setBulkLocationId('')
    setHoldReasonId('')
  }

  const handleBulkSubmit = () => {
    if (!bulkDialog.data) return
    const { type } = bulkDialog.data
    try {
      if (type === 'hold_lot') {
        if (!bulkLotInput.trim()) {
          bulkDialog.setError('Ingresa un número de lote.')
          return
        }
        const warehouseId = state.warehouses[0]?.id ?? 'wh-bog'
        holdByLot(bulkLotInput.trim(), warehouseId, 'Operador', holdReasonId || undefined)
      } else {
        if (!bulkLocationId) {
          bulkDialog.setError('Selecciona una ubicación.')
          return
        }
        holdByLocation(bulkLocationId, 'Operador', holdReasonId || undefined)
      }
      bulkDialog.close()
      setBulkLotInput('')
      setBulkLocationId('')
      setHoldReasonId('')
    } catch (e: unknown) {
      bulkDialog.setError(e instanceof Error ? e.message : 'Error en la operación')
    }
  }

  const columns = useMemo(
    () => buildInventoryColumns(openActionDialog),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const relocatableLocations = useMemo(
    () => locations.filter((l) => l.type === 'pick' || l.type === 'reserve'),
    [locations]
  )

  // ── Expiry KPI tone ───────────────────────────────────────────────────────
  const expiryTone = expiredCount > 0 ? 'red' : expiringSoonCount > 0 ? 'amber' : 'green'
  const expiryValue = expiredCount + expiringSoonCount
  const expirySublabel =
    expiredCount > 0
      ? `${expiredCount} vencido${expiredCount > 1 ? 's' : ''} · ${expiringSoonCount} próximo${expiringSoonCount !== 1 ? 's' : ''}`
      : expiringSoonCount > 0
        ? `${expiringSoonCount} lote${expiringSoonCount !== 1 ? 's' : ''} vencen en ≤30 días`
        : 'Sin alertas de vencimiento'

  const hasActiveFilters =
    productFilter.trim() !== '' ||
    statusFilter !== 'all' ||
    expiryFilter !== 'all' ||
    lotFilter.trim() !== ''

  const filtersNode = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
        <Input
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          placeholder="Buscar producto..."
          className="h-8 w-44 pl-7 text-xs"
        />
      </div>
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
      <Select value={expiryFilter} onValueChange={setExpiryFilter}>
        <SelectTrigger className="h-8 w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los vencimientos</SelectItem>
          <SelectItem value="soon">Próximos a vencer (≤30d)</SelectItem>
          <SelectItem value="expired">Ya vencidos</SelectItem>
        </SelectContent>
      </Select>
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-8 text-xs"
          onClick={() => {
            setProductFilter('')
            setStatusFilter('all')
            setExpiryFilter('all')
            setLotFilter('')
          }}
        >
          Limpiar
        </Button>
      )}
    </div>
  )

  return (
    <>
      <PageHeader
        title="Inventario"
        description="Stock en tiempo real. Fuente única de verdad calculada desde el store central."
      />

      {/* ── Freeze banner ────────────────────────────────────────────────── */}
      {settings.inventoryFreezeActive && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 px-4 py-3">
          <Snowflake className="size-5 shrink-0 text-blue-600" />
          <div className="flex-1 text-sm text-blue-800">
            <p className="font-semibold">Inventario congelado</p>
            <p className="text-blue-700">Los ajustes, bloqueos y liberaciones están deshabilitados. Ve a Administración para desactivar el modo congelado.</p>
          </div>
        </div>
      )}

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <KpiCard
          icon={Warehouse}
          value={totalOnHand}
          label="Total en mano"
          sublabel="Unidades físicas en el almacén"
          tone="neutral"
        />
        <KpiCard
          icon={Boxes}
          value={totalAvailable}
          label="Disponible"
          sublabel="Sin reserva ni hold"
          tone="green"
        />
        <KpiCard
          icon={PackageSearch}
          value={totalHold}
          label="En espera (hold)"
          sublabel={totalHold > 0 ? 'Bloqueado para operaciones' : 'Sin unidades bloqueadas'}
          tone={totalHold > 0 ? 'amber' : 'neutral'}
          alert={totalHold > 0}
          onClick={totalHold > 0 ? () => setStatusFilter('on_hold') : undefined}
        />
        <KpiCard
          icon={CalendarClock}
          value={expiryValue}
          label="Alertas de vencimiento"
          sublabel={expirySublabel}
          tone={expiryTone}
          alert={expiredCount > 0}
          onClick={
            expiryValue > 0
              ? () => setExpiryFilter(expiredCount > 0 ? 'expired' : 'soon')
              : undefined
          }
        />
        <KpiCard
          icon={ClipboardCheck}
          value={`${accuracy.ira}%`}
          label="IRA"
          sublabel={`${accuracy.adjustmentsPending} ajuste${accuracy.adjustmentsPending !== 1 ? 's' : ''} pendiente${accuracy.adjustmentsPending !== 1 ? 's' : ''}`}
          tone={accuracy.ira >= 95 ? 'green' : accuracy.ira >= 80 ? 'amber' : 'red'}
          alert={accuracy.adjustmentsPending > 0}
        />
      </div>

      {/* ── Pending adjustments panel ────────────────────────────────────── */}
      {adjustmentRequests.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ClipboardCheck className="size-4" />
                Solicitudes de ajuste de inventario
                {pendingAdj.length > 0 && (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                    {pendingAdj.length} pendiente{pendingAdj.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </CardTitle>
            </div>
            <CardDescription>
              Ajustes con delta &gt; {settings.adjustmentApprovalThreshold} uds que requieren aprobación de supervisor.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {adjustmentRequests.map((req) => {
                const product = products.find((p) => p.id === req.productId)
                return (
                  <div key={req.id} className="flex flex-wrap items-center gap-4 px-4 py-3 text-sm">
                    <div className="flex-1 min-w-40">
                      <p className="font-medium truncate">{product?.name ?? req.productId}</p>
                      <p className="text-xs text-muted-foreground">{req.operatorName} · {req.requestedAt.slice(0, 10)}</p>
                    </div>
                    <div className="flex items-center gap-4 tabular-nums text-xs text-muted-foreground">
                      <span>{req.currentQty} → {req.countedQty}</span>
                      <span className={cn('font-semibold text-sm', req.delta > 0 ? 'text-emerald-600' : 'text-red-600')}>
                        {req.delta > 0 ? '+' : ''}{req.delta}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn('text-xs shrink-0', req.status === 'pending_approval' ? 'border-amber-200 bg-amber-50 text-amber-700' : req.status === 'approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-50 text-zinc-500')}
                    >
                      {req.status === 'pending_approval' ? 'Pendiente' : req.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                    </Badge>
                    {req.status === 'pending_approval' && (
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-emerald-600 hover:text-emerald-700" onClick={() => approveAdjustment(req.id, 'Supervisor')}>
                          <CheckCircle2 className="size-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-red-500 hover:text-red-600" onClick={() => handleOpenReject(req.id)}>
                          <XCircle className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* ── Inventory table ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Boxes className="text-muted-foreground size-4" />
              <CardTitle className="text-base">Posiciones de inventario</CardTitle>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  Acciones masivas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openBulkDialog('hold_lot')}>
                  Hold por lote
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openBulkDialog('hold_location')}>
                  Hold por ubicación
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <CardDescription>
            Cada fila es una posición única: producto × ubicación × lote/serial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredRows}
            filters={filtersNode}
            emptyMessage="No hay posiciones de inventario con los filtros seleccionados."
            onRowClick={(row) => setSelectedItem(row)}
          />
        </CardContent>
      </Card>

      {/* ── Item action dialog ───────────────────────────────────────────── */}
      <Dialog open={!!actionDialog.data} onOpenChange={(o) => { if (!o) actionDialog.close() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.data ? DIALOG_TITLES[actionDialog.data.type] : ''}
            </DialogTitle>
          </DialogHeader>

          {actionDialog.data && (
            <div className="space-y-4 py-2">
              <p className="text-muted-foreground text-sm">
                Producto:{' '}
                <span className="text-foreground font-medium">{actionDialog.data.productName}</span>
              </p>

              {actionDialog.data.type === 'adjust' && (
                <p className="text-muted-foreground text-sm">
                  Stock actual en mano:{' '}
                  <span className="text-foreground font-medium">{actionDialog.data.currentOnHand}</span>
                </p>
              )}

              {actionDialog.data.type === 'release' && (
                <p className="text-muted-foreground text-sm">
                  Cantidad en hold:{' '}
                  <span className="text-foreground font-medium">{actionDialog.data.currentHold}</span>
                </p>
              )}

              {actionDialog.data.type === 'relocate' ? (
                <Field className="w-full">
                  <FieldLabel htmlFor="inv-relocate">Ubicación destino</FieldLabel>
                  <Select value={relocateLocationId} onValueChange={setRelocateLocationId}>
                    <SelectTrigger id="inv-relocate">
                      <SelectValue placeholder="Seleccionar ubicación..." />
                    </SelectTrigger>
                    <SelectContent>
                      {relocatableLocations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          <span className="font-mono">{loc.code}</span>
                          <span className="text-muted-foreground ml-2 text-xs">
                            {loc.zone} · {loc.type}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <>
                  <Field className="w-full">
                    <FieldLabel htmlFor="inv-qty">
                      {actionDialog.data.type === 'adjust' ? 'Nueva cantidad en mano' : 'Cantidad'}
                    </FieldLabel>
                    <Input
                      id="inv-qty"
                      type="number"
                      min={0}
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                    />
                  </Field>
                  {actionDialog.data.type === 'hold' && (
                    <Field className="w-full">
                      <FieldLabel htmlFor="inv-hold-reason">Motivo de hold</FieldLabel>
                      <Select value={holdReasonId} onValueChange={setHoldReasonId}>
                        <SelectTrigger id="inv-hold-reason">
                          <SelectValue placeholder="Seleccionar motivo (opcional)..." />
                        </SelectTrigger>
                        <SelectContent>
                          {holdReasons.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                </>
              )}

              {actionDialog.error && (
                <p className="text-destructive flex items-center gap-1 text-sm">
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

      {/* ── Bulk action dialog ───────────────────────────────────────────── */}
      <Dialog open={!!bulkDialog.data} onOpenChange={(o) => { if (!o) bulkDialog.close() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkDialog.data ? BULK_DIALOG_TITLES[bulkDialog.data.type] : ''}
            </DialogTitle>
            <DialogDescription>
              {bulkDialog.data?.type === 'hold_lot'
                ? 'Se bloquearán todas las posiciones disponibles del lote indicado.'
                : 'Se bloquearán todos los ítems disponibles en la ubicación seleccionada.'}
            </DialogDescription>
          </DialogHeader>

          {bulkDialog.data && (
            <div className="space-y-4 py-2">
              {bulkDialog.data.type === 'hold_lot' ? (
                <Field className="w-full">
                  <FieldLabel htmlFor="bulk-lot">Número de lote</FieldLabel>
                  <FieldDescription>Ej. LOT-TS-2601</FieldDescription>
                  <Input
                    id="bulk-lot"
                    placeholder="LOT-TS-2601"
                    value={bulkLotInput}
                    onChange={(e) => setBulkLotInput(e.target.value)}
                    className="font-mono"
                  />
                </Field>
              ) : (
                <Field className="w-full">
                  <FieldLabel htmlFor="bulk-location">Ubicación</FieldLabel>
                  <Select value={bulkLocationId} onValueChange={setBulkLocationId}>
                    <SelectTrigger id="bulk-location">
                      <SelectValue placeholder="Seleccionar ubicación..." />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          <span className="font-mono">{loc.code}</span>
                          <span className="text-muted-foreground ml-2 text-xs">
                            {loc.zone} · {loc.type}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <Field className="w-full">
                <FieldLabel htmlFor="bulk-reason">Motivo de hold</FieldLabel>
                <Select value={holdReasonId} onValueChange={setHoldReasonId}>
                  <SelectTrigger id="bulk-reason">
                    <SelectValue placeholder="Seleccionar motivo (opcional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {holdReasons.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {bulkDialog.error && (
                <p className="text-destructive flex items-center gap-1 text-sm">
                  <TriangleAlert className="size-3" /> {bulkDialog.error}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={bulkDialog.close}>Cancelar</Button>
            <Button onClick={handleBulkSubmit}>Confirmar hold masivo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject adjustment dialog ────────────────────────────────────── */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rechazar ajuste</DialogTitle>
            <DialogDescription>Indica el motivo del rechazo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-2">
            <label htmlFor="inv-reject-note" className="text-sm font-medium">Motivo *</label>
            <input
              id="inv-reject-note"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="Ej: Diferencia fuera de rango aceptable…"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={!rejectNote.trim()} onClick={handleConfirmReject}>Rechazar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail sheet ─────────────────────────────────────────────────── */}
      <InventoryDetailSheet
        item={selectedItem}
        movements={state.stockMovements}
        onClose={() => setSelectedItem(null)}
      />
    </>
  )
}
