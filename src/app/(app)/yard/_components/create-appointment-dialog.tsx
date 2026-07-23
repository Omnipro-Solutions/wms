'use client'

import { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarPlus } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { isDockCompatible } from '@/lib/rules/yard'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import type { DockAppointmentType } from '@/types/wms'

const NONE = '__none__'

const schema = z.object({
  warehouseId: z.string().min(1, 'Requerido'),
  type: z.enum(['inbound', 'outbound']),
  referenceId: z.string(),
  dockId: z.string(),
  carrierName: z.string(),
  driverName: z.string().optional(),
  vehiclePlate: z.string().optional(),
  date: z.string().min(1, 'Requerido'),
  startTime: z.string().min(1, 'Requerido'),
  endTime: z.string().min(1, 'Requerido'),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const addMinutes = (time: string, minutes: number): string => {
  const [h, m] = time.split(':').map(Number)
  const total = ((h * 60 + m + minutes) % (24 * 60) + 24 * 60) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// Local calendar date (not toISOString(), which is UTC and can land on the
// wrong day for timezones ahead of/behind UTC near midnight).
const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface CreateAppointmentInitial {
  warehouseId?: string
  type?: DockAppointmentType
}

interface Props {
  open: boolean
  onClose: () => void
  initial?: CreateAppointmentInitial
}

export const CreateAppointmentDialog = ({ open, onClose, initial }: Props) => {
  const { warehouses, docks, asnRecords, loadManifests, carriers, settings, createDockAppointment } =
    useWmsStore()

  const regularWarehouses = warehouses.filter((w) => w.type !== 'transit')
  const activeCarriers = carriers.filter((c) => c.active)
  const openAsns = asnRecords.filter((a) => a.status !== 'cancelled' && a.status !== 'putaway_done')
  const openManifests = loadManifests.filter((m) => m.status !== 'completed' && m.status !== 'cancelled')

  const buildDefaults = (): FormValues => {
    const start = '08:00'
    return {
      warehouseId: initial?.warehouseId ?? regularWarehouses[0]?.id ?? '',
      type: initial?.type ?? 'inbound',
      referenceId: NONE,
      dockId: NONE,
      carrierName: NONE,
      driverName: '',
      vehiclePlate: '',
      date: todayStr(),
      startTime: start,
      endTime: addMinutes(start, settings.yardDefaultSlotMinutes),
      notes: '',
    }
  }

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: buildDefaults(),
  })

  useEffect(() => {
    if (open) reset(buildDefaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial])

  const warehouseId = watch('warehouseId')
  const type = watch('type')

  const compatibleDocks = useMemo(
    () => docks.filter((d) => d.warehouseId === warehouseId && d.status === 'active' && isDockCompatible(d, type)),
    [docks, warehouseId, type]
  )

  const handleTypeChange = (value: string, onChange: (v: string) => void) => {
    onChange(value)
    setValue('referenceId', NONE)
    setValue('dockId', NONE)
  }
  const handleWarehouseChange = (value: string, onChange: (v: string) => void) => {
    onChange(value)
    setValue('dockId', NONE)
  }
  const handleStartTimeChange = (value: string, onChange: (v: string) => void) => {
    onChange(value)
    setValue('endTime', addMinutes(value, settings.yardDefaultSlotMinutes))
  }

  const onSubmit = (values: FormValues) => {
    try {
      createDockAppointment({
        warehouseId: values.warehouseId,
        type: values.type as DockAppointmentType,
        dockId: values.dockId === NONE ? undefined : values.dockId,
        asnId: values.type === 'inbound' && values.referenceId !== NONE ? values.referenceId : undefined,
        manifestId: values.type === 'outbound' && values.referenceId !== NONE ? values.referenceId : undefined,
        carrierName: values.carrierName === NONE ? undefined : values.carrierName,
        driverName: values.driverName?.trim() || undefined,
        vehiclePlate: values.vehiclePlate?.trim() || undefined,
        // No trailing 'Z' — these are wall-clock times, parsed/displayed in
        // local time throughout the app (see lib/rules/yard.ts).
        scheduledStart: `${values.date}T${values.startTime}:00`,
        scheduledEnd: `${values.date}T${values.endTime}:00`,
        notes: values.notes?.trim() || undefined,
      })
      reset(buildDefaults())
      onClose()
    } catch (e: unknown) {
      setError('root', { message: e instanceof Error ? e.message : 'Error al crear la cita' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva cita de patio</DialogTitle>
          <DialogDescription>
            Agenda la llegada o salida de un vehículo. El muelle es opcional al crear — puedes asignarlo
            después desde la cola de citas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="warehouseId">Bodega</FieldLabel>
              <Controller
                control={control}
                name="warehouseId"
                render={({ field }) => (
                  <Select onValueChange={(v) => handleWarehouseChange(v, field.onChange)} value={field.value}>
                    <SelectTrigger id="warehouseId">
                      <SelectValue placeholder="Bodega" />
                    </SelectTrigger>
                    <SelectContent>
                      {regularWarehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.warehouseId]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="type">Tipo</FieldLabel>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select onValueChange={(v) => handleTypeChange(v, field.onChange)} value={field.value}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbound">Llegada (entrada)</SelectItem>
                      <SelectItem value="outbound">Salida</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="referenceId">
              {type === 'inbound' ? 'ASN de referencia' : 'Manifiesto de referencia'}
            </FieldLabel>
            <Controller
              control={control}
              name="referenceId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger id="referenceId">
                    <SelectValue placeholder="Sin referencia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin referencia</SelectItem>
                    {type === 'inbound'
                      ? openAsns.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} — {a.supplierName}
                          </SelectItem>
                        ))
                      : openManifests.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.code} — {m.carrierName}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="dockId">Muelle</FieldLabel>
              <Controller
                control={control}
                name="dockId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="dockId">
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin asignar</SelectItem>
                      {compatibleDocks.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.code} — {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {compatibleDocks.length === 0 && (
                <p className="text-muted-foreground text-xs">
                  No hay muelles activos compatibles en esta bodega.
                </p>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="carrierName">Transportista</FieldLabel>
              <Controller
                control={control}
                name="carrierName"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="carrierName">
                      <SelectValue placeholder="Sin especificar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin especificar</SelectItem>
                      {activeCarriers.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="driverName">Conductor</FieldLabel>
              <Input id="driverName" placeholder="Opcional" {...register('driverName')} />
            </Field>
            <Field>
              <FieldLabel htmlFor="vehiclePlate">Placa</FieldLabel>
              <Input id="vehiclePlate" placeholder="ABC-123" {...register('vehiclePlate')} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field>
              <FieldLabel htmlFor="date">Fecha</FieldLabel>
              <Input id="date" type="date" {...register('date')} />
              <FieldError errors={[errors.date]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="startTime">Desde</FieldLabel>
              <Controller
                control={control}
                name="startTime"
                render={({ field }) => (
                  <Input
                    id="startTime"
                    type="time"
                    value={field.value}
                    onChange={(e) => handleStartTimeChange(e.target.value, field.onChange)}
                  />
                )}
              />
              <FieldError errors={[errors.startTime]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="endTime">Hasta</FieldLabel>
              <Input id="endTime" type="time" {...register('endTime')} />
              <FieldError errors={[errors.endTime]} />
            </Field>
          </div>
          <p className="text-muted-foreground -mt-2 text-xs">
            Horario operativo: {settings.yardOperatingHoursStart}–{settings.yardOperatingHoursEnd}. Fuera de
            ese rango la cita será rechazada.
          </p>

          <Field>
            <FieldLabel htmlFor="notes">Notas</FieldLabel>
            <Textarea id="notes" rows={2} placeholder="Observaciones (opcional)" {...register('notes')} />
          </Field>

          {errors.root && <p className="text-destructive text-sm">{errors.root.message}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              <CalendarPlus className="mr-1.5 size-4" />
              Crear cita
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
