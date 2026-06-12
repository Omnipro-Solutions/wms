'use client'

import { useMemo, useState } from 'react'
import { Route } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable } from '@/components/data-table'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatNumber } from '@/lib/formatters'
import { buildSapRouteColumns, type SapRouteRow } from './columns'

export default function SapRoutesPage() {
  const state = useWmsStore()
  const { warehouseName } = useStoreHelpers()

  const [statusFilter, setStatusFilter] = useState('all')
  const [carrierFilter, setCarrierFilter] = useState('all')

  const carriers = useMemo(
    () => [...new Set(state.sapRoutes.map((r) => r.carrierName))],
    [state.sapRoutes]
  )

  const rows = useMemo<SapRouteRow[]>(
    () =>
      state.sapRoutes.map((r) => {
        const loadPct = r.capacityKg > 0 ? Math.round((r.currentLoadKg / r.capacityKg) * 100) : 0
        return {
          id: r.id,
          code: r.code,
          name: r.name,
          originName: warehouseName(r.originId),
          destinationNames: r.destinationIds.map((did) => warehouseName(did)),
          carrierName: r.carrierName,
          driverName: r.driverName,
          truckPlate: r.truckPlate,
          routeDate: r.routeDate,
          currentLoadKg: r.currentLoadKg,
          capacityKg: r.capacityKg,
          loadPct,
          status: r.status,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.sapRoutes]
  )

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false
        if (carrierFilter !== 'all' && r.carrierName !== carrierFilter) return false
        return true
      }),
    [rows, statusFilter, carrierFilter]
  )

  const inTransitCount = state.sapRoutes.filter((r) => r.status === 'in_transit').length
  const syncedCount = state.sapRoutes.filter((r) => r.status === 'synced').length
  const totalLoad = state.sapRoutes.reduce((s, r) => s + r.currentLoadKg, 0)

  const columns = useMemo(() => buildSapRouteColumns(), [])

  const filtersNode = (
    <>
      <Select value={carrierFilter} onValueChange={setCarrierFilter}>
        <SelectTrigger className="h-8 w-44">
          <SelectValue placeholder="Transportadora" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {carriers.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="h-8 w-40">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="pending">Pendiente</SelectItem>
          <SelectItem value="in_progress">En preparación</SelectItem>
          <SelectItem value="in_transit">En tránsito</SelectItem>
          <SelectItem value="completed">Completado</SelectItem>
          <SelectItem value="synced">Sincronizado</SelectItem>
          <SelectItem value="error">Error</SelectItem>
        </SelectContent>
      </Select>
    </>
  )

  return (
    <>
      <PageHeader
        title="Rutas SAP"
        description="Rutas de transporte sincronizadas desde SAP. Seguimiento de carga, conductor y estado por ruta."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">En tránsito</p>
            <p className="text-2xl font-bold text-blue-600 tabular-nums">
              {formatNumber(inTransitCount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Sincronizadas</p>
            <p className="text-2xl font-bold text-green-700 tabular-nums">
              {formatNumber(syncedCount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Carga total activa (kg)</p>
            <p className="text-2xl font-bold tabular-nums">{formatNumber(totalLoad)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="mb-1 flex items-center gap-2 text-base font-semibold">
            <Route className="size-4" /> Rutas SAP
          </div>
          <DataTable
            columns={columns}
            data={filteredRows}
            searchColumn="name"
            searchPlaceholder="Buscar ruta..."
            filters={filtersNode}
            emptyMessage="No hay rutas con los filtros seleccionados."
          />
        </CardContent>
      </Card>
    </>
  )
}
