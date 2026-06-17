'use client'

import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Info,
  Pencil,
  PlusCircle,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useWmsStore } from '@/store/wms-store'
import type { PackingRule, PackingRuleTrigger } from '@/types/wms'

// ─── Trigger catalogue ────────────────────────────────────────────────────────

interface TriggerOption {
  value: PackingRuleTrigger
  label: string
  description: string
  color: string
  example: string
}

const TRIGGER_OPTIONS: TriggerOption[] = [
  {
    value: 'fragile',
    label: 'Frágil',
    description: 'Productos que se rompen o dañan fácilmente con golpes.',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    example: 'Espejos, cerámica, vidrio, electrónicos sin estuche.',
  },
  {
    value: 'liquid',
    label: 'Líquido',
    description: 'Contenido líquido que puede derramarse si la caja se vuelca.',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    example: 'Perfumes, aceites, bebidas, productos de limpieza.',
  },
  {
    value: 'heavy',
    label: 'Pesado',
    description: 'Artículos con peso mayor a 15 kg por unidad.',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    example: 'Maquinaria, herramientas, electrodomésticos grandes.',
  },
  {
    value: 'oversized',
    label: 'Sobredimensionado',
    description: 'Productos de gran tamaño que superan las dimensiones estándar de caja.',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    example: 'Muebles, colchones, televisores grandes.',
  },
  {
    value: 'cold_chain',
    label: 'Cadena de frío',
    description: 'Requiere temperatura controlada durante todo el tránsito.',
    color: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    example: 'Alimentos perecederos, medicamentos termolábiles.',
  },
  {
    value: 'high_value',
    label: 'Alto valor',
    description: 'Mercancía de alto costo que requiere seguridad adicional y firma en entrega.',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    example: 'Joyería, dispositivos de lujo, relojes, arte.',
  },
  {
    value: 'hazmat',
    label: 'Material peligroso',
    description: 'Sustancias clasificadas como peligrosas según normativa IATA o ADR.',
    color: 'bg-red-100 text-red-700 border-red-200',
    example: 'Aerosoles, baterías de litio, productos inflamables.',
  },
]

// ─── Requirement checkboxes ───────────────────────────────────────────────────

const REQUIREMENT_FIELDS = [
  {
    key: 'requiresBubbleWrap' as const,
    label: 'Burbuja de aire',
    hint: 'Envolver el producto en plástico burbuja antes de colocar en caja.',
  },
  {
    key: 'requiresDoublePacking' as const,
    label: 'Doble empaque',
    hint: 'Empacar dentro de una bolsa o caja interior antes de la caja exterior.',
  },
  {
    key: 'requiresDryIce' as const,
    label: 'Hielo seco / Gel frío',
    hint: 'Incluir elemento refrigerante para mantener temperatura durante el envío.',
  },
  {
    key: 'requiresVoidFill' as const,
    label: 'Relleno de vacíos',
    hint: 'Completar espacios vacíos con papel kraft, espuma o aire expandido.',
  },
]

// ─── Form types ───────────────────────────────────────────────────────────────

interface FormState {
  code: string
  name: string
  trigger: PackingRuleTrigger | ''
  description: string
  labelNote: string
  requiresBubbleWrap: boolean
  requiresDoublePacking: boolean
  requiresDryIce: boolean
  requiresVoidFill: boolean
}

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  trigger: '',
  description: '',
  labelNote: '',
  requiresBubbleWrap: false,
  requiresDoublePacking: false,
  requiresDryIce: false,
  requiresVoidFill: false,
}

const ruleToForm = (rule: PackingRule): FormState => ({
  code: rule.code,
  name: rule.name,
  trigger: rule.trigger,
  description: rule.description,
  labelNote: rule.labelNote,
  requiresBubbleWrap: rule.requiresBubbleWrap,
  requiresDoublePacking: rule.requiresDoublePacking,
  requiresDryIce: rule.requiresDryIce,
  requiresVoidFill: rule.requiresVoidFill,
})

// ─── Validation ───────────────────────────────────────────────────────────────

interface FormErrors {
  code?: string
  name?: string
  trigger?: string
  description?: string
  labelNote?: string
}

