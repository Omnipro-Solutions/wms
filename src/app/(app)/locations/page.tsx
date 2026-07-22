'use client'

import { useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import {
  AlertOctagon,
  CheckCircle2,
  Grid3x3,
  Layers,
  Lock,
  LockOpen,
  MapPin,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Star,
  Trash2,
  TriangleAlert,
  Warehouse as WarehouseIcon,
  X,
} from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable, DataTableColumnHeader } from '@/components/data-table'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/formatters'
import {
  isGoldenEligible,
  locationHierarchyPath,
  locationUtilizationPct,
  LOCATION_TYPE_LABELS,
} from '@/lib/rules/locations'
import type { StorageLocation } from '@/types/wms'
import { GenerateLayoutDialog } from './_components/generate-layout-dialog'
import { LocationFormDialog } from './_components/location-form-dialog'
import { WarehouseMap, type LocationRow } from './_components/warehouse-map'

// Virtual slots (en tránsito / recibo de traslado) are pipeline placeholders,
// not physical positions of the layout — kept out of this structure view.
const VIRTUAL_ZONES = new Set(['TR', 'RB'])

const TYPE_COLORS: Record<StorageLocation['type'], string> = {
  pick: 'border-blue-200 bg-blue-50 text-blue-700',
  reserve: 'border-violet-200 bg-violet-50 text-violet-700',
  quality_control: 'border-amber-200 bg-amber-50 text-amber-700',
  staging: 'border-teal-200 bg-teal-50 text-teal-700',
  returns: 'border-rose-200 bg-rose-50 text-rose-700',
}

// ── Cell sub-components ─────────────────────────────────────────────────────────

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
      <p className="text-muted-foreground text-[11px]">{locationHierarchyPath(loc)}</p>
    </div>
  </div>
)

