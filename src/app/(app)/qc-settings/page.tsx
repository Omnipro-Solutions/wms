'use client'

import { useMemo, useState } from 'react'
import { ClipboardCheck, MoreHorizontal, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
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
import { cn } from '@/lib/utils'
import type { QcRule } from '@/types/wms'
import { QcRuleDialog } from './_components/qc-rule-dialog'

const describeCondition = (rule: QcRule, productName?: string): string => {
  switch (rule.matchType) {
    case 'category':
      return `Categoría = ${rule.matchValue}`
    case 'supplier':
      return `Proveedor = ${rule.matchValue}`
    case 'product':
      return `Producto = ${productName ?? rule.matchValue}`
    case 'abc_class':
      return `Clase ABC = ${rule.matchValue}`
    case 'all':
      return 'Todas las recepciones'
  }
}

export default function QcSettingsPage() {
  const settings = useWmsStore((s) => s.settings)
  const qcRules = useWmsStore((s) => s.qcRules)
  const products = useWmsStore((s) => s.products)
  const asnRecords = useWmsStore((s) => s.asnRecords)
  const updateSettings = useWmsStore((s) => s.updateSettings)
  const updateQcRule = useWmsStore((s) => s.updateQcRule)
  const deleteQcRule = useWmsStore((s) => s.deleteQcRule)

  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<QcRule | null>(null)
  const [deletingRule, setDeletingRule] = useState<QcRule | null>(null)

  const activeRules = qcRules.filter((r) => r.active)
  const autoDivertedCount = useMemo(
    () => asnRecords.filter((a) => a.qcRuleId).length,
    [asnRecords]
  )
  const pendingQcCount = useMemo(
    () => asnRecords.filter((a) => a.requiresQualityControl && a.status === 'completed').length,
    [asnRecords]
  )

  const sortedRules = useMemo(
    () => [...qcRules].sort((a, b) => a.priority - b.priority),
    [qcRules]
  )

  const handleOpenCreate = () => {
    setEditingRule(null)
    setRuleDialogOpen(true)
  }

  const handleOpenEdit = (rule: QcRule) => {
    setEditingRule(rule)
    setRuleDialogOpen(true)
  }

  const handleToggle = (rule: QcRule) => {
    updateQcRule(rule.id, { active: !rule.active })
  }

  const handleConfirmDelete = () => {
    if (!deletingRule) return
    deleteQcRule(deletingRule.id)
    setDeletingRule(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración de Control de Calidad"
        description="Reglas de desvío automático a cuarentena. La regla de menor prioridad gana cuando varias aplican."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          icon={ClipboardCheck}
          label="Reglas activas"
          value={String(activeRules.length)}
          tone="blue"
        />
        <KpiCard
          icon={ShieldAlert}
          label="ASN desviados por regla"
          value={String(autoDivertedCount)}
          tone="amber"
        />
        <KpiCard
          icon={ClipboardCheck}
          label="Pendientes de inspección"
          value={String(pendingQcCount)}
          tone={pendingQcCount > 0 ? 'amber' : 'neutral'}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Motor de reglas</CardTitle>
            <CardDescription>
              Al crear una recepción, el sistema evalúa estas reglas y marca el ASN para QC sin
              intervención del operario.
            </CardDescription>
          </div>
          <Switch
            checked={settings.qcRulesEnabled}
            onCheckedChange={(v) => updateSettings({ qcRulesEnabled: v })}
            aria-label="Activar motor de reglas de QC"
          />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {settings.qcRulesEnabled
              ? 'Activo — las recepciones nuevas se evalúan automáticamente.'
              : 'Inactivo — el desvío a QC solo se hace marcando la casilla al crear la recepción.'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Reglas de desvío</CardTitle>
            <CardDescription>{qcRules.length} reglas configuradas</CardDescription>
          </div>
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Nueva regla
          </Button>
        </CardHeader>
        <CardContent>
          {sortedRules.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay reglas configuradas. Crea la primera para automatizar el desvío a QC.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Condición</TableHead>
                  <TableHead className="text-right">Muestreo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRules.map((rule) => {
                  const productName = products.find((p) => p.id === rule.matchValue)?.name
                  return (
                    <TableRow key={rule.id} className={cn(!rule.active && 'opacity-50')}>
                      <TableCell className="font-mono text-xs">{rule.priority}</TableCell>
                      <TableCell>
                        <div className="font-medium">{rule.name}</div>
                        <div className="text-xs text-muted-foreground">{rule.reason}</div>
                      </TableCell>
                      <TableCell className="text-sm">{describeCondition(rule, productName)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {rule.samplingPercent}%
                      </TableCell>
                      <TableCell>
                        <Badge variant={rule.active ? 'default' : 'secondary'}>
                          {rule.active ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEdit(rule)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggle(rule)}>
                              <ClipboardCheck className="mr-2 h-4 w-4" />
                              {rule.active ? 'Desactivar' : 'Activar'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeletingRule(rule)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <QcRuleDialog
        open={ruleDialogOpen}
        rule={editingRule}
        onClose={() => setRuleDialogOpen(false)}
      />

      <Dialog open={!!deletingRule} onOpenChange={(o) => !o && setDeletingRule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar regla</DialogTitle>
            <DialogDescription>
              ¿Eliminar «{deletingRule?.name}»? Las recepciones nuevas dejarán de evaluarla.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeletingRule(null)}>
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