const validate = (form: FormState): FormErrors => {
  const errors: FormErrors = {}
  if (!form.code.trim()) errors.code = 'El código es obligatorio.'
  else if (!/^[A-Z0-9-]{2,12}$/.test(form.code.trim().toUpperCase()))
    errors.code = 'Solo letras mayúsculas, números y guiones. Máx. 12 caracteres.'
  if (!form.name.trim()) errors.name = 'El nombre es obligatorio.'
  else if (form.name.trim().length < 3) errors.name = 'Mínimo 3 caracteres.'
  if (!form.trigger) errors.trigger = 'Selecciona un disparador.'
  if (!form.description.trim()) errors.description = 'Agrega una descripción del procedimiento.'
  else if (form.description.trim().length < 10)
    errors.description = 'La descripción debe tener al menos 10 caracteres.'
  if (!form.labelNote.trim()) errors.labelNote = 'La nota de etiqueta es obligatoria.'
  return errors
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  /** Cuando se pasa, el dialog entra en modo edición. */
  rule?: PackingRule
}

export const CreateRuleDialog = ({ open, onClose, rule }: Props) => {
  const { createPackingRule, updatePackingRule } = useWmsStore()
  const isEditing = !!rule

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [touched, setTouched] = useState<Set<keyof FormState>>(new Set())

  // Populate form when opening in edit mode (or reset on close)
  useEffect(() => {
    if (open) {
      setForm(rule ? ruleToForm(rule) : EMPTY_FORM)
      setErrors({})
      setTouched(new Set())
      setSubmitError('')
    }
  }, [open, rule])

  const selectedTrigger = TRIGGER_OPTIONS.find((t) => t.value === form.trigger)

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setTouched((prev) => new Set(prev).add(key))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setSubmitError('')
  }

  const handleClose = () => {
    onClose()
  }

  const handleSubmit = () => {
    const validationErrors = validate(form)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      setTouched(new Set(Object.keys(EMPTY_FORM) as (keyof FormState)[]))
      return
    }
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        trigger: form.trigger as PackingRuleTrigger,
        description: form.description.trim(),
        labelNote: form.labelNote.trim(),
        requiresBubbleWrap: form.requiresBubbleWrap,
        requiresDoublePacking: form.requiresDoublePacking,
        requiresDryIce: form.requiresDryIce,
        requiresVoidFill: form.requiresVoidFill,
      }
      if (isEditing) {
        updatePackingRule(rule.id, payload)
      } else {
        createPackingRule({ ...payload, active: true })
      }
      handleClose()
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Error al guardar la regla.')
    }
  }

  const fieldError = (key: keyof FormErrors) =>
    touched.has(key) && errors[key] ? errors[key] : undefined

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? (
              <Pencil className="size-5 text-blue-500" />
            ) : (
              <ShieldAlert className="size-5 text-amber-500" />
            )}
            {isEditing ? `Editar regla — ${rule.code}` : 'Nueva regla de empaque'}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto space-y-5 py-1 pr-1">

          {/* Info banner — solo en creación */}
          {!isEditing && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
              <Info className="mt-0.5 size-4 shrink-0" />
              <p>
                Una regla define <strong>cómo empacar</strong> un tipo de producto.
                El <strong>disparador</strong> la activa automáticamente cuando el producto
                coincide. La <strong>nota de etiqueta</strong> se imprime en el paquete.
              </p>
            </div>
          )}

          {/* Código + Nombre */}
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rule-code">
                Código <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rule-code"
                placeholder="FRAG-02"
                maxLength={12}
                value={form.code}
                onChange={(e) => setField('code', e.target.value.toUpperCase())}
                onBlur={() => setTouched((p) => new Set(p).add('code'))}
                className={cn(fieldError('code') && 'border-destructive')}
              />
              {fieldError('code') ? (
                <p className="text-destructive text-xs">{fieldError('code')}</p>
              ) : (
                <p className="text-muted-foreground text-xs">Ej. FRAG-02, LIQ-03</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rule-name">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rule-name"
                placeholder="Producto frágil tipo B"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                onBlur={() => setTouched((p) => new Set(p).add('name'))}
                className={cn(fieldError('name') && 'border-destructive')}
              />
              {fieldError('name') ? (
                <p className="text-destructive text-xs">{fieldError('name')}</p>
              ) : (
                <p className="text-muted-foreground text-xs">Nombre corto y descriptivo.</p>
              )}
            </div>
          </div>

          {/* Disparador */}
          <div className="space-y-1.5">
            <Label htmlFor="rule-trigger">
              Disparador <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.trigger}
              onValueChange={(v) => setField('trigger', v as PackingRuleTrigger)}
            >
              <SelectTrigger
                id="rule-trigger"
                className={cn('w-full', fieldError('trigger') && 'border-destructive')}
              >
                <SelectValue placeholder="¿Cuándo se activa esta regla?" />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn('text-[10px]', t.color)}>
                        {t.label}
                      </Badge>
                      <span className="text-muted-foreground text-xs">{t.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError('trigger') && (
              <p className="text-destructive text-xs">{fieldError('trigger')}</p>
            )}
            {selectedTrigger && (
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2.5 text-xs space-y-1">
                <p className="font-medium text-zinc-700">{selectedTrigger.description}</p>
                <p className="text-muted-foreground">
                  <span className="font-medium">Ejemplos:</span> {selectedTrigger.example}
                </p>
              </div>
            )}
          </div>

          {/* Requisitos */}
          <div className="space-y-2">
            <Label>Requisitos de empaque</Label>
            <div className="grid grid-cols-2 gap-2">
              {REQUIREMENT_FIELDS.map((req) => (
                <label
                  key={req.key}
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors',
                    form[req.key]
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-zinc-200 hover:bg-zinc-50'
                  )}
                >
                  <Checkbox
                    checked={form[req.key]}
                    onCheckedChange={(checked) => setField(req.key, !!checked)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium leading-none">{req.label}</p>
                    <p className="text-muted-foreground text-xs">{req.hint}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Procedimiento */}
          <div className="space-y-1.5">
            <Label htmlFor="rule-description">
              Procedimiento de empaque <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="rule-description"
              rows={3}
              placeholder="Describe paso a paso cómo empacar este tipo de producto. Ej: Envolver en burbuja doble capa, sellar con cinta de seguridad en los 4 bordes..."
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              onBlur={() => setTouched((p) => new Set(p).add('description'))}
              className={cn(fieldError('description') && 'border-destructive')}
            />
            {fieldError('description') ? (
              <p className="text-destructive text-xs">{fieldError('description')}</p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Este texto lo verá el operador al empacar.
              </p>
            )}
          </div>

          {/* Nota etiqueta */}
          <div className="space-y-1.5">
            <Label htmlFor="rule-label-note">
              Nota en etiqueta <span className="text-destructive">*</span>
            </Label>
            <Input
              id="rule-label-note"
              placeholder="Ej. FRÁGIL – MANEJO CUIDADOSO"
              value={form.labelNote}
              onChange={(e) => setField('labelNote', e.target.value.toUpperCase())}
              onBlur={() => setTouched((p) => new Set(p).add('labelNote'))}
              className={cn(fieldError('labelNote') && 'border-destructive')}
            />
            {fieldError('labelNote') ? (
              <p className="text-destructive text-xs">{fieldError('labelNote')}</p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Texto corto impreso en la etiqueta de despacho (mayúsculas recomendadas).
              </p>
            )}
          </div>

          {/* Vista previa */}
          {(form.name || form.trigger || form.labelNote) && (
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Vista previa
              </p>
              <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {form.code && (
                    <span className="font-mono text-xs font-semibold text-zinc-500">
                      {form.code}
                    </span>
                  )}
                  {form.name && (
                    <span className="text-sm font-medium">{form.name}</span>
                  )}
                  {form.trigger && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px]',
                        TRIGGER_OPTIONS.find((t) => t.value === form.trigger)?.color
                      )}
                    >
                      {TRIGGER_OPTIONS.find((t) => t.value === form.trigger)?.label}
                    </Badge>
                  )}
                </div>
                {form.labelNote && (
                  <p className="text-xs font-bold text-amber-700 tracking-wide">
                    ⚠ {form.labelNote}
                  </p>
                )}
                {(form.requiresBubbleWrap || form.requiresDoublePacking || form.requiresDryIce || form.requiresVoidFill) && (
                  <div className="flex flex-wrap gap-1">
                    {form.requiresBubbleWrap && (
                      <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">Burbuja</Badge>
                    )}
                    {form.requiresDoublePacking && (
                      <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">Doble empaque</Badge>
                    )}
                    {form.requiresDryIce && (
                      <Badge variant="outline" className="text-[10px] bg-cyan-50 text-cyan-700 border-cyan-200">Hielo seco</Badge>
                    )}
                    {form.requiresVoidFill && (
                      <Badge variant="outline" className="text-[10px] bg-zinc-50 text-zinc-600 border-zinc-200">Relleno</Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {submitError && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <TriangleAlert className="size-4 shrink-0" />
              {submitError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            {isEditing ? (
              <><CheckCircle2 className="mr-1 size-4" /> Guardar cambios</>
            ) : (
              <><PlusCircle className="mr-1 size-4" /> Crear regla</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
