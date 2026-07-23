'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  Boxes,
  Layers,
  Lightbulb,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Ruler,
  Star,
  Trash2,
  TrendingUp,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import {
  abcByProduct,
  xyzByProduct,
  selectSlottingRecommendations,
  selectSlottingRuleMatches,
} from '@/store/selectors'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  describeDirective,
  isHardDirective,
  SLOTTING_MATCH_TYPE_LABELS,
  SLOTTING_TIER_LABELS,
} from '@/lib/rules/slotting'
import { cn } from '@/lib/utils'
import type { SlottingRule, SlottingTier } from '@/types/wms'
import { SlottingRuleDialog } from './_components/slotting-rule-dialog'

// ── Reusable layout bits (mirror /location-settings) ──────────────────────────

const SectionHeading = ({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) => (
  <div>
    <h3 className="flex items-center gap-2 text-sm font-semibold">
      <Icon className="size-4 text-muted-foreground" />
      {title}
    </h3>
    <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
  </div>
)

const SettingRow = ({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: ReactNode
}) => (
  <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="sm:max-w-[60%]">
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
)

const InlineSlider = ({
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  onChange: (value: number) => void
}) => (
  <div className="flex items-center gap-3">
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="h-1.5 w-40 cursor-pointer accent-zinc-800 sm:w-48 dark:accent-zinc-300"
    />
    <span className="w-16 shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-right text-sm font-semibold tabular-nums dark:bg-zinc-800">
      {value}
      {suffix ? <span className="text-muted-foreground ml-0.5 text-xs">{suffix}</span> : null}
    </span>
  </div>
)

const StatCard = ({
  icon: Icon,
  label,
  value,
  sublabel,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  sublabel: string
  tone: 'neutral' | 'amber' | 'blue' | 'green'
}) => {
  const toneClass = {
    neutral: 'text-zinc-500',
    amber: 'text-amber-600 dark:text-amber-300',
    blue: 'text-blue-600 dark:text-blue-300',
    green: 'text-emerald-600 dark:text-emerald-300',
  }[tone]
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          <Icon className="size-3.5" />
          {label}
        </p>
        <p className={cn('mt-1 text-3xl font-bold tabular-nums', toneClass)}>{value}</p>
        <p className="mt-1 text-xs text-zinc-500">{sublabel}</p>
      </CardContent>
    </Card>
  )
}

// ── Slotting-specific helpers ───────────────────────────────────────────────────

const TIER_BADGE: Record<SlottingTier, { className: string; icon: LucideIcon }> = {
  golden: {
    className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300',
    icon: Star,
  },
  standard: {
    className: 'text-muted-foreground',
    icon: MapPin,
  },
  remote: {
    className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300',
    icon: MapPin,
  },
}

const describeCondition = (rule: SlottingRule): string => {
  switch (rule.matchType) {
    case 'category':
      return `Categoría = ${rule.matchValue}`
    case 'abcClass':
      return `Clase ABC = ${rule.matchValue}`
    case 'weightAboveKg':
      return `Peso ≥ ${rule.matchValue} kg`
    case 'trackBy':
      return `Trazabilidad = ${rule.matchValue === 'serial' ? 'Serie' : rule.matchValue === 'lot' ? 'Lote' : 'Sin trazabilidad'}`
    default:
      return SLOTTING_MATCH_TYPE_LABELS[rule.matchType]
  }
}

