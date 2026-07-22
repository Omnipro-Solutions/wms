'use client'

import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Sparkles, Star } from 'lucide-react'

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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { buildLocationCode, isGoldenEligible, LOCATION_TYPE_LABELS } from '@/lib/rules/locations'
import { cn } from '@/lib/utils'
import type { LocationType, StorageLocation } from '@/types/wms'

const LOCATION_TYPES = Object.keys(LOCATION_TYPE_LABELS) as LocationType[]
const NONE_RACK = '__none__'

const schema = z.object({
  warehouseId: z.string().min(1, 'Requerido'),
  type: z.string().min(1, 'Requerido'),
  zone: z.string().min(1, 'Requerido'),
  aisle: z.string().optional(),
  rack: z.string().optional(),
  level: z.string().optional(),
  position: z.string().optional(),
  code: z.string().min(1, 'Requerido'),
  rackTypeId: z.string(),
  isPickFace: z.boolean(),
  golden: z.boolean(),
  // ponytail: strings in form, parsed to numbers on submit
  accessibilityScore: z.string().min(1, 'Requerido'),
  distanceToDispatchM: z.string().min(1, 'Requerido'),
  maxWeightKg: z.string().min(1, 'Requerido'),
  volumeCapacityM3: z.string().min(1, 'Requerido'),
})

type FormValues = z.infer<typeof schema>

const toDefaults = (loc: StorageLocation | null, defaultWarehouseId: string): FormValues => ({
  warehouseId: loc?.warehouseId ?? defaultWarehouseId,
  type: loc?.type ?? 'pick',
  zone: loc?.zone ?? '',
  aisle: loc?.aisle ?? '',
  rack: loc?.rack ?? '',
  level: loc?.level ?? '',
  position: loc?.position ?? '',
  code: loc?.code ?? '',
  rackTypeId: loc?.rackTypeId ?? NONE_RACK,
  isPickFace: loc?.isPickFace ?? true,
  golden: loc?.golden ?? false,
  accessibilityScore: String(loc?.accessibilityScore ?? 50),
  distanceToDispatchM: String(loc?.distanceToDispatchM ?? 20),
  maxWeightKg: String(loc?.maxWeightKg ?? 25),
  volumeCapacityM3: String(loc?.volumeCapacityM3 ?? 2),
})

interface Props {
  open: boolean
  location: StorageLocation | null // null = create mode
  onClose: () => void
}

