import Link from 'next/link'
import { type ColumnDef } from '@tanstack/react-table'
import { ShieldCheck, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { ProductAvatar } from '../_components/product-avatar'
import { AbcBadge } from '../_components/abc-badge'
import type { AsnRow, ActionType } from '../columns'

export type ActionHandler = (type: ActionType, row: AsnRow) => void

export const codeCol: ColumnDef<AsnRow> = {
  accessorKey: 'code',
  header: ({ column }) => <DataTableColumnHeader column={column} title="N° Aviso" />,
  cell: ({ row }) => (
    <Link
      href={`/receiving/${row.original.id}`}
      className="text-primary font-mono text-xs font-semibold underline-offset-4 hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {row.getValue('code')}
    </Link>
  ),
}

export const supplierCol: ColumnDef<AsnRow> = {
  accessorKey: 'supplierName',
  header: ({ column }) => <DataTableColumnHeader column={column} title="Proveedor" />,
  cell: ({ row }) => <span className="text-sm">{row.getValue('supplierName')}</span>,
}

export const productCol: ColumnDef<AsnRow> = {
  accessorKey: 'productName',
  header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
  cell: ({ row }) => (
    <ProductAvatar productId={row.original.productId} name={row.original.productName} />
  ),
}

export const abcCol: ColumnDef<AsnRow> = {
  accessorKey: 'abcClass',
  header: ({ column }) => <DataTableColumnHeader column={column} title="Rotación" />,
  cell: ({ row }) => <AbcBadge abcClass={row.getValue('abcClass')} />,
}

export const flagsCol: ColumnDef<AsnRow> = {
  id: 'flags',
  header: 'Tipo',
  enableSorting: false,
  cell: ({ row }) => {
    const { requiresQualityControl, crossDocking } = row.original
    if (!requiresQualityControl && !crossDocking)
      return <span className="text-muted-foreground text-xs">Estándar</span>
    return (
      <div className="flex flex-col gap-1">
        {requiresQualityControl && (
          <Badge
            variant="outline"
            className="w-fit gap-1 border-amber-300 bg-amber-50 text-xs text-amber-700"
          >
            <ShieldCheck className="size-3" /> Inspección QC
          </Badge>
        )}
        {crossDocking && (
          <Badge
            variant="outline"
            className="w-fit gap-1 border-blue-300 bg-blue-50 text-xs text-blue-700"
          >
            <Zap className="size-3" /> Cross-Docking
          </Badge>
        )}
      </div>
    )
  },
}

export const statusCol: ColumnDef<AsnRow> = {
  accessorKey: 'status',
  header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
  cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
}
