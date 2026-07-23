'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  Box,
  ClipboardCheck,
  PackageCheck,
  Pencil,
  Ruler,
  ShieldAlert,
  Snowflake,
  Tag,
  Trash2,
  type LucideIcon,
} from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
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
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { PackingBoxType, PackingRule, WmsSettings } from '@/types/wms'
import { CreateRuleDialog } from '../packing/_components/create-rule-dialog'
import { BoxDialog } from './_components/box-dialog'

// ── Reusable layout bits (mirror /yard-settings, /picking-settings) ──

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
      <Icon className="text-muted-foreground size-4" />
      {title}
    </h3>
    <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
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
      <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
)

const InlineSlider = ({
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  format?: (v: number) => string
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
      {format ? format(value) : value}
    </span>
  </div>
)

const PackingSettingsPage = () => {
  const state = useWmsStore()
  const {
    settings,
    packingOrders,
    packingRules,
    packingBoxTypes,
    updateSettings,
    togglePackingRule,
    deletePackingRule,
    deletePackingBox,
  } = state

  const [localSettings, setLocalSettings] = useState<WmsSettings>({ ...settings })
  const [settingsChanged, setSettingsChanged] = useState(false)

  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<PackingRule | undefined>(undefined)
  const [ruleToDelete, setRuleToDelete] = useState<PackingRule | null>(null)

  const [boxDialogOpen, setBoxDialogOpen] = useState(false)
  const [editingBox, setEditingBox] = useState<PackingBoxType | undefined>(undefined)
  const [boxToDelete, setBoxToDelete] = useState<PackingBoxType | null>(null)

  const handleSettingChange = (key: keyof WmsSettings, value: number | boolean) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
    setSettingsChanged(true)
  }

  const handleSaveSettings = () => {
    updateSettings(localSettings)
    setSettingsChanged(false)
    toast.success('Configuración de packing guardada')
  }

  const handleToggleFreeze = () => {
    const next = !settings.packingFreezeActive
    updateSettings({ packingFreezeActive: next })
    setLocalSettings((prev) => ({ ...prev, packingFreezeActive: next }))
    toast[next ? 'warning' : 'success'](next ? 'Packing congelado' : 'Packing reactivado')
  }

  const openRuleCreate = () => {
    setEditingRule(undefined)
    setRuleDialogOpen(true)
  }
  const openRuleEdit = (rule: PackingRule) => {
    setEditingRule(rule)
    setRuleDialogOpen(true)
  }
  const confirmDeleteRule = () => {
    if (!ruleToDelete) return
    deletePackingRule(ruleToDelete.id)
    toast.success(`Regla ${ruleToDelete.code} eliminada`)
    setRuleToDelete(null)
  }

  const openBoxCreate = () => {
    setEditingBox(undefined)
    setBoxDialogOpen(true)
  }
  const openBoxEdit = (box: PackingBoxType) => {
    setEditingBox(box)
    setBoxDialogOpen(true)
  }
  const confirmDeleteBox = () => {
    if (!boxToDelete) return
    deletePackingBox(boxToDelete.id)
    toast.success(`Caja ${boxToDelete.code} eliminada`)
    setBoxToDelete(null)
  }

  // KPIs derived from packing orders
  const kpis = useMemo(() => {
    const pending = packingOrders.filter((p) => p.status === 'pending').length
    const inProgress = packingOrders.filter((p) => p.status === 'in_progress').length
    const mismatch = packingOrders.filter((p) => p.verificationStatus === 'mismatch').length
    const labelled = packingOrders.filter((p) => p.labelGenerated).length
    return { pending, inProgress, mismatch, labelled }
  }, [packingOrders])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración de Packing"
        description="Parámetros y gobierno del módulo de embalaje — cartonización, verificación de contenido, catálogo de cajas y reglas de empaque. Los cambios aquí afectan de inmediato lo que se ve en /packing."
      />

      {/* ── KPI row + freeze ─────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card
          className={cn(
            'border-2',
            kpis.mismatch === 0
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/40'
              : 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40'
          )}
        >
          <CardContent className="pt-5">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Discrepancias</p>
            <p
              className={cn(
                'mt-1 text-4xl font-bold tabular-nums',
                kpis.mismatch === 0
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-red-700 dark:text-red-300'
              )}
            >
              {kpis.mismatch}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Órdenes con contenido no verificado</p>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardContent className="flex items-start gap-4 pt-5">
            <Snowflake
              className={cn(
                'mt-0.5 size-8 shrink-0',
                settings.packingFreezeActive ? 'text-blue-500' : 'text-zinc-300'
              )}
            />
            <div className="flex-1">
              <p className="text-sm font-medium">Modo congelado</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Bloquea iniciar, escanear, completar, aplicar reglas, elegir caja, etiquetar y enviar a despacho.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Switch checked={settings.packingFreezeActive} onCheckedChange={handleToggleFreeze} />
                <span className="text-sm">{settings.packingFreezeActive ? 'Activo' : 'Inactivo'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">En cola / progreso</p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-amber-600 dark:text-amber-300">
              {kpis.pending + kpis.inProgress}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{kpis.labelled} etiquetadas</p>
          </CardContent>
        </Card>
      </div>

      {settings.packingFreezeActive && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/40">
          <Snowflake className="size-5 shrink-0 text-blue-600 dark:text-blue-300" />
          <p className="flex-1 text-sm text-blue-800 dark:text-blue-300">
            Con packing congelado, ve a <span className="font-semibold">/packing</span> e intenta iniciar o escanear una orden — verás el bloqueo en vivo.
          </p>
        </div>
      )}

      <Separator />

      {/* ── Parameters ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-sm">Parámetros del módulo</CardTitle>
              <CardDescription>Cartonización y gobierno de la verificación de contenido.</CardDescription>
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
              icon={Box}
              title="Cartonización"
              description="Cómo el sistema sugiere la caja al empacar (suggestBox) según peso y volumen del bulto."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow
                label="Sugerir caja automáticamente"
                description="En /packing, propone la caja más pequeña que encaje por peso y volumen."
              >
                <Switch
                  checked={localSettings.packingAutoBoxSuggestion}
                  onCheckedChange={(v) => handleSettingChange('packingAutoBoxSuggestion', v)}
                />
              </SettingRow>
              <SettingRow
                label="Margen de seguridad de caja"
                description="Fracción de la capacidad nominal que se reserva al sugerir la caja (0.10 = usar solo el 90%)."
              >
                <InlineSlider
                  value={localSettings.packingBoxSafetyMargin}
                  min={0}
                  max={0.4}
                  step={0.05}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onChange={(v) => handleSettingChange('packingBoxSafetyMargin', v)}
                />
              </SettingRow>
            </div>
          </section>

          <section className="pt-5">
            <SectionHeading
              icon={ClipboardCheck}
              title="Verificación y etiqueta"
              description="Última barrera de calidad: qué se exige antes de cerrar un packing y generar la etiqueta."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow
                label="Exigir escaneo completo (1:1)"
                description="No se puede completar el packing hasta escanear todo lo esperado — bloquea discrepancias."
              >
                <Switch
                  checked={localSettings.packingRequireFullScan}
                  onCheckedChange={(v) => handleSettingChange('packingRequireFullScan', v)}
                />
              </SettingRow>
              <SettingRow
                label="Permitir cierre con discrepancia"
                description="Deja cerrar un packing con mismatch (queda marcado). Ignorado si se exige escaneo completo."
              >
                <Switch
                  checked={localSettings.packingAllowMismatch}
                  onCheckedChange={(v) => handleSettingChange('packingAllowMismatch', v)}
                />
              </SettingRow>
              <SettingRow
                label="Generar etiqueta automáticamente"
                description="Al verificar el packing, la etiqueta de envío se genera sin paso manual adicional."
              >
                <Switch
                  checked={localSettings.packingAutoGenerateLabel}
                  onCheckedChange={(v) => handleSettingChange('packingAutoGenerateLabel', v)}
                />
              </SettingRow>
            </div>
          </section>
        </CardContent>
      </Card>

      {/* ── Box catalogue ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Ruler className="size-4" /> Catálogo de cajas ({packingBoxTypes.length})
              </CardTitle>
              <CardDescription>Contenedores disponibles para cartonización.</CardDescription>
            </div>
            <Button size="sm" onClick={openBoxCreate}>
              + Nueva caja
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {packingBoxTypes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Box className="size-8 text-zinc-300" />
              <p className="text-muted-foreground text-sm">Sin cajas configuradas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-right">Peso máx.</TableHead>
                    <TableHead className="text-right">Volumen</TableHead>
                    <TableHead>Dimensiones</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packingBoxTypes.map((box) => (
                    <TableRow key={box.id}>
                      <TableCell className="font-mono text-xs font-semibold text-zinc-500">{box.code}</TableCell>
                      <TableCell className="font-medium">{box.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{box.maxWeightKg} kg</TableCell>
                      <TableCell className="text-right tabular-nums">{box.volumeM3} m³</TableCell>
                      <TableCell className="tabular-nums text-zinc-500">{box.dimensionsCm} cm</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" className="size-7 p-0" onClick={() => openBoxEdit(box)}>
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="size-7 p-0 text-red-500 hover:text-red-700"
                            onClick={() => setBoxToDelete(box)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Rule catalogue ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldAlert className="size-4" /> Reglas de empaque ({packingRules.length})
              </CardTitle>
              <CardDescription>Manejo condicional por tipo de producto (frágil, líquido, frío…).</CardDescription>
            </div>
            <Button size="sm" onClick={openRuleCreate}>
              + Nueva regla
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {packingRules.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <ShieldAlert className="size-8 text-zinc-300" />
              <p className="text-muted-foreground text-sm">Sin reglas configuradas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Disparador</TableHead>
                    <TableHead>Nota etiqueta</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packingRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-mono text-xs font-semibold text-zinc-500">{rule.code}</TableCell>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{rule.trigger}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-amber-700 dark:text-amber-400">
                        <span className="flex items-center gap-1">
                          <Tag className="size-3 shrink-0" /> {rule.labelNote}
                        </span>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => togglePackingRule(rule.id)}
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
                            rule.active
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-zinc-300'
                          )}
                        >
                          {rule.active ? 'Activa' : 'Inactiva'}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" className="size-7 p-0" onClick={() => openRuleEdit(rule)}>
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="size-7 p-0 text-red-500 hover:text-red-700"
                            onClick={() => setRuleToDelete(rule)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateRuleDialog open={ruleDialogOpen} onClose={() => setRuleDialogOpen(false)} rule={editingRule} />
      <BoxDialog
        key={editingBox?.id ?? 'new'}
        open={boxDialogOpen}
        onClose={() => setBoxDialogOpen(false)}
        box={editingBox}
      />

      <Dialog open={!!ruleToDelete} onOpenChange={(o) => { if (!o) setRuleToDelete(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="size-5 text-red-500" /> Eliminar regla
            </DialogTitle>
            <DialogDescription>
              ¿Eliminar la regla <span className="font-semibold">{ruleToDelete?.code}</span> — {ruleToDelete?.name}? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleToDelete(null)}>Cancelar</Button>
            <Button onClick={confirmDeleteRule} className="bg-red-600 hover:bg-red-700">
              <Trash2 className="mr-1 size-4" /> Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!boxToDelete} onOpenChange={(o) => { if (!o) setBoxToDelete(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Box className="size-5 text-red-500" /> Eliminar caja
            </DialogTitle>
            <DialogDescription>
              ¿Eliminar la caja <span className="font-semibold">{boxToDelete?.code}</span> — {boxToDelete?.name}? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBoxToDelete(null)}>Cancelar</Button>
            <Button onClick={confirmDeleteBox} className="bg-red-600 hover:bg-red-700">
              <Trash2 className="mr-1 size-4" /> Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default PackingSettingsPage
