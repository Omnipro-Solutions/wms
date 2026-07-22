'use client'

import { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

import { useWmsStore } from '@/store/wms-store'
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
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { LOCATION_TYPE_LABELS, RACK_STYLE_LABELS } from '@/lib/rules/locations'
import type { LocationType, RackStorageStyle, RackType } from '@/types/wms'

const STORAGE_STYLES = Object.keys(RACK_STYLE_LABELS) as RackStorageStyle[]
const LOCATION_TYPES = Object.keys(LOCATION_TYPE_LABELS) as LocationType[]

const schema = z.object({
  code: z.string().min(1, 'Requerido'),
  name: z.string().min(1, 'Requerido'),
  storageStyle: z.string().min(1, 'Requerido'),
  // ponytail: strings in form state, parsed to numbers on submit
  levels: z.string().min(1, 'Requerido'),
  maxWeightKgPerLevel: z.string().min(1, 'Requerido'),
  maxPalletsPerLevel: z.string().min(1, 'Requerido'),
  compatibleLocationTypes: z.array(z.string()),
  compatibleCategories: z.array(z.string()),
  description: z.string().optional(),
  active: z.boolean(),
})

type FormValues = z.infer<typeof schema>

const toDefaults = (rack: RackType | null): FormValues => ({
  code: rack?.code ?? '',
  name: rack?.name ?? '',
  storageStyle: rack?.storageStyle ?? 'selective',
  levels: String(rack?.levels ?? 4),
  maxWeightKgPerLevel: String(rack?.maxWeightKgPerLevel ?? 800),
  maxPalletsPerLevel: String(rack?.maxPalletsPerLevel ?? 2),
  compatibleLocationTypes: rack?.compatibleLocationTypes ?? ['pick', 'reserve'],
  compatibleCategories: rack?.compatibleCategories ?? [],
  description: rack?.description ?? '',
  active: rack?.active ?? true,
})

interface Props {
  open: boolean
  rack: RackType | null // null = create mode
  onClose: () => void
}

export const RackTypeDialog = ({ open, rack, onClose }: Props) => {
  const { products, createRackType, updateRackType } = useWmsStore()

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    [products]
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
    defaultValues: toDefaults(rack),
  })

  // Re-seed the form whenever the dialog opens for a different rack.
  useEffect(() => {
    if (open) reset(toDefaults(rack))
  }, [open, rack, reset])

  const onSubmit = (values: FormValues) => {
    try {
      const payload = {
        code: values.code.trim(),
        name: values.name.trim(),
        storageStyle: values.storageStyle as RackStorageStyle,
        levels: Math.max(1, parseInt(values.levels, 10) || 1),
        maxWeightKgPerLevel: Math.max(0, parseFloat(values.maxWeightKgPerLevel) || 0),
        maxPalletsPerLevel: Math.max(0, parseInt(values.maxPalletsPerLevel, 10) || 0),
        compatibleLocationTypes: values.compatibleLocationTypes as LocationType[],
        compatibleCategories: values.compatibleCategories,
        description: values.description?.trim() || undefined,
        active: values.active,
      }
      if (rack) updateRackType(rack.id, payload)
      else createRackType(payload)
      onClose()
    } catch (e: unknown) {
      setError('root', { message: e instanceof Error ? e.message : 'Error al guardar el tipo de estiba' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{rack ? 'Editar tipo de estiba' : 'Nuevo tipo de estiba'}</DialogTitle>
          <DialogDescription>
            Define el estilo de rack, su capacidad por nivel y qué producto admite. Se usa al asignar
            ubicaciones y para validar la compatibilidad rack↔producto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="rack-code">Código</FieldLabel>
              <Input id="rack-code" placeholder="SEL-STD" {...register('code')} />
              <FieldError errors={[errors.code]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="rack-name">Nombre</FieldLabel>
              <Input id="rack-name" placeholder="Rack selectivo estándar" {...register('name')} />
              <FieldError errors={[errors.name]} />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="rack-style">Estilo de almacenamiento</FieldLabel>
            <Controller
              control={control}
              name="storageStyle"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger id="rack-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STORAGE_STYLES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {RACK_STYLE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[errors.storageStyle]} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field>
              <FieldLabel htmlFor="rack-levels">Niveles</FieldLabel>
              <Input id="rack-levels" type="number" min={1} {...register('levels')} />
              <FieldError errors={[errors.levels]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="rack-weight">Kg / nivel</FieldLabel>
              <Input id="rack-weight" type="number" min={0} {...register('maxWeightKgPerLevel')} />
              <FieldError errors={[errors.maxWeightKgPerLevel]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="rack-pallets">Pallets / nivel</FieldLabel>
              <Input id="rack-pallets" type="number" min={0} {...register('maxPalletsPerLevel')} />
              <FieldError errors={[errors.maxPalletsPerLevel]} />
            </Field>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Tipos de ubicación admitidos</p>
            <Controller
              control={control}
              name="compatibleLocationTypes"
              render={({ field }) => (
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {LOCATION_TYPES.map((t) => (
                    <label key={t} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={field.value.includes(t)}
                        onCheckedChange={(c) =>
                          field.onChange(
                            c ? [...field.value, t] : field.value.filter((v) => v !== t)
                          )
                        }
                      />
                      {LOCATION_TYPE_LABELS[t]}
                    </label>
                  ))}
                </div>
              )}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Categorías compatibles
              <span className="text-muted-foreground ml-1 text-xs font-normal">
                (ninguna seleccionada = todas)
              </span>
            </p>
            <Controller
              control={control}
              name="compatibleCategories"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {categories.map((c) => (
                    <label key={c} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={field.value.includes(c)}
                        onCheckedChange={(checked) =>
                          field.onChange(
                            checked ? [...field.value, c] : field.value.filter((v) => v !== c)
                          )
                        }
                      />
                      {c}
                    </label>
                  ))}
                </div>
              )}
            />
          </div>

          <Field>
            <FieldLabel htmlFor="rack-desc">Descripción</FieldLabel>
            <Textarea
              id="rack-desc"
              rows={2}
              placeholder="Notas de uso, rotación, restricciones…"
              {...register('description')}
            />
          </Field>

          <div className="flex items-center gap-3">
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <Switch id="rack-active" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label htmlFor="rack-active" className="text-sm">
              Activo (disponible para asignar a ubicaciones)
            </Label>
          </div>

          {errors.root && <p className="text-destructive text-sm">{errors.root.message}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">{rack ? 'Guardar cambios' : 'Crear tipo de estiba'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
