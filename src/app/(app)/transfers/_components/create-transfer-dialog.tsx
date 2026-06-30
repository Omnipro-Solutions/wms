'use client'

import { useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2, ArrowRight } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'

const lineSchema = z.object({
  productId: z.string().min(1, 'Requerido'),
  // ponytail: string in form state, parsed to number on submit
  requestedQuantity: z.string().min(1, 'Requerido'),
})

const schema = z.object({
  originId: z.string().min(1, 'Requerido'),
  destinationId: z.string().min(1, 'Requerido'),
  estimatedArrivalDate: z.string().min(1, 'Requerido'),
  transitStops: z.array(
    z.object({
      warehouseId: z.string().min(1, 'Requerido'),
      estimatedArrivalDate: z.string().min(1, 'Requerido'),
    })
  ),
  items: z.array(lineSchema).min(1, 'Agrega al menos un producto'),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
}

export const CreateTransferDialog = ({ open, onClose }: Props) => {
  const { warehouses, products, createTransferOrder } = useWmsStore()
  const [multiLeg, setMultiLeg] = useState(false)

  const transitWarehouses = warehouses.filter((w) => w.type === 'transit')
  const regularWarehouses = warehouses.filter((w) => w.type !== 'transit')

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      originId: '',
      destinationId: '',
      estimatedArrivalDate: '',
      transitStops: [],
      items: [{ productId: '', requestedQuantity: '1' }],
    },
  })

  const stopsArray = useFieldArray({ control, name: 'transitStops' })
  const itemsArray = useFieldArray({ control, name: 'items' })

  const handleMultiLegToggle = (checked: boolean) => {
    setMultiLeg(checked)
    if (!checked) setValue('transitStops', [])
  }

  const onSubmit = (values: FormValues) => {
    try {
      const legs = [
        {
          originId: values.originId,
          destinationId:
            multiLeg && values.transitStops[0]
              ? values.transitStops[0].warehouseId
              : values.destinationId,
          estimatedArrivalDate:
            multiLeg && values.transitStops[0]
              ? values.transitStops[0].estimatedArrivalDate
              : values.estimatedArrivalDate,
        },
        ...values.transitStops.slice(1).map((stop, i) => ({
          originId: values.transitStops[i].warehouseId,
          destinationId: stop.warehouseId,
          estimatedArrivalDate: stop.estimatedArrivalDate,
        })),
        ...(multiLeg && values.transitStops.length > 0
          ? [
              {
                originId: values.transitStops[values.transitStops.length - 1].warehouseId,
                destinationId: values.destinationId,
                estimatedArrivalDate: values.estimatedArrivalDate,
              },
            ]
          : []),
      ]

      const items = values.items.map((item, i) => ({
        id: `item-new-${i}`,
        productId: item.productId,
        requestedQuantity: Math.max(1, parseInt(item.requestedQuantity, 10) || 1),
      }))

      createTransferOrder({ legs, items, operatorName: 'Sistema' })
      reset()
      setMultiLeg(false)
      onClose()
    } catch (e: unknown) {
      setError('root', {
        message: e instanceof Error ? e.message : 'Error al crear traslado',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo traslado</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Origen */}
          <Field>
            <FieldLabel htmlFor="originId">Origen</FieldLabel>
            <Controller
              control={control}
              name="originId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger id="originId">
                    <SelectValue placeholder="Seleccionar bodega origen" />
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
            <FieldError errors={[errors.originId]} />
          </Field>

          {/* Toggle multi-tramo */}
          {transitWarehouses.length > 0 && (
            <div className="flex items-center gap-3">
              <Switch id="multi-leg" checked={multiLeg} onCheckedChange={handleMultiLegToggle} />
              <Label htmlFor="multi-leg" className="text-sm">
                Agregar parada intermedia
              </Label>
            </div>
          )}

          {/* Paradas intermedias */}
          {multiLeg && (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-muted-foreground text-xs font-medium uppercase">
                Paradas intermedias
              </p>
              {stopsArray.fields.map((field, i) => (
                <div key={field.id} className="flex items-end gap-2">
                  <Field className="flex-1">
                    <FieldLabel className="text-xs">Bodega transitoria</FieldLabel>
                    <Controller
                      control={control}
                      name={`transitStops.${i}.warehouseId`}
                      render={({ field: f }) => (
                        <Select onValueChange={f.onChange} value={f.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Hub / cross-dock" />
                          </SelectTrigger>
                          <SelectContent>
                            {transitWarehouses.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                <span>{w.name}</span>
                                {'transitRole' in w && w.transitRole && (
                                  <Badge variant="outline" className="ml-2 text-[10px]">
                                    {String(w.transitRole)}
                                  </Badge>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldError errors={[errors.transitStops?.[i]?.warehouseId]} />
                  </Field>
                  <Field className="w-36">
                    <FieldLabel className="text-xs">ETA</FieldLabel>
                    <Controller
                      control={control}
                      name={`transitStops.${i}.estimatedArrivalDate`}
                      render={({ field: f }) => <Input type="date" {...f} />}
                    />
                    <FieldError errors={[errors.transitStops?.[i]?.estimatedArrivalDate]} />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mb-0.5"
                    onClick={() => stopsArray.remove(i)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => stopsArray.append({ warehouseId: '', estimatedArrivalDate: '' })}
              >
                <Plus className="mr-1.5 size-3.5" />
                Agregar parada
              </Button>
            </div>
          )}

          {/* Destino final */}
          <Field>
            <FieldLabel htmlFor="destinationId">Destino final</FieldLabel>
            <Controller
              control={control}
              name="destinationId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger id="destinationId">
                    <SelectValue placeholder="Seleccionar bodega destino" />
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
            <FieldError errors={[errors.destinationId]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="estimatedArrivalDate">
              Fecha estimada de llegada al destino final
            </FieldLabel>
            <Controller
              control={control}
              name="estimatedArrivalDate"
              render={({ field }) => <Input id="estimatedArrivalDate" type="date" {...field} />}
            />
            <FieldError errors={[errors.estimatedArrivalDate]} />
          </Field>

          {/* Productos */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Productos</p>
            {itemsArray.fields.map((field, i) => (
              <div key={field.id} className="flex items-end gap-2">
                <Field className="flex-1">
                  <Controller
                    control={control}
                    name={`items.${i}.productId`}
                    render={({ field: f }) => (
                      <Select onValueChange={f.onChange} value={f.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Producto" />
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
                </Field>
                <Field className="w-24">
                  <Controller
                    control={control}
                    name={`items.${i}.requestedQuantity`}
                    render={({ field: f }) => (
                      <Input type="number" min={1} placeholder="Cant." {...f} />
                    )}
                  />
                  <FieldError errors={[errors.items?.[i]?.requestedQuantity]} />
                </Field>
                {itemsArray.fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mb-0.5"
                    onClick={() => itemsArray.remove(i)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => itemsArray.append({ productId: '', requestedQuantity: '1' })}
            >
              <Plus className="mr-1.5 size-3.5" />
              Agregar producto
            </Button>
            {errors.items?.root && (
              <p className="text-destructive text-xs">{errors.items.root.message}</p>
            )}
          </div>

          {errors.root && (
            <p className="text-destructive text-xs">{errors.root.message}</p>
          )}

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              <ArrowRight className="mr-1.5 size-4" />
              Crear traslado
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
