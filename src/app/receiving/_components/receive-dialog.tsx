'use client'

import {
  AlertTriangle,
  CheckCircle2,
  Hash,
  PackageCheck,
  Ruler,
  ShieldCheck,
  Zap,
  Minus,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, FieldLabel } from '@/components/ui/field'
import { Progress } from '@/components/ui/progress'
import { BarcodeScanner } from '@/components/shared/barcode-scanner'
import type { useReceiveDialog } from '../_hooks/use-receive-dialog'

const DISCREPANCY_REASONS = [
  { value: 'short_shipped', label: 'Proveedor envió menos de lo pactado' },
  { value: 'damaged', label: 'Unidades llegaron dañadas' },
  { value: 'refused', label: 'Unidades rechazadas por calidad' },
  { value: 'count_error', label: 'Error de conteo' },
]

const ErrorBanner = ({ message }: { message: string }) => (
  <div className="border-destructive/20 bg-destructive/8 text-destructive flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm">
    <AlertTriangle className="size-4 shrink-0" /> {message}
  </div>
)

// Stepper numérico +/- para facilitar el conteo en tablet/touch
const QtyInput = ({
  id,
  value,
  onChange,
  hasError,
  accentClass,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  hasError?: boolean
  accentClass: string
}) => {
  const num = parseInt(value, 10) || 0
  const handleStep = (delta: number) => onChange(String(Math.max(0, num + delta)))

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="text-muted-foreground size-10 shrink-0 rounded-xl"
        onClick={() => handleStep(-1)}
        tabIndex={-1}
      >
        <Minus className="size-4" />
      </Button>
      <Input
        id={id}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-14 flex-1 rounded-xl border-2 bg-white dark:bg-zinc-900 text-center text-3xl font-bold tabular-nums',
          hasError ? 'border-destructive' : accentClass
        )}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="text-muted-foreground size-10 shrink-0 rounded-xl"
        onClick={() => handleStep(1)}
        tabIndex={-1}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  )
}

interface Props {
  state: ReturnType<typeof useReceiveDialog>
}

