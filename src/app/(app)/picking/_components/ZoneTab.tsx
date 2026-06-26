'use client'

import { CheckCircle2, ClipboardList, LayoutGrid, MapPin, Package, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/formatters'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { TabPanel } from '@/app/(app)/receiving/_components/tab-panel'
import { EmptyState } from '@/app/(app)/receiving/_components/empty-state'
import type { ColumnDef } from '@tanstack/react-table'
import type { ZoneTask } from '../columns'

const ZONE_COLORS: Record<string, string> = {
  A: 'border-green-200 bg-green-100 text-green-800',
  B: 'border-blue-200 bg-blue-100 text-blue-800',
  R: 'border-slate-200 bg-slate-100 text-slate-700',
  S: 'border-orange-200 bg-orange-100 text-orange-800',
  QC: 'border-purple-200 bg-purple-100 text-purple-800',
}

interface ZoneStat {
  zone: string
  completed: number
  total: number
  totalUnits: number
  pickedUnits: number
  operators: (string | undefined)[]
}

interface Props {
  tasksWithZone: ZoneTask[]
  zoneStats: ZoneStat[]
  zones: string[]
  consolidationCount: number
  zoneCols: ColumnDef<ZoneTask>[]
}

export const ZoneTab = ({
  tasksWithZone,
  zoneStats,
  consolidationCount,
  zoneCols,
}: Props) => (
  <TabPanel
    icon={LayoutGrid}
    iconClass="text-zinc-500"
    title="Picking por zona"
    description="Vista de progreso por zona de almacén. Identifica zonas con tareas pendientes y pedidos listos para consolidar."
  >
    <div className="mb-4 grid gap-3 sm:grid-cols-4">
      <KpiCard
        icon={ClipboardList}
        value={tasksWithZone.filter((t) => t.status === 'pending' || t.status === 'assigned').length}
        label="Tareas pendientes"
        sublabel="Por iniciar o asignar"
        tone="amber"
      />
      <KpiCard
        icon={Package}
        value={tasksWithZone.filter((t) => t.status === 'in_progress').length}
        label="En progreso"
        sublabel="Siendo pickeadas"
        tone="blue"
      />
      <KpiCard
        icon={MapPin}
        value={zoneStats.length}
        label="Zonas activas"
        sublabel="Con al menos una tarea"
        tone="neutral"
      />
      <KpiCard
        icon={CheckCircle2}
        value={consolidationCount}
        label="Listos p/ consolidar"
        sublabel="Todos los items recogidos"
        tone="green"
      />
    </div>

    {consolidationCount > 0 && (
      <Card className="mb-4 border-green-300 bg-green-50">
        <CardContent className="flex items-start gap-3 pt-4">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-700" />
          <div className="text-sm text-green-800">
            <p className="font-medium">{consolidationCount} pedido(s) listo(s) para consolidar</p>
            <p className="mt-1 text-green-700">
              Todos los ítems han sido recogidos. Trasládalos al área de staging para empaque.
            </p>
          </div>
        </CardContent>
      </Card>
    )}

    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {zoneStats.map(({ zone, completed, total, totalUnits, pickedUnits, operators }) => {
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0
        return (
          <Card key={zone}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <MapPin className="size-4" /> Zona {zone}
                </span>
                <Badge variant="outline" className={cn('text-xs', ZONE_COLORS[zone] ?? '')}>
                  {completed}/{total} tareas
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={pct} className="h-2" />
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Unidades</p>
                  <p className="font-medium tabular-nums">
                    {formatNumber(pickedUnits)}/{formatNumber(totalUnits)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Operadores</p>
                  <p className="text-xs font-medium">
                    {operators.length > 0 ? operators.join(', ') : '—'}
                  </p>
                </div>
              </div>
              {pct === 100 && (
                <div className="flex items-center gap-1 text-xs text-green-700">
                  <CheckCircle2 className="size-3" /> Zona completada
                </div>
              )}
              {pct > 0 && pct < 100 && (
                <div className="flex items-center gap-1 text-xs text-amber-700">
                  <TriangleAlert className="size-3" /> {total - completed} tarea(s) pendiente(s)
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>

    {tasksWithZone.length === 0 ? (
      <EmptyState
        icon={LayoutGrid}
        title="Sin tareas por zona"
        description="Las tareas de picking aparecerán organizadas por zona cuando sean generadas."
      />
    ) : (
      <DataTable
        columns={zoneCols}
        data={tasksWithZone}
        searchColumn="code"
        searchPlaceholder="Buscar tarea…"
        emptyMessage="No hay tareas de picking."
      />
    )}
  </TabPanel>
)
