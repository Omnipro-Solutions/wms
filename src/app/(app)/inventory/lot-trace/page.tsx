'use client'

import { useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  BoxesIcon,
  CalendarClock,
  Hash,
  Info,
  MapPin,
  Package,
  Search,
  Tag,
} from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { availableStock, isExpired } from '@/lib/rules/inventory'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { formatDate, formatDateTime, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { InventoryItem, StockMovement } from '@/types/wms'

// ── Constants ─────────────────────────────────────────────────────────────────

const MOVEMENT_LABELS: Record<StockMovement['type'], string> = {
  receipt: 'Recepción',
  putaway: 'Ubicación',
  pick: 'Picking',
  transfer: 'Traslado',
  adjustment: 'Ajuste',
  hold: 'Hold',
  release: 'Liberación',
  return: 'Devolución',
  scrap: 'Baja',
}

const MOVEMENT_COLORS: Record<StockMovement['type'], string> = {
  receipt: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  putaway: 'text-blue-600 bg-blue-50 border-blue-200',
  pick: 'text-violet-600 bg-violet-50 border-violet-200',
  transfer: 'text-sky-600 bg-sky-50 border-sky-200',
  adjustment: 'text-amber-600 bg-amber-50 border-amber-200',
  hold: 'text-orange-600 bg-orange-50 border-orange-200',
  release: 'text-teal-600 bg-teal-50 border-teal-200',
  return: 'text-rose-600 bg-rose-50 border-rose-200',
  scrap: 'text-zinc-500 bg-zinc-50 border-zinc-200',
}

const DEBIT_TYPES = new Set<StockMovement['type']>(['pick', 'transfer', 'scrap'])

// ── Sub-components ─────────────────────────────────────────────────────────────

const HowItWorksCallout = () => (
  <Alert className="border-blue-200 bg-blue-50">
    <Info className="size-4 text-blue-600" />
    <AlertTitle className="text-blue-800">Rastrea un lote o serial en segundos</AlertTitle>
    <AlertDescription className="text-blue-700">
      <p className="mt-1">
        Escribe el número de lote (ej. <code className="font-mono text-xs">LOT-TS-2601</code>) o el
        serial (ej. <code className="font-mono text-xs">SN-2024-0001</code>) del producto que
        quieres consultar. Obtendrás de inmediato:
      </p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
        <li>
          <strong>Dónde está</strong> — ubicación exacta, cantidades disponibles y estado actual.
        </li>
        <li>
          <strong>Todo lo que le pasó</strong> — cada recepción, traslado, picking, hold o ajuste
          registrado.
        </li>
      </ul>
      <p className="mt-2 text-xs opacity-80">
        Ideal para auditorías de calidad, recalls y consultas de clientes sobre el origen de un
        producto.
      </p>
    </AlertDescription>
  </Alert>
)

interface PositionCardProps {
  item: InventoryItem
  productName: string
  productSku?: string
  locationCode: string | null
}

const PositionCard = ({ item, productName, productSku, locationCode }: PositionCardProps) => {
  const expired = isExpired(item)
  const avail = availableStock(item)

  return (
    <div className="space-y-3 rounded-lg border bg-zinc-50/50 p-4 dark:bg-transparent">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{productName}</p>
          {productSku && <p className="text-muted-foreground font-mono text-xs">{productSku}</p>}
        </div>
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 text-xs',
            expired && 'border-red-300 text-red-700',
            !expired && item.status === 'on_hold' && 'border-amber-300 text-amber-700',
            !expired && item.status === 'available' && 'border-emerald-300 text-emerald-700'
          )}
        >
          {expired ? 'Vencido' : item.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <MapPin className="text-muted-foreground size-3.5 shrink-0" />
          <span className="font-mono text-xs">{locationCode ?? item.locationId}</span>
        </div>
        {item.lot && (
          <div className="flex items-center gap-2">
            <Hash className="text-muted-foreground size-3.5 shrink-0" />
            <span className="font-mono text-xs">Lote: {item.lot}</span>
          </div>
        )}
        {item.serial && (
          <div className="flex items-center gap-2">
            <Tag className="text-muted-foreground size-3.5 shrink-0" />
            <span className="font-mono text-xs">S/N: {item.serial}</span>
          </div>
        )}
        {item.expirationDate && (
          <div className="flex items-center gap-2">
            <CalendarClock className="text-muted-foreground size-3.5 shrink-0" />
            <span
              className={cn(
                'text-xs',
                expired ? 'text-destructive font-medium' : 'text-muted-foreground'
              )}
            >
              Vence: {formatDate(item.expirationDate)}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-4 border-t pt-2 text-sm">
        <span className="text-muted-foreground text-xs">
          En mano: <strong className="text-foreground">{formatNumber(item.onHandQuantity)}</strong>
        </span>
        <span className="text-muted-foreground text-xs">
          Disponible: <strong className="text-emerald-600">{formatNumber(avail)}</strong>
        </span>
        {item.reservedQuantity > 0 && (
          <span className="text-muted-foreground text-xs">
            Reservado:{' '}
            <strong className="text-blue-600">{formatNumber(item.reservedQuantity)}</strong>
          </span>
        )}
        {item.holdQuantity > 0 && (
          <span className="text-muted-foreground text-xs">
            Hold: <strong className="text-amber-600">{formatNumber(item.holdQuantity)}</strong>
          </span>
        )}
      </div>
    </div>
  )
}

interface MovementRowProps {
  movement: StockMovement
  index: number
  isLast: boolean
  getLocationCode: (id?: string) => string | null
  getProductName: (id: string) => string
}

const MovementRow = ({
  movement: mv,
  index,
  isLast,
  getLocationCode,
  getProductName,
}: MovementRowProps) => (
  <div className="flex gap-3">
    <div className="flex flex-col items-center">
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
          MOVEMENT_COLORS[mv.type]
        )}
      >
        {index + 1}
      </div>
      {!isLast && <div className="bg-border my-1 w-px flex-1" />}
    </div>

    <div className={cn('min-w-0 flex-1 pb-4', isLast && 'pb-0')}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-xs font-semibold', MOVEMENT_COLORS[mv.type].split(' ')[0])}>
          {MOVEMENT_LABELS[mv.type]}
        </span>
        <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
          {formatDateTime(mv.createdAt)}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium tabular-nums">
          {DEBIT_TYPES.has(mv.type) ? '−' : '+'}
          {formatNumber(mv.quantity)} uds.
        </span>
        <span className="text-muted-foreground text-xs">{getProductName(mv.productId)}</span>
        {mv.lot && (
          <Badge variant="outline" className="font-mono text-[10px]">
            L: {mv.lot}
          </Badge>
        )}
        {mv.serial && (
          <Badge variant="outline" className="font-mono text-[10px]">
            S: {mv.serial}
          </Badge>
        )}
      </div>

      {(mv.fromLocationId || mv.toLocationId) && (
        <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[11px]">
          {mv.fromLocationId && (
            <span className="font-mono">{getLocationCode(mv.fromLocationId)}</span>
          )}
          {mv.fromLocationId && mv.toLocationId && <ArrowRight className="size-3" />}
          {mv.toLocationId && <span className="font-mono">{getLocationCode(mv.toLocationId)}</span>}
        </p>
      )}

      <p className="text-muted-foreground mt-0.5 text-[11px]">
        {mv.operatorName} · {mv.referenceType}/{mv.referenceId}
      </p>

      {!isLast && <Separator className="mt-3" />}
    </div>
  </div>
)

