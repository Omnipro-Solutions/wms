'use client'

import { useMemo } from 'react'
import { Download, PackageCheck, TrendingUp, Truck, User, Warehouse } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { productivityByOperator } from '@/lib/rules/picking'
import { receivingDiscrepancies, pickingDiscrepancies } from '@/lib/rules/reports'
import { otifPercentage } from '@/lib/rules/shipping'
import { availableStock } from '@/lib/rules/inventory'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNumber, formatPercent } from '@/lib/formatters'
import {
  productivityColumns,
  discrepancyColumns,
  warehouseInventoryColumns,
  movementColumns,
  otifColumns,
  type ProductivityRow,
  type DiscrepancyRow,
  type WarehouseInventoryRow,
  type MovementRow,
  type OtifRow,
} from './columns'

const exportCsv = (headers: string[], rows: (string | number)[][], filename: string) => {
  const lines = [headers.join(','), ...rows.map((r) => r.join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const state = useWmsStore()

  const productivity = useMemo(
    () => productivityByOperator(state.pickingTasks),
    [state.pickingTasks]
  )
  const receivingDisc = useMemo(() => receivingDiscrepancies(state.asnRecords), [state.asnRecords])
  const pickingDisc = useMemo(() => pickingDiscrepancies(state.pickingTasks), [state.pickingTasks])
  const allDiscrepancies = useMemo(
    () => [...receivingDisc, ...pickingDisc],
    [receivingDisc, pickingDisc]
  )

  const otif = useMemo(() => otifPercentage(state.shipments), [state.shipments])
  const otifColor = otif >= 90 ? 'text-green-700' : otif >= 75 ? 'text-amber-600' : 'text-red-600'

  const productivityRows = useMemo<ProductivityRow[]>(
    () =>
      productivity.map((r) => {
        const total = r.picksCompleted + r.partialCount + r.issueCount
        return {
          operatorName: r.operatorName,
          picksCompleted: r.picksCompleted,
          unitsPicked: r.unitsPicked,
          partialCount: r.partialCount,
          issueCount: r.issueCount,
          efficiency: total > 0 ? Math.round((r.picksCompleted / total) * 100) : 0,
        }
      }),
    [productivity]
  )

  const discrepancyRows = useMemo<DiscrepancyRow[]>(
    () =>
      allDiscrepancies.map((r, i) => ({
        id: `${r.referenceType}-${i}`,
        referenceType: r.referenceType,
        referenceCode: r.referenceCode,
        expected: r.expected,
        actual: r.actual,
        difference: r.difference,
      })),
    [allDiscrepancies]
  )

  const warehouseInventoryRows = useMemo<WarehouseInventoryRow[]>(
    () =>
      state.warehouses
        .map((wh) => {
          const items = state.inventoryItems.filter((i) => i.warehouseId === wh.id)
          return {
            warehouseId: wh.id,
            warehouseName: wh.name,
            totalOnHand: items.reduce((s, i) => s + i.onHandQuantity, 0),
            totalReserved: items.reduce((s, i) => s + i.reservedQuantity, 0),
            totalHold: items.reduce((s, i) => s + i.holdQuantity, 0),
            totalAvailable: items.reduce((s, i) => s + availableStock(i), 0),
            skuCount: new Set(items.map((i) => i.productId)).size,
          }
        })
        .filter((r) => r.totalOnHand > 0),
    [state.warehouses, state.inventoryItems]
  )

  const movementRows = useMemo<MovementRow[]>(
    () =>
      [...state.stockMovements]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 20)
        .map((mv) => ({
          id: mv.id,
          type: mv.type,
          productName: state.products.find((p) => p.id === mv.productId)?.name ?? mv.productId,
          quantity: mv.quantity,
          referenceId: mv.referenceId,
          operatorName: mv.operatorName,
          createdAt: mv.createdAt,
        })),
    [state.stockMovements, state.products]
  )

  const otifRows = useMemo<OtifRow[]>(
    () =>
      state.shipments.map((s) => ({
        id: s.id,
        customerName: s.customerName,
        carrierName: s.carrierName,
        otifStatus: s.otifStatus,
        shippedAt: s.shippedAt ?? null,
        packageCount: s.packageCount,
        weightKg: s.weightKg,
      })),
    [state.shipments]
  )

  const handleExportProductivity = () => {
    exportCsv(
      ['Operador', 'Picks completados', 'Unidades pickeadas', 'Parciales', 'Incidencias'],
      productivityRows.map((r) => [
        r.operatorName,
        r.picksCompleted,
        r.unitsPicked,
        r.partialCount,
        r.issueCount,
      ]),
      'reporte_productividad.csv'
    )
  }

  const handleExportDiscrepancies = () => {
    exportCsv(
      ['Tipo', 'Referencia', 'Esperado', 'Real', 'Diferencia'],
      discrepancyRows.map((r) => [
        r.referenceType,
        r.referenceCode,
        r.expected,
        r.actual,
        r.difference,
      ]),
      'reporte_discrepancias.csv'
    )
  }

  const handleExportInventory = () => {
    exportCsv(
      ['Bodega', 'En mano', 'Reservado', 'Retenido', 'Disponible', 'SKUs'],
      warehouseInventoryRows.map((r) => [
        r.warehouseName,
        r.totalOnHand,
        r.totalReserved,
        r.totalHold,
        r.totalAvailable,
        r.skuCount,
      ]),
      'reporte_inventario.csv'
    )
  }

  const handleExportMovements = () => {
    exportCsv(
      ['ID', 'Tipo', 'Producto', 'Cantidad', 'Referencia', 'Operador', 'Fecha'],
      movementRows.map((m) => [
        m.id,
        m.type,
        m.productName,
        m.quantity,
        m.referenceId,
        m.operatorName,
        m.createdAt.slice(0, 16),
      ]),
      'reporte_movimientos.csv'
    )
  }

  const handleExportOtif = () => {
    exportCsv(
      ['Pedido', 'Cliente', 'Transportadora', 'Estado OTIF', 'Despachado'],
      state.shipments.map((s) => [
        s.orderId,
        s.customerName,
        s.carrierName,
        s.otifStatus,
        s.shippedAt ?? '—',
      ]),
      'reporte_otif.csv'
    )
  }

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Reportes operativos: productividad, discrepancias, inventario, movimientos y OTIF. Exportables a CSV."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Picks completados</p>
            <p className="text-2xl font-bold tabular-nums">
              {formatNumber(productivityRows.reduce((s, r) => s + r.picksCompleted, 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Discrepancias activas</p>
            <p
              className={`text-2xl font-bold tabular-nums ${discrepancyRows.length > 0 ? 'text-red-600' : 'text-green-700'}`}
            >
              {formatNumber(discrepancyRows.length)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">OTIF</p>
            <p className={`text-2xl font-bold tabular-nums ${otifColor}`}>{formatPercent(otif)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Movimientos registrados</p>
            <p className="text-2xl font-bold tabular-nums">
              {formatNumber(state.stockMovements.length)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="size-4" /> Productividad por operador
            </CardTitle>
            <Button size="sm" variant="outline" onClick={handleExportProductivity}>
              <Download className="mr-1 size-3" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={productivityColumns}
            data={productivityRows}
            searchColumn="operatorName"
            searchPlaceholder="Buscar operador..."
            showViewOptions={false}
            emptyMessage="Sin datos de productividad."
            defaultPageSize={10}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4" /> Discrepancias (recepción + picking)
            </CardTitle>
            <Button size="sm" variant="outline" onClick={handleExportDiscrepancies}>
              <Download className="mr-1 size-3" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={discrepancyColumns}
            data={discrepancyRows}
            searchColumn="referenceCode"
            searchPlaceholder="Buscar referencia..."
            showViewOptions={false}
            emptyMessage="Sin discrepancias."
            defaultPageSize={10}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Warehouse className="size-4" /> Inventario por bodega
            </CardTitle>
            <Button size="sm" variant="outline" onClick={handleExportInventory}>
              <Download className="mr-1 size-3" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={warehouseInventoryColumns}
            data={warehouseInventoryRows}
            showViewOptions={false}
            emptyMessage="Sin datos de inventario."
            defaultPageSize={10}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageCheck className="size-4" /> Últimos movimientos de stock
            </CardTitle>
            <Button size="sm" variant="outline" onClick={handleExportMovements}>
              <Download className="mr-1 size-3" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={movementColumns}
            data={movementRows}
            searchColumn="productName"
            searchPlaceholder="Buscar producto..."
            showViewOptions={false}
            emptyMessage="Sin movimientos registrados."
            defaultPageSize={20}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="size-4" /> OTIF — On Time In Full
            </CardTitle>
            <Button size="sm" variant="outline" onClick={handleExportOtif}>
              <Download className="mr-1 size-3" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-4">
            <p className="text-muted-foreground text-sm">OTIF global:</p>
            <p className={`text-3xl font-bold tabular-nums ${otifColor}`}>{formatPercent(otif)}</p>
            <p className="text-muted-foreground text-sm">
              ({state.shipments.filter((s) => s.otifStatus === 'on_time').length} de{' '}
              {state.shipments.length} envíos a tiempo)
            </p>
          </div>
          <DataTable
            columns={otifColumns}
            data={otifRows}
            searchColumn="customerName"
            searchPlaceholder="Buscar cliente..."
            showViewOptions={false}
            emptyMessage="Sin envíos registrados."
            defaultPageSize={20}
          />
        </CardContent>
      </Card>
    </>
  )
}
