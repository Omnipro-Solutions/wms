'use client'

import React, { useState } from 'react'
import { isToday, isBefore, parseISO } from 'date-fns'
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  PackageCheck,
  ShoppingBag,
  ShoppingCart,
  TriangleAlert,
} from 'lucide-react'
import { useWmsStore } from '@/store/wms-store'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { useDialogState } from '@/hooks/use-dialog-state'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'

type SortField = 'orderNumber' | 'customer' | 'channel' | 'status' | 'createdAt' | 'delivery'
type SortDir = 'asc' | 'desc'

interface ReserveDialogData {
  orderId: string
  orderNumber: string
  customerName: string
  lines: { productId: string; requestedQuantity: number }[]
}

const CHANNEL_LABELS: Record<string, string> = {
  ecommerce: 'Ecommerce',
  marketplace: 'Marketplace',
  pos: 'POS',
  b2b: 'B2B',
  app: 'App',
}

const FULFILLMENT_LABELS: Record<string, string> = {
  ship_from_dc: 'Despacho DC',
  ship_from_store: 'Despacho tienda',
  pickup_in_store: 'Recogida tienda',
  put_to_store: 'Reposición tienda',
  cross_docking: 'Cross docking',
}

const SortIcon = ({ field, active, dir }: { field: string; active: string; dir: SortDir }) => {
  if (active !== field) return <ArrowUpDown className="ml-1 inline size-3 opacity-40" />
  return dir === 'asc' ? (
    <ChevronUp className="ml-1 inline size-3" />
  ) : (
    <ChevronDown className="ml-1 inline size-3" />
  )
}

const isOverdue = (promisedDeliveryDate: string) =>
  isBefore(parseISO(promisedDeliveryDate), new Date()) &&
  !isToday(parseISO(promisedDeliveryDate))

const isUrgent = (promisedDeliveryDate: string) =>
  isToday(parseISO(promisedDeliveryDate))

