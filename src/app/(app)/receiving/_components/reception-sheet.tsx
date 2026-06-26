'use client'

import { CalendarPlus, Minus, Plus, ShieldCheck, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Field, FieldLabel } from '@/components/ui/field'

import type { useReceptionSheet } from '../_hooks/use-reception-sheet'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  state: ReturnType<typeof useReceptionSheet>
}

export const ReceptionSheet = ({ state }: Props) => {
  const {
    isOpen,
    sheetPo,
    receptionLines,
    appointmentDate,
    setAppointmentDate,
    receptionCarrier,
    setReceptionCarrier,
    receptionNotes,
    setReceptionNotes,
    requiresQc,
    setRequiresQc,
    sheetError,
    carriers,
    close,
    updateLineQty,
    setLineQty,
    handleSubmit,
  } = state

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(o) => {
        if (!o) close()
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="bg-muted/30 border-b px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 border-primary/20 mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border">
              <CalendarPlus className="text-primary size-5" />
            </div>
            <div>
              <SheetTitle className="text-base leading-snug font-semibold">
                Nueva recepción
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-xs">
                {sheetPo ? `${sheetPo.code} · ${sheetPo.supplierName}` : ''}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div className="space-y-3">
            <p className="text-sm font-semibold">Cantidades a recibir</p>
            {receptionLines.map((line) => {
              const max = line.orderedQty - line.alreadyReceivedQty
              const current = parseInt(line.qty, 10) || 0
              const pct = max > 0 ? Math.round((current / max) * 100) : 0
              return (
                <div key={line.lineId} className="bg-card space-y-3 rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{line.productName}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Pedido: {line.orderedQty} uds
                        {line.alreadyReceivedQty > 0 &&
                          ` · Ya recibido: ${line.alreadyReceivedQty}`}
                        {' · '}
                        <span className="text-foreground font-medium">Pendiente: {max}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        onClick={() => updateLineQty(line.lineId, -10)}
                        disabled={current === 0}
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <Input
                        type="number"
                        min={0}
                        max={max}
                        value={line.qty}
                        onChange={(e) => setLineQty(line.lineId, e.target.value, max)}
                        className="w-20 text-center font-semibold tabular-nums"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        onClick={() => updateLineQty(line.lineId, 10)}
                        disabled={current >= max}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-muted-foreground flex justify-between text-[10px]">
                      <span>A recibir en esta entrega</span>
                      <span className="font-medium">{pct}% del pendiente</span>
                    </div>
                    <Progress value={pct} className={cn(pct === 100 ? '*:data-[slot=progress-indicator]:bg-emerald-500' : pct > 0 ? '*:data-[slot=progress-indicator]:bg-blue-500' : '')} />
                  </div>
                </div>
              )
            })}
          </div>

          <Separator />

          <div className="space-y-4">
            <p className="text-sm font-semibold">Detalles de la cita</p>

            <div className="space-y-2">
              <Field className="w-full">
                <FieldLabel>
                  {' '}
                  Fecha de cita <span className="text-destructive">*</span>
                </FieldLabel>

                <Input
                  id="apt-date"
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className={cn(!appointmentDate && sheetError && 'border-destructive')}
                />
              </Field>
            </div>

            <div className="space-y-2">
              <Field className="w-full">
                <FieldLabel>Transportista</FieldLabel>

                <Select value={receptionCarrier} onValueChange={setReceptionCarrier}>
                  <SelectTrigger id="apt-carrier">
                    <SelectValue placeholder="Selecciona transportista (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {carriers
                      .filter((c) => c.active)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="space-y-2">
              <Field className="w-full">
                <FieldLabel>Notas de entrega</FieldLabel>

                <Textarea
                  placeholder="N° remito, guía de transporte, instrucciones…"
                  value={receptionNotes}
                  onChange={(e) => setReceptionNotes(e.target.value)}
                />
              </Field>
            </div>

            <button
              type="button"
              onClick={() => setRequiresQc(!requiresQc)}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-all',
                requiresQc
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-border hover:border-amber-200'
              )}
            >
              <div className={cn(
                'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border',
                requiresQc ? 'border-amber-300 bg-amber-100' : 'border-border bg-muted'
              )}>
                <ShieldCheck className={cn('size-4', requiresQc ? 'text-amber-600' : 'text-muted-foreground')} />
              </div>
              <div>
                <p className={cn('text-sm font-semibold', requiresQc ? 'text-amber-900' : '')}>
                  Requiere inspección de calidad (QC)
                </p>
                <p className={cn('mt-0.5 text-xs', requiresQc ? 'text-amber-700' : 'text-muted-foreground')}>
                  El lote quedará bloqueado hasta que QC lo apruebe.
                </p>
              </div>
            </button>
          </div>

          {sheetError && (
            <p className="bg-destructive/10 text-destructive flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm">
              <TriangleAlert className="size-3.5 shrink-0" /> {sheetError}
            </p>
          )}
        </div>

        <SheetFooter className="bg-muted/20 flex-row justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            <CalendarPlus className="mr-1.5 size-4" />
            Crear recepción
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