export const ReceiveDialog = ({ state }: Props) => {
  const {
    dialog,
    handleSubmit,
    goodQty,
    setGoodQty,
    damagedQty,
    setDamagedQty,
    discrepancyReason,
    setDiscrepancyReason,
    closeIntent,
    setCloseIntent,
    serialsRaw,
    setSerialsRaw,
    parsedSerials,
    serialsMismatch,
    serialsDuplicated,
    requiresSerial,
    goodQtyNum,
    damagedQtyNum,
    totalCounted,
    pendingQty,
    isOverCount,
    isDiscrepancy,
    missingInForm,
    canSubmit,
    selectedUomId,
    setSelectedUomId,
    selectableUoms,
    hasUomChoice,
    baseUomId,
  } = state

  const data = dialog.data
  const progressPct =
    pendingQty > 0 ? Math.min(100, Math.round((totalCounted / pendingQty) * 100)) : 0

  return (
    <Dialog
      open={!!data}
      onOpenChange={(o) => {
        if (!o) dialog.close()
      }}
    >
      <DialogContent className="max-w-4xl! gap-0 overflow-hidden p-0">
        {/* ── Header ── */}
        <div className="border-b bg-white dark:bg-zinc-900 px-7 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-muted border-border mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border">
                <PackageCheck className="text-foreground size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg leading-snug font-semibold">
                    Registrar entrega
                  </DialogTitle>
                  {data && data.deliveryCount > 0 && (
                    <Badge variant="outline" className="text-muted-foreground text-xs font-normal">
                      Entrega #{data.deliveryCount + 1}
                    </Badge>
                  )}
                  {data?.requiresQC && (
                    <Badge variant="outline" className="text-muted-foreground gap-1 text-xs">
                      <ShieldCheck className="size-3" /> Requiere QC
                    </Badge>
                  )}
                  {data?.isCrossDocking && (
                    <Badge variant="outline" className="text-muted-foreground gap-1 text-xs">
                      <Zap className="size-3" /> Cross-Docking
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-muted-foreground mt-0.5 text-sm">
                  Solo las unidades en buen estado ingresan al inventario disponible.
                </DialogDescription>
              </div>
            </div>
          </div>

          {data && (
            <div className="mt-4 grid grid-cols-3 gap-x-8 gap-y-1 text-sm">
              <div>
                <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
                  N° Aviso
                </p>
                <p className="text-foreground font-mono font-bold">{data.asnCode}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
                  Proveedor
                </p>
                <p className="text-foreground font-medium">{data.supplierName}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
                  Producto
                </p>
                <p className="text-foreground font-medium">{data.productName}</p>
              </div>
            </div>
          )}
        </div>

        {data && (
          <div className="grid grid-cols-5 divide-x">
            {/* ── Left panel: resumen de la entrega ── */}
            <div className="bg-muted/30 col-span-2 flex flex-col gap-5 px-6 py-6">
              <div>
                <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase">
                  Resumen de esta entrega
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border bg-white dark:bg-zinc-900 px-4 py-3">
                    <span className="text-muted-foreground text-sm">Total esperado</span>
                    <span className="text-xl font-bold tabular-nums">{data.expectedTotal}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-white dark:bg-zinc-900 px-4 py-3">
                    <span className="text-muted-foreground text-sm">Ya recibido</span>
                    <span className="text-xl font-bold tabular-nums">{data.receivedSoFar}</span>
                  </div>
                  <div className="border-foreground/15 flex items-center justify-between rounded-lg border-2 bg-white dark:bg-zinc-900 px-4 py-3">
                    <span className="text-sm font-semibold">Pendiente esta entrega</span>
                    <span className="text-2xl font-bold tabular-nums">{data.pendingQty}</span>
                  </div>
                  {data.deliveryCount > 0 && (
                    <p className="text-muted-foreground text-center text-xs">
                      {data.deliveryCount}{' '}
                      {data.deliveryCount === 1 ? 'entrega previa' : 'entregas previas'} registradas
                    </p>
                  )}
                </div>
              </div>

              {/* Barra de progreso del conteo actual */}
              <div>
                <Field className="w-full max-w-sm">
                  <FieldLabel htmlFor="progress-upload">
                    <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                      Progreso del conteo
                    </p>
                    <span
                      className={cn(
                        'ml-auto text-sm font-bold',
                        isOverCount ? 'text-destructive' : 'text-foreground'
                      )}
                    >
                      {progressPct}%
                    </span>
                  </FieldLabel>
                  <Progress
                    value={Math.min(100, progressPct)}
                    id="progress-upload"
                    variant={isOverCount ? 'destructive' : progressPct === 100 ? 'success' : 'default'}
                  />
                </Field>

                <p className="text-muted-foreground mt-1.5 text-xs">
                  {totalCounted} de {pendingQty} unidades contadas
                </p>
              </div>

              {/* Status pill del conteo */}
              {totalCounted > 0 &&
                (isOverCount ? (
                  <div className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-3 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-semibold">Sobrepasa lo pendiente</p>
                      <p className="mt-0.5 text-xs opacity-70">
                        Reduce la cantidad en alguno de los campos.
                      </p>
                    </div>
                  </div>
                ) : progressPct === 100 ? (
                  <div className="border-border flex items-center gap-2 rounded-lg border bg-white dark:bg-zinc-900 px-3 py-3 text-sm">
                    <CheckCircle2 className="text-foreground size-5 shrink-0" />
                    <div>
                      <p className="font-semibold">Conteo completo</p>
                      {damagedQtyNum > 0 && (
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {damagedQtyNum} dañadas no entrarán al stock.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="border-border flex items-start gap-2 rounded-lg border bg-white dark:bg-zinc-900 px-3 py-3 text-sm">
                    <AlertTriangle className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-semibold">Faltan {missingInForm} unidades</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Indica el motivo de la diferencia.
                      </p>
                    </div>
                  </div>
                ))}
            </div>

            {/* ── Right panel: formulario de conteo ── */}
            <div className="col-span-3 flex flex-col gap-5 px-7 py-6">
              <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                Conteo físico
              </p>

              {/* UoM selector — shown only when product has multiple options */}
              {hasUomChoice && (
                <div className="space-y-1.5 rounded-lg border bg-white dark:bg-zinc-900 p-4">
                  <Label className="flex items-center gap-2 text-sm font-semibold">
                    <Ruler className="text-muted-foreground size-4" />
                    Unidad de medida de recepción
                  </Label>
                  <Select value={selectedUomId} onValueChange={setSelectedUomId}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Selecciona unidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectableUoms.map((uom) => (
                        <SelectItem key={uom.id} value={uom.id}>
                          <span className="font-mono font-semibold">{uom.code}</span>
                          <span className="text-muted-foreground ml-1.5">{uom.name}</span>
                          {uom.id === baseUomId && (
                            <span className="text-muted-foreground ml-1 text-xs">(base)</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedUomId && selectedUomId !== baseUomId && (
                    <p className="text-muted-foreground text-xs">
                      Las cantidades se convertirán automáticamente a la UM base al ingresar al stock.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                {/* Buen estado */}
                <div className="space-y-3 rounded-lg border bg-white dark:bg-zinc-900 p-4">
                  <Label
                    htmlFor="rcv-good"
                    className="flex items-center gap-2 text-sm font-semibold"
                  >
                    <CheckCircle2 className="text-muted-foreground size-4" />
                    Unidades en buen estado
                  </Label>
                  <QtyInput
                    id="rcv-good"
                    value={goodQty}
                    onChange={setGoodQty}
                    hasError={isOverCount}
                    accentClass="border-input focus-visible:ring-ring"
                  />
                  <p className="text-muted-foreground text-xs">
                    Ingresan al inventario disponible para picking.
                  </p>
                </div>

                {/* Dañadas */}
                <div className="space-y-3 rounded-lg border bg-white dark:bg-zinc-900 p-4">
                  <Label
                    htmlFor="rcv-damaged"
                    className="flex items-center gap-2 text-sm font-semibold"
                  >
                    <AlertTriangle className="text-destructive size-4" />
                    Unidades dañadas
                  </Label>
                  <QtyInput
                    id="rcv-damaged"
                    value={damagedQty}
                    onChange={setDamagedQty}
                    hasError={isOverCount}
                    accentClass={cn(damagedQtyNum > 0 ? 'border-destructive/50' : 'border-input')}
                  />
                  <p className="text-muted-foreground text-xs">
                    Se registran como daño — no entran al inventario.
                  </p>
                </div>
              </div>

              {/* Serial capture */}
              {requiresSerial && goodQtyNum > 0 && (
                <div className="space-y-2 rounded-lg border bg-white dark:bg-zinc-900 p-4">
                  <Label
                    htmlFor="rcv-serials"
                    className="flex items-center gap-2 text-sm font-semibold"
                  >
                    <Hash className="text-muted-foreground size-4" />
                    Números de serie{' '}
                    <Badge
                      variant="outline"
                      className={cn(
                        'ml-auto text-xs',
                        serialsDuplicated
                          ? 'border-destructive text-destructive'
                          : serialsMismatch
                            ? 'border-amber-400 text-amber-600'
                            : parsedSerials.length === goodQtyNum && goodQtyNum > 0
                              ? 'border-green-400 text-green-700 dark:text-emerald-300'
                              : 'text-muted-foreground'
                      )}
                    >
                      {parsedSerials.length}/{goodQtyNum}
                    </Badge>
                  </Label>
                  <BarcodeScanner
                    onScan={(val) =>
                      setSerialsRaw(serialsRaw ? `${serialsRaw}\n${val}` : val)
                    }
                    placeholder="Escanear serial con cámara o RF..."
                  />
                  <Textarea
                    id="rcv-serials"
                    placeholder={`Ingresa ${goodQtyNum} número(s) de serie, uno por línea o separados por coma`}
                    value={serialsRaw}
                    onChange={(e) => setSerialsRaw(e.target.value)}
                    rows={Math.min(6, goodQtyNum + 1)}
                    className={cn(
                      'font-mono text-sm',
                      serialsDuplicated || serialsMismatch ? 'border-destructive' : ''
                    )}
                  />
                  {serialsDuplicated && (
                    <p className="text-destructive text-xs">Hay números de serie duplicados.</p>
                  )}
                  {!serialsDuplicated && serialsMismatch && (
                    <p className="text-amber-600 dark:text-amber-300 text-xs">
                      Se esperan {goodQtyNum} series — ingresadas {parsedSerials.length}.
                    </p>
                  )}
                  {!serialsDuplicated && parsedSerials.length === goodQtyNum && goodQtyNum > 0 && (
                    <p className="text-green-700 dark:text-emerald-300 text-xs flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> {goodQtyNum} series capturadas correctamente.
                    </p>
                  )}
                </div>
              )}

              {/* Motivo de diferencia */}
              {isDiscrepancy && (
                <div className="space-y-2">
                  <Field className="w-full">
                    <FieldLabel> Motivo de la diferencia</FieldLabel>
                    <Select value={discrepancyReason} onValueChange={setDiscrepancyReason}>
                      <SelectTrigger
                        id="disc-reason"
                        className={cn(
                          'h-11',
                          !discrepancyReason && dialog.error && 'border-destructive'
                        )}
                      >
                        <SelectValue placeholder="¿Por qué llegaron menos unidades?" />
                      </SelectTrigger>
                      <SelectContent>
                        {DISCREPANCY_REASONS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              )}

              {/* Intención de cierre */}
              {isDiscrepancy && discrepancyReason && (
                <div className="space-y-2.5">
                  <p className="text-sm font-medium">
                    ¿Qué deseas hacer con las {missingInForm} unidades faltantes?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3.5 transition-all',
                        closeIntent === 'leave_open'
                          ? 'border-foreground bg-muted/40'
                          : 'border-border hover:border-foreground/30'
                      )}
                    >
                      <input
                        type="radio"
                        name="close-intent"
                        value="leave_open"
                        checked={closeIntent === 'leave_open'}
                        onChange={() => setCloseIntent('leave_open')}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm leading-snug font-semibold">Dejar abierto</p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          El proveedor enviará las {missingInForm} unidades en otro camión.
                        </p>
                      </div>
                    </label>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3.5 transition-all',
                        closeIntent === 'close_now'
                          ? 'border-foreground bg-muted/40'
                          : 'border-border hover:border-foreground/30'
                      )}
                    >
                      <input
                        type="radio"
                        name="close-intent"
                        value="close_now"
                        checked={closeIntent === 'close_now'}
                        onChange={() => setCloseIntent('close_now')}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm leading-snug font-semibold">Cerrar con diferencia</p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          No se esperan más entregas. Se genera reporte OTIF.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {dialog.error && <ErrorBanner message={dialog.error} />}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t bg-white dark:bg-zinc-900 px-7 py-4">
          <div className="text-muted-foreground text-sm">
            {totalCounted > 0 && !isOverCount && (
              <span>
                Total contado:{' '}
                <span className="text-foreground font-semibold tabular-nums">{totalCounted}</span>{' '}
                <span className="font-mono text-xs">
                  {selectableUoms.find((u) => u.id === selectedUomId)?.abbreviation ?? 'und'}
                </span>
                {goodQtyNum > 0 && <span className="text-foreground"> · {goodQtyNum} OK</span>}
                {damagedQtyNum > 0 && (
                  <span className="text-destructive"> · {damagedQtyNum} dañadas</span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={dialog.close}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit} className="min-w-40">
              <CheckCircle2 className="mr-1.5 size-4" />
              {closeIntent === 'close_now' ? 'Confirmar y cerrar ASN' : 'Confirmar entrega'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
