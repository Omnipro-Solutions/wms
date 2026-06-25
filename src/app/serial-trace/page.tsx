'use client'

import { useMemo, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Hash,
  Info,
  MapPin,
  Package,
  Search,
  ShieldAlert,
  Truck,
  Undo2,
} from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { formatDateTime } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { StockMovement } from '@/types/wms'

// ── Constants ─────────────────────────────────────────────────────────────────

const MOVEMENT_LABELS: Record<StockMovement['type'], string> = {
  receipt: 'Recepción en CD',
  putaway: 'Ubicación en estante',
  pick: 'Picking / Empaque',
  transfer: 'Traslado',
  adjustment: 'Ajuste de inventario',
  hold: 'Puesto en hold',
  release: 'Liberado de hold',
  return: 'Devolución',
  scrap: 'Dado de baja',
}

const MOVEMENT_COLORS: Record<StockMovement['type'], string> = {
  receipt: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50',
  putaway: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/50',
  pick: 'text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800/50',
  transfer: 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/50',
  adjustment: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50',
  hold: 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800/50',
  release: 'text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800/50',
  return: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/50',
  scrap: 'text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50',
}

const MOVEMENT_ICONS: Record<StockMovement['type'], React.ReactNode> = {
  receipt: <Package className="size-3.5" />,
  putaway: <MapPin className="size-3.5" />,
  pick: <CheckCircle2 className="size-3.5" />,
  transfer: <ArrowRight className="size-3.5" />,
  adjustment: <Hash className="size-3.5" />,
  hold: <ShieldAlert className="size-3.5" />,
  release: <CheckCircle2 className="size-3.5" />,
  return: <Undo2 className="size-3.5" />,
  scrap: <Truck className="size-3.5" />,
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const InfoCallout = () => (
  <Alert className="border-violet-200 dark:border-violet-800/50 bg-violet-50 dark:bg-violet-950/50">
    <Info className="size-4 text-violet-600 dark:text-violet-300" />
    <AlertTitle className="text-violet-800 dark:text-violet-300">Trazabilidad completa por número de serie</AlertTitle>
    <AlertDescription className="text-violet-700 dark:text-violet-300">
      <p className="mt-1 text-sm">
        Busca cualquier número de serie (N/S) para ver su ciclo de vida completo: recepción en
        bodega, ubicación en estante, picking, empaque y despacho — incluyendo devoluciones.
      </p>
      <p className="mt-1.5 text-xs opacity-80">
        Ejemplo: <code className="font-mono">SN-2024-0001</code>. La búsqueda no distingue
        mayúsculas/minúsculas.
      </p>
    </AlertDescription>
  </Alert>
)

interface StatusChipProps {
  status: string
  serial: string
  locationCode: string | null
  productName: string
}

const StatusChip = ({ status, serial, locationCode, productName }: StatusChipProps) => {
  const colorMap: Record<string, string> = {
    available: 'border-emerald-300 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300',
    reserved: 'border-blue-300 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300',
    on_hold: 'border-amber-300 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300',
    in_transit: 'border-sky-300 dark:border-sky-800/50 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300',
    expired: 'border-red-300 dark:border-red-800/50 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300',
    damaged: 'border-zinc-300 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-300',
  }
  const labelMap: Record<string, string> = {
    available: 'Disponible',
    reserved: 'Reservado',
    on_hold: 'En hold',
    in_transit: 'En tránsito',
    expired: 'Vencido',
    damaged: 'Dañado',
  }

  return (
    <div className="rounded-xl border-2 border-violet-200 dark:border-violet-800/50 bg-violet-50 dark:bg-violet-950/50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500 dark:text-violet-300">
        Estado actual del serial
      </p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-2xl font-bold text-violet-900 dark:text-violet-200">{serial}</p>
          <p className="mt-0.5 text-sm text-violet-700 dark:text-violet-300">{productName}</p>
          {locationCode && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-violet-700 dark:text-violet-300">
              <MapPin className="size-3.5" />
              <span className="font-mono font-semibold">{locationCode}</span>
            </p>
          )}
        </div>
        <Badge
          variant="outline"
          className={cn('mt-1 shrink-0 text-xs', colorMap[status] ?? 'text-muted-foreground')}
        >
          {labelMap[status] ?? status}
        </Badge>
      </div>
    </div>
  )
}

interface TimelineRowProps {
  movement: StockMovement
  index: number
  isLast: boolean
  getLocationCode: (id?: string) => string | null
  getProductName: (id: string) => string
}

