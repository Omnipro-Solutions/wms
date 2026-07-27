'use client'

import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
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
import { defaultFieldsForType, resolveLabelTemplate } from '@/lib/rules/label-templates'
import { LabelPreview } from '@/app/(app)/labels/_components/zpl-preview-dialog'
import type {
  LabelField,
  LabelFieldKey,
  LabelSizePreset,
  LabelSymbology,
  LabelTemplate,
  LabelType,
  WmsLabel,
} from '@/types/wms'

const TYPE_LABELS: Record<LabelType, string> = {
  product: 'Producto',
  location: 'Ubicación',
  box: 'Caja',
  pallet: 'Pallet',
  shipping: 'Despacho',
  return: 'Devolución',
  receipt: 'Recepción',
  lpn: 'LPN',
}

const SIZE_LABELS: Record<LabelSizePreset, string> = {
  '4x2': '4×2 pulg (102×51 mm)',
  '4x6': '4×6 pulg (102×152 mm)',
  '3x2': '3×2 pulg (76×51 mm)',
  '2x1': '2×1 pulg (51×25 mm)',
}

const SYMBOLOGY_LABELS: Record<LabelSymbology, string> = {
  code128: 'Code 128 (1D, interno)',
  'gs1-128': 'GS1-128 (1D, lote/vencimiento embebidos)',
  qr: 'QR (2D)',
  datamatrix: 'DataMatrix (2D)',
}

const FIELD_LABELS: Record<LabelFieldKey, string> = {
  reference: 'Referencia',
  lot: 'Lote',
  expirationDate: 'Vencimiento',
  quantity: 'Cantidad',
  poNumber: 'Orden de compra',
  operator: 'Operario',
  date: 'Fecha',
  warehouse: 'Bodega',
  logo: 'Logo / marca',
}

const TYPES = Object.keys(TYPE_LABELS) as LabelType[]
const SIZES = Object.keys(SIZE_LABELS) as LabelSizePreset[]
const SYMBOLOGIES = Object.keys(SYMBOLOGY_LABELS) as LabelSymbology[]

// Sample values so the live preview shows realistic content.
const SAMPLE_VALUES: Partial<Record<LabelFieldKey, string>> = {
  reference: 'REF-0012',
  lot: 'L-2026-07',
  expirationDate: '2026-12-31',
  quantity: '12',
  poNumber: 'OC-4471',
  operator: 'Demo',
  date: '2026-07-27',
  warehouse: 'CD Bogotá',
}

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  type: z.string().min(1),
  warehouseId: z.string(),
  sizePreset: z.string().min(1),
  dpi: z.string().min(1),
  symbology: z.string().min(1),
  autoPrint: z.boolean(),
  fields: z.array(z.object({ key: z.string(), enabled: z.boolean(), order: z.number() })),
})

type FormValues = z.infer<typeof schema>

const toDefaults = (template: LabelTemplate | null): FormValues => ({
  name: template?.name ?? '',
  type: template?.type ?? 'product',
  warehouseId: template?.warehouseId ?? '',
  sizePreset: template?.sizePreset ?? '4x2',
  dpi: String(template?.dpi ?? 203),
  symbology: template?.symbology ?? 'code128',
  autoPrint: template?.autoPrint ?? false,
  fields: template?.fields ?? defaultFieldsForType('product'),
})

interface Props {
  open: boolean
  template: LabelTemplate | null
  onClose: () => void
}

