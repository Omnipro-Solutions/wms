'use client'

import { useMemo, useState } from 'react'
import { MapPin, MoreHorizontal, Pencil, Plus, Snowflake, Trash2, Zap, ClipboardCheck } from 'lucide-react'

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { describeDirective, isHardDirective } from '@/lib/rules/slotting'
import { cn } from '@/lib/utils'
import type { PutawayRule } from '@/types/wms'
import { PutawayRuleDialog } from './_components/putaway-rule-dialog'

const describeCondition = (rule: PutawayRule): string => {
  switch (rule.matchType) {
    case 'category':
      return `Categoría = ${rule.matchValue}`
    case 'abcClass':
      return `Clase ABC = ${rule.matchValue}`
    case 'weightAboveKg':
      return `Peso ≥ ${rule.matchValue} kg`
    case 'trackBy':
      return `Trazabilidad = ${rule.matchValue === 'serial' ? 'Serie' : rule.matchValue === 'lot' ? 'Lote' : 'Sin trazabilidad'}`
  }
}

export default function PutawaySettingsPage() {
  const state = useWmsStore()
  const {
    settings,
    putawayRules,
    locations,
    asnRecords,
    updateSettings,
    togglePutawayRule,
    deletePutawayRule,
  } = state

  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<PutawayRule | null>(null)
  const [deletingRule, setDeletingRule] = useState<PutawayRule | null>(null)

  const activeRules = putawayRules.filter((r) => r.active)
  const hazardApprovedCount = useMemo(() => locations.filter((l) => l.hazardApproved).length, [locations])
  const coldChainCount = useMemo(
    () => locations.filter((l) => l.temperatureZone && l.temperatureZone !== 'ambient').length,
    [locations]
  )
  const pendingPutawayCount = useMemo(
    () =>
      asnRecords.filter(
        (a) =>
          (a.status === 'completed' || a.status === 'partial' || a.status === 'short_received') &&
          !a.requiresQualityControl
      ).length,
    [asnRecords]
  )

  const handleOpenCreate = () => {
    setEditingRule(null)
    setRuleDialogOpen(true)
  }
  const handleOpenEdit = (rule: PutawayRule) => {
    setEditingRule(rule)
    setRuleDialogOpen(true)
  }
  const handleConfirmDelete = () => {
    if (deletingRule) deletePutawayRule(deletingRule.id)
    setDeletingRule(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración de Almacenamiento y Putaway"
        description="Gobierno del módulo de putaway: congelamiento, reglas de ubicación (zona/tipo/ABC/capacidad) y visibilidad de las restricciones siempre activas (hazmat, cadena de frío, mezcla de lotes). Los cambios afectan /receiving → Putaway staging al instante."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <ClipboardCheck className="size-3.5" /> Pendientes de putaway
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{pendingPutawayCount}</p>
            <p className="mt-1 text-xs text-zinc-500">ASNs listas para ubicar</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <Zap className="size-3.5" /> Reglas activas
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{activeRules.length}</p>
            <p className="mt-1 text-xs text-zinc-500">de {putawayRules.length} reglas configuradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <Zap className="size-3.5" /> Aprobadas hazmat
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{hazardApprovedCount}</p>
            <p className="mt-1 text-xs text-zinc-500">de {locations.length} ubicaciones</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <Snowflake className="size-3.5" /> Cadena de frío
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{coldChainCount}</p>
            <p className="mt-1 text-xs text-zinc-500">ubicaciones con temperatura controlada</p>
          </CardContent>
        </Card>
      </div>

      <Card
        className={cn(
          settings.putawayFreezeActive && 'border-red-300 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20'
        )}
      >
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Congelar operaciones de putaway</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Bloquea confirmar ubicación (putawayItem) y asignar operario. No afecta la
              configuración de reglas — puedes seguir ajustándolas mientras el módulo está congelado.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {settings.putawayFreezeActive && (
              <Badge variant="outline" className="border-red-300 bg-red-100 text-red-700">
                Congelado
              </Badge>
            )}
            <Switch
              checked={settings.putawayFreezeActive}
              onCheckedChange={(v) => updateSettings({ putawayFreezeActive: v })}
              aria-label="Congelar putaway"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Recepción ciega</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Oculta la cantidad esperada al operario mientras cuenta y arranca el contador en
                cero. Evita el sesgo de confirmación. La validación contra lo esperado no cambia.
              </p>
            </div>
            <Switch
              checked={settings.receivingBlindEnabled}
              onCheckedChange={(v) => updateSettings({ receivingBlindEnabled: v })}
              aria-label="Activar recepción ciega"
            />
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Unidades de carga (LPN)</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Agrega el paso de paletizado al flujo de recepción móvil. Con LPN, un escaneo mueve
                toda la unidad; sin él, el putaway opera sobre stock suelto.
              </p>
            </div>
            <Switch
              checked={settings.lpnEnabled}
              onCheckedChange={(v) => updateSettings({ lpnEnabled: v })}
              aria-label="Activar unidades de carga"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <MapPin className="size-4" />
                Reglas de putaway
              </CardTitle>
              <CardDescription>
                Directivas de ubicación por zona/tipo/ABC. Las restricciones de hazmat, cadena de
                frío y mezcla de lotes están siempre activas y no se configuran aquí — dependen de
                los atributos del producto/ubicación editados en /admin y /locations.
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleOpenCreate}>
              <Plus className="mr-1.5 size-3.5" />
              Nueva regla
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {putawayRules.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Zap className="size-8 text-zinc-300" />
              <p className="text-sm text-muted-foreground">
                Sin reglas configuradas. La sugerencia usa solo la clasificación ABC/XYZ y las
                restricciones siempre activas.
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
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...putawayRules]
                  .sort((a, b) => b.priority - a.priority)
                  .map((rule) => (
                    <TableRow key={rule.id} className="border-border/60">
                      <TableCell className="max-w-[280px]">
                        <p className="text-sm font-medium">{rule.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{rule.code}</p>
                      </TableCell>
                      <TableCell className="text-sm">{describeCondition(rule)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {rule.directives.map((d, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className={cn('gap-1 font-normal', isHardDirective(d) && 'border-dashed')}
                            >
                              {describeDirective(d)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{rule.priority}</TableCell>
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
                            onCheckedChange={() => togglePutawayRule(rule.id)}
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
                              <DropdownMenuItem onClick={() => togglePutawayRule(rule.id)}>
                                {rule.active ? 'Desactivar' : 'Activar'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setDeletingRule(rule)}>
                                <Trash2 className="mr-2 size-3.5" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PutawayRuleDialog open={ruleDialogOpen} rule={editingRule} onClose={() => setRuleDialogOpen(false)} />

      <Dialog open={deletingRule !== null} onOpenChange={(o) => !o && setDeletingRule(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar regla</DialogTitle>
            <DialogDescription>
              ¿Eliminar la regla «{deletingRule?.name}»? La sugerencia de putaway dejará de
              considerarla. Esta acción no se puede deshacer.
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
