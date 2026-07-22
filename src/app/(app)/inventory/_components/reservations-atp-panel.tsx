'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Clock, Hourglass, Package, RefreshCw } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { selectActiveReservations, selectAtp } from '@/store/selectors'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'

const ProductCell = ({ name, sku, imageUrl }: { name: string; sku: string; imageUrl?: string }) => (
  <div className="flex items-center gap-3">
    <div className="size-8 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
      {imageUrl ? (
        <Image src={imageUrl} alt={name} width={32} height={32} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center">
          <Package className="size-4 text-zinc-400" />
        </div>
      )}
    </div>
    <div className="min-w-0">
      <p className="truncate text-sm font-medium leading-tight">{name}</p>
      <p className="font-mono text-[11px] leading-tight text-muted-foreground">{sku}</p>
    </div>
  </div>
)

interface ReservationsAtpPanelProps {
  operatorName: string
  releaseExpiredReservations: (operatorName: string) => number
}

// Reading the clock is a side effect — it's never called inline during render.
// setState only happens inside async callbacks (timeout/interval ticks), not
// synchronously in the effect body, to avoid cascading renders on mount.
const useNow = (): number => {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const initial = setTimeout(tick, 0)
    const id = setInterval(tick, 60_000)
    return () => {
      clearTimeout(initial)
      clearInterval(id)
    }
  }, [])
  return now ?? 0
}

export const ReservationsAtpPanel = ({
  operatorName,
  releaseExpiredReservations,
}: ReservationsAtpPanelProps) => {
  const state = useWmsStore()
  const { productName, productSku, getProduct, locationCode, warehouseName } = useStoreHelpers()
  const [lastReleased, setLastReleased] = useState<number | null>(null)
  const now = useNow()

  const reservations = selectActiveReservations(state, now)
  const atp = selectAtp(state)
  const expiredCount = reservations.filter((r) => r.isExpired).length

  const handleRelease = () => {
    const count = releaseExpiredReservations(operatorName)
    setLastReleased(count)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Reservations ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Hourglass className="text-muted-foreground size-4" />
              <CardTitle className="text-base">Reservas activas (TTL)</CardTitle>
              {expiredCount > 0 && (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                  {expiredCount} vencida{expiredCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              disabled={expiredCount === 0}
              onClick={handleRelease}
            >
              <RefreshCw className="size-3.5" />
              Liberar reservas vencidas
            </Button>
          </div>
          <CardDescription>
            Cada reserva expira {state.settings.reservationTtlHours}h después de generarse (
            <code className="text-[11px]">WmsSettings.reservationTtlHours</code>). Al vencer, sigue
            contando como reservada hasta que se libere manualmente o con este botón.
          </CardDescription>
          {lastReleased !== null && (
            <p className="text-xs text-emerald-600">
              {lastReleased === 0
                ? 'No había reservas vencidas para liberar.'
                : `Se liberaron ${lastReleased} reserva${lastReleased !== 1 ? 's' : ''}.`}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {reservations.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No hay unidades reservadas actualmente.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead className="text-right">Reservado</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((r) => (
                  <TableRow key={r.itemId}>
                    <TableCell>
                      <ProductCell
                        name={productName(r.productId)}
                        sku={productSku(r.productId)}
                        imageUrl={getProduct(r.productId)?.imageUrl}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{locationCode(r.locationId)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatNumber(r.reservedQuantity)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.reservationExpiresAt ? formatDateTime(r.reservationExpiresAt) : '—'}
                    </TableCell>
                    <TableCell>
                      {!r.reservationExpiresAt ? (
                        <span className="text-muted-foreground text-xs">Sin TTL</span>
                      ) : r.isExpired ? (
                        <Badge variant="outline" className="border-red-200 bg-red-50 text-xs text-red-700">
                          Vencida
                        </Badge>
                      ) : (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-xs tabular-nums',
                            (r.hoursRemaining ?? 0) <= 2 ? 'text-amber-600' : 'text-muted-foreground'
                          )}
                        >
                          <Clock className="size-3" />
                          {r.hoursRemaining}h restantes
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── ATP ──────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Available-to-Promise (ATP)</CardTitle>
          <CardDescription>
            Suma de disponible (en mano − reservado − hold) por producto y almacén, en tiempo real.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {atp.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">Sin datos de ATP.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Almacén</TableHead>
                  <TableHead className="text-right">ATP disponible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atp
                  .sort((a, b) => productName(a.productId).localeCompare(productName(b.productId)))
                  .map((r) => (
                    <TableRow key={`${r.productId}-${r.warehouseId}`}>
                      <TableCell>
                        <ProductCell
                          name={productName(r.productId)}
                          sku={productSku(r.productId)}
                          imageUrl={getProduct(r.productId)?.imageUrl}
                        />
                      </TableCell>
                      <TableCell className="text-xs">{warehouseName(r.warehouseId)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold tabular-nums">
                        {formatNumber(r.available)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
