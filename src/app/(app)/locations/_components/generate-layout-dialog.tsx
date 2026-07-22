'use client'

import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Grid3x3 } from 'lucide-react'

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
import { LOCATION_TYPE_LABELS } from '@/lib/rules/locations'
import type { LocationType } from '@/types/wms'

const LOCATION_TYPES = Object.keys(LOCATION_TYPE_LABELS) as LocationType[]
const NONE_RACK = '__none__'

const num = z.string().min(1, 'Requerido')
const schema = z.object({
  zone: z.string().min(1, 'Requerido'),
  type: z.string().min(1),
  rackTypeId: z.string(),
  aisles: num,
  racksPerAisle: num,
  levelsPerRack: num,
  positionsPerLevel: num,
  isPickFace: z.boolean(),
  maxWeightKg: num,
  maxVolumeM3: num,
  baseDistanceToDispatchM: num,
  baseAccessibilityScore: num,
})

type FormValues = z.infer<typeof schema>

const DEFAULTS: FormValues = {
  zone: 'C',
  type: 'pick',
  rackTypeId: NONE_RACK,
  aisles: '2',
  racksPerAisle: '3',
  levelsPerRack: '2',
  positionsPerLevel: '2',
  isPickFace: true,
  maxWeightKg: '25',
  maxVolumeM3: '2',
  baseDistanceToDispatchM: '20',
  baseAccessibilityScore: '70',
}

interface Props {
  open: boolean
  warehouseId: string
  onClose: () => void
}

export const GenerateLayoutDialog = ({ open, warehouseId, onClose }: Props) => {
  const { rackTypes, generateLocations } = useWmsStore()
  const [result, setResult] = useState<number | null>(null)

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: DEFAULTS })

  // Reset on close (not in an effect) so each reopen starts fresh.
  const handleClose = () => {
    reset(DEFAULTS)
    setResult(null)
    onClose()
  }

  const watched = useWatch({ control })
  const total =
    (parseInt(watched.aisles ?? '0', 10) || 0) *
    (parseInt(watched.racksPerAisle ?? '0', 10) || 0) *
    (parseInt(watched.levelsPerRack ?? '0', 10) || 0) *
    (parseInt(watched.positionsPerLevel ?? '0', 10) || 0)

  const availableRacks = rackTypes.filter((r) => r.active)

  const onSubmit = (values: FormValues) => {
    try {
      const created = generateLocations({
        warehouseId,
        zone: values.zone.trim(),
        type: values.type as LocationType,
        rackTypeId: values.rackTypeId === NONE_RACK ? undefined : values.rackTypeId,
        aisles: Math.max(1, parseInt(values.aisles, 10) || 1),
        racksPerAisle: Math.max(1, parseInt(values.racksPerAisle, 10) || 1),
        levelsPerRack: Math.max(1, parseInt(values.levelsPerRack, 10) || 1),
        positionsPerLevel: Math.max(1, parseInt(values.positionsPerLevel, 10) || 1),
        isPickFace: values.isPickFace,
        maxWeightKg: Math.max(0, parseFloat(values.maxWeightKg) || 0),
        maxVolumeM3: Math.max(0, parseFloat(values.maxVolumeM3) || 0),
        baseDistanceToDispatchM: Math.max(0, parseFloat(values.baseDistanceToDispatchM) || 0),
        baseAccessibilityScore: Math.max(0, Math.min(100, parseInt(values.baseAccessibilityScore, 10) || 0)),
      })
      setResult(created.length)
    } catch (e: unknown) {
      setError('root', { message: e instanceof Error ? e.message : 'Error al generar el layout' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generar layout</DialogTitle>
          <DialogDescription>
            Crea de una vez todas las posiciones de una zona: pasillos × racks × niveles × posiciones.
            La accesibilidad y la distancia se estiman por nivel y profundidad de pasillo.
          </DialogDescription>
        </DialogHeader>

        {result !== null ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Grid3x3 className="size-5 shrink-0" />
              {result > 0
                ? `Se generaron ${result} posiciones nuevas. Míralas en el mapa.`
                : 'No se generaron posiciones nuevas (los códigos ya existían).'}
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Listo</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <Field>
                <FieldLabel htmlFor="gen-zone">Zona</FieldLabel>
                <Input id="gen-zone" placeholder="C" {...register('zone')} />
                <FieldError errors={[errors.zone]} />
              </Field>
              <Field className="col-span-2">
                <FieldLabel htmlFor="gen-type">Tipo de ubicación</FieldLabel>
                <Controller
                  control={control}
                  name="type"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="gen-type">
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
              </Field>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <Field>
                <FieldLabel htmlFor="gen-aisles" className="text-xs">Pasillos</FieldLabel>
                <Input id="gen-aisles" type="number" min={1} {...register('aisles')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="gen-racks" className="text-xs">Racks/pasillo</FieldLabel>
                <Input id="gen-racks" type="number" min={1} {...register('racksPerAisle')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="gen-levels" className="text-xs">Niveles/rack</FieldLabel>
                <Input id="gen-levels" type="number" min={1} {...register('levelsPerRack')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="gen-pos" className="text-xs">Pos./nivel</FieldLabel>
                <Input id="gen-pos" type="number" min={1} {...register('positionsPerLevel')} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="gen-racktype">Tipo de estiba</FieldLabel>
              <Controller
                control={control}
                name="rackTypeId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="gen-racktype">
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

            <div className="grid grid-cols-4 gap-3">
              <Field>
                <FieldLabel htmlFor="gen-acc" className="text-xs">Accesib. base</FieldLabel>
                <Input id="gen-acc" type="number" min={0} max={100} {...register('baseAccessibilityScore')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="gen-dist" className="text-xs">Dist. base (m)</FieldLabel>
                <Input id="gen-dist" type="number" min={0} {...register('baseDistanceToDispatchM')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="gen-weight" className="text-xs">Peso máx (kg)</FieldLabel>
                <Input id="gen-weight" type="number" min={0} {...register('maxWeightKg')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="gen-vol" className="text-xs">Capacidad (m³)</FieldLabel>
                <Input id="gen-vol" type="number" min={0} step={0.5} {...register('maxVolumeM3')} />
              </Field>
            </div>

            <div className="flex items-center gap-3">
              <Controller
                control={control}
                name="isPickFace"
                render={({ field }) => (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    Marcar como pick-face
                  </label>
                )}
              />
            </div>

            <div className="rounded-md border bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900/40">
              Se crearán <span className="font-semibold tabular-nums">{total}</span> posiciones en la zona{' '}
              <span className="font-mono font-semibold">{watched.zone || '—'}</span>.
            </div>

            {errors.root && <p className="text-destructive text-sm">{errors.root.message}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={total === 0}>
                Generar {total > 0 ? `(${total})` : ''}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