const TypeBadge = ({ type }: { type: StorageLocation['type'] }) => (
  <Badge variant="outline" className={cn('text-xs', TYPE_COLORS[type])}>
    {LOCATION_TYPE_LABELS[type]}
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
  const barColor = pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'

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
  const color = score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-zinc-400'
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

// ── Column definitions ──────────────────────────────────────────────────────────

interface ColumnHandlers {
  onEdit: (loc: LocationRow) => void
  onBlock: (loc: LocationRow) => void
  onUnblock: (loc: LocationRow) => void
  onDelete: (loc: LocationRow) => void
  rackTypeName: (id?: string) => string
}

const buildColumns = (h: ColumnHandlers): ColumnDef<LocationRow>[] => [
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
    id: 'rackType',
    header: 'Estiba',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">{h.rackTypeName(row.original.rackTypeId)}</span>
    ),
    enableSorting: false,
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
          <p>{loc.volumeCapacityM3 > 0 ? `${loc.volumeCapacityM3} m³` : '—'}</p>
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="size-8 p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => h.onEdit(loc)}>
              <Pencil className="mr-2 size-3.5" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {loc.isBlocked ? (
              <DropdownMenuItem className="text-emerald-700 focus:text-emerald-700" onClick={() => h.onUnblock(loc)}>
                <LockOpen className="mr-2 size-3.5" />
                Desbloquear
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => h.onBlock(loc)}>
                <Lock className="mr-2 size-3.5" />
                Bloquear
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => h.onDelete(loc)}>
              <Trash2 className="mr-2 size-3.5" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LocationsPage() {
  const {
    warehouses,
    locations,
    rackTypes,
    reasons,
    inventoryItems,
    settings,
    blockLocation,
    unblockLocation,
    deleteLocation,
  } = useWmsStore()

  const firstWarehouseWithLocations =
    warehouses.find((w) => locations.some((l) => l.warehouseId === w.id && !VIRTUAL_ZONES.has(l.zone)))?.id ??
    warehouses[0]?.id ??
    ''

  const [warehouseId, setWarehouseId] = useState(firstWarehouseWithLocations)
  const [tab, setTab] = useState('map')
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [formDialog, setFormDialog] = useState<{ open: boolean; location: StorageLocation | null }>({
    open: false,
    location: null,
  })
  const [generateOpen, setGenerateOpen] = useState(false)
  const [blockLoc, setBlockLoc] = useState<LocationRow | null>(null)
  const [blockReasonId, setBlockReasonId] = useState('')
  const [blockError, setBlockError] = useState('')
  const [deleteLoc, setDeleteLoc] = useState<LocationRow | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const holdReasons = useMemo(() => reasons.filter((r) => r.context === 'hold' && r.active), [reasons])
  const rackTypeName = (id?: string) => (id ? rackTypes.find((r) => r.id === id)?.name ?? '—' : '—')

  const rows = useMemo<LocationRow[]>(() => {
    return locations
      .filter((loc) => loc.warehouseId === warehouseId && !VIRTUAL_ZONES.has(loc.zone))
      .map((loc) => {
        const items = inventoryItems.filter((i) => i.locationId === loc.id && i.onHandQuantity > 0)
        const onHandUnits = items.reduce((s, i) => s + i.onHandQuantity, 0)
        const skuCount = new Set(items.map((i) => i.productId)).size
        const utilizationPct = locationUtilizationPct(onHandUnits, loc.volumeCapacityM3)
        return { ...loc, onHandUnits, skuCount, utilizationPct }
      })
  }, [locations, inventoryItems, warehouseId])

  const filteredRows = useMemo(() => {
    let result = selectedZone ? rows.filter((r) => r.zone === selectedZone) : rows
    if (typeFilter !== 'all') result = result.filter((r) => r.type === typeFilter)
    if (statusFilter === 'occupied') result = result.filter((r) => r.onHandUnits > 0 && !r.isBlocked)
    else if (statusFilter === 'available') result = result.filter((r) => r.onHandUnits === 0 && !r.isBlocked)
    else if (statusFilter === 'blocked') result = result.filter((r) => r.isBlocked)
    else if (statusFilter === 'golden') result = result.filter((r) => r.golden)
    return result
  }, [rows, selectedZone, typeFilter, statusFilter])

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalLocations = rows.length
  const occupiedCount = rows.filter((r) => r.onHandUnits > 0 && !r.isBlocked).length
  const availableCount = rows.filter((r) => r.onHandUnits === 0 && !r.isBlocked).length
  const blockedCount = rows.filter((r) => r.isBlocked).length
  const goldenMismatchCount = rows.filter(
    (r) => r.type === 'pick' && isGoldenEligible(r, settings) !== r.golden
  ).length

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleNew = () => setFormDialog({ open: true, location: null })
  const handleEdit = (loc: LocationRow) => setFormDialog({ open: true, location: loc })
  const handleOpenBlock = (loc: LocationRow) => {
    setBlockLoc(loc)
    setBlockReasonId('')
    setBlockError('')
  }
  const handleUnblock = (loc: LocationRow) => unblockLocation(loc.id)
  const handleConfirmBlock = () => {
    if (!blockLoc) return
    try {
      blockLocation(blockLoc.id, blockReasonId || undefined)
      setBlockLoc(null)
    } catch (e: unknown) {
      setBlockError(e instanceof Error ? e.message : 'No se pudo bloquear la ubicación')
    }
  }
  const handleOpenDelete = (loc: LocationRow) => {
    setDeleteLoc(loc)
    setDeleteError('')
  }
  const handleConfirmDelete = () => {
    if (!deleteLoc) return
    try {
      deleteLocation(deleteLoc.id)
      setDeleteLoc(null)
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'No se pudo eliminar la ubicación')
    }
  }

  const columns = useMemo(
    () =>
      buildColumns({
        onEdit: handleEdit,
        onBlock: handleOpenBlock,
        onUnblock: handleUnblock,
        onDelete: handleOpenDelete,
        rackTypeName,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rackTypes]
  )

  const hasActiveFilters = typeFilter !== 'all' || statusFilter !== 'all' || selectedZone !== null

  const filtersNode = (
    <div className="flex flex-wrap items-center gap-2">
      {selectedZone && (
        <Badge
          variant="outline"
          className="h-8 gap-1.5 border-zinc-300 pl-2.5 pr-1.5 text-xs font-medium"
        >
          Zona {selectedZone}
          <button
            type="button"
            onClick={() => setSelectedZone(null)}
            className="hover:bg-muted flex size-4 items-center justify-center rounded-full"
            aria-label="Quitar filtro de zona"
          >
            <X className="size-3" />
          </button>
        </Badge>
      )}
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
          <SelectItem value="golden">Golden</SelectItem>
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
            setSelectedZone(null)
          }}
        >
          Limpiar
        </Button>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ubicaciones y layout"
        description="Modelo digital del almacén — jerarquía zona → pasillo → rack → nivel → posición, con ocupación, accesibilidad y estado operativo."
        actions={
          <div className="flex items-center gap-2">
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="h-9 w-56">
                <WarehouseIcon className="text-muted-foreground size-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => setGenerateOpen(true)}>
              <Grid3x3 className="mr-1.5 size-3.5" />
              Generar layout
            </Button>
            <Button size="sm" onClick={handleNew}>
              <Plus className="mr-1.5 size-3.5" />
              Nueva ubicación
            </Button>
          </div>
        }
      />

      {/* ── KPI row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          icon={WarehouseIcon}
          value={totalLocations}
          label="Ubicaciones"
          sublabel={`${occupiedCount} ocupadas`}
          tone="neutral"
        />
        <KpiCard
          icon={CheckCircle2}
          value={availableCount}
          label="Disponibles"
          sublabel="Sin stock actual"
          tone="green"
        />
        <KpiCard
          icon={Star}
          value={goldenMismatchCount}
          label="Golden desalineadas"
          sublabel={goldenMismatchCount > 0 ? 'Reclasificar en Config.' : 'Alineado con umbral'}
          tone={goldenMismatchCount > 0 ? 'amber' : 'green'}
        />
        <KpiCard
          icon={Lock}
          value={blockedCount}
          label="Bloqueadas"
          sublabel={blockedCount > 0 ? 'Requieren atención' : 'Sin bloqueos activos'}
          tone={blockedCount > 0 ? 'red' : 'neutral'}
        />
      </div>

      {/* ── Map (primary) / list (secondary) ─────────────────────────────── */}
      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="map">
              <MapPin className="mr-1.5 size-3.5" />
              Mapa
            </TabsTrigger>
            <TabsTrigger value="list">
              <Layers className="mr-1.5 size-3.5" />
              Listado
            </TabsTrigger>
          </TabsList>
          <p className="text-muted-foreground hidden text-xs sm:block">
            Clic en una posición para editarla · clic en una zona para ver su uso
          </p>
        </div>

        <TabsContent value="map">
          <WarehouseMap
            rows={rows}
            settings={settings}
            selectedZone={selectedZone}
            onSelectZone={setSelectedZone}
            onViewList={(zone) => {
              setSelectedZone(zone)
              setTab('list')
            }}
            onSelect={handleEdit}
          />
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <MapPin className="text-muted-foreground size-4" />
                <CardTitle className="text-base">Listado de ubicaciones</CardTitle>
              </div>
              <CardDescription>
                Búsqueda, orden y atributos completos (estiba, capacidad, accesibilidad) de cada posición.
              </CardDescription>
            </CardHeader>
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
        </TabsContent>
      </Tabs>

      {/* ── Create / edit dialog ─────────────────────────────────────────── */}
      <LocationFormDialog
        open={formDialog.open}
        location={formDialog.location}
        onClose={() => setFormDialog({ open: false, location: null })}
      />

      {/* ── Bulk layout generator ────────────────────────────────────────── */}
      <GenerateLayoutDialog
        open={generateOpen}
        warehouseId={warehouseId}
        onClose={() => setGenerateOpen(false)}
      />

      {/* ── Block dialog (with reason) ───────────────────────────────────── */}
      <Dialog open={!!blockLoc} onOpenChange={(o) => !o && setBlockLoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear ubicación</DialogTitle>
            <DialogDescription>
              La ubicación quedará marcada como bloqueada. No se podrán realizar nuevas operaciones de
              putaway ni picking sobre ella.
            </DialogDescription>
          </DialogHeader>

          {blockLoc && (
            <div className="space-y-3 py-1">
              <div className="rounded-lg border bg-zinc-50 px-4 py-3 dark:bg-zinc-900/40">
                <div className="flex items-center gap-3">
                  <div className="border-destructive/30 bg-destructive/10 flex size-9 items-center justify-center rounded-md border">
                    <Lock className="text-destructive size-4" />
                  </div>
                  <div>
                    <p className="font-mono text-sm font-semibold">{blockLoc.code}</p>
                    <p className="text-muted-foreground text-xs">
                      {locationHierarchyPath(blockLoc)} · {LOCATION_TYPE_LABELS[blockLoc.type]}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Motivo del bloqueo</label>
                <Select value={blockReasonId} onValueChange={setBlockReasonId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar motivo (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {holdReasons.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {blockLoc.onHandUnits > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/40">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Esta ubicación tiene{' '}
                    <span className="font-semibold">{formatNumber(blockLoc.onHandUnits)} unidades</span> en
                    stock.
                    {settings.blockRequiresEmptyLocation
                      ? ' La configuración exige vaciarla antes de bloquear.'
                      : ' El inventario permanecerá, pero no se podrán realizar nuevas operaciones.'}
                  </p>
                </div>
              )}

              {blockError && <p className="text-destructive text-sm">{blockError}</p>}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockLoc(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmBlock}>
              Bloquear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!deleteLoc} onOpenChange={(o) => !o && setDeleteLoc(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar ubicación</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Solo se pueden eliminar ubicaciones sin stock.
            </DialogDescription>
          </DialogHeader>
          {deleteLoc && (
            <div className="space-y-3 py-1">
              <div className="rounded-lg border bg-zinc-50 px-4 py-3 dark:bg-zinc-900/40">
                <p className="font-mono text-sm font-semibold">{deleteLoc.code}</p>
                <p className="text-muted-foreground text-xs">{locationHierarchyPath(deleteLoc)}</p>
              </div>
              {deleteError && <p className="text-destructive text-sm">{deleteError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteLoc(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Zone summary strip ──────────────────────────────────────────────────────────

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
          <div className="rounded border bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {zone}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-zinc-500">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{total}</span> pos.
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
