'use client'

import { useMemo, useState } from 'react'
import { Boxes, Filter, TriangleAlert } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { availableStock, abcByProduct } from '@/store/selectors'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { useDialogState } from '@/hooks/use-dialog-state'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { formatNumber } from '@/lib/formatters'
import { buildInventoryColumns, type InventoryRow } from './columns'

type ActionType = 'hold' | 'release' | 'adjust'

interface ActionDialogData {
  type: ActionType
  itemId: string
  productName: string
  currentOnHand: number
  currentHold: number
}

const DIALOG_TITLES: Record<ActionType, string> = {
  hold: 'Poner en espera (hold)',
  release: 'Liberar del hold',
  adjust: 'Ajuste de inventario',
}

export default function InventoryPage() {
  const state = useWmsStore()
  const { holdInventory, releaseInventory, adjustInventory } = useWmsStore()
  const { productName, locationCode } = useStoreHelpers()

  const abc = abcByProduct(state)

  const [statusFilter, setStatusFilter] = useState('all')
  const [qty, setQty] = useState('')

  const actionDialog = useDialogState<ActionDialogData>()

  const rows = useMemo<InventoryRow[]>(
    () =>
      state.inventoryItems
        .filter((i) => i.onHandQuantity > 0)
        .map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: productName(i.productId),
          locationId: i.locationId,
          locationCode: locationCode(i.locationId),
          lot: i.lot ?? null,
          serial: i.serial ?? null,
          abcClass: abc[i.productId] ?? 'C',
          onHandQuantity: i.onHandQuantity,
          reservedQuantity: i.reservedQuantity,
          holdQuantity: i.holdQuantity,
          available: availableStock(i),
          status: i.status,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.inventoryItems]
  )

  const filteredRows = useMemo(
    () => (statusFilter === 'all' ? rows : rows.filter((r) => r.status === statusFilter)),
    [rows, statusFilter]
  )

  const totalOnHand = filteredRows.reduce((s, i) => s + i.onHandQuantity, 0)
  const totalAvailable = filteredRows.reduce((s, i) => s + i.available, 0)
  const totalHold = filteredRows.reduce((s, i) => s + i.holdQuantity, 0)

  const openActionDialog = (type: ActionType, item: InventoryRow) => {
    actionDialog.open({
      type,
      itemId: item.id,
      productName: item.productName,
      currentOnHand: item.onHandQuantity,
      currentHold: item.holdQuantity,
    })
    setQty(type === 'adjust' ? String(item.onHandQuantity) : '')
  }

  const handleSubmit = () => {
    if (!actionDialog.data) return
    const n = parseInt(qty, 10)
    if (isNaN(n) || n < 0) {
      actionDialog.setError('Ingresa una cantidad válida.')
      return
    }
    try {
      if (actionDialog.data.type === 'hold') holdInventory(actionDialog.data.itemId, n, 'Operador')
      else if (actionDialog.data.type === 'release')
        releaseInventory(actionDialog.data.itemId, n, 'Operador')
      else adjustInventory(actionDialog.data.itemId, n, 'Operador')
      actionDialog.close()
      setQty('')
    } catch (e: unknown) {
      actionDialog.setError(e instanceof Error ? e.message : 'Error en la operación')
    }
  }

  const columns = useMemo(
    () => buildInventoryColumns(openActionDialog),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const statusFilterNode = (
    <div className="flex items-center gap-2">
      <Filter className="text-muted-foreground size-4" />
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
  )

  return (
    <>
      <PageHeader
        title="Inventario"
        description="Stock en tiempo real. Fuente única de verdad calculada desde el store central."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Total en mano</p>
            <p className="text-2xl font-bold tabular-nums">{formatNumber(totalOnHand)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Disponible</p>
            <p className="text-2xl font-bold text-green-700 tabular-nums">
              {formatNumber(totalAvailable)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">En espera (hold)</p>
            <p className="text-2xl font-bold text-amber-600 tabular-nums">
              {formatNumber(totalHold)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="mb-1 flex items-center gap-2 text-base font-semibold">
            <Boxes className="size-4" />
            Posiciones de inventario
          </div>
          <DataTable
            columns={columns}
            data={filteredRows}
            searchColumn="productName"
            searchPlaceholder="Buscar producto..."
            filters={statusFilterNode}
            emptyMessage="No hay posiciones de inventario con los filtros seleccionados."
          />
        </CardContent>
      </Card>

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
