'use client'

import { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { METHOD_LABELS } from '../columns'
import type { CyclicCountMethod } from '@/types/wms'

const METHODS: CyclicCountMethod[] = ['by_zone', 'by_category', 'by_abc', 'by_rotation']

const ROTATION_OPTIONS = [
  { value: 'alta', label: 'Alta rotación' },
  { value: 'baja', label: 'Baja rotación' },
]

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  method: z.enum(['by_zone', 'by_category', 'by_abc', 'by_rotation']),
  filterValue: z.string().min(1, 'Requerido'),
  warehouseId: z.string().min(1, 'Requerido'),
  scheduledDate: z.string().min(1, 'Requerido'),
  assignedOperatorName: z.string().optional(),
  blindCount: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
}

export const CreateCountDialog = ({ open, onClose }: Props) => {
  const { warehouses, locations, products, settings, createCyclicCount } = useWmsStore()

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      method: 'by_zone',
      filterValue: '',
      warehouseId: warehouses[0]?.id ?? '',
      scheduledDate: '',
      assignedOperatorName: '',
      blindCount: settings.cycleCountBlindCountDefault,
    },
  })

  // Reset to the current default every time the dialog reopens.
  useEffect(() => {
    if (open) reset({
      name: '',
      method: 'by_zone',
      filterValue: '',
      warehouseId: warehouses[0]?.id ?? '',
      scheduledDate: '',
      assignedOperatorName: '',
      blindCount: settings.cycleCountBlindCountDefault,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const method = watch('method')
  const warehouseId = watch('warehouseId')

  const zoneOptions = useMemo(
    () =>
      Array.from(
        new Set(locations.filter((l) => l.warehouseId === warehouseId).map((l) => l.zone))
      ).sort(),
    [locations, warehouseId]
  )
  const categoryOptions = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    [products]
  )

  const handleMethodChange = (value: CyclicCountMethod, onChange: (v: string) => void) => {
    onChange(value)
    setValue('filterValue', '')
  }

  const onSubmit = (values: FormValues) => {
    try {
      createCyclicCount({
        name: values.name.trim(),
        method: values.method,
        filterValue: values.filterValue,
        warehouseId: values.warehouseId,
        scheduledDate: values.scheduledDate,
        assignedOperatorName: values.assignedOperatorName?.trim() || undefined,
        blindCount: values.blindCount,
      })
      reset()
      onClose()
    } catch (e) {
      setError('root', {
        message: e instanceof Error ? e.message : 'No se pudo crear el plan de conteo',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo plan de conteo cíclico</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="cc-name">Nombre</FieldLabel>
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Input id="cc-name" placeholder="Ej: Conteo zona A — julio" {...field} />
              )}
            />
            <FieldError errors={[errors.name]} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>Método</FieldLabel>
              <Controller
                control={control}
                name="method"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => handleMethodChange(v as CyclicCountMethod, field.onChange)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {METHOD_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field>
              <FieldLabel>Almacén</FieldLabel>
              <Controller
                control={control}
                name="warehouseId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v)
                      if (method === 'by_zone') setValue('filterValue', '')
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
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
            </Field>
          </div>

          <Field>
            <FieldLabel>Valor de filtro</FieldLabel>
            <Controller
              control={control}
              name="filterValue"
              render={({ field }) => {
                if (method === 'by_zone') {
                  return (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={zoneOptions.length ? 'Selecciona una zona' : 'Sin zonas en este almacén'} />
                      </SelectTrigger>
                      <SelectContent>
                        {zoneOptions.map((z) => (
                          <SelectItem key={z} value={z}>
                            Zona {z}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )
                }
                if (method === 'by_category') {
                  return (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona una categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )
                }
                if (method === 'by_abc') {
                  return (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona una clase" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">Clase A</SelectItem>
                        <SelectItem value="B">Clase B</SelectItem>
                        <SelectItem value="C">Clase C</SelectItem>
                      </SelectContent>
                    </Select>
                  )
                }
                return (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona rotación" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROTATION_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              }}
            />
            <FieldError errors={[errors.filterValue]} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="cc-date">Fecha programada</FieldLabel>
              <Controller
                control={control}
                name="scheduledDate"
                render={({ field }) => <Input id="cc-date" type="date" {...field} />}
              />
              <FieldError errors={[errors.scheduledDate]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="cc-operator">Operador asignado</FieldLabel>
              <Controller
                control={control}
                name="assignedOperatorName"
                render={({ field }) => (
                  <Input id="cc-operator" placeholder="Opcional" {...field} />
                )}
              />
            </Field>
          </div>

          <Controller
            control={control}
            name="blindCount"
            render={({ field }) => (
              <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Conteo ciego</p>
                  <p className="text-muted-foreground text-xs">
                    El operario no verá la cantidad esperada del sistema mientras cuenta.
                  </p>
                </div>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />

          {errors.root && <p className="text-destructive text-sm">{errors.root.message}</p>}

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              <Plus className="mr-1.5 size-4" />
              Crear plan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
