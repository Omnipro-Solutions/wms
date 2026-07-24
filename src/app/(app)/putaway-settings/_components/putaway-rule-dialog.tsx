'use client'

import { useEffect, useMemo } from 'react'
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type UseFormSetValue,
} from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, X } from 'lucide-react'

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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { SLOTTING_DIRECTIVE_LABELS, SLOTTING_MATCH_TYPE_LABELS, SLOTTING_TIER_LABELS } from '@/lib/rules/slotting'
import { LOCATION_TYPE_LABELS } from '@/lib/rules/locations'
import type {
  AbcClass,
  LocationType,
  Product,
  PutawayDirective,
  PutawayDirectiveKind,
  PutawayRule,
  PutawayRuleMatchType,
  SlottingTier,
} from '@/types/wms'

const MATCH_TYPES = Object.keys(SLOTTING_MATCH_TYPE_LABELS) as PutawayRuleMatchType[]
const TIERS = Object.keys(SLOTTING_TIER_LABELS) as SlottingTier[]
const DIRECTIVE_KINDS = Object.keys(SLOTTING_DIRECTIVE_LABELS) as PutawayDirectiveKind[]
const LOCATION_TYPES = Object.keys(LOCATION_TYPE_LABELS) as LocationType[]
const ABC_CLASSES: AbcClass[] = ['A', 'B', 'C']
const TRACK_BY_LABELS: Record<Product['trackBy'], string> = {
  none: 'Sin trazabilidad',
  lot: 'Lote',
  serial: 'Serie',
}

const KINDS_WITHOUT_VALUE = new Set<PutawayDirectiveKind>([
  'requireGolden',
  'forbidGolden',
  'requireRackCompatible',
])

type DirectiveRow = { kind: PutawayDirectiveKind; value: string }

const toRow = (d: PutawayDirective): DirectiveRow => {
  switch (d.kind) {
    case 'preferTier':
      return { kind: d.kind, value: d.tier }
    case 'requireLocationType':
      return { kind: d.kind, value: d.locationType }
    case 'requireZone':
      return { kind: d.kind, value: d.zone }
    case 'maxLevel':
      return { kind: d.kind, value: String(d.level) }
    default:
      return { kind: d.kind, value: '' }
  }
}

const toTypedDirective = (row: DirectiveRow): PutawayDirective | null => {
  switch (row.kind) {
    case 'preferTier':
      return row.value ? { kind: 'preferTier', tier: row.value as SlottingTier } : null
    case 'requireLocationType':
      return row.value ? { kind: 'requireLocationType', locationType: row.value as LocationType } : null
    case 'requireZone':
      return row.value.trim() ? { kind: 'requireZone', zone: row.value.trim() } : null
    case 'maxLevel': {
      const n = parseInt(row.value, 10)
      return Number.isFinite(n) && n >= 0 ? { kind: 'maxLevel', level: n } : null
    }
    case 'requireGolden':
      return { kind: 'requireGolden' }
    case 'forbidGolden':
      return { kind: 'forbidGolden' }
    case 'requireRackCompatible':
      return { kind: 'requireRackCompatible' }
    default:
      return null
  }
}

const schema = z.object({
  code: z.string().min(1, 'Requerido'),
  name: z.string().min(1, 'Requerido'),
  description: z.string().optional(),
  matchType: z.string().min(1, 'Requerido'),
  matchValue: z.string().min(1, 'Requerido'),
  priority: z.string().min(1, 'Requerido'),
  active: z.boolean(),
  directives: z
    .array(z.object({ kind: z.string(), value: z.string() }))
    .min(1, 'Agrega al menos una directiva'),
})

type FormValues = z.infer<typeof schema>

const toDefaults = (rule: PutawayRule | null): FormValues => ({
  code: rule?.code ?? '',
  name: rule?.name ?? '',
  description: rule?.description ?? '',
  matchType: rule?.matchType ?? 'category',
  matchValue: rule?.matchValue ?? '',
  priority: String(rule?.priority ?? 50),
  active: rule?.active ?? true,
  directives: rule?.directives.map(toRow) ?? [{ kind: 'requireZone', value: '' }],
})

