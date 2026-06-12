'use client'

import { useMemo, useState } from 'react'
import { Boxes, CalendarClock, PackageSearch, TriangleAlert, Warehouse } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { availableStock, abcByProduct } from '@/store/selectors'
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
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { buildInventoryColumns, daysUntilExpiry, type InventoryRow } from './columns'

type ActionType = 'hold' | 'release' | 'adjust' | 'relocate'

interface ActionDialogData {
  type: ActionType
  itemId: string
  productName: string
  currentOnHand: number
  currentHold: number
  locationId: string
}

const DIALOG_TITLES: Record<ActionType, string> = {
  hold: 'Poner en espera (hold)',
  release: 'Liberar del hold',
  adjust: 'Ajuste de inventario',
  relocate: 'Reubicar inventario',
}

const EXPIRY_FILTER_DAYS = 30

export default function InventoryPage() {
  const state = useWmsStore()
  const { holdInventory, releaseInventory, adjustInventory, relocateInventory, locations } =
    useWmsStore()
  const { productName, productSku, locationCode } = useStoreHelpers()

  const abc = abcByProduct(state)

  const [statusFilter, setStatusFilter] = useState('all')
  const [expiryFilter, setExpiryFilter] = useState('all')
  const [qty, setQty] = useState('')
  const [relocateLocationId, setRelocateLocationId] = useState('')

  const actionDialog = useDialogState<ActionDialogData>()

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
    return result
  }, [rows, statusFilter, expiryFilter])

  // ── KPI derivations ──────────────────────────────────────────────────────────
  const totalOnHand = rows.reduce((s, i) => s + i.onHandQuantity, 0)
  const totalAvailable = rows.reduce((s, i) => s + i.available, 0)
  const totalHold = rows.reduce((s, i) => s + i.holdQuantity, 0)

  const expiredCount = useMemo(
    () =>
      rows.filter((r) => r.expirationDate !== null && daysUntilExpiry(r.expirationDate) < 0).length,
    [rows]
  )
  const expiringSoonCount = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.expirationDate !== null &&
          daysUntilExpiry(r.expirationDate) >= 0 &&
          daysUntilExpiry(r.expirationDate) <= EXPIRY_FILTER_DAYS
      ).length,
    [rows]
  )

  // ── Action dialog ─────────────────────────────────────────────────────────
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
  }

  const handleSubmit = () => {
    if (!actionDialog.data) return
    try {
      if (actionDialog.data.type === 'relocate') {
        if (!relocateLocationId) {
          actionDialog.setError('Selecciona una ubicación destino.')
          return
        }
        if (relocateLocationId === actionDialog.data.locationId) {
          actionDialog.setError('La ubicación destino debe ser diferente a la actual.')
          return
        }
        relocateInventory(actionDialog.data.itemId, relocateLocationId, 'Operador')
      } else {
        const n = parseInt(qty, 10)
        if (isNaN(n) || n < 0) {
          actionDialog.setError('Ingresa una cantidad válida.')
          return
        }
        if (actionDialog.data.type === 'hold')
          holdInventory(actionDialog.data.itemId, n, 'Operador')
        else if (actionDialog.data.type === 'release')
          releaseInventory(actionDialog.data.itemId, n, 'Operador')
        else adjustInventory(actionDialog.data.itemId, n, 'Operador')
      }
      actionDialog.close()
      setQty('')
      setRelocateLocationId('')
    } catch (e: unknown) {
      actionDialog.setError(e instanceof Error ? e.message : 'Error en la operación')
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

  const filtersNode = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-44">
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
      <div className="flex items-center gap-1.5">
        <Select value={expiryFilter} onValueChange={setExpiryFilter}>
          <SelectTrigger className="h-8 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los vencimientos</SelectItem>
            <SelectItem value="soon">Próximos a vencer (≤30d)</SelectItem>
            <SelectItem value="expired">Ya vencidos</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {(statusFilter !== 'all' || expiryFilter !== 'all') && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-8 text-xs"
          onClick={() => {
            setStatusFilter('all')
            setExpiryFilter('all')
          }}
        >
          Limpiar filtros
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

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
      </div>

      {/* ── Inventory table ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Boxes className="text-muted-foreground size-4" />
            <CardTitle className="text-base">Posiciones de inventario</CardTitle>
          </div>
          <CardDescription>
            Cada fila es una posición única: producto × ubicación × lote/serial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredRows}
            searchColumn="productName"
            searchPlaceholder="Buscar producto..."
            filters={filtersNode}
            emptyMessage="No hay posiciones de inventario con los filtros seleccionados."
          />
        </CardContent>
      </Card>

      {/* ── Action dialog ────────────────────────────────────────────────── */}
      <Dialog
        open={!!actionDialog.data}
        onOpenChange={(o) => {
          if (!o) actionDialog.close()
        }}
      >
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
                  <span className="text-foreground font-medium">
                    {actionDialog.data.currentOnHand}
                  </span>
                </p>
              )}

              {actionDialog.data.type === 'release' && (
                <p className="text-muted-foreground text-sm">
                  Cantidad en hold:{' '}
                  <span className="text-foreground font-medium">
                    {actionDialog.data.currentHold}
                  </span>
                </p>
              )}

              {actionDialog.data.type === 'relocate' ? (
                <div className="space-y-1">
                  <Label htmlFor="inv-relocate">Ubicación destino</Label>
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
                </div>
              ) : (
                <div className="space-y-1">
                  <Label htmlFor="inv-qty">
                    {actionDialog.data.type === 'adjust' ? 'Nueva cantidad en mano' : 'Cantidad'}
                  </Label>
                  <Input
                    id="inv-qty"
                    type="number"
                    min={0}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </div>
              )}

              {actionDialog.error && (
                <p className="text-destructive flex items-center gap-1 text-sm">
                  <TriangleAlert className="size-3" /> {actionDialog.error}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={actionDialog.close}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
