'use client'

import { useEffect, useMemo } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarClock, Plus, TriangleAlert, Undo2, X } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { seedTimestamp } from '@/data/seed'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import { RETURN_TYPE_LABELS, RETURN_TYPES, returnWindowExceededBy } from '@/lib/returns'
import type { ReturnOrder } from '@/types/wms'

const schema = z.object({
  customerName: z.string().min(1, 'Requerido'),
  type: z.string().min(1, 'Requerido'),
  originId: z.string().min(1, 'Requerido'),
  destinationId: z.string().min(1, 'Requerido'),
  reasonId: z.string().min(1, 'Selecciona un motivo'),
  dispatchDate: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Selecciona un producto'),
        requestedQuantity: z
          .string()
          .min(1, 'Requerido')
          .refine((v) => Number.isInteger(Number(v)) && Number(v) > 0, 'Cantidad > 0'),
      })
    )
    .min(1, 'Agrega al menos un ítem'),
})

type FormValues = z.infer<typeof schema>

const DEFAULTS: FormValues = {
  customerName: '',
  type: 'store_to_dc',
  originId: '',
  destinationId: '',
  reasonId: '',
  dispatchDate: '',
  items: [{ productId: '', requestedQuantity: '1' }],
}

interface Props {
  open: boolean
  onClose: () => void
}

export const CreateReturnDialog = ({ open, onClose }: Props) => {
  const { products, warehouses, reasons, settings, createReturn } = useWmsStore()

  const returnReasons = useMemo(
    () => reasons.filter((r) => r.context === 'return' && r.active),
    [reasons]
  )

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  })

  const itemsArray = useFieldArray({ control, name: 'items' })

  useEffect(() => {
    if (open) reset(DEFAULTS)
  }, [open, reset])

  // Return-window check: how many days elapsed since the (optional) original
  // dispatch date, compared against WmsSettings.returnWindowDays.
  const dispatchDate = useWatch({ control, name: 'dispatchDate' })
  const windowExceeded = useMemo(
    () => returnWindowExceededBy(dispatchDate, settings.returnWindowDays, seedTimestamp),
    [dispatchDate, settings.returnWindowDays]
  )

  const onSubmit = (values: FormValues) => {
    try {
      createReturn({
        customerName: values.customerName.trim(),
        type: values.type as ReturnOrder['type'],
        originId: values.originId,
        destinationId: values.destinationId,
        reasonId: values.reasonId,
        ...(values.dispatchDate ? { dispatchDate: values.dispatchDate } : {}),
        items: values.items.map((i) => ({
          productId: i.productId,
          requestedQuantity: Number(i.requestedQuantity),
        })),
      })
      onClose()
    } catch (e: unknown) {
      setError('root', {
        message: e instanceof Error ? e.message : 'Error al registrar la devolución',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="size-5 text-blue-600" />
            Registrar devolución (RMA)
          </DialogTitle>
          <DialogDescription>
            Registra el flujo inverso con su motivo. La devolución entra en estado «Solicitada» y
            avanza por la máquina de estados hasta la disposición final.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="ret-customer">Cliente / Origen</FieldLabel>
              <Input
                id="ret-customer"
                placeholder="Nombre del cliente o tienda"
                {...register('customerName')}
              />
              <FieldError errors={[errors.customerName]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ret-type">Tipo de devolución</FieldLabel>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="ret-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RETURN_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {RETURN_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="ret-origin">Bodega origen</FieldLabel>
              <Controller
                control={control}
                name="originId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="ret-origin">
                      <SelectValue placeholder="Selecciona…" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.originId]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ret-dest">Bodega destino (recibe)</FieldLabel>
              <Controller
                control={control}
                name="destinationId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="ret-dest">
                      <SelectValue placeholder="Selecciona…" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.destinationId]} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="ret-reason">Motivo</FieldLabel>
              <Controller
                control={control}
                name="reasonId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="ret-reason">
                      <SelectValue placeholder="Selecciona un motivo…" />
                    </SelectTrigger>
                    <SelectContent>
                      {returnReasons.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.reasonId]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ret-dispatch">Fecha de despacho original</FieldLabel>
              <Input id="ret-dispatch" type="date" {...register('dispatchDate')} />
            </Field>
          </div>

          {windowExceeded !== null && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <CalendarClock className="mt-0.5 size-4 shrink-0" />
              <span>
                Fuera de la ventana de devolución: {windowExceeded} días desde el despacho (máximo{' '}
                {settings.returnWindowDays} días). Puedes continuar, pero suele requerir
                autorización.
              </span>
            </div>
          )}

          {/* Items */}
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                Ítems devueltos
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => itemsArray.append({ productId: '', requestedQuantity: '1' })}
              >
                <Plus className="mr-1.5 size-3.5" />
                Ítem
              </Button>
            </div>
            <div className="space-y-2">
              {itemsArray.fields.map((f, i) => (
                <div key={f.id} className="flex items-start gap-2">
                  <div className="w-full">
                    <Controller
                      control={control}
                      name={`items.${i}.productId`}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Producto…" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldError errors={[errors.items?.[i]?.productId]} />
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      min={1}
                      className="text-right"
                      {...register(`items.${i}.requestedQuantity`)}
                    />
                    <FieldError errors={[errors.items?.[i]?.requestedQuantity]} />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'text-muted-foreground size-9 shrink-0 p-0',
                      itemsArray.fields.length === 1 && 'invisible'
                    )}
                    onClick={() => itemsArray.remove(i)}
                    aria-label="Quitar ítem"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <FieldError errors={[errors.items?.root ?? errors.items]} />
          </div>

          {errors.root && (
            <p className="text-destructive flex items-center gap-1 text-sm">
              <TriangleAlert className="size-3" /> {errors.root.message}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              <Undo2 className="mr-1.5 size-4" /> Registrar devolución
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
