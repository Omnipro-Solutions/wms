'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  Pencil,
  Route,
  ShieldAlert,
  Snowflake,
  Timer,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { PickingZoneConfig } from '@/types/wms'

const SectionHeading = ({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Timer
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
  children: React.ReactNode
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
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
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
    <span className="w-14 shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-right text-sm font-semibold tabular-nums dark:bg-zinc-800">
      {value}
    </span>
  </div>
)

const ZONE_BLANK = { name: '', sequenceOrder: 1 }

export default function PickingSettingsPage() {
  const state = useWmsStore()
  const { settings, pickingTasks, updateSettings } = state

  const [localSettings, setLocalSettings] = useState({ ...settings })
  const [settingsChanged, setSettingsChanged] = useState(false)

  const [zoneDialogOpen, setZoneDialogOpen] = useState(false)
  const [zoneEditId, setZoneEditId] = useState<string | null>(null)
  const [zoneForm, setZoneForm] = useState(ZONE_BLANK)
  const [zoneFormError, setZoneFormError] = useState('')

  const handleSettingChange = (key: keyof typeof settings, value: number | boolean) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
    setSettingsChanged(true)
  }

  const handleSaveSettings = () => {
    updateSettings(localSettings)
    setSettingsChanged(false)
  }

  const handleToggleFreeze = () => {
    const next = !settings.pickingFreezeActive
    updateSettings({ pickingFreezeActive: next })
    setLocalSettings((prev) => ({ ...prev, pickingFreezeActive: next }))
  }

  const openZoneCreate = () => {
    setZoneEditId(null)
    setZoneForm({ name: '', sequenceOrder: localSettings.pickingZones.length + 1 })
    setZoneFormError('')
    setZoneDialogOpen(true)
  }

  const openZoneEdit = (zone: PickingZoneConfig) => {
    setZoneEditId(zone.id)
    setZoneForm({ name: zone.name, sequenceOrder: zone.sequenceOrder })
    setZoneFormError('')
    setZoneDialogOpen(true)
  }

  const handleSaveZone = () => {
    if (!zoneForm.name.trim()) {
      setZoneFormError('El nombre es obligatorio')
      return
    }
    const nextZones = zoneEditId
      ? localSettings.pickingZones.map((z) =>
          z.id === zoneEditId ? { ...z, name: zoneForm.name.trim(), sequenceOrder: zoneForm.sequenceOrder } : z
        )
      : [
          ...localSettings.pickingZones,
          {
            id: `pz-${Date.now()}`,
            name: zoneForm.name.trim(),
            sequenceOrder: zoneForm.sequenceOrder,
            active: true,
          },
        ]
    const updatedZones = [...nextZones].sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    setLocalSettings((prev) => ({ ...prev, pickingZones: updatedZones }))
    updateSettings({ pickingZones: updatedZones })
    setZoneDialogOpen(false)
  }

  const handleToggleZone = (zoneId: string) => {
    const updatedZones = localSettings.pickingZones.map((z) =>
      z.id === zoneId ? { ...z, active: !z.active } : z
    )
    setLocalSettings((prev) => ({ ...prev, pickingZones: updatedZones }))
    updateSettings({ pickingZones: updatedZones })
  }

  const issueCount = useMemo(
    () => pickingTasks.filter((t) => t.status === 'with_issue').length,
    [pickingTasks]
  )
  const activeStrategyCount = useMemo(
    () =>
      pickingTasks.filter((t) => t.status === 'in_progress' || t.status === 'assigned').length,
    [pickingTasks]
  )
  const urgentCount = useMemo(
    () => pickingTasks.filter((t) => t.priority === 'high' && t.status !== 'completed').length,
    [pickingTasks]
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración de Picking"
        description="Parámetros y gobierno del módulo de picking — SLA de prioridad, agrupación, excepciones y zonas de pick-and-pass. Los cambios aquí afectan de inmediato lo que se ve en /picking."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card
          className={cn(
            'border-2',
            issueCount === 0
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/40'
              : 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40'
          )}
        >
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Incidencias abiertas</p>
            <p
              className={cn(
                'mt-1 text-4xl font-bold tabular-nums',
                issueCount === 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'
              )}
            >
              {issueCount}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Tareas en estado &ldquo;Con incidencia&rdquo;</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-4 pt-5">
            <Snowflake className={cn('mt-0.5 size-8 shrink-0', settings.pickingFreezeActive ? 'text-blue-500' : 'text-zinc-300')} />
            <div className="flex-1">
              <p className="sm font-medium">Modo congelado</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Bloquea iniciar, completar, aprobar/rechazar y reportar incidencias.</p>
              <div className="mt-3 flex items-center gap-2">
                <Switch checked={settings.pickingFreezeActive} onCheckedChange={handleToggleFreeze} />
                <span className="text-sm">{settings.pickingFreezeActive ? 'Activo' : 'Inactivo'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Tareas activas / urgentes</p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-amber-600 dark:text-amber-300">{activeStrategyCount}</p>
            <p className="mt-1 text-xs text-zinc-500">{urgentCount} con prioridad alta</p>
          </CardContent>
        </Card>
      </div>

      {settings.pickingFreezeActive && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/40">
          <Snowflake className="size-5 shrink-0 text-blue-600 dark:text-blue-300" />
          <p className="flex-1 text-sm text-blue-800 dark:text-blue-300">
            Con picking congelado, ve a <span className="font-semibold">/picking</span> e intenta iniciar o registrar un pick — verás el bloqueo en vivo.
          </p>
        </div>
      )}

      <Separator />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-sm">Parámetros del módulo</CardTitle>
              <CardDescription>SLA de prioridad, umbrales de agrupación y gobierno de excepciones.</CardDescription>
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
              icon={Timer}
              title="SLA y prioridad"
              description="Horas restantes hasta el despacho que disparan la prioridad sugerida al crear una tarea, oleada u orden waveless."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow label="Prioridad alta (horas)" description="Menos de N horas para el despacho → prioridad alta.">
                <InlineSlider
                  value={localSettings.pickingSlaUrgentHours}
                  min={1}
                  max={48}
                  step={1}
                  onChange={(v) => handleSettingChange('pickingSlaUrgentHours', v)}
                />
              </SettingRow>
              <SettingRow label="Prioridad media (horas)" description="Menos de N horas para el despacho → prioridad media.">
                <InlineSlider
                  value={localSettings.pickingSlaWarningHours}
                  min={1}
                  max={96}
                  step={1}
                  onChange={(v) => handleSettingChange('pickingSlaWarningHours', v)}
                />
              </SettingRow>
            </div>
          </section>

          <section className="py-5">
            <SectionHeading
              icon={Boxes}
              title="Agrupación (wave, batch, cluster)"
              description="Umbrales sugeridos para decidir qué estrategia usar — no se aplican automáticamente."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow label="Mínimo de órdenes para oleada" description="Por debajo de este número conviene picking waveless.">
                <InlineSlider
                  value={localSettings.pickingWaveMinOrders}
                  min={1}
                  max={50}
                  step={1}
                  onChange={(v) => handleSettingChange('pickingWaveMinOrders', v)}
                />
              </SettingRow>
              <SettingRow label="Mínimo de órdenes para batch" description="Órdenes del mismo SKU+ubicación para agrupar en un solo viaje.">
                <InlineSlider
                  value={localSettings.pickingBatchMinOrders}
                  min={2}
                  max={20}
                  step={1}
                  onChange={(v) => handleSettingChange('pickingBatchMinOrders', v)}
                />
              </SettingRow>
              <SettingRow label="Máximo contenedores por cluster" description="Techo operativo de un picker con múltiples pedidos simultáneos.">
                <InlineSlider
                  value={localSettings.pickingClusterMaxContainers}
                  min={2}
                  max={16}
                  step={1}
                  onChange={(v) => handleSettingChange('pickingClusterMaxContainers', v)}
                />
              </SettingRow>
            </div>
          </section>

          <section className="pt-5">
            <SectionHeading
              icon={ShieldAlert}
              title="Excepciones"
              description="Gobierna el dialog de 'Reportar incidencia' en /picking y en la app del operario."
            />
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <SettingRow label="Exigir foto" description="La incidencia no se puede guardar sin una foto adjunta.">
                <Switch
                  checked={localSettings.pickingRequireIssuePhoto}
                  onCheckedChange={(v) => handleSettingChange('pickingRequireIssuePhoto', v)}
                />
              </SettingRow>
              <SettingRow label="Permitir sustitución" description="El operario puede sugerir un producto sustituto al reportar falta de stock.">
                <Switch
                  checked={localSettings.pickingAllowSubstitution}
                  onCheckedChange={(v) => handleSettingChange('pickingAllowSubstitution', v)}
                />
              </SettingRow>
            </div>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Route className="size-4" /> Zonas de picking ({localSettings.pickingZones.length})
              </CardTitle>
              <CardDescription>Orden de paso para picking por zona (pick-and-pass).</CardDescription>
            </div>
            <Button size="sm" onClick={openZoneCreate}>
              + Nueva zona
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {localSettings.pickingZones.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <ClipboardList className="size-8 text-zinc-300" />
              <p className="text-sm text-muted-foreground">Sin zonas configuradas.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Orden</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {localSettings.pickingZones.map((zone) => (
                  <TableRow key={zone.id}>
                    <TableCell className="tabular-nums">{zone.sequenceOrder}</TableCell>
                    <TableCell className="font-medium">{zone.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          zone.active
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-zinc-300'
                        )}
                      >
                        {zone.active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openZoneEdit(zone)}>
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={cn('h-7 px-2 text-xs', zone.active ? 'text-red-500 hover:text-red-700' : 'text-emerald-600 hover:text-emerald-800')}
                          onClick={() => handleToggleZone(zone.id)}
                        >
                          {zone.active ? 'Desactivar' : 'Activar'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={zoneDialogOpen} onOpenChange={(o) => { if (!o) setZoneDialogOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Route className="size-4 text-blue-600" />
              {zoneEditId ? 'Editar zona' : 'Nueva zona de picking'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {zoneEditId ? 'Editar zona existente' : 'Crear nueva zona de picking'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="zone-name">Nombre <span className="text-destructive">*</span></Label>
              <Input
                id="zone-name"
                placeholder="Ej: Zona D — Alto valor"
                value={zoneForm.name}
                onChange={(e) => setZoneForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zone-order">Orden de secuencia</Label>
              <Input
                id="zone-order"
                type="number"
                min={1}
                value={zoneForm.sequenceOrder}
                onChange={(e) => setZoneForm((p) => ({ ...p, sequenceOrder: Number(e.target.value) }))}
              />
            </div>
            {zoneFormError && (
              <p className="flex items-center gap-1 text-sm text-destructive">
                <AlertTriangle className="size-3" /> {zoneFormError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setZoneDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveZone}>{zoneEditId ? 'Guardar cambios' : 'Crear zona'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
