'use client'

import { useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import {
  AlertOctagon,
  CheckCircle2,
  Lock,
  LockOpen,
  MapPin,
  Package,
  Star,
  TriangleAlert,
  Warehouse,
} from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/data-table'
import { DataTableColumnHeader } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/formatters'
import type { StorageLocation } from '@/types/wms'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LocationRow extends StorageLocation {
  onHandUnits: number
  skuCount: number
  utilizationPct: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<StorageLocation['type'], string> = {
  pick: 'Pick',
  reserve: 'Reserva',
  quality_control: 'Control de calidad',
  staging: 'Staging',
  returns: 'Devoluciones',
}

const TYPE_COLORS: Record<StorageLocation['type'], string> = {
  pick: 'border-blue-200 bg-blue-50 text-blue-700',
  reserve: 'border-violet-200 bg-violet-50 text-violet-700',
  quality_control: 'border-amber-200 bg-amber-50 text-amber-700',
  staging: 'border-teal-200 bg-teal-50 text-teal-700',
  returns: 'border-rose-200 bg-rose-50 text-rose-700',
}

// ── Sub-components ────────────────────────────────────────────────────────────

const LocationCodeCell = ({ loc }: { loc: LocationRow }) => (
  <div className="flex items-center gap-2">
    <div
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-md border',
        loc.isBlocked
          ? 'border-destructive/30 bg-destructive/10'
          : loc.golden
            ? 'border-amber-200 bg-amber-50'
            : 'border-zinc-200 bg-zinc-50'
      )}
    >
      {loc.isBlocked ? (
        <Lock className="text-destructive size-3.5" />
      ) : loc.golden ? (
        <Star className="size-3.5 fill-amber-400 text-amber-400" />
      ) : (
        <MapPin className="text-muted-foreground size-3.5" />
      )}
    </div>
    <div className="min-w-0">
      <p className="font-mono text-sm font-semibold leading-tight">{loc.code}</p>
      <p className="text-muted-foreground text-[11px]">Zona {loc.zone}</p>
    </div>
  </div>
)

const TypeBadge = ({ type }: { type: StorageLocation['type'] }) => (
  <Badge variant="outline" className={cn('text-xs', TYPE_COLORS[type])}>
    {TYPE_LABELS[type]}
  </Badge>
)

const StatusCell = ({ loc }: { loc: LocationRow }) => {
  if (loc.isBlocked) {
    return (
      <div className="flex items-center gap-1.5">
        <AlertOctagon className="text-destructive size-3.5 shrink-0" />
        <span className="text-destructive text-xs font-semibold">Bloqueada</span>
      </div>
    )
  }
  if (loc.onHandUnits === 0) {
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
        <span className="text-xs text-emerald-700">Disponible</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      <Package className="size-3.5 shrink-0 text-blue-500" />
      <span className="text-xs text-blue-700">Ocupada</span>
    </div>
  )
}

const UtilizationCell = ({ loc }: { loc: LocationRow }) => {
  if (loc.onHandUnits === 0) {
    return <span className="text-muted-foreground text-xs">—</span>
  }
  const pct = Math.min(100, loc.utilizationPct)
  const barColor =
    pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'

  return (
    <div className="flex min-w-28 flex-col gap-1">
      <div className="flex items-center justify-between text-[11px] tabular-nums">
        <span className="font-medium">{formatNumber(loc.onHandUnits)} uds.</span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div className={cn('h-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted-foreground text-[10px]">{loc.skuCount} SKU</span>
    </div>
  )
}

const AccessibilityCell = ({ score }: { score: number }) => {
  const color =
    score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-zinc-400'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex cursor-default items-center gap-1.5">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                score >= 80 ? 'bg-emerald-400' : score >= 50 ? 'bg-amber-400' : 'bg-zinc-300'
              )}
              style={{ width: `${score}%` }}
            />
          </div>
          <span className={cn('text-xs font-semibold tabular-nums', color)}>{score}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">Score de accesibilidad (0–100)</p>
        <p className="text-background/70 text-[11px]">Mayor = más cercano y ergonómico</p>
      </TooltipContent>
    </Tooltip>
  )
}

// ── Column definitions ────────────────────────────────────────────────────────

type BlockHandler = (loc: LocationRow, action: 'block' | 'unblock') => void