// Renders a rule's directives as chips: the soft preferTier gets its tier color,
// hard constraints get a neutral outline chip.
const DirectiveChips = ({ rule }: { rule: SlottingRule }) => (
  <div className="flex flex-wrap gap-1">
    {rule.directives.map((d, i) => {
      if (d.kind === 'preferTier') {
        const badge = TIER_BADGE[d.tier]
        const Icon = badge.icon
        return (
          <Badge key={i} variant="outline" className={cn('gap-1', badge.className)}>
            <Icon className={cn('size-3', d.tier === 'golden' && 'fill-amber-400 text-amber-400')} />
            {SLOTTING_TIER_LABELS[d.tier]}
          </Badge>
        )
      }
      return (
        <Badge
          key={i}
          variant="outline"
          className={cn(
            'gap-1 font-normal',
            isHardDirective(d) && 'border-dashed text-zinc-600 dark:text-zinc-300'
          )}
        >
          {describeDirective(d)}
        </Badge>
      )
    })}
  </div>
)

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SlottingSettingsPage() {
  const state = useWmsStore()
  const { products, settings, slottingRules, updateSettings, toggleSlottingRule, deleteSlottingRule } =
    state

  const [localSettings, setLocalSettings] = useState({ ...settings })
  const [settingsChanged, setSettingsChanged] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<SlottingRule | null>(null)
  const [deletingRule, setDeletingRule] = useState<SlottingRule | null>(null)

  const handleSettingChange = (key: keyof typeof settings, value: number) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
    setSettingsChanged(true)
    setSaveError(null)
  }

  const handleSaveSettings = () => {
    if (localSettings.abcThresholdA >= localSettings.abcThresholdB) {
      setSaveError('El corte de clase A debe ser menor que el de clase B.')
      return
    }
    if (localSettings.xyzCvX >= localSettings.xyzCvY) {
      setSaveError('El límite CV X/Y debe ser menor que el límite CV Y/Z.')
      return
    }
    updateSettings(localSettings)
    setSettingsChanged(false)
    setSaveError(null)
  }

  // Distributions + recommendations reflect SAVED settings (live effect).
  const abc = useMemo(() => abcByProduct(state), [state])
  const xyz = useMemo(() => xyzByProduct(state), [state])
  const recommendations = useMemo(() => selectSlottingRecommendations(state), [state])
  const ruleMatches = useMemo(() => selectSlottingRuleMatches(state), [state])

  const abcDist = useMemo(() => {
    const d = { A: 0, B: 0, C: 0 }
    for (const p of products) d[abc[p.id] ?? 'C']++
    return d
  }, [products, abc])

  const xyzDist = useMemo(() => {
    const d = { X: 0, Y: 0, Z: 0 }
    for (const p of products) d[xyz[p.id] ?? 'Z']++
    return d
  }, [products, xyz])

  const activeRules = slottingRules.filter((r) => r.active)
  const affectedByActive = useMemo(() => {
    const ids = new Set<string>()
    for (const r of activeRules) for (const pid of ruleMatches[r.id] ?? []) ids.add(pid)
    return ids.size
  }, [activeRules, ruleMatches])

  const handleOpenCreate = () => {
    setEditingRule(null)
    setRuleDialogOpen(true)
  }

  const handleOpenEdit = (rule: SlottingRule) => {
    setEditingRule(rule)
    setRuleDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (deletingRule) deleteSlottingRule(deletingRule.id)
    setDeletingRule(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración de Slotting"
        description="Gobierno de la optimización de ubicaciones — parámetros de clasificación ABC/XYZ, umbral de reposición y reglas de ubicación. Los cambios aquí recalculan las recomendaciones de /slotting al instante."
      />

      {/* ── KPI header ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Boxes}
          label="Clasificación ABC"
          value={
            <span className="flex items-baseline gap-2">
              <span>{abcDist.A}</span>
              <span className="text-lg text-zinc-400">/</span>
              <span>{abcDist.B}</span>
              <span className="text-lg text-zinc-400">/</span>
              <span>{abcDist.C}</span>
            </span>
          }
          sublabel={`A · B · C sobre ${products.length} productos`}
          tone="neutral"
        />
        <StatCard
          icon={Layers}
          label="Clasificación XYZ"
          value={
            <span className="flex items-baseline gap-2">
              <span>{xyzDist.X}</span>
              <span className="text-lg text-zinc-400">/</span>
              <span>{xyzDist.Y}</span>
              <span className="text-lg text-zinc-400">/</span>
              <span>{xyzDist.Z}</span>
            </span>
          }
          sublabel="X estable · Y variable · Z errático"
          tone="neutral"
        />
        <StatCard
          icon={Zap}
          label="Reglas activas"
          value={activeRules.length}
          sublabel={`de ${slottingRules.length} reglas · afectan ${affectedByActive} producto${affectedByActive !== 1 ? 's' : ''}`}
          tone={activeRules.length > 0 ? 'amber' : 'neutral'}
        />
        <StatCard
          icon={TrendingUp}
          label="Recomendaciones"
          value={recommendations.length}
          sublabel="oportunidades con la configuración actual"
          tone={recommendations.length > 0 ? 'blue' : 'green'}
        />
      </div>

      <Separator />

      {/* ── Parameters ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-sm">Parámetros de clasificación</CardTitle>
              <CardDescription>
                Definen los cortes ABC (Pareto sobre frecuencia de picking) y XYZ (variabilidad de la
                demanda), además del umbral de prioridad de reposición. Guarda para aplicarlos.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {settingsChanged && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  Cambios sin guardar
                </span>
              )}
              <Button size="sm" disabled={!settingsChanged} onClick={handleSaveSettings}>
                Guardar cambios
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="divide-y divide-zinc-200 dark:divide-zinc-800">
          <section className="pb-5">
            <SectionHeading
              icon={Boxes}
              title="Clasificación ABC (rotación)"
              description="Curva de Pareto sobre la frecuencia de picking. La clase A concentra la mayor rotación; la C, la menor."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow
                label="Corte de clase A"
                description="Los productos hasta este % acumulado de rotación son clase A (alta rotación)."
              >
                <InlineSlider
                  value={Math.round(localSettings.abcThresholdA * 100)}
                  min={50}
                  max={90}
                  step={1}
                  suffix="%"
                  onChange={(v) => handleSettingChange('abcThresholdA', v / 100)}
                />
              </SettingRow>
              <SettingRow
                label="Corte de clase B"
                description="Entre el corte A y este % acumulado son clase B; el resto, clase C."
              >
                <InlineSlider
                  value={Math.round(localSettings.abcThresholdB * 100)}
                  min={60}
                  max={99}
                  step={1}
                  suffix="%"
                  onChange={(v) => handleSettingChange('abcThresholdB', v / 100)}
                />
              </SettingRow>
            </div>
          </section>

          <section className="py-5">
            <SectionHeading
              icon={Layers}
              title="Clasificación XYZ (variabilidad)"
              description="Coeficiente de variación (desv. estándar / media) de la demanda. Bajo = estable (X); alto = errático (Z)."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow
                label="Límite CV — X / Y"
                description="CV por debajo de este valor clasifica como X (demanda muy estable)."
              >
                <InlineSlider
                  value={localSettings.xyzCvX}
                  min={0.1}
                  max={1.5}
                  step={0.05}
                  onChange={(v) => handleSettingChange('xyzCvX', v)}
                />
              </SettingRow>
              <SettingRow
                label="Límite CV — Y / Z"
                description="CV por encima de este valor clasifica como Z (demanda errática)."
              >
                <InlineSlider
                  value={localSettings.xyzCvY}
                  min={0.5}
                  max={2}
                  step={0.05}
                  onChange={(v) => handleSettingChange('xyzCvY', v)}
                />
              </SettingRow>
            </div>
          </section>

          <section className="pt-5">
            <SectionHeading
              icon={Ruler}
              title="Reposición"
              description="Umbral de prioridad para las tareas de reabastecimiento de pick-faces."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow
                label="Factor de prioridad alta"
                description="Un pick-face con stock por debajo de (mínimo × este %) se marca prioridad ALTA."
              >
                <InlineSlider
                  value={Math.round(localSettings.replenishmentHighFactor * 100)}
                  min={10}
                  max={90}
                  step={5}
                  suffix="%"
                  onChange={(v) => handleSettingChange('replenishmentHighFactor', v / 100)}
                />
              </SettingRow>
            </div>
          </section>

          {saveError && (
            <p className="pt-4 text-sm text-destructive">{saveError}</p>
          )}
        </CardContent>
      </Card>

      {/* ── Slotting rules ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Zap className="size-4" />
                Reglas de slotting
              </CardTitle>
              <CardDescription>
                Directivas de negocio que gobiernan la ubicación: una preferencia de zona (blanda) y/o
                restricciones duras. Si varias reglas aplican al mismo producto, se acumulan sus
                restricciones y gana la preferencia de mayor prioridad.
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleOpenCreate}>
              <Plus className="mr-1.5 size-3.5" />
              Nueva regla
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {slottingRules.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Zap className="size-8 text-zinc-300" />
              <p className="text-sm text-muted-foreground">
                Sin reglas configuradas. Las recomendaciones usan solo la clasificación ABC/XYZ.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Regla</TableHead>
                  <TableHead>Condición</TableHead>
                  <TableHead>Directivas</TableHead>
                  <TableHead className="text-right">Prioridad</TableHead>
                  <TableHead className="text-right">Afectados</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...slottingRules]
                  .sort((a, b) => b.priority - a.priority)
                  .map((rule) => {
                    const affected = ruleMatches[rule.id]?.length ?? 0
                    return (
                      <TableRow key={rule.id} className="border-border/60">
                        <TableCell className="max-w-[280px]">
                          <p className="text-sm font-medium">{rule.name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{rule.code}</p>
                          {rule.description && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {rule.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{describeCondition(rule)}</TableCell>
                        <TableCell>
                          <DirectiveChips rule={rule} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{rule.priority}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {affected}
                          <span className="ml-1 text-xs text-muted-foreground">
                            producto{affected !== 1 ? 's' : ''}
                          </span>
                        </TableCell>
                        <TableCell>
                          {rule.active ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                            >
                              Activa
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Inactiva
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Switch
                              checked={rule.active}
                              onCheckedChange={() => toggleSlottingRule(rule.id)}
                              aria-label={rule.active ? 'Desactivar regla' : 'Activar regla'}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" className="size-8 p-0">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenEdit(rule)}>
                                  <Pencil className="mr-2 size-3.5" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleSlottingRule(rule.id)}>
                                  {rule.active ? 'Desactivar' : 'Activar'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeletingRule(rule)}
                                >
                                  <Trash2 className="mr-2 size-3.5" />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── How rules work (help) ──────────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
        <Lightbulb className="mt-0.5 size-4 shrink-0" />
        <p>
          El algoritmo asigna cada producto a una <strong>zona ideal</strong> según su clase ABC/XYZ.
          Una regla activa <strong>reemplaza</strong> esa zona ideal para los productos que hace match
          — por ejemplo, forzar la electrónica de alto valor a la zona golden aunque su rotación no lo
          exija. Verifica el efecto en{' '}
          <a href="/slotting" className="font-medium underline underline-offset-2">
            /slotting → Recomendaciones
          </a>
          .
        </p>
      </div>

      <SlottingRuleDialog
        open={ruleDialogOpen}
        rule={editingRule}
        onClose={() => setRuleDialogOpen(false)}
      />

      {/* Delete confirmation */}
      <Dialog open={deletingRule !== null} onOpenChange={(o) => !o && setDeletingRule(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar regla</DialogTitle>
            <DialogDescription>
              ¿Eliminar la regla «{deletingRule?.name}»? Las recomendaciones dejarán de considerarla.
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingRule(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
