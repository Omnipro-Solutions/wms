import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  PackageCheck,
  ShieldX,
  Truck,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatDateTime, formatNumber } from '@/lib/formatters'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import type { InventoryItem, StockMovement } from '@/types/wms'

interface MovementConfig {
  icon: React.ReactNode
  label: string
  dotClass: string
  lineClass: string
  badgeClass: string
}

const MOVEMENT_CONFIG: Record<string, MovementConfig> = {
  receipt: {
    icon: <PackageCheck className="size-4" />,
    label: 'Entrada de mercancía',
    dotClass: 'bg-emerald-500 border-emerald-200',
    lineClass: 'bg-emerald-200',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  putaway: {
    icon: <MapPin className="size-4" />,
    label: 'Putaway — posición final',
    dotClass: 'bg-blue-500 border-blue-200',
    lineClass: 'bg-blue-200',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  putaway_qc: {
    icon: <ShieldX className="size-4" />,
    label: 'Aprobación QC → Staging',
    dotClass: 'bg-amber-500 border-amber-200',
    lineClass: 'bg-amber-200',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  adjustment: {
    icon: <ClipboardCheck className="size-4" />,
    label: 'Ajuste de diferencia',
    dotClass: 'bg-amber-500 border-amber-200',
    lineClass: 'bg-amber-200',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  hold: {
    icon: <XCircle className="size-4" />,
    label: 'Retención de stock',
    dotClass: 'bg-red-500 border-red-200',
    lineClass: 'bg-red-200',
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
  },
  release: {
    icon: <CheckCircle2 className="size-4" />,
    label: 'Liberación de stock',
    dotClass: 'bg-emerald-500 border-emerald-200',
    lineClass: 'bg-emerald-200',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
}

const DEFAULT_CONFIG: MovementConfig = {
  icon: <ArrowRight className="size-4" />,
  label: 'Movimiento',
  dotClass: 'bg-zinc-400 border-zinc-200',
  lineClass: 'bg-zinc-200',
  badgeClass: 'bg-zinc-100 text-zinc-600 border-zinc-200',
}

const resolveConfig = (mv: StockMovement): MovementConfig => {
  if (mv.type === 'putaway' && mv.fromLocationId === 'loc-qc') return MOVEMENT_CONFIG.putaway_qc
  return MOVEMENT_CONFIG[mv.type] ?? DEFAULT_CONFIG
}

const LocationPill = ({ code }: { code: string }) => (
  <span className="bg-muted/60 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs font-medium">
    <MapPin className="text-muted-foreground size-3" />
    {code}
  </span>
)

const MovementRow = ({ mv, isLast }: { mv: StockMovement; isLast: boolean }) => {
  const { locationCode } = useStoreHelpers()
  const config = resolveConfig(mv)
  const from = mv.fromLocationId ? locationCode(mv.fromLocationId) : null
  const to = mv.toLocationId ? locationCode(mv.toLocationId) : null

  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-white shadow-sm',
            config.dotClass
          )}
        >
          {config.icon}
        </div>
        {!isLast && <div className={cn('my-1 w-0.5 flex-1', config.lineClass)} />}
      </div>

      <div className={cn('min-w-0 flex-1', isLast ? 'pb-0' : 'pb-5')}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm leading-snug font-semibold">{config.label}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {formatDateTime(mv.createdAt)} · {mv.operatorName}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn('shrink-0 px-2.5 py-0.5 text-sm font-bold tabular-nums', config.badgeClass)}
          >
            {formatNumber(mv.quantity)} uds
          </Badge>
        </div>

        {(from || to) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {from && <LocationPill code={from} />}
            {from && to && <ArrowRight className="text-muted-foreground size-3 shrink-0" />}
            {to && <LocationPill code={to} />}
          </div>
        )}

        {(mv.lot || mv.serial) && (
          <div className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-xs">
            {mv.lot && (
              <span className="bg-muted rounded px-1.5 py-0.5 font-mono">Lote: {mv.lot}</span>
            )}
            {mv.serial && (
              <span className="bg-muted rounded px-1.5 py-0.5 font-mono">Serial: {mv.serial}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const EmptyTimeline = () => (
  <div className="text-muted-foreground flex flex-col items-center gap-3 py-10">
    <div className="bg-muted flex size-14 items-center justify-center rounded-full">
      <Truck className="size-6 opacity-40" />
    </div>
    <div className="text-center">
      <p className="text-sm font-medium">Sin movimientos registrados</p>
      <p className="mt-0.5 text-xs">
        Los eventos de recepción aparecerán aquí al registrar la primera entrega.
      </p>
    </div>
  </div>
)

interface StagingBannerProps {
  stagingInventory: InventoryItem
}

const StagingBanner = ({ stagingInventory }: StagingBannerProps) => {
  const { locationCode } = useStoreHelpers()
  const isOnHold = stagingInventory.status === 'on_hold'
  return (
    <div
      className={cn(
        'mt-4 flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3',
        isOnHold ? 'border-amber-200 bg-amber-50/50' : 'border-emerald-200 bg-emerald-50/50'
      )}
    >
      <MapPin
        className={cn('size-4 shrink-0', isOnHold ? 'text-amber-500' : 'text-emerald-600')}
      />
      <div className="text-xs">
        <span className="text-foreground font-semibold">
          {formatNumber(stagingInventory.onHandQuantity)} uds
        </span>
        <span className="text-muted-foreground"> aguardando en </span>
        <span className="text-foreground font-mono font-semibold">
          {locationCode(stagingInventory.locationId)}
        </span>
        <span className="text-muted-foreground mx-1.5">·</span>
        <StatusBadge
          status={stagingInventory.status}
          className="h-4 py-0 align-middle text-[10px]"
        />
      </div>
    </div>
  )
}

interface Props {
  movements: StockMovement[]
  stagingInventory: InventoryItem | null
}

export const MovementTimeline = ({ movements, stagingInventory }: Props) => (
  <>
    {movements.length === 0 ? (
      <EmptyTimeline />
    ) : (
      <div className="relative">
        {movements.map((mv, idx) => (
          <MovementRow key={mv.id} mv={mv} isLast={idx === movements.length - 1} />
        ))}
      </div>
    )}
    {stagingInventory && stagingInventory.onHandQuantity > 0 && (
      <StagingBanner stagingInventory={stagingInventory} />
    )}
  </>
)
