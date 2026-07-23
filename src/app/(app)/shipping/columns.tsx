'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { Clock, ClipboardCheck, DollarSign, Truck, HandHelping } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { formatDate, formatNumber } from '@/lib/formatters'
import { SERVICE_LEVEL_LABELS } from '@/lib/rules/shipping'
import { cn } from '@/lib/utils'
import type { CarrierModality, CarrierServiceLevel, Shipment } from '@/types/wms'

export interface ShippingRow {
  id: string
  orderNumber: string
  customerName: string
  carrierId: string | undefined
  carrierName: string
  modalityType: CarrierModality | undefined
  serviceLevel: CarrierServiceLevel | undefined
  quotedCostUsd: number | undefined
  destinationCity: string | undefined
  packageCount: number
  weightKg: number
  trackingNumber: string | null
  promisedDate: string | null
  estimatedDeliveryDate: string | null
  otifStatus: Shipment['otifStatus']
  status: string
  shippedAt: string | null
  deliveredAt: string | null
  verifiedPackages: number
  partialDispatch: boolean
  pendingPackages: number
}

const OTIF_COLORS: Record<Shipment['otifStatus'], string> = {
  on_time: 'bg-green-100 text-green-700 border-green-200',
  at_risk: 'bg-amber-100 text-amber-700 border-amber-200',
  late: 'bg-red-100 text-red-700 border-red-200',
}

const OTIF_LABELS: Record<Shipment['otifStatus'], string> = {
  on_time: 'A tiempo',
  at_risk: 'En riesgo',
  late: 'Tarde',
}

interface ColumnActions {
  onShip: (row: ShippingRow) => void
  onRateShop: (row: ShippingRow) => void
  onDeliver: (row: ShippingRow) => void
  onVerifyLoad: (row: ShippingRow) => void
  // Cuando la configuración exige verificación, "Despachar" queda bloqueado
  // hasta confirmar los bultos cargados.
  requireLoadVerification: boolean
}