export const LabelTemplateDialog = ({ open, template, onClose }: Props) => {
  const { warehouses, labelTemplates, createLabelTemplate, updateLabelTemplate } = useWmsStore()
  const isEdit = template !== null

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
    defaultValues: toDefaults(template),
  })

  useEffect(() => {
    if (open) reset(toDefaults(template))
  }, [open, template, reset])

  const values = useWatch({ control }) as FormValues
  const selectedType = (values.type ?? 'product') as LabelType

  // On create, when the type changes, clone the global template of that type as a starting point.
  useEffect(() => {
    if (!open || isEdit) return
    const global = resolveLabelTemplate(labelTemplates, selectedType)
    if (global) {
      setValue('sizePreset', global.sizePreset)
      setValue('dpi', String(global.dpi))
      setValue('symbology', global.symbology)
      setValue('autoPrint', global.autoPrint)
      setValue('fields', global.fields)
    } else {
      setValue('fields', defaultFieldsForType(selectedType))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, open, isEdit])

  const onSubmit = (v: FormValues) => {
    try {
      const payload = {
        name: v.name.trim(),
        type: v.type as LabelType,
        warehouseId: v.warehouseId || undefined,
        sizePreset: v.sizePreset as LabelSizePreset,
        dpi: Number(v.dpi) as LabelTemplate['dpi'],
        symbology: v.symbology as LabelSymbology,
        fields: v.fields as LabelField[],
        autoPrint: v.autoPrint,
        isDefault: template ? template.isDefault : !v.warehouseId,
      }
      if (template) updateLabelTemplate(template.id, payload)
      else createLabelTemplate(payload)
      onClose()
    } catch (e: unknown) {
      setError('root', {
        message: e instanceof Error ? e.message : 'Error al guardar la plantilla',
      })
    }
  }

  // Build a preview template + fake label from the current form values.
  const previewTemplate: LabelTemplate = {
    id: 'preview',
    name: values.name ?? '',
    type: selectedType,
    warehouseId: values.warehouseId || undefined,
    sizePreset: (values.sizePreset ?? '4x2') as LabelSizePreset,
    dpi: Number(values.dpi ?? 203) as LabelTemplate['dpi'],
    symbology: (values.symbology ?? 'code128') as LabelSymbology,
    fields: (values.fields ?? []) as LabelField[],
    autoPrint: values.autoPrint ?? false,
    isDefault: false,
    createdAt: '',
    updatedAt: '',
  }
  const previewLabel: WmsLabel = {
    id: 'preview',
    code: `${selectedType.toUpperCase()}-0001`,
    type: selectedType,
    reference: SAMPLE_VALUES.reference as string,
    status: 'pending',
    createdAt: '2026-07-27T00:00:00.000Z',
    createdBy: 'Demo',
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar plantilla' : 'Nueva plantilla de etiqueta'}</DialogTitle>
          <DialogDescription>
            Define tamaño, densidad, simbología y qué campos imprime la etiqueta. Una plantilla por
            bodega sobrescribe la plantilla global de ese tipo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1fr_auto]">
          <form id="label-template-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Field>
              <FieldLabel htmlFor="lt-name">Nombre</FieldLabel>
              <Input id="lt-name" placeholder="Recepción — CD Bogotá" {...register('name')} />
              <FieldError errors={[errors.name]} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="lt-type">Tipo de etiqueta</FieldLabel>
                <Controller
                  control={control}
                  name="type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
                      <SelectTrigger id="lt-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="lt-warehouse">Ámbito</FieldLabel>
                <Controller
                  control={control}
                  name="warehouseId"
                  render={({ field }) => (
                    <Select
                      value={field.value || 'global'}
                      onValueChange={(v) => field.onChange(v === 'global' ? '' : v)}
                      disabled={isEdit}
                    >
                      <SelectTrigger id="lt-warehouse">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">Global (todas las bodegas)</SelectItem>
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

            <div className="grid gap-3 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="lt-size">Tamaño</FieldLabel>
                <Controller
                  control={control}
                  name="sizePreset"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="lt-size">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SIZES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {SIZE_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="lt-dpi">Densidad</FieldLabel>
                <Controller
                  control={control}
                  name="dpi"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="lt-dpi">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="203">203 dpi</SelectItem>
                        <SelectItem value="300">300 dpi</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="lt-sym">Simbología</FieldLabel>
                <Controller
                  control={control}
                  name="symbology"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="lt-sym">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SYMBOLOGIES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {SYMBOLOGY_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="mb-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                Campos visibles
              </p>
              <Controller
                control={control}
                name="fields"
                render={({ field }) => (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {field.value.map((f, i) => (
                      <div key={f.key} className="flex items-center gap-2">
                        <Switch
                          id={`lt-field-${f.key}`}
                          checked={f.enabled}
                          onCheckedChange={(checked) => {
                            const next = field.value.map((x, xi) =>
                              xi === i ? { ...x, enabled: checked } : x
                            )
                            field.onChange(next)
                          }}
                        />
                        <Label htmlFor={`lt-field-${f.key}`} className="text-sm">
                          {FIELD_LABELS[f.key as LabelFieldKey]}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              />
            </div>

            <div className="flex items-center gap-3">
              <Controller
                control={control}
                name="autoPrint"
                render={({ field }) => (
                  <Switch
                    id="lt-autoprint"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="lt-autoprint" className="text-sm">
                Auto-impresión (genera la etiqueta en su evento disparador)
              </Label>
            </div>

            {errors.root && <p className="text-destructive text-sm">{errors.root.message}</p>}
          </form>

          {/* Live preview */}
          <div className="space-y-2">
            <p className="text-muted-foreground text-center text-xs font-medium tracking-wide uppercase">
              Vista previa
            </p>
            <LabelPreview label={previewLabel} template={previewTemplate} values={SAMPLE_VALUES} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="label-template-form">
            {isEdit ? 'Guardar cambios' : 'Crear plantilla'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