const buildColumns = (onAction: BlockHandler): ColumnDef<LocationRow>[] => [
  {
    id: 'code',
    accessorKey: 'code',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Ubicación" />,
    cell: ({ row }) => <LocationCodeCell loc={row.original} />,
  },
  {
    accessorKey: 'type',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
    cell: ({ row }) => <TypeBadge type={row.getValue('type')} />,
  },
  {
    id: 'status',
    header: 'Estado',
    cell: ({ row }) => <StatusCell loc={row.original} />,
    enableSorting: false,
  },
  {
    id: 'utilization',
    accessorKey: 'onHandUnits',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Ocupación" />,
    cell: ({ row }) => <UtilizationCell loc={row.original} />,
  },
  {
    accessorKey: 'accessibilityScore',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Accesibilidad" />,
    cell: ({ row }) => <AccessibilityCell score={row.getValue('accessibilityScore')} />,
  },
  {
    accessorKey: 'distanceToDispatchM',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Dist. despacho" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs tabular-nums">
        {row.getValue<number>('distanceToDispatchM')} m
      </span>
    ),
  },
  {
    id: 'capacity',
    header: 'Capacidad',
    cell: ({ row }) => {
      const loc = row.original
      return (
        <div className="text-muted-foreground text-[11px] tabular-nums">
          <p>{loc.maxWeightKg} kg</p>
          <p>{loc.maxVolumeM3 > 0 ? `${loc.maxVolumeM3} m³` : '—'}</p>
        </div>
      )
    },
    enableSorting: false,
  },
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const loc = row.original
      return (
        <div className="flex gap-1">
          {loc.isBlocked ? (
            <Button
              size="sm"
              variant="outline"
              className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              onClick={(e) => {
                e.stopPropagation()
                onAction(loc, 'unblock')
              }}
            >
              <LockOpen className="mr-1 size-3" />
              Desbloquear
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={(e) => {
                e.stopPropagation()
                onAction(loc, 'block')
              }}
            >
              <Lock className="mr-1 size-3" />
              Bloquear
            </Button>
          )}
        </div>
      )
    },
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

interface ConfirmDialog {
  loc: LocationRow
  action: 'block' | 'unblock'
}

