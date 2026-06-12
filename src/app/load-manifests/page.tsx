'use client'

import { MapPin, MapPinned, Package, Truck } from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatNumber } from '@/lib/formatters'

export default function LoadManifestsPage() {
  const state = useWmsStore()

  const totalUnits = state.loadManifests.reduce((s, m) => s + m.totalUnits, 0)
  const totalWeight = state.loadManifests.reduce((s, m) => s + m.totalWeightKg, 0)
  const activeCount = state.loadManifests.filter((m) => m.status === 'in_progress').length

  return (
    <>
      <PageHeader
        title="Manifiestos de carga"
        description="Vista de los manifiestos de despacho por ruta SAP. Detalle de paradas y documentos incluidos."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Manifiestos activos</p>
            <p className="text-2xl font-bold text-blue-600 tabular-nums">
              {formatNumber(activeCount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Unidades totales</p>
            <p className="text-2xl font-bold tabular-nums">{formatNumber(totalUnits)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Peso total (kg)</p>
            <p className="text-2xl font-bold tabular-nums">{formatNumber(totalWeight)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Manifests list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPinned className="size-4" /> Manifiestos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Manifiesto</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Ruta SAP</TableHead>
                <TableHead>Transportadora</TableHead>
                <TableHead>Conductor</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead className="text-right">Paradas</TableHead>
                <TableHead className="text-right">Paquetes</TableHead>
                <TableHead className="text-right">Peso (kg)</TableHead>
                <TableHead className="text-right">Vol. (m³)</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.loadManifests.map((m) => {
                const route = state.sapRoutes.find((r) => r.id === m.sapRouteId)
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono font-medium">{m.code}</TableCell>
                    <TableCell className="text-sm">{m.manifestDate}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {route ? route.code : '—'}
                    </TableCell>
                    <TableCell>{m.carrierName}</TableCell>
                    <TableCell>{m.driverName}</TableCell>
                    <TableCell className="font-mono text-xs">{m.truckPlate}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.stops.length}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(m.totalPackages)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(m.totalWeightKg)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.totalVolumeM3}</TableCell>
                    <TableCell>
                      <StatusBadge status={m.status} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Stop detail for each manifest */}
      {state.loadManifests.map((manifest) => (
        <Card key={manifest.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <MapPinned className="size-4 text-blue-600" />
              {manifest.code} — Paradas de ruta
              <StatusBadge status={manifest.status} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {manifest.stops
              .sort((a, b) => a.sequence - b.sequence)
              .map((stop) => {
                const dest = state.warehouses.find((w) => w.id === stop.destinationId)
                const orders = stop.orderIds
                  .map((oid) => state.commerceOrders.find((o) => o.id === oid))
                  .filter(Boolean)
                const transfers = stop.transferIds
                  .map((tid) => state.transfers.find((t) => t.id === tid))
                  .filter(Boolean)
                const returns = stop.returnIds
                  .map((rid) => state.returnOrders.find((r) => r.id === rid))
                  .filter(Boolean)

                return (
                  <div key={stop.id} className="rounded-md border p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full text-xs font-bold">
                        {stop.sequence}
                      </div>
                      <MapPin className="text-muted-foreground size-4" />
                      <span className="font-medium">{dest?.name ?? stop.destinationId}</span>
                      <Badge variant="outline" className="ml-auto text-xs">
                        {dest?.city}
                      </Badge>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      {orders.length > 0 && (
                        <div>
                          <p className="text-muted-foreground mb-1 flex items-center gap-1 text-xs font-semibold">
                            <Package className="size-3" /> Pedidos ({orders.length})
                          </p>
                          {orders.map(
                            (o) =>
                              o && (
                                <p key={o.id} className="text-sm">
                                  {o.orderNumber} — {o.customerName}
                                </p>
                              )
                          )}
                        </div>
                      )}
                      {transfers.length > 0 && (
                        <div>
                          <p className="text-muted-foreground mb-1 flex items-center gap-1 text-xs font-semibold">
                            <Truck className="size-3" /> Traslados ({transfers.length})
                          </p>
                          {transfers.map(
                            (t) =>
                              t && (
                                <p key={t.id} className="text-sm">
                                  {t.code}
                                </p>
                              )
                          )}
                        </div>
                      )}
                      {returns.length > 0 && (
                        <div>
                          <p className="text-muted-foreground mb-1 flex items-center gap-1 text-xs font-semibold">
                            Devoluciones ({returns.length})
                          </p>
                          {returns.map(
                            (r) =>
                              r && (
                                <p key={r.id} className="text-sm">
                                  {r.rmaCode}
                                </p>
                              )
                          )}
                        </div>
                      )}
                      {orders.length === 0 && transfers.length === 0 && returns.length === 0 && (
                        <p className="text-muted-foreground text-sm">
                          Sin documentos asignados a esta parada.
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
          </CardContent>
        </Card>
      ))}
    </>
  )
}