export const LocationFormDialog = ({ open, location, onClose }: Props) => {
  const { warehouses, rackTypes, settings, createLocation, updateLocation } = useWmsStore()
  const defaultWarehouseId = warehouses[0]?.id ?? ''

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(location, defaultWarehouseId),
  })

  useEffect(() => {
    if (open) reset(toDefaults(location, defaultWarehouseId))
  }, [open, location, defaultWarehouseId, reset])

  // useWatch (not watch()) so the suggested code and golden hint stay live and
  // React-Compiler-safe.
  const watched = useWatch({ control })
  const watchedType = (watched.type ?? 'pick') as LocationType
  const suggestedCode = buildLocationCode({
    zone: watched.zone ?? '',
    aisle: watched.aisle,
    rack: watched.rack,
    level: watched.level,
    position: watched.position,
  })
  const goldenEligible = isGoldenEligible(
    {
      type: watchedType,
      distanceToDispatchM: parseFloat(watched.distanceToDispatchM ?? '') || 0,
      accessibilityScore: parseFloat(watched.accessibilityScore ?? '') || 0,
    },
    settings
  )

  const availableRacks = rackTypes.filter(
    (r) =>
      r.active &&
      (r.compatibleLocationTypes.length === 0 || r.compatibleLocationTypes.includes(watchedType))
  )

  const onSubmit = (values: FormValues) => {
    try {
      const code = values.code.trim()
      const payload = {
        code,
        barcode: `LOC-${values.zone.trim()}-${code.replace(/-/g, '')}`,
        warehouseId: values.warehouseId,
        zone: values.zone.trim(),
        aisle: values.aisle?.trim() || undefined,
        rack: values.rack?.trim() || undefined,
        level: values.level?.trim() || undefined,
        position: values.position?.trim() || undefined,
        rackTypeId: values.rackTypeId === NONE_RACK ? undefined : values.rackTypeId,
        type: values.type as LocationType,
        isPickFace: values.isPickFace,
        golden: values.golden,
        isBlocked: location?.isBlocked ?? false,
        blockReasonId: location?.blockReasonId,
        accessibilityScore: Math.max(0, Math.min(100, parseInt(values.accessibilityScore, 10) || 0)),
        distanceToDispatchM: Math.max(0, parseFloat(values.distanceToDispatchM) || 0),
        maxWeightKg: Math.max(0, parseFloat(values.maxWeightKg) || 0),
        volumeCapacityM3: Math.max(0, parseFloat(values.volumeCapacityM3) || 0),
        maxVolumeM3: location?.maxVolumeM3 ?? Math.max(0, parseFloat(values.volumeCapacityM3) || 0),
        routeCode: location?.routeCode,
      }
      if (location) updateLocation(location.id, payload)
      else createLocation(payload)
      onClose()
    } catch (e: unknown) {
      setError('root', { message: e instanceof Error ? e.message : 'Error al guardar la ubicación' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{location ? 'Editar ubicación' : 'Nueva ubicación'}</DialogTitle>
          <DialogDescription>
            Modelo jerárquico: almacén → zona → pasillo → rack → nivel → posición. El código se puede
            generar desde la jerarquía.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="loc-wh">Almacén</FieldLabel>
              <Controller
                control={control}
                name="warehouseId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="loc-wh">
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
              <FieldError errors={[errors.warehouseId]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="loc-type">Tipo de ubicación</FieldLabel>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="loc-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {LOCATION_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.type]} />
            </Field>
          </div>

          {/* Jerarquía */}
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Jerarquía
            </p>
            <div className="grid grid-cols-5 gap-2">
              <Field>
                <FieldLabel htmlFor="loc-zone" className="text-xs">Zona</FieldLabel>
                <Input id="loc-zone" placeholder="A" {...register('zone')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="loc-aisle" className="text-xs">Pasillo</FieldLabel>
                <Input id="loc-aisle" placeholder="01" {...register('aisle')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="loc-rack" className="text-xs">Rack</FieldLabel>
                <Input id="loc-rack" placeholder="A" {...register('rack')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="loc-level" className="text-xs">Nivel</FieldLabel>
                <Input id="loc-level" placeholder="1" {...register('level')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="loc-position" className="text-xs">Posición</FieldLabel>
                <Input id="loc-position" placeholder="01" {...register('position')} />
              </Field>
            </div>
            <FieldError errors={[errors.zone]} />
          </div>

          {/* Código */}
          <div className="flex items-end gap-2">
            <Field className="flex-1">
              <FieldLabel htmlFor="loc-code">Código</FieldLabel>
              <Input id="loc-code" placeholder="A-01-A-1-01" className="font-mono" {...register('code')} />
              <FieldError errors={[errors.code]} />
            </Field>
            <Button
              type="button"
              variant="outline"
              disabled={!suggestedCode}
              onClick={() => setValue('code', suggestedCode, { shouldValidate: true })}
            >
              <Sparkles className="mr-1.5 size-3.5" />
              Sugerir
            </Button>
          </div>

          {/* Rack + flags */}
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="loc-racktype">Tipo de estiba</FieldLabel>
              <Controller
                control={control}
                name="rackTypeId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="loc-racktype">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_RACK}>Sin asignar</SelectItem>
                      {availableRacks.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <div className="flex items-end gap-6 pb-1.5">
              <Controller
                control={control}
                name="isPickFace"
                render={({ field }) => (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    Pick-face
                  </label>
                )}
              />
              <Controller
                control={control}
                name="golden"
                render={({ field }) => (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    <span className="flex items-center gap-1">
                      <Star className="size-3.5 text-amber-500" /> Golden
                    </span>
                  </label>
                )}
              />
            </div>
          </div>

          {/* Atributos numéricos */}
          <div className="grid grid-cols-4 gap-3">
            <Field>
              <FieldLabel htmlFor="loc-acc" className="text-xs">Accesibilidad</FieldLabel>
              <Input id="loc-acc" type="number" min={0} max={100} {...register('accessibilityScore')} />
              <FieldError errors={[errors.accessibilityScore]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="loc-dist" className="text-xs">Dist. despacho (m)</FieldLabel>
              <Input id="loc-dist" type="number" min={0} {...register('distanceToDispatchM')} />
              <FieldError errors={[errors.distanceToDispatchM]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="loc-weight" className="text-xs">Peso máx (kg)</FieldLabel>
              <Input id="loc-weight" type="number" min={0} {...register('maxWeightKg')} />
              <FieldError errors={[errors.maxWeightKg]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="loc-vol" className="text-xs">Capacidad (m³)</FieldLabel>
              <Input id="loc-vol" type="number" min={0} step={0.5} {...register('volumeCapacityM3')} />
              <FieldError errors={[errors.volumeCapacityM3]} />
            </Field>
          </div>

          {/* Golden eligibility hint */}
          {watchedType === 'pick' && (
            <div
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-2 text-xs',
                goldenEligible
                  ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'border-zinc-200 bg-zinc-50 text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900/40'
              )}
            >
              <Star className={cn('size-3.5', goldenEligible ? 'fill-amber-400 text-amber-400' : 'text-zinc-400')} />
              {goldenEligible
                ? `Cumple los umbrales golden (dist ≤ ${settings.goldenMaxDistanceM} m y accesibilidad ≥ ${settings.goldenMinAccessibility}).`
                : `No cumple los umbrales golden (dist ≤ ${settings.goldenMaxDistanceM} m y accesibilidad ≥ ${settings.goldenMinAccessibility}).`}
            </div>
          )}

          {errors.root && <p className="text-destructive text-sm">{errors.root.message}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">{location ? 'Guardar cambios' : 'Crear ubicación'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
