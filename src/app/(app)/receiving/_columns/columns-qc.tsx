import { type ColumnDef } from '@tanstack/react-table'
import { ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/formatters'
import type { AsnRow } from '../columns'
import { codeCol, supplierCol, productCol, abcCol, type ActionHandler } from './shared'

export const buildQcColumns = (onAction: ActionHandler): ColumnDef<AsnRow>[] => [
  codeCol,
  supplierCol,
  productCol,
  abcCol,
  {
    id: 'qcProgress',
    header: 'Unidades recibidas',
    enableSorting: false,
    cell: ({ row }) => {
      const { receivedQuantity, expectedQuantity } = row.original
      return (
        <span className="text-sm font-medium tabular-nums">
          {formatNumber(receivedQuantity)}
          <span className="text-muted-foreground font-normal">
            {' '}
            / {formatNumber(expectedQuantity)} uds
          </span>
        </span>
      )
    },
  },
  {
    id: 'qcStatus',
    header: 'Estado inspección',
    enableSorting: false,
    cell: () => (
      <Badge
        variant="outline"
        className="gap-1 border-amber-300 bg-amber-50 text-xs text-amber-700"
      >
        <ShieldCheck className="size-3" /> Pendiente de inspección
      </Badge>
    ),
  },
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <Button
        size="sm"
        className="bg-amber-500 text-white hover:bg-amber-600"
        onClick={(e) => {
          e.stopPropagation()
          onAction('qc', row.original)
        }}
      >
        <ShieldCheck className="mr-1.5 size-3.5" />
        Inspeccionar lote
      </Button>
    ),
  },
]
