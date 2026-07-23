'use client'

import { useState } from 'react'
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  TriangleAlert,
  Truck,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/formatters'
import type { CarrierRateQuote } from '@/types/wms'

interface Props {
  open: boolean
  quotes: CarrierRateQuote[]
  weightKg: number
  destinationCity: string
  packageCount: number
  customerName: string
  error: string
  // Cotización recomendada por la política configurada (/shipping-settings).
  // Cuando llega, se preselecciona al abrir el diálogo.
  suggested?: CarrierRateQuote | null
  onConfirm: (quote: CarrierRateQuote) => void
  onClose: () => void
}

const SPEED_STYLES: Record<number, { badge: string; bar: string; label: string }> = {
  0: {
    badge: 'bg-violet-100 text-violet-700 border-violet-200',
    bar: 'bg-violet-500',
    label: 'Entrega hoy',
  },
  1: { badge: 'bg-blue-100 text-blue-700 border-blue-200', bar: 'bg-blue-500', label: '1 día' },
  2: { badge: 'bg-cyan-100 text-cyan-700 border-cyan-200', bar: 'bg-cyan-500', label: '2 días' },
  3: { badge: 'bg-teal-100 text-teal-700 border-teal-200', bar: 'bg-teal-500', label: '3 días' },
  4: {
    badge: 'bg-green-100 text-green-700 border-green-200',
    bar: 'bg-green-500',
    label: '4 días',
  },
}
const speedStyle = (days: number) =>
  SPEED_STYLES[days] ?? {
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    bar: 'bg-slate-400',
    label: `${days} días`,
  }

// Maps transit days to a 0–100 "speed score" (fewer days = higher score)
const speedScore = (days: number, maxDays: number) =>
  maxDays > 0 ? Math.round(((maxDays - days) / maxDays) * 100) : 100

