import { type ColumnDef } from '@tanstack/react-table'
import { CheckCircle2, MapPin, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/formatters'
import type { AsnRow } from '../columns'
import { codeCol, supplierCol, productCol, abcCol, statusCol, type ActionHandler } from './shared'

export const buildPutawayColumns = (onAction: ActionHandler): ColumnDef<AsnRow>[] => [
  codeCol,
  supplierCol,
  productCol,
  abcCol,
  {
    id: 'putawayQty',
    header: 'Uds en área de ingreso',
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-sm font-medium tabular-nums">
        {formatNumber(row.original.receivedQuantity)} uds
      </span>
    ),
  },
  {
    id: 'cdFlag',
    header: 'Destino',
    enableSorting: false,
    cell: ({ row }) => {
      if (row.original.crossDocking) {
        return (
          <Badge
            variant="outline"
            className="gap-1 border-blue-300 bg-blue-50 text-xs text-blue-700"
          >
            <Zap className="size-3" /> Salida directa
          </Badge>
        )
      }
      return <span className="text-muted-foreground text-xs">Almacén</span>
    },
  },
  statusCol,
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      if (!row.original.canPutaway) {
        if (row.original.status === 'completed') {
          return (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="size-3.5" /> Ubicado
            </span>
          )
        }
        return null
      }
      return (
        <Button
          size="sm"
          className="bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={(e) => {
            e.stopPropagation()
            onAction('putaway', row.original)
          }}
        >
          <MapPin className="mr-1.5 size-3.5" />
          {row.original.crossDocking ? 'Enviar a salida' : 'Asignar ubicación'}
        </Button>
      )
    },
  },
]