// ── Page ───────────────────────────────────────────────────────────────────────

export default function LotTracePage() {
  const state = useWmsStore()
  const { productName, locationCode } = useStoreHelpers()
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState('')

  const handleSearch = () => setSearched(query.trim())
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch()
  }

  const getLocationCode = (locationId?: string) => (locationId ? locationCode(locationId) : null)

  const result = useMemo(() => {
    if (!searched) return null

    const q = searched.toLowerCase()
    const items = state.inventoryItems.filter(
      (i) =>
        (i.lot && i.lot.toLowerCase().includes(q)) ||
        (i.serial && i.serial.toLowerCase().includes(q))
    )

    const matchedLots = new Set(items.map((i) => i.lot).filter(Boolean))
    const matchedSerials = new Set(items.map((i) => i.serial).filter(Boolean))

    const movements = state.stockMovements
      .filter(
        (mv) => (mv.lot && matchedLots.has(mv.lot)) || (mv.serial && matchedSerials.has(mv.serial))
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    return { items, movements }
  }, [searched, state.inventoryItems, state.stockMovements])

  const isEmpty = result && result.items.length === 0 && result.movements.length === 0

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Trazabilidad por lote / serial"
        description="Consulta el historial completo de un lote o serial: posiciones actuales, movimientos y estado."
      />

      <HowItWorksCallout />

      {/* ── Search bar ── */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                placeholder="Número de lote o serial (ej. LOT-TS-2601, SN-2024-0001)…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch}>Buscar</Button>
          </div>
        </CardContent>
      </Card>

      {/* ── No results ── */}
      {isEmpty && (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="text-muted-foreground mx-auto mb-3 size-10 opacity-30" />
            <p className="text-muted-foreground text-sm">
              No se encontraron resultados para{' '}
              <span className="text-foreground font-mono font-medium">
                &ldquo;{searched}&rdquo;
              </span>
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Verifica que el número de lote o serial esté escrito correctamente.
            </p>
          </CardContent>
        </Card>
      )}

      {result && !isEmpty && (
        <div className="space-y-4">
          {/* ── Current positions ── */}
          {result.items.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BoxesIcon className="text-muted-foreground size-4" />
                  Posiciones actuales
                  <Badge variant="outline">{result.items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.items.map((item) => {
                    const product = state.products.find((p) => p.id === item.productId)
                    return (
                      <PositionCard
                        key={item.id}
                        item={item}
                        productName={productName(item.productId)}
                        productSku={product?.sku}
                        locationCode={getLocationCode(item.locationId)}
                      />
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Movement timeline ── */}
          {result.movements.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowRight className="text-muted-foreground size-4" />
                  Historial de movimientos
                  <Badge variant="outline">{result.movements.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {result.movements.map((mv, idx) => (
                    <MovementRow
                      key={mv.id}
                      movement={mv}
                      index={idx}
                      isLast={idx === result.movements.length - 1}
                      getLocationCode={getLocationCode}
                      getProductName={productName}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Movements empty state ── */}
          {result.items.length > 0 && result.movements.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <Package className="text-muted-foreground mx-auto mb-2 size-8 opacity-30" />
                <p className="text-muted-foreground text-sm">
                  Sin movimientos registrados para este lote/serial.
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Los movimientos se generan al ejecutar acciones en Inventario o Picking.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