export default function CommercePage() {
  const state = useWmsStore()
  const { reserveInventory, markReadyForPickup, confirmPickup } = useWmsStore()
  const { productName } = useStoreHelpers()
  const { operator } = useCurrentOperator()

  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [channelFilter, setChannelFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const toggleRow = (id: string) =>
    setExpandedRow((prev) => (prev === id ? null : id))

  const reserveDialog = useDialogState<ReserveDialogData>()

  const filtered = state.commerceOrders.filter((o) => {
    if (channelFilter !== 'all' && o.channel !== channelFilter) return false
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    const d = sortDir === 'asc' ? 1 : -1
    if (sortField === 'orderNumber') return a.orderNumber.localeCompare(b.orderNumber) * d
    if (sortField === 'customer') return a.customerName.localeCompare(b.customerName) * d
    if (sortField === 'channel') return a.channel.localeCompare(b.channel) * d
    if (sortField === 'status') return a.status.localeCompare(b.status) * d
    if (sortField === 'delivery')
      return a.promisedDeliveryDate.localeCompare(b.promisedDeliveryDate) * d
    return a.createdAt.localeCompare(b.createdAt) * d
  })

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const openReserveDialog = (orderId: string) => {
    const order = state.commerceOrders.find((o) => o.id === orderId)
    if (!order) return
    reserveDialog.open({
      orderId,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      lines: order.items.map((l) => ({
        productId: l.productId,
        requestedQuantity: l.requestedQuantity,
      })),
    })
  }

  const handleReserve = () => {
    if (!reserveDialog.data) return
    try {
      reserveInventory(reserveDialog.data.orderId)
      reserveDialog.close()
    } catch (e: unknown) {
      reserveDialog.setError(e instanceof Error ? e.message : 'Error al reservar inventario')
    }
  }

  const pendingCount = state.commerceOrders.filter((o) => o.status === 'pending').length
  const inProgressCount = state.commerceOrders.filter((o) => o.status === 'in_progress').length
  const completedCount = state.commerceOrders.filter((o) => o.status === 'completed').length
  const readyForPickupCount = state.commerceOrders.filter((o) => o.status === 'ready_for_pickup').length
  const operatorName = operator?.name ?? 'Sistema'

  return (
    <>
      <PageHeader
        title="Commerce — Pedidos"
        description="Gestión de pedidos multicanal. Reserva inventario, supervisa estados y sigue la promesa de entrega."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={TriangleAlert}
          value={pendingCount}
          label="Pendientes de reserva"
          tone="amber"
          alert={pendingCount > 0}
        />
        <KpiCard
          icon={ShoppingCart}
          value={inProgressCount}
          label="En operación"
          tone="blue"
        />
        <KpiCard
          icon={ShoppingBag}
          value={readyForPickupCount}
          label="Listos para recoger"
          tone="green"
        />
        <KpiCard
          icon={CheckCircle2}
          value={completedCount}
          label="Completados"
          tone="neutral"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="size-4" /> Pedidos
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="h-8 w-40">
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los canales</SelectItem>
                  <SelectItem value="ecommerce">Ecommerce</SelectItem>
                  <SelectItem value="marketplace">Marketplace</SelectItem>
                  <SelectItem value="pos">POS</SelectItem>
                  <SelectItem value="b2b">B2B</SelectItem>
                  <SelectItem value="app">App</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-44">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="assigned">Reservado</SelectItem>
                  <SelectItem value="in_progress">En operación</SelectItem>
                  <SelectItem value="ready_for_pickup">Listo para recoger</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('orderNumber')}>
                  Pedido <SortIcon field="orderNumber" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('customer')}>
                  Cliente <SortIcon field="customer" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('channel')}>
                  Canal / Tipo <SortIcon field="channel" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead>Líneas</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('delivery')}>
                  Promesa <SortIcon field="delivery" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('status')}>
                  Estado <SortIcon field="status" active={sortField} dir={sortDir} />
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((order) => {
                const overdue = !['completed', 'cancelled'].includes(order.status) && isOverdue(order.promisedDeliveryDate)
                const urgent = !['completed', 'cancelled'].includes(order.status) && isUrgent(order.promisedDeliveryDate)
                const isExpanded = expandedRow === order.id

                return (
                  <React.Fragment key={order.id}>
                    <TableRow
                      className={cn(
                        'cursor-pointer',
                        overdue && 'bg-red-50 hover:bg-red-100',
                        urgent && !overdue && 'bg-amber-50 hover:bg-amber-100'
                      )}
                      onClick={() => toggleRow(order.id)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {overdue && <TriangleAlert className="size-3 shrink-0 text-red-500" />}
                          {urgent && !overdue && <Clock className="size-3 shrink-0 text-amber-500" />}
                          {order.orderNumber}
                        </div>
                      </TableCell>
                      <TableCell>{order.customerName}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="outline" className="text-xs">
                            {CHANNEL_LABELS[order.channel] ?? order.channel}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {FULFILLMENT_LABELS[order.fulfillmentType] ?? order.fulfillmentType}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">{order.items.length}</TableCell>
                      <TableCell
                        className={cn(
                          'text-sm',
                          overdue && 'font-semibold text-red-600',
                          urgent && !overdue && 'font-semibold text-amber-600'
                        )}
                      >
                        {formatDate(order.promisedDeliveryDate)}
                        {overdue && <span className="ml-1 text-xs">(vencida)</span>}
                        {urgent && !overdue && <span className="ml-1 text-xs">(hoy)</span>}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                      <TableCell>
                        {isExpanded ? (
                          <ChevronUp className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow key={`${order.id}-detail`} className={cn(
                        overdue && 'bg-red-50',
                        urgent && !overdue && 'bg-amber-50'
                      )}>
                        <TableCell colSpan={7} className="pb-4 pt-2">
                          <div className="rounded-lg border bg-white p-4 space-y-3">
                            <p className="text-sm font-medium text-muted-foreground">Líneas del pedido</p>
                            <div className="divide-y rounded-md border">
                              {order.items.map((item) => (
                                <div key={item.id} className="flex items-center justify-between px-3 py-2">
                                  <span className="text-sm">{productName(item.productId)}</span>
                                  <span className="tabular-nums text-sm font-medium">
                                    {item.requestedQuantity} uds.
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              {order.status === 'pending' && (
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openReserveDialog(order.id)
                                  }}
                                >
                                  <PackageCheck className="mr-1 size-3" /> Reservar inventario
                                </Button>
                              )}
                              {order.status === 'in_progress' &&
                                order.fulfillmentType === 'pickup_in_store' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      try { markReadyForPickup(order.id, operatorName) } catch { /* ignore */ }
                                    }}
                                  >
                                    <ShoppingBag className="mr-1 size-3" /> Listo para recoger
                                  </Button>
                                )}
                              {order.status === 'ready_for_pickup' && (
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    try { confirmPickup(order.id, operatorName) } catch { /* ignore */ }
                                  }}
                                >
                                  <CheckCircle2 className="mr-1 size-3" /> Confirmar recogida
                                </Button>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={!!reserveDialog.data}
        onOpenChange={(o) => {
          if (!o) reserveDialog.close()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reservar inventario</DialogTitle>
          </DialogHeader>
          {reserveDialog.data && (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">
                  Pedido:{' '}
                  <span className="text-foreground font-medium">
                    {reserveDialog.data.orderNumber}
                  </span>
                </p>
                <p className="text-muted-foreground text-sm">
                  Cliente:{' '}
                  <span className="text-foreground font-medium">
                    {reserveDialog.data.customerName}
                  </span>
                </p>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reserveDialog.data.lines.map((l) => (
                      <TableRow key={l.productId}>
                        <TableCell className="text-sm">{productName(l.productId)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.requestedQuantity}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-muted-foreground text-sm">
                Esta acción reservará el stock disponible y cambiará el pedido a estado{' '}
                <strong>Reservado</strong>.
              </p>
              {reserveDialog.error && (
                <p className="text-destructive flex items-center gap-1 text-sm">
                  <TriangleAlert className="size-3" /> {reserveDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={reserveDialog.close}>
              Cancelar
            </Button>
            <Button onClick={handleReserve}>
              <PackageCheck className="mr-1 size-4" /> Confirmar reserva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
