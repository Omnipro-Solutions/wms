'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import {
  CheckCircle2,
  ClipboardCheck,
  Hourglass,
  MoreHorizontal,
  Package,
  PackageSearch,
  Search,
  ShieldCheck,
  Snowflake,
} from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { selectInventoryAccuracy } from '@/store/selectors'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { SettingField } from '@/components/shared/setting-field'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { InventoryAdjustmentRequest } from '@/types/wms'

const STATUS_META: Record<
  InventoryAdjustmentRequest['status'],
  { label: string; badgeClass: string }
> = {
  pending_approval: {
    label: 'Pendiente',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300',
  },
  approved: {
    label: 'Aprobado',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  rejected: {
    label: 'Rechazado',
    badgeClass: 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-zinc-300',
  },
}

const ProductCell = ({ name, sku, imageUrl }: { name: string; sku: string; imageUrl?: string }) => (
  <div className="flex items-center gap-3">
    <div className="size-8 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
      {imageUrl ? (
        <Image src={imageUrl} alt={name} width={32} height={32} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center">
          <Package className="size-4 text-zinc-400" />
        </div>
      )}
    </div>
    <div className="min-w-0">
      <p className="truncate text-sm font-medium leading-tight">{name}</p>
      <p className="font-mono text-[11px] leading-tight text-muted-foreground">{sku}</p>
    </div>
  </div>
)

const SectionLabel = ({ icon: Icon, children }: { icon: typeof PackageSearch; children: string }) => (
  <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
    <Icon className="size-3.5" />
    {children}
  </div>
)

export default function InventorySettingsPage() {
  const state = useWmsStore()
  const { settings, adjustmentRequests, updateSettings, approveAdjustment, rejectAdjustment } = state
  const accuracy = selectInventoryAccuracy(state)
  const { productName, productSku, getProduct, locationCode } = useStoreHelpers()

  const [localSettings, setLocalSettings] = useState({ ...settings })
  const [settingsChanged, setSettingsChanged] = useState(false)

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectingId, setRejectingId] = useState('')
  const [rejectNote, setRejectNote] = useState('')

  const [detailId, setDetailId] = useState<string | null>(null)
  const [productFilter, setProductFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | InventoryAdjustmentRequest['status']>('all')

  const handleSettingChange = (key: keyof typeof settings, value: number | boolean) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
    setSettingsChanged(true)
  }

  const handleSaveSettings = () => {
    updateSettings(localSettings)
    setSettingsChanged(false)
  }

  const handleToggleFreeze = () => {
    const next = !settings.inventoryFreezeActive
    updateSettings({ inventoryFreezeActive: next })
    setLocalSettings((prev) => ({ ...prev, inventoryFreezeActive: next }))
  }

  const handleOpenReject = (id: string) => {
    setRejectingId(id)
    setRejectNote('')
    setRejectDialogOpen(true)
  }

  const handleConfirmReject = () => {
    if (!rejectNote.trim()) return
    rejectAdjustment(rejectingId, 'Supervisor', rejectNote.trim())
    setRejectDialogOpen(false)
  }

  const filteredRequests = useMemo(() => {
    let result = adjustmentRequests
    if (statusFilter !== 'all') result = result.filter((r) => r.status === statusFilter)
    if (productFilter.trim()) {
      const q = productFilter.trim().toLowerCase()
      result = result.filter(
        (r) => productName(r.productId).toLowerCase().includes(q) || productSku(r.productId).toLowerCase().includes(q)
      )
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustmentRequests, statusFilter, productFilter])

  const pendingCount = adjustmentRequests.filter((r) => r.status === 'pending_approval').length
  const detailRequest = adjustmentRequests.find((r) => r.id === detailId) ?? null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración de Inventario"
        description="Parámetros y gobierno del módulo de inventario — congelamiento, umbrales de alerta y aprobación de ajustes. Los cambios aquí afectan de inmediato lo que se ve en /inventory."
      />

      {/* ── IRA + Freeze + Pending count ─────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card
          className={cn(
            'border-2',
            accuracy.ira >= 95
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/40'
              : accuracy.ira >= 80
                ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/40'
                : 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40'
          )}
        >
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">IRA — Exactitud de inventario</p>
            <p
              className={cn(
                'mt-1 text-4xl font-bold tabular-nums',
                accuracy.ira >= 95
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : accuracy.ira >= 80
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-red-700 dark:text-red-300'
              )}
            >
              {accuracy.ira}%
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {accuracy.totalDeviation} uds de desviación en {accuracy.adjustmentsApproved} conteos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-4 pt-5">
            <Snowflake className={cn('mt-0.5 size-8 shrink-0', settings.inventoryFreezeActive ? 'text-blue-500' : 'text-zinc-300')} />
            <div className="flex-1">
              <p className="text-sm font-medium">Modo congelado</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Bloquea ajustes, bloqueos, liberaciones y reubicaciones de stock.</p>
              <div className="mt-3 flex items-center gap-2">
                <Switch checked={settings.inventoryFreezeActive} onCheckedChange={handleToggleFreeze} />
                <span className="text-sm">{settings.inventoryFreezeActive ? 'Activo' : 'Inactivo'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Ajustes pendientes</p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-amber-600 dark:text-amber-300">{accuracy.adjustmentsPending}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {accuracy.adjustmentsApproved} aprobados · {accuracy.adjustmentsRejected} rechazados
            </p>
          </CardContent>
        </Card>
      </div>

      {settings.inventoryFreezeActive && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/40">
          <Snowflake className="size-5 shrink-0 text-blue-600 dark:text-blue-300" />
          <p className="flex-1 text-sm text-blue-800 dark:text-blue-300">
            Con el inventario congelado, ve a <span className="font-semibold">/inventory</span> e intenta cualquier hold, ajuste o reubicación — verás el bloqueo en vivo.
          </p>
        </div>
      )}

      <Separator />

      {/* ── Parámetros ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-sm">Parámetros del módulo</CardTitle>
              <CardDescription>Umbrales que gobiernan alertas, aprobaciones y reservas de inventario.</CardDescription>
            </div>
            <Button size="sm" disabled={!settingsChanged} onClick={handleSaveSettings}>
              Guardar cambios
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div>
            <SectionLabel icon={PackageSearch}>Alertas de stock</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingField
                label="Umbral stock crítico (uds)"
                description="Disponible ≤ este valor dispara la alerta de stock crítico."
                value={localSettings.stockAlertThreshold}
                min={1}
                max={200}
                step={1}
                onChange={(v) => handleSettingChange('stockAlertThreshold', v)}
              />
              <SettingField
                label="Alerta de vencimiento (días)"
                description="Lotes que vencen dentro de N días disparan la alerta de vencimiento."
                value={localSettings.expirationAlertDays}
                min={1}
                max={180}
                step={1}
                onChange={(v) => handleSettingChange('expirationAlertDays', v)}
              />
            </div>
          </div>

          <Separator />

          <div>
            <SectionLabel icon={ShieldCheck}>Aprobación de ajustes</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingField
                label="Umbral aprobación ajuste (uds)"
                description="Delta absoluto en unidades por encima del cual el ajuste requiere aprobación de supervisor."
                value={localSettings.adjustmentApprovalThreshold}
                min={1}
                max={500}
                step={1}
                onChange={(v) => handleSettingChange('adjustmentApprovalThreshold', v)}
              />
            </div>
          </div>

          <Separator />

          <div>
            <SectionLabel icon={Hourglass}>Reservas y rotación</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingField
                label="TTL de reservas (horas)"
                description="Horas que una reserva de pedido retiene stock antes de poder liberarse por vencimiento."
                value={localSettings.reservationTtlHours}
                min={1}
                max={168}
                step={1}
                onChange={(v) => handleSettingChange('reservationTtlHours', v)}
              />
              <SettingField
                label="Baja rotación (días)"
                description="Días en bodega sin salida por encima de los cuales una posición se marca de baja rotación."
                value={localSettings.agingLowRotationDays}
                min={7}
                max={365}
                step={1}
                onChange={(v) => handleSettingChange('agingLowRotationDays', v)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Solicitudes de ajuste ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ClipboardCheck className="size-4" />
                Solicitudes de ajuste de inventario
                {pendingCount > 0 && (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                    {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Ajustes con delta &gt; umbral de aprobación ({settings.adjustmentApprovalThreshold} uds) que requieren revisión del supervisor. Se generan desde /inventory → &ldquo;Ajustar stock&rdquo;.
              </CardDescription>
            </div>
            {adjustmentRequests.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
                  <Input
                    value={productFilter}
                    onChange={(e) => setProductFilter(e.target.value)}
                    placeholder="Buscar producto..."
                    className="h-8 w-44 pl-7 text-xs"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending_approval">Pendientes</SelectItem>
                    <SelectItem value="approved">Aprobados</SelectItem>
                    <SelectItem value="rejected">Rechazados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {adjustmentRequests.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <CheckCircle2 className="size-8 text-zinc-300" />
              <p className="text-sm text-muted-foreground">Sin solicitudes de ajuste registradas.</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Search className="size-8 text-zinc-300" />
              <p className="text-sm text-muted-foreground">Sin solicitudes que coincidan con los filtros.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Contado</TableHead>
                  <TableHead className="text-right">Delta</TableHead>
                  <TableHead>Solicitado</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((req) => {
                  const meta = STATUS_META[req.status]
                  return (
                    <TableRow key={req.id} className="border-border/60 transition-colors hover:bg-muted/40">
                      <TableCell>
                        <ProductCell
                          name={productName(req.productId)}
                          sku={productSku(req.productId)}
                          imageUrl={getProduct(req.productId)?.imageUrl}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{locationCode(req.locationId)}</TableCell>
                      <TableCell className="text-right tabular-nums">{req.currentQty}</TableCell>
                      <TableCell className="text-right tabular-nums">{req.countedQty}</TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-semibold tabular-nums',
                          req.delta > 0 ? 'text-emerald-600' : 'text-red-600'
                        )}
                      >
                        {req.delta > 0 ? '+' : ''}
                        {req.delta}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDateTime(req.requestedAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-xs', meta.badgeClass)}>
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="size-8 p-0">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailId(req.id)}>Ver detalle</DropdownMenuItem>
                            {req.status === 'pending_approval' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-emerald-600 focus:text-emerald-700"
                                  onClick={() => approveAdjustment(req.id, 'Supervisor')}
                                >
                                  Aprobar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-500 focus:text-red-600"
                                  onClick={() => handleOpenReject(req.id)}
                                >
                                  Rechazar
                                </DropdownMenuItem>
                              </>
                            )}
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

      {/* ── Detail dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!detailRequest} onOpenChange={(o) => { if (!o) setDetailId(null) }}>
        <DialogContent className="sm:max-w-sm">
          {detailRequest && (
            <>
              <DialogHeader>
                <DialogTitle>Detalle de la solicitud</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <ProductCell
                  name={productName(detailRequest.productId)}
                  sku={productSku(detailRequest.productId)}
                  imageUrl={getProduct(detailRequest.productId)?.imageUrl}
                />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Ubicación</p>
                    <p className="font-mono">{locationCode(detailRequest.locationId)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Estado</p>
                    <Badge variant="outline" className={cn('text-xs', STATUS_META[detailRequest.status].badgeClass)}>
                      {STATUS_META[detailRequest.status].label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Actual → Contado</p>
                    <p className="tabular-nums">{detailRequest.currentQty} → {detailRequest.countedQty}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Delta</p>
                    <p className={cn('font-semibold tabular-nums', detailRequest.delta > 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {detailRequest.delta > 0 ? '+' : ''}{detailRequest.delta}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Solicitado por</p>
                    <p>{detailRequest.operatorName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Fecha de solicitud</p>
                    <p>{formatDateTime(detailRequest.requestedAt)}</p>
                  </div>
                  {detailRequest.reviewedBy && (
                    <>
                      <div>
                        <p className="text-muted-foreground text-xs">Revisado por</p>
                        <p>{detailRequest.reviewedBy}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Fecha de revisión</p>
                        <p>{detailRequest.reviewedAt ? formatDateTime(detailRequest.reviewedAt) : '—'}</p>
                      </div>
                    </>
                  )}
                </div>
                {detailRequest.rejectionNote && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                    <p className="text-xs font-semibold uppercase tracking-wide">Motivo de rechazo</p>
                    <p className="mt-0.5">{detailRequest.rejectionNote}</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailId(null)}>Cerrar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Reject dialog ─────────────────────────────────────────────────── */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rechazar ajuste</DialogTitle>
            <DialogDescription>Indica el motivo del rechazo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-2">
            <label htmlFor="invcfg-reject-note" className="text-sm font-medium">Motivo *</label>
            <input
              id="invcfg-reject-note"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="Ej: Diferencia fuera de rango aceptable…"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={!rejectNote.trim()} onClick={handleConfirmReject}>Rechazar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