const DirectiveRowFields = ({
  control,
  index,
  zones,
  setValue,
  onRemove,
}: {
  control: Control<FormValues>
  index: number
  zones: string[]
  setValue: UseFormSetValue<FormValues>
  onRemove: () => void
}) => {
  const kind = useWatch({ control, name: `directives.${index}.kind` }) as PutawayDirectiveKind
  const hasValue = !KINDS_WITHOUT_VALUE.has(kind)

  const renderValue = () => {
    if (kind === 'maxLevel') {
      return (
        <Controller
          control={control}
          name={`directives.${index}.value`}
          render={({ field }) => (
            <Input type="number" min={0} placeholder="2" className="w-24" {...field} />
          )}
        />
      )
    }

    const options =
      kind === 'preferTier'
        ? TIERS.map((t) => ({ value: t, label: SLOTTING_TIER_LABELS[t] }))
        : kind === 'requireLocationType'
          ? LOCATION_TYPES.map((t) => ({ value: t, label: LOCATION_TYPE_LABELS[t] }))
          : zones.map((z) => ({ value: z, label: `Zona ${z}` }))

    return (
      <Controller
        control={control}
        name={`directives.${index}.value`}
        render={({ field }) => (
          <Select onValueChange={field.onChange} value={field.value}>
            <SelectTrigger className="min-w-40">
              <SelectValue placeholder="Valor…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Controller
        control={control}
        name={`directives.${index}.kind`}
        render={({ field }) => (
          <Select
            value={field.value}
            onValueChange={(v) => {
              field.onChange(v)
              setValue(`directives.${index}.value`, '')
            }}
          >
            <SelectTrigger className="min-w-52 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIRECTIVE_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {SLOTTING_DIRECTIVE_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {hasValue ? renderValue() : <span className="text-xs text-muted-foreground">sin valor</span>}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="size-8 shrink-0 p-0 text-muted-foreground"
        onClick={onRemove}
        aria-label="Quitar directiva"
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}

interface Props {
  open: boolean
  rule: PutawayRule | null
  onClose: () => void
}

export const PutawayRuleDialog = ({ open, rule, onClose }: Props) => {
  const { products, locations, createPutawayRule, updatePutawayRule } = useWmsStore()

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    [products]
  )
  const zones = useMemo(
    () => Array.from(new Set(locations.map((l) => l.zone))).sort(),
    [locations]
  )

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
    defaultValues: toDefaults(rule),
  })

  const directivesArray = useFieldArray({ control, name: 'directives' })

  useEffect(() => {
    if (open) reset(toDefaults(rule))
  }, [open, rule, reset])

  const matchType = useWatch({ control, name: 'matchType' }) as PutawayRuleMatchType

  const onSubmit = (values: FormValues) => {
    try {
      const directives = values.directives
        .map((r) => toTypedDirective(r as DirectiveRow))
        .filter((d): d is PutawayDirective => d !== null)

      if (directives.length !== values.directives.length) {
        setError('directives', { message: 'Completa el valor de todas las directivas.' })
        return
      }

      const payload = {
        code: values.code.trim(),
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        matchType: values.matchType as PutawayRuleMatchType,
        matchValue: values.matchValue.trim(),
        directives,
        priority: Math.max(0, parseInt(values.priority, 10) || 0),
        active: values.active,
      }
      if (rule) updatePutawayRule(rule.id, payload)
      else createPutawayRule(payload)
      onClose()
    } catch (e: unknown) {
      setError('root', {
        message: e instanceof Error ? e.message : 'Error al guardar la regla',
      })
    }
  }

  const renderMatchValue = () => {
    if (matchType === 'weightAboveKg') {
      return (
        <Input
          id="pwr-value"
          type="number"
          min={0}
          step="0.1"
          placeholder="60"
          {...register('matchValue')}
        />
      )
    }

    const options =
      matchType === 'category'
        ? categories.map((c) => ({ value: c, label: c }))
        : matchType === 'abcClass'
          ? ABC_CLASSES.map((c) => ({ value: c, label: `Clase ${c}` }))
          : (Object.keys(TRACK_BY_LABELS) as Product['trackBy'][]).map((t) => ({
              value: t,
              label: TRACK_BY_LABELS[t],
            }))

    return (
      <Controller
        control={control}
        name="matchValue"
        render={({ field }) => (
          <Select onValueChange={field.onChange} value={field.value}>
            <SelectTrigger id="pwr-value">
              <SelectValue placeholder="Selecciona…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{rule ? 'Editar regla de putaway' : 'Nueva regla de putaway'}</DialogTitle>
          <DialogDescription>
            Una regla aplica a los productos que hacen match una preferencia de zona (blanda) y/o
            restricciones duras de destino. Su efecto se ve al instante en la sugerencia de
            /receiving → Putaway staging.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="pwr-code">Código</FieldLabel>
              <Input id="pwr-code" placeholder="PWR-04" {...register('code')} />
              <FieldError errors={[errors.code]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="pwr-priority">Prioridad</FieldLabel>
              <Input id="pwr-priority" type="number" min={0} {...register('priority')} />
              <FieldError errors={[errors.priority]} />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="pwr-name">Nombre</FieldLabel>
            <Input id="pwr-name" placeholder="Electrónica siempre en zona A" {...register('name')} />
            <FieldError errors={[errors.name]} />
          </Field>

          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Condición — si el producto cumple
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="pwr-match">Atributo</FieldLabel>
                <Controller
                  control={control}
                  name="matchType"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v)
                        setValue('matchValue', '')
                      }}
                    >
                      <SelectTrigger id="pwr-match">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MATCH_TYPES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {SLOTTING_MATCH_TYPE_LABELS[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="pwr-value">
                  {matchType === 'weightAboveKg' ? 'Umbral (kg)' : 'Valor'}
                </FieldLabel>
                {renderMatchValue()}
                <FieldError errors={[errors.matchValue]} />
              </Field>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Entonces — directivas de destino
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => directivesArray.append({ kind: 'requireZone', value: '' })}
              >
                <Plus className="mr-1.5 size-3.5" />
                Directiva
              </Button>
            </div>
            <div className="space-y-2">
              {directivesArray.fields.map((f, i) => (
                <DirectiveRowFields
                  key={f.id}
                  control={control}
                  index={i}
                  zones={zones}
                  setValue={setValue}
                  onRemove={() => directivesArray.remove(i)}
                />
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              «Preferir zona» es una preferencia blanda. El resto son restricciones duras: un
              candidato que las viola nunca se sugiere ni se acepta al confirmar el putaway.
            </p>
            <FieldError errors={[errors.directives?.root ?? errors.directives]} />
          </div>

          <Field>
            <FieldLabel htmlFor="pwr-desc">Descripción</FieldLabel>
            <Textarea id="pwr-desc" rows={2} placeholder="Motivo de negocio de la regla…" {...register('description')} />
          </Field>

          <div className="flex items-center gap-3">
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <Switch id="pwr-active" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label htmlFor="pwr-active" className="text-sm">
              Activa (afecta la sugerencia y validación de putaway)
            </Label>
          </div>

          {errors.root && <p className="text-destructive text-sm">{errors.root.message}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">{rule ? 'Guardar cambios' : 'Crear regla'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
