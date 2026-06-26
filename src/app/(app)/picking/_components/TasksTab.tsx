'use client'

import { CheckCircle2, ClipboardList, Package } from 'lucide-react'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TabPanel } from '@/app/(app)/receiving/_components/tab-panel'
import { EmptyState } from '@/app/(app)/receiving/_components/empty-state'
import type { ColumnDef } from '@tanstack/react-table'
import type { PickingTask } from '@/types/wms'

interface Props {
  pickingTasks: PickingTask[]
  filteredTasks: PickingTask[]
  pendingTaskCount: number
  partialTaskCount: number
  completedTaskCount: number
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  taskCols: ColumnDef<PickingTask>[]
}

export const TasksTab = ({
  pickingTasks,
  filteredTasks,
  pendingTaskCount,
  partialTaskCount,
  completedTaskCount,
  statusFilter,
  onStatusFilterChange,
  taskCols,
}: Props) => (
  <TabPanel
    icon={ClipboardList}
    iconClass="text-amber-500"
    title="Tareas de picking"
    description="Tareas individuales asignadas a operadores. Inicia, registra la cantidad pickeada y aprueba o rechaza parciales."
  >
    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      <KpiCard
        icon={ClipboardList}
        value={pendingTaskCount}
        label="Pendientes / asignadas"
        sublabel="Por iniciar o en espera"
        tone="amber"
      />
      <KpiCard
        icon={Package}
        value={partialTaskCount}
        label="Picking parcial"
        sublabel="Requieren aprobación o reintento"
        tone="blue"
      />
      <KpiCard
        icon={CheckCircle2}
        value={completedTaskCount}
        label="Completadas"
        sublabel="Finalizadas en esta sesión"
        tone="green"
      />
    </div>
    {pickingTasks.length === 0 ? (
      <EmptyState
        icon={ClipboardList}
        title="Sin tareas de picking"
        description="Las tareas generadas por oleadas o pedidos waveless aparecerán aquí."
      />
    ) : (
      <DataTable
        columns={taskCols}
        data={filteredTasks}
        searchColumn="code"
        searchPlaceholder="Buscar por código o producto…"
        emptyMessage="Sin tareas para el filtro seleccionado."
        filters={
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="h-8 w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="assigned">Asignada</SelectItem>
              <SelectItem value="in_progress">En progreso</SelectItem>
              <SelectItem value="partially_picked">Parcialmente pickeada</SelectItem>
              <SelectItem value="partial_with_shortage">Parcial c/faltante</SelectItem>
              <SelectItem value="partial_approved">Parcial aprobada</SelectItem>
              <SelectItem value="partial_rejected">Parcial rechazada</SelectItem>
              <SelectItem value="completed">Completada</SelectItem>
              <SelectItem value="with_issue">Con incidencia</SelectItem>
            </SelectContent>
          </Select>
        }
      />
    )}
  </TabPanel>
)