const TimelineRow = ({
  movement: mv,
  index,
  isLast,
  getLocationCode,
  getProductName,
}: TimelineRowProps) => (
  <div className="flex gap-3">
    <div className="flex flex-col items-center">
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full border',
          MOVEMENT_COLORS[mv.type]
        )}
      >
        {MOVEMENT_ICONS[mv.type]}
      </div>
      {!isLast && <div className="bg-border my-1 w-px flex-1" />}
    </div>

    <div className={cn('min-w-0 flex-1 pb-5', isLast && 'pb-0')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={cn('text-sm font-semibold', MOVEMENT_COLORS[mv.type].split(' ')[0])}>
            {MOVEMENT_LABELS[mv.type]}
          </p>
          <p className="text-muted-foreground text-xs">{getProductName(mv.productId)}</p>
        </div>
        <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
          {formatDateTime(mv.createdAt)}
        </span>
      </div>

      {(mv.fromLocationId || mv.toLocationId) && (
        <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
          {mv.fromLocationId && (
            <span className="font-mono">{getLocationCode(mv.fromLocationId)}</span>
          )}
          {mv.fromLocationId && mv.toLocationId && <ArrowRight className="size-3" />}
          {mv.toLocationId && (
            <span className="font-mono">{getLocationCode(mv.toLocationId)}</span>
          )}
        </p>
      )}

      <p className="text-muted-foreground mt-0.5 text-[11px]">
        {mv.operatorName} · Ref:{' '}
        <span className="font-mono">
          {mv.referenceType}/{mv.referenceId}
        </span>
      </p>

      {!isLast && <Separator className="mt-3" />}
    </div>
  </div>
)

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SerialTracePage() {
  const state = useWmsStore()
  const { productName, locationCode } = useStoreHelpers()
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState('')

  const handleSearch = () => {
    const trimmed = query.trim()
    if (trimmed) setSearched(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch()
  }

  const getLocationCode = (locationId?: string) =>
    locationId ? locationCode(locationId) : null

  const result = useMemo(() => {
    if (!searched) return null

    const q = searched.toLowerCase()

    // Find inventory item(s) matching this serial
    const inventoryItem = state.inventoryItems.find((i) => i.serial?.toLowerCase() === q)

    // Find all stock movements for this serial
    const movements = state.stockMovements
      .filter((mv) => mv.serial?.toLowerCase() === q)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    // Derive product from inventory item or first movement
    const productId = inventoryItem?.productId ?? movements[0]?.productId

    return { inventoryItem, movements, productId }
  }, [searched, state.inventoryItems, state.stockMovements])

  const notFound =
    result && !result.inventoryItem && result.movements.length === 0

  return (
    <>
      <PageHeader
        title="Trazabilidad por N/S"
        description="Historial completo de un número de serie: recepción → ubicación → picking → despacho → devolución."
      />

      <InfoCallout />

      {/* Search bar */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Hash className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                placeholder="Ej: SN-2024-0001"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-9 font-mono"
                autoFocus
              />
            </div>
            <Button onClick={handleSearch} disabled={!query.trim()}>
              <Search className="mr-1.5 size-4" />
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Not found */}
      {notFound && (
        <Alert className="border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/40">
          <Info className="size-4 text-amber-600 dark:text-amber-300" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">Serial no encontrado</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
            No hay inventario ni movimientos registrados para el serial{' '}
            <code className="font-mono font-bold">{searched}</code>. Verifica que el número sea
            correcto o que el producto haya sido recibido con captura de serial.
          </AlertDescription>
        </Alert>
      )}

      {result && !notFound && (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Left: status card */}
          <div className="space-y-4">
            {result.inventoryItem ? (
              <StatusChip
                serial={searched}
                status={result.inventoryItem.status}
                locationCode={getLocationCode(result.inventoryItem.locationId)}
                productName={productName(result.inventoryItem.productId)}
              />
            ) : (
              <div className="rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/50 p-4 text-center">
                <p className="text-muted-foreground text-sm font-medium">
                  Serial ya no está en inventario
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Fue despachado, dado de baja o transferido.
                </p>
              </div>
            )}

            {/* Summary KPIs */}
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm">Resumen de movimientos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 pb-4">
                {(['receipt', 'putaway', 'pick', 'transfer', 'return', 'scrap'] as StockMovement['type'][]).map(
                  (type) => {
                    const count = result.movements.filter((mv) => mv.type === type).length
                    if (count === 0) return null
                    return (
                      <div key={type} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground text-xs">
                          <span
                            className={cn(
                              'inline-flex size-5 items-center justify-center rounded border',
                              MOVEMENT_COLORS[type]
                            )}
                          >
                            {MOVEMENT_ICONS[type]}
                          </span>
                          {MOVEMENT_LABELS[type]}
                        </span>
                        <Badge variant="outline" className="text-xs tabular-nums">
                          {count}
                        </Badge>
                      </div>
                    )
                  }
                )}
                {result.movements.length === 0 && (
                  <p className="text-muted-foreground text-xs">Sin movimientos registrados aún.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: timeline */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Hash className="text-muted-foreground size-4" />
                  Ciclo de vida del serial{' '}
                  <code className="font-mono text-violet-700 dark:text-violet-300">{searched}</code>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.movements.length === 0 ? (
                  <p className="text-muted-foreground py-4 text-center text-sm">
                    No hay movimientos registrados para este serial.
                  </p>
                ) : (
                  <div className="pt-1">
                    {result.movements.map((mv, i) => (
                      <TimelineRow
                        key={mv.id}
                        movement={mv}
                        index={i}
                        isLast={i === result.movements.length - 1}
                        getLocationCode={getLocationCode}
                        getProductName={productName}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  )
}