export const buildShippingColumns = ({
  onShip,
  onRateShop,
  onDeliver,
  onVerifyLoad,
  requireLoadVerification,
}: ColumnActions): ColumnDef<ShippingRow>[] => [
  {
    accessorKey: 'orderNumber',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Pedido" />,
    cell: ({ row }) => <span className="font-medium">{row.getValue('orderNumber')}</span>,
  },
  {
    accessorKey: 'customerName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" />,
  },
  {
    accessorKey: 'destinationCity',
    header: 'Destino',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {row.getValue<string | undefined>('destinationCity') ?? '—'}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'carrierName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Transportadora" />,
    cell: ({ row }) => (
      <span className="block max-w-[120px] truncate" title={row.getValue('carrierName')}>
        {row.getValue('carrierName')}
      </span>
    ),
  },
  {
    id: 'modalityType',
    accessorKey: 'modalityType',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Modalidad" />,
    cell: ({ row }) => {
      const modality = row.original.modalityType
      if (!modality) return <span className="text-muted-foreground text-sm">—</span>
      const config: Record<string, { label: string; className: string }> = {
        own: { label: 'Flota propia', className: 'bg-green-100 text-green-700 border-green-200' },
        third_party: { label: 'Tercero', className: 'bg-blue-100 text-blue-700 border-blue-200' },
        courier: { label: 'Courier', className: 'bg-violet-100 text-violet-700 border-violet-200' },
        last_mile: { label: 'Última milla', className: 'bg-orange-100 text-orange-700 border-orange-200' },
      }
      const { label, className } = config[modality] ?? { label: modality, className: '' }
      return (
        <span className={cn('rounded border px-2 py-0.5 text-xs font-medium', className)}>
          {label}
        </span>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'serviceLevel',
    header: 'Servicio',
    cell: ({ row }) => {
      const level = row.getValue<CarrierServiceLevel | undefined>('serviceLevel')
      if (!level) return <span className="text-muted-foreground text-sm">—</span>
      return (
        <Badge variant="outline" className="text-xs">
          {SERVICE_LEVEL_LABELS[level]}
        </Badge>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'quotedCostUsd',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Costo (USD)" className="justify-end" />
    ),
    cell: ({ row }) => {
      const cost = row.getValue<number | undefined>('quotedCostUsd')
      return (
        <div className="text-right tabular-nums">
          {cost !== undefined && cost !== null ? (
            <span className="flex items-center justify-end gap-1">
              <DollarSign className="text-muted-foreground size-3" />
              {cost.toFixed(2)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'packageCount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Paquetes" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{formatNumber(row.getValue('packageCount'))}</div>
    ),
  },
  {
    accessorKey: 'weightKg',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Peso (kg)" className="justify-end" />
    ),
    cell: ({ row }) => <div className="text-right tabular-nums">{row.getValue('weightKg')}</div>,
  },
  {
    accessorKey: 'trackingNumber',
    header: 'Tracking',
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.getValue('trackingNumber') ?? '—'}</span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'promisedDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Prometido" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {formatDate(row.getValue<string | null>('promisedDate') ?? undefined)}
      </span>
    ),
  },
  {
    accessorKey: 'estimatedDeliveryDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estimado" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {formatDate(row.getValue<string | null>('estimatedDeliveryDate') ?? undefined)}
      </span>
    ),
  },
  {
    accessorKey: 'otifStatus',
    header: ({ column }) => <DataTableColumnHeader column={column} title="OTIF" />,
    cell: ({ row }) => {
      const status = row.getValue<Shipment['otifStatus']>('otifStatus')
      return (
        <Badge variant="outline" className={`text-xs ${OTIF_COLORS[status]}`}>
          <Clock className="mr-1 inline size-3" />
          {OTIF_LABELS[status]}
        </Badge>
      )
    },
  },
  {
    id: 'load',
    header: 'Carga',
    cell: ({ row }) => {
      const item = row.original
      if (item.partialDispatch) {
        return (
          <Badge variant="outline" className="border-amber-200 bg-amber-100 text-amber-700">
            Parcial · {item.pendingPackages} pend.
          </Badge>
        )
      }
      if (item.status !== 'pending') {
        return <span className="text-muted-foreground text-xs tabular-nums">{item.packageCount}</span>
      }
      const verified = item.verifiedPackages
      if (verified <= 0) {
        return <span className="text-muted-foreground text-xs">Sin verificar</span>
      }
      return (
        <Badge
          variant="outline"
          className={cn(
            'tabular-nums',
            verified >= item.packageCount
              ? 'border-green-200 bg-green-100 text-green-700'
              : 'border-amber-200 bg-amber-100 text-amber-700'
          )}
        >
          {verified}/{item.packageCount}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
  },
  {
    id: 'actions',
    enableHiding: false,
    enableSorting: false,
    cell: ({ row }) => {
      const item = row.original
      if (item.status === 'pending' && !item.quotedCostUsd) {
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              onRateShop(item)
            }}
          >
            <DollarSign className="mr-1 size-3" /> Cotizar
          </Button>
        )
      }
      if (item.status === 'pending' && item.quotedCostUsd) {
        const blocked = requireLoadVerification && item.verifiedPackages <= 0
        return (
          <div className="flex gap-1">
            <Button
              size="icon-sm"
              variant="outline"
              title="Recotizar tarifa"
              onClick={(e) => {
                e.stopPropagation()
                onRateShop(item)
              }}
            >
              <DollarSign className="size-3" />
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              title="Verificar carga"
              onClick={(e) => {
                e.stopPropagation()
                onVerifyLoad(item)
              }}
            >
              <ClipboardCheck className="size-3" />
            </Button>
            <Button
              size="sm"
              disabled={blocked}
              title={blocked ? 'Verifica la carga antes de despachar' : 'Despachar envío'}
              onClick={(e) => {
                e.stopPropagation()
                onShip(item)
              }}
            >
              <Truck className="mr-1 size-3" /> Despachar
            </Button>
          </div>
        )
      }
      if (item.status === 'in_transit') {
        return (
          <Button
            size="sm"
            variant="outline"
            title="Registrar entrega"
            onClick={(e) => {
              e.stopPropagation()
              onDeliver(item)
            }}
          >
            <HandHelping className="mr-1 size-3" /> Entregado
          </Button>
        )
      }
      return null
    },
  },
]
