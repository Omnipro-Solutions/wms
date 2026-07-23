'use client'

import { type ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { cn } from '@/lib/utils'

const ROLE_LABELS: Record<string, string> = {
  picker: 'Picker',
  packer: 'Packer',
  receiver: 'Recepcionista',
  driver: 'Conductor',
  supervisor: 'Supervisor',
}

export interface OperatorLoadRow {
  id: string
  name: string
  role: string
  active: boolean
  currentLoad: number
}

export const buildOperatorColumns = (): ColumnDef<OperatorLoadRow>[] => [
  {
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Operario" />,
    cell: ({ row }) => <span className="text-sm font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'role',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Rol" />,
    cell: ({ row }) => <Badge variant="outline" className="text-xs">{ROLE_LABELS[row.original.role] ?? row.original.role}</Badge>,
  },
  {
    accessorKey: 'active',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={cn(
          'text-xs',
          row.original.active
            ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
            : 'border-zinc-200 bg-zinc-100 text-zinc-500'
        )}
      >
        {row.original.active ? 'Activo' : 'Inactivo'}
      </Badge>
    ),
  },
  {
    accessorKey: 'currentLoad',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Carga actual" />,
    cell: ({ row }) => <div className="text-right tabular-nums">{row.original.currentLoad} tareas</div>,
  },
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    cell: () => (
      <Button asChild size="sm" variant="outline">
        <Link href="/admin">Editar</Link>
      </Button>
    ),
  },
]
