'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Boxes,
  CalendarClock,
  ClipboardCheck,
  PackageSearch,
  Search,
  Snowflake,
  TriangleAlert,
  Warehouse,
} from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { availableStock, abcByProduct, selectInventoryAccuracy, selectStockStateCounts } from '@/store/selectors'
import { resolveStockState, type StockStateCode } from '@/lib/rules/inventory'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { useDialogState } from '@/hooks/use-dialog-state'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { SubNav, type SubNavItem } from '@/components/shared/sub-nav'
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
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { InventoryDetailSheet } from './_components/inventory-detail-sheet'
import { ReservationsAtpPanel } from './_components/reservations-atp-panel'
import { AgingReportPanel } from './_components/aging-report-panel'
import { buildInventoryColumns, daysUntilExpiry, type InventoryRow } from './columns'

type ActionType = 'hold' | 'release' | 'adjust' | 'relocate' | 'damage'
type BulkActionType = 'hold_lot' | 'hold_location'

const INVENTORY_TABS: SubNavItem[] = [
  { value: 'stock', label: 'Stock' },
  { value: 'reservations', label: 'Reservas & ATP' },
  { value: 'aging', label: 'Antigüedad' },
]

const STOCK_STATE_LABELS: Record<StockStateCode, string> = {
  available: 'Disponible',
  reserved: 'Reservado',
  on_hold: 'En espera',
  quarantine: 'Cuarentena',
  damaged: 'Dañado',
  expired: 'Vencido',
  in_transit: 'En tránsito',
}

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
  damage: 'Marcar como dañado',
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
    relocateInventory,
    holdByLot,
    holdByLocation,
    markDamaged,
    releaseExpiredReservations,
    locations,
    unitsOfMeasure,
    settings,
  } = state
  const { productName, productSku, locationCode } = useStoreHelpers()
  const { operator } = useCurrentOperator()
  const operatorName = operator?.name ?? 'Sistema'

  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'stock'

  const abc = abcByProduct(state)
  const accuracy = selectInventoryAccuracy(state)
  const stockStateCounts = selectStockStateCounts(state)

  const [productFilter, setProductFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expiryFilter, setExpiryFilter] = useState('all')
  const [lotFilter, setLotFilter] = useState('')
  const [qty, setQty] = useState('')
  const [relocateLocationId, setRelocateLocationId] = useState('')
  const [reasonId, setReasonId] = useState('')
  const [bulkLotInput, setBulkLotInput] = useState('')
  const [bulkLocationId, setBulkLocationId] = useState('')
  const [selectedItem, setSelectedItem] = useState<InventoryRow | null>(null)

  const actionDialog = useDialogState<ActionDialogData>()
  const bulkDialog = useDialogState<BulkDialogData>()

  const holdReasons = state.reasons.filter((r) => r.context === 'hold' && r.active)
  const adjustmentReasons = state.reasons.filter((r) => r.context === 'adjustment' && r.active)

  const rows = useMemo<InventoryRow[]>(
    () =>
      state.inventoryItems
        .filter((i) => i.onHandQuantity > 0)
        .map((i) => {
          const product = state.products.find((p) => p.id === i.productId)
          const location = state.locations.find((l) => l.id === i.locationId)
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
            computedStatus: resolveStockState(i, location?.type),
            baseUomAbbr: unitsOfMeasure.find((u) => u.id === product?.baseUomId)?.abbreviation,
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.inventoryItems, state.locations]
  )

  const filteredRows = useMemo(() => {
    let result =
      statusFilter === 'all' ? rows : rows.filter((r) => r.computedStatus === statusFilter)
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
    setReasonId('')
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
        if (type === 'hold') holdInventory(itemId, n, 'Operador', reasonId || undefined)
        else if (type === 'release') releaseInventory(itemId, n, 'Operador')
        else if (type === 'damage') markDamaged(itemId, n, operatorName, reasonId || undefined)
        else state.requestAdjustment(itemId, n, 'Operador', reasonId || undefined)
      }
      actionDialog.close()
      setQty('')
      setRelocateLocationId('')
      setReasonId('')
    } catch (e: unknown) {
      actionDialog.setError(e instanceof Error ? e.message : 'Error en la operación')
    }
  }

  // ── Bulk action dialog ────────────────────────────────────────────────────
  const openBulkDialog = (type: BulkActionType) => {
    bulkDialog.open({ type })
    setBulkLotInput('')
    setBulkLocationId('')
    setReasonId('')
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
        holdByLot(bulkLotInput.trim(), warehouseId, 'Operador', reasonId || undefined)
      } else {
        if (!bulkLocationId) {
          bulkDialog.setError('Selecciona una ubicación.')
          return
        }
        holdByLocation(bulkLocationId, 'Operador', reasonId || undefined)
      }
      bulkDialog.close()
      setBulkLotInput('')
      setBulkLocationId('')
      setReasonId('')
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
      <Input
        value={lotFilter}
        onChange={(e) => setLotFilter(e.target.value)}
        placeholder="Lote o serial..."
        className="h-8 w-36 font-mono text-xs"
      />
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="h-8 w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          {(Object.keys(STOCK_STATE_LABELS) as StockStateCode[]).map((code) => (
            <SelectItem key={code} value={code}>
              {STOCK_STATE_LABELS[code]}
            </SelectItem>
          ))}
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventario"
        description="Stock en tiempo real. Fuente única de verdad calculada desde el store central."
      />

      <SubNav items={INVENTORY_TABS} defaultValue="stock" />

      {activeTab === 'stock' && (
      <>
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
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
        />
        <KpiCard
          icon={CalendarClock}
          value={expiryValue}
          label="Alertas de vencimiento"
          sublabel={expirySublabel}
          tone={expiryTone}
        />
        <KpiCard
          icon={ClipboardCheck}
          value={`${accuracy.ira}%`}
          label="IRA"
          sublabel={`${accuracy.adjustmentsPending} ajuste${accuracy.adjustmentsPending !== 1 ? 's' : ''} pendiente${accuracy.adjustmentsPending !== 1 ? 's' : ''}`}
          tone={accuracy.ira >= 95 ? 'green' : accuracy.ira >= 80 ? 'amber' : 'red'}
        />
      </div>

      {/* ── Stock state breakdown (Base — múltiples estados de stock) ──────── */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(STOCK_STATE_LABELS) as StockStateCode[])
          .filter((code) => stockStateCounts[code] > 0)
          .map((code) => (
            <div
              key={code}
              className="flex items-center gap-1.5 rounded-full border bg-muted/30 px-3 py-1 text-xs"
            >
              <StatusBadge status={code} />
              <span className="text-muted-foreground">·</span>
              <span className="font-semibold tabular-nums">{stockStateCounts[code]}</span>
              <span className="text-muted-foreground">posición{stockStateCounts[code] !== 1 ? 'es' : ''}</span>
            </div>
          ))}
      </div>

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
      </>
      )}

      {activeTab === 'reservations' && (
        <ReservationsAtpPanel
          operatorName={operatorName}
          releaseExpiredReservations={releaseExpiredReservations}
        />
      )}

      {activeTab === 'aging' && (
        <AgingReportPanel
          inventoryRows={rows}
          onRelocate={(row) => openActionDialog('relocate', row)}
          onOpenDetail={(row) => setSelectedItem(row)}
        />
      )}

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
                  {(actionDialog.data.type === 'hold' ||
                    actionDialog.data.type === 'damage' ||
                    actionDialog.data.type === 'adjust') && (
                    <Field className="w-full">
                      <FieldLabel htmlFor="inv-hold-reason">Motivo</FieldLabel>
                      <Select value={reasonId} onValueChange={setReasonId}>
                        <SelectTrigger id="inv-hold-reason">
                          <SelectValue placeholder="Seleccionar motivo (opcional)..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(actionDialog.data.type === 'adjust' ? adjustmentReasons : holdReasons).map((r) => (
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
                <Select value={reasonId} onValueChange={setReasonId}>
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

      {/* ── Detail sheet ─────────────────────────────────────────────────── */}
      <InventoryDetailSheet
        item={selectedItem}
        movements={state.stockMovements}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  )
}
