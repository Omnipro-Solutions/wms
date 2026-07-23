'use client'

import { Users } from 'lucide-react'
import { DataTable } from '@/components/data-table'
import { TabPanel } from '@/app/(app)/receiving/_components/tab-panel'
import { EmptyState } from '@/app/(app)/receiving/_components/empty-state'
import type { ColumnDef } from '@tanstack/react-table'
import type { OperatorLoadRow } from '../columns'

interface Props {
  rows: OperatorLoadRow[]
  operatorCols: ColumnDef<OperatorLoadRow>[]
}

export const OperatorsTab = ({ rows, operatorCols }: Props) => (
  <TabPanel
    icon={Users}
    iconClass="text-indigo-500"
    title="Turnos y operarios"
    description="Operarios registrados y su carga de trabajo actual. Edita datos del operario desde Administración."
  >
    {rows.length === 0 ? (
      <EmptyState icon={Users} title="Sin operarios registrados" description="Registra operarios en Administración." />
    ) : (
      <DataTable columns={operatorCols} data={rows} searchColumn="name" searchPlaceholder="Buscar operario…" />
    )}
  </TabPanel>
)