export const RateShoppingDialog = ({
  open,
  quotes,
  weightKg,
  destinationCity,
  packageCount,
  customerName,
  error,
  suggested,
  onConfirm,
  onClose,
}: Props) => {
  const [selected, setSelected] = useState<CarrierRateQuote | null>(null)
  // La recomendación vale como preselección, no como elección forzada: el usuario
  // puede sobreescribirla y su elección manda mientras el diálogo siga abierto.
  const activeSelection = selected ?? suggested ?? null

  const handleClose = () => {
    setSelected(null)
    onClose()
  }

  const handleConfirm = () => {
    if (!activeSelection) return
    onConfirm(activeSelection)
    setSelected(null)
  }

  if (!open) return null

  // Se calcula por costo real, no por posición: el orden de la lista depende de la
  // estrategia configurada (menor costo o menor tiempo).
  const cheapest =
    quotes.length > 0 ? quotes.reduce((a, b) => (a.quotedCostUsd <= b.quotedCostUsd ? a : b)) : null
  const fastest =
    quotes.length > 0
      ? quotes.reduce((a, b) => (a.estimatedTransitDays <= b.estimatedTransitDays ? a : b))
      : null
  const maxDays = quotes.length > 0 ? Math.max(...quotes.map((q) => q.estimatedTransitDays)) : 0

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose()
      }}
    >
      <DialogContent className="max-w-3xl! gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <DollarSign className="text-primary size-5" />
            Rate Shopping — Cotización de tarifas
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0">
          {/* ── Left panel: context + selected summary ── */}
          <div className="bg-muted/40 flex w-56 shrink-0 flex-col gap-4 border-r px-5 py-4">
            <div className="space-y-3">
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                  Cliente
                </p>
                <p className="text-sm leading-snug font-semibold">{customerName}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                  Destino
                </p>
                <p className="text-sm font-semibold">{destinationCity || '—'}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                    Paquetes
                  </p>
                  <p className="flex items-center gap-1 text-sm font-semibold">
                    <Package className="text-muted-foreground size-3.5" />
                    {packageCount}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                    Peso
                  </p>
                  <p className="text-sm font-semibold">{weightKg} kg</p>
                </div>
              </div>
            </div>

            <div className="text-muted-foreground space-y-1.5 border-t pt-3 text-xs">
              <p className="text-foreground font-semibold">{quotes.length} tarifas</p>
              <p className="flex items-center gap-1">
                <Zap className="size-3 text-green-600" /> Más económica:{' '}
                <span className="text-foreground font-mono font-medium">
                  ${cheapest?.quotedCostUsd.toFixed(2)}
                </span>
              </p>
              <p className="flex items-center gap-1">
                <Clock className="size-3 text-blue-500" /> Más rápida:{' '}
                <span className="text-foreground font-medium">
                  {fastest ? speedStyle(fastest.estimatedTransitDays).label : '—'}
                </span>
              </p>
            </div>

            {activeSelection && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-foreground text-xs font-semibold tracking-wide uppercase">
                  Seleccionada
                </p>
                <div className="bg-primary/8 border-primary/20 space-y-1 rounded-lg border px-3 py-2.5">
                  <p className="text-sm font-bold">{activeSelection.carrierName}</p>
                  <p className="text-muted-foreground text-xs">{activeSelection.serviceLabel}</p>
                  <p className="text-primary text-lg font-bold tabular-nums">
                    ${activeSelection.quotedCostUsd.toFixed(2)}{' '}
                    <span className="text-muted-foreground text-xs font-normal">USD</span>
                  </p>
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <CalendarCheck className="size-3" />{' '}
                    {formatDate(activeSelection.estimatedDeliveryDate)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Right panel: scrollable quote list ── */}
          <div className="max-h-[60vh] flex-1 space-y-2 overflow-y-auto px-4 py-4">
            {quotes.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-16 text-sm">
                <Truck className="size-8 opacity-30" />
                No hay tarifas disponibles para este destino y peso.
              </div>
            ) : (
              quotes.map((q) => {
                const isCheapest = q === cheapest
                const isFastest = q === fastest && q !== cheapest
                const isSelected = activeSelection === q
                const style = speedStyle(q.estimatedTransitDays)
                const score = speedScore(q.estimatedTransitDays, maxDays)

                return (
                  <button
                    key={`${q.carrierId}-${q.serviceLevel}`}
                    type="button"
                    onClick={() => setSelected(q)}
                    className={cn(
                      'w-full rounded-xl border text-left transition-all duration-150',
                      'hover:shadow-sm',
                      isSelected
                        ? 'border-primary bg-primary/5 ring-primary/30 shadow-sm ring-1'
                        : 'border-border bg-card hover:border-primary/40 hover:bg-accent/30'
                    )}
                  >
                    <div className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        {/* Radio */}
                        <div
                          className={cn(
                            'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                            isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                          )}
                        >
                          {isSelected && <div className="size-1.5 rounded-full bg-white" />}
                        </div>

                        {/* Main content */}
                        <div className="min-w-0 flex-1">
                          {/* Row 1: carrier name + badges + price */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{q.carrierName}</span>
                            <Badge variant="outline" className="px-1.5 py-0 text-xs">
                              {q.serviceLabel}
                            </Badge>
                            {isCheapest && (
                              <Badge className="gap-1 bg-green-600 px-1.5 py-0 text-xs text-white hover:bg-green-600">
                                <Zap className="size-2.5" /> Más económico
                              </Badge>
                            )}
                            {isFastest && (
                              <Badge className="gap-1 bg-blue-600 px-1.5 py-0 text-xs text-white hover:bg-blue-600">
                                <Clock className="size-2.5" /> Más rápido
                              </Badge>
                            )}
                            <span className="ml-auto shrink-0 text-base font-bold tabular-nums">
                              ${q.quotedCostUsd.toFixed(2)}
                              <span className="text-muted-foreground ml-1 text-xs font-normal">
                                USD
                              </span>
                            </span>
                          </div>

                          {/* Row 2: transit + delivery */}
                          <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
                            <Badge
                              variant="outline"
                              className={cn('px-1.5 py-0 text-xs font-medium', style.badge)}
                            >
                              <Clock className="mr-1 size-2.5" />
                              {style.label}
                            </Badge>
                            <span className="flex items-center gap-1">
                              <CalendarCheck className="size-3" />
                              Entrega estimada:
                              <span className="text-foreground ml-0.5 font-medium">
                                {formatDate(q.estimatedDeliveryDate)}
                              </span>
                            </span>
                          </div>

                          {/* Row 3: speed bar */}
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-muted-foreground w-10 shrink-0 text-xs">
                              Rapidez
                            </span>
                            <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                              <div
                                className={cn('h-full rounded-full transition-all', style.bar)}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="border-t px-6 py-4">
          {error && (
            <p className="text-destructive mb-3 flex items-center gap-1 text-sm">
              <TriangleAlert className="size-3" /> {error}
            </p>
          )}
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={!activeSelection}>
              <CheckCircle2 className="mr-1 size-4" /> Confirmar tarifa
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