export default function LocationsPage() {
  const { locations, inventoryItems, blockLocation, unblockLocation } = useWmsStore()

  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)

  const rows = useMemo<LocationRow[]>(() => {
    return locations.map((loc) => {
      const items = inventoryItems.filter((i) => i.locationId === loc.id && i.onHandQuantity > 0)
      const onHandUnits = items.reduce((s, i) => s + i.onHandQuantity, 0)
      const skuCount = new Set(items.map((i) => i.productId)).size
      const volumeUsed = items.reduce((s, i) => {
        return s + i.onHandQuantity * 0.002
      }, 0)
      const utilizationPct =
        loc.volumeCapacityM3 > 0
          ? Math.round((volumeUsed / loc.volumeCapacityM3) * 100)
          : 0
      return { ...loc, onHandUnits, skuCount, utilizationPct }
    })
  }, [locations, inventoryItems])

  const filteredRows = useMemo(() => {
    let result = typeFilter === 'all' ? rows : rows.filter((r) => r.type === typeFilter)
    if (statusFilter === 'occupied') result = result.filter((r) => r.onHandUnits > 0 && !r.isBlocked)
    else if (statusFilter === 'available') result = result.filter((r) => r.onHandUnits === 0 && !r.isBlocked)
    else if (statusFilter === 'blocked') result = result.filter((r) => r.isBlocked)
    return result
  }, [rows, typeFilter, statusFilter])

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalLocations = rows.length
  const occupiedCount = rows.filter((r) => r.onHandUnits > 0 && !r.isBlocked).length
  const availableCount = rows.filter((r) => r.onHandUnits === 0 && !r.isBlocked).length
  const blockedCount = rows.filter((r) => r.isBlocked).length

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAction = (loc: LocationRow, action: 'block' | 'unblock') => {
    setConfirmDialog({ loc, action })
  }

  const handleConfirm = () => {
    if (!confirmDialog) return
    if (confirmDialog.action === 'block') {
      blockLocation(confirmDialog.loc.id)
    } else {
      unblockLocation(confirmDialog.loc.id)
    }
    setConfirmDialog(null)
  }

  const columns = useMemo(() => buildColumns(handleAction), [])

  const hasActiveFilters = typeFilter !== 'all' || statusFilter !== 'all'

  const filtersNode = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="h-8 w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los tipos</SelectItem>
          <SelectItem value="pick">Pick</SelectItem>
          <SelectItem value="reserve">Reserva</SelectItem>
          <SelectItem value="quality_control">Control de calidad</SelectItem>
          <SelectItem value="staging">Staging</SelectItem>
          <SelectItem value="returns">Devoluciones</SelectItem>
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="h-8 w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="available">Disponible</SelectItem>
          <SelectItem value="occupied">Ocupada</SelectItem>
          <SelectItem value="blocked">Bloqueada</SelectItem>
        </SelectContent>
      </Select>
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-8 text-xs"
          onClick={() => {
            setTypeFilter('all')
            setStatusFilter('all')
          }}
        >
          Limpiar
        </Button>
      )}
    </div>
  )

  return (
    <>
      <PageHeader
        title="Ubicaciones"
        description="Vista de todas las posiciones del almacén — ocupación, accesibilidad y estado operativo."
      />

      {/* ── KPI row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={Warehouse}
          value={totalLocations}
          label="Total ubicaciones"
          sublabel="Posiciones configuradas"
          tone="neutral"
        />
        <KpiCard
          icon={Package}
          value={occupiedCount}
          label="Ocupadas"
          sublabel={`${availableCount} disponibles`}
          tone="blue"
          onClick={occupiedCount > 0 ? () => setStatusFilter('occupied') : undefined}
        />
        <KpiCard
          icon={CheckCircle2}
          value={availableCount}
          label="Disponibles"
          sublabel="Sin stock actual"
          tone="green"
          onClick={availableCount > 0 ? () => setStatusFilter('available') : undefined}
        />
        <KpiCard
          icon={Lock}
          value={blockedCount}
          label="Bloqueadas"
          sublabel={blockedCount > 0 ? 'Requieren atención' : 'Sin bloqueos activos'}
          tone={blockedCount > 0 ? 'red' : 'neutral'}
          alert={blockedCount > 0}
          onClick={blockedCount > 0 ? () => setStatusFilter('blocked') : undefined}
        />
      </div>

      {/* ── Locations table ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <MapPin className="text-muted-foreground size-4" />
            <CardTitle className="text-base">Mapa de ubicaciones</CardTitle>
          </div>
          <CardDescription>
            Cada fila es una posición física del almacén. Zona · Tipo · Estado · Ocupación.
          </CardDescription>
        </CardHeader>

        {/* ── Zone summary legend ──────────────────────────────────────────── */}
        <div className="border-b px-6 pb-3">
          <ZoneSummary rows={rows} />
        </div>

        <CardContent className="pt-3">
          <DataTable
            columns={columns}
            data={filteredRows}
            searchColumn="code"
            searchPlaceholder="Buscar ubicación..."
            filters={filtersNode}
            emptyMessage="No hay ubicaciones con los filtros seleccionados."
          />
        </CardContent>
      </Card>

      {/* ── Confirm block/unblock dialog ─────────────────────────────────── */}
      <Dialog
        open={!!confirmDialog}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.action === 'block' ? 'Bloquear ubicación' : 'Desbloquear ubicación'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.action === 'block'
                ? 'La ubicación quedará marcada como bloqueada. No se podrán realizar nuevas operaciones de putaway ni picking sobre ella.'
                : 'La ubicación volverá a estar disponible para operaciones de putaway y picking.'}
            </DialogDescription>
          </DialogHeader>

          {confirmDialog && (
            <div className="space-y-3 py-1">
              <div className="rounded-lg border bg-zinc-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex size-9 items-center justify-center rounded-md border',
                      confirmDialog.action === 'block'
                        ? 'border-destructive/30 bg-destructive/10'
                        : 'border-emerald-200 bg-emerald-50'
                    )}
                  >
                    {confirmDialog.action === 'block' ? (
                      <Lock className="text-destructive size-4" />
                    ) : (
                      <LockOpen className="size-4 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-mono text-sm font-semibold">{confirmDialog.loc.code}</p>
                    <p className="text-muted-foreground text-xs">
                      Zona {confirmDialog.loc.zone} · {TYPE_LABELS[confirmDialog.loc.type]}
                    </p>
                  </div>
                </div>
              </div>

              {confirmDialog.action === 'block' && confirmDialog.loc.onHandUnits > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-700">
                    Esta ubicación tiene{' '}
                    <span className="font-semibold">
                      {formatNumber(confirmDialog.loc.onHandUnits)} unidades
                    </span>{' '}
                    en stock. El inventario existente permanecerá, pero no se podrán realizar nuevas
                    operaciones.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant={confirmDialog?.action === 'block' ? 'destructive' : 'default'}
              onClick={handleConfirm}
            >
              {confirmDialog?.action === 'block' ? 'Bloquear' : 'Desbloquear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Zone summary strip ────────────────────────────────────────────────────────

const ZoneSummary = ({ rows }: { rows: LocationRow[] }) => {
  const zones = useMemo(() => {
    const map = new Map<string, { total: number; occupied: number; blocked: number }>()
    for (const r of rows) {
      const entry = map.get(r.zone) ?? { total: 0, occupied: 0, blocked: 0 }
      entry.total++
      if (r.isBlocked) entry.blocked++
      else if (r.onHandUnits > 0) entry.occupied++
      map.set(r.zone, entry)
    }
    return Array.from(map.entries()).map(([zone, stats]) => ({ zone, ...stats }))
  }, [rows])

  return (
    <div className="flex flex-wrap gap-3">
      {zones.map(({ zone, total, occupied, blocked }) => (
        <div key={zone} className="flex items-center gap-2">
          <div className="rounded border bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-zinc-600">
            {zone}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-zinc-500">
            <span className="font-medium text-zinc-700">{total}</span> pos.
            {occupied > 0 && (
              <>
                <Separator orientation="vertical" className="mx-0.5 h-3" />
                <span className="text-blue-600">{occupied} ocup.</span>
              </>
            )}
            {blocked > 0 && (
              <>
                <Separator orientation="vertical" className="mx-0.5 h-3" />
                <span className="text-destructive">{blocked} bloq.</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
