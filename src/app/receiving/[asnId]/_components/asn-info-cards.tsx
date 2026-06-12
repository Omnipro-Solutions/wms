import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  FileText,
  ShieldCheck,
  XCircle,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { formatDate, formatNumber } from '@/lib/formatters'
import type { Asn, PurchaseOrder } from '@/types/wms'

// ─── Primitives ───────────────────────────────────────────────────────────────

const Field = ({
  label,
  value,
  mono = false,
  children,
}: {
  label: string
  value?: string
  mono?: boolean
  children?: React.ReactNode
}) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
      {label}
    </span>
    {children ?? (
      <span className={cn('text-sm font-semibold text-foreground', mono && 'font-mono')}>
        {value ?? '—'}
      </span>
    )}
  </div>
)

const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <div className="flex items-center gap-2">
    <Icon className="size-3.5 text-muted-foreground/60" />
    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
      {title}
    </span>
  </div>
)

// ─── Discrepancy reasons ──────────────────────────────────────────────────────

const DISCREPANCY_REASONS = [
  { value: 'short_shipped', label: 'Proveedor envió menos de lo pactado' },
  { value: 'damaged', label: 'Unidades llegaron dañadas' },
  { value: 'refused', label: 'Unidades rechazadas por calidad' },
  { value: 'count_error', label: 'Error de conteo' },
]

// ─── Left panel (info + progress + flags unified) ─────────────────────────────

interface LeftPanelProps {
  asn: Asn
  po: PurchaseOrder | null
  isOverdue: boolean
  progressPct: number
  pendingQty: number
  isDone: boolean
}

export const AsnLeftPanel = ({ asn, po, isOverdue, progressPct, pendingQty, isDone }: LeftPanelProps) => {
  const isGreen = isDone || progressPct === 100
  const showFlags = asn.requiresQualityControl || asn.crossDocking || asn.closeReason
  const qcApproved = isDone || asn.status === 'completed'

  return (
    <Card className="shadow-sm">
      <CardContent className="p-0">
        {/* ── Info section ── */}
        <div className="px-4 pt-4 pb-3">
          <SectionHeader icon={FileText} title="Información de recepción" />
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3.5">
            <Field label="N° Aviso" value={asn.code} mono />
            <Field label="Proveedor" value={asn.supplierName} />
            <Field label="Fecha de cita">
              <div className="flex items-center gap-1.5">
                <CalendarDays
                  className={cn('size-3.5 shrink-0', isOverdue ? 'text-red-500' : 'text-muted-foreground/60')}
                />
                <span className={cn('text-sm font-semibold', isOverdue && 'text-red-600')}>
                  {formatDate(asn.appointmentDate)}
                </span>
              </div>
            </Field>
            <Field label="Origen">
              <Badge variant="outline" className="w-fit text-xs font-medium capitalize">
                {asn.sourceType === 'purchase'
                  ? 'Compra'
                  : asn.sourceType === 'internal_transfer'
                    ? 'Traslado'
                    : 'Ajuste'}
              </Badge>
            </Field>
            {po && (
              <div className="col-span-2">
                <Field label="Orden de compra" value={po.code} mono />
              </div>
            )}
            {asn.receptionNotes && (
              <div className="col-span-2">
                <Field label="Notas" value={asn.receptionNotes} />
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* ── Progress section ── */}
        <div className="px-4 py-3">
          <SectionHeader icon={CheckCircle2} title="Progreso de recepción" />
          <div className="mt-3 space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <span className="text-3xl font-bold tabular-nums leading-none">
                  {formatNumber(asn.receivedQuantity)}
                </span>
                <span className="ml-1.5 text-sm text-muted-foreground">
                  / {formatNumber(asn.expectedQuantity)} uds
                </span>
              </div>
              <span
                className={cn(
                  'text-2xl font-bold tabular-nums',
                  isGreen
                    ? 'text-emerald-600'
                    : progressPct > 0
                      ? 'text-amber-600'
                      : 'text-muted-foreground/40'
                )}
              >
                {progressPct}%
              </span>
            </div>

            <Progress
              value={progressPct}
              className={cn(
                'h-2 rounded-full',
                isGreen && '[&>div]:bg-emerald-500',
                !isDone && progressPct > 0 && progressPct < 100 && '[&>div]:bg-amber-400'
              )}
            />

            {asn.damagedQuantity > 0 && (
              <p className="text-xs font-medium text-red-500">
                {formatNumber(asn.damagedQuantity)} unidades dañadas registradas
              </p>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-emerald-50 px-2 py-2.5 text-center">
                <p className="text-lg font-bold text-emerald-600 tabular-nums">
                  {formatNumber(asn.receivedQuantity)}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600/70">
                  Recibidas
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 px-2 py-2.5 text-center">
                <p className="text-lg font-bold text-amber-600 tabular-nums">
                  {formatNumber(pendingQty)}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600/70">
                  Pendientes
                </p>
              </div>
              <div className="rounded-lg bg-muted/60 px-2 py-2.5 text-center">
                <p className="text-lg font-bold tabular-nums">{asn.deliveryCount}</p>
                <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                  Entregas
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Flags section ── */}
        {showFlags && (
          <>
            <Separator />
            <div className="px-4 py-3">
              <SectionHeader icon={ShieldCheck} title="Indicadores especiales" />
              <div className="mt-3 space-y-2">
                {asn.requiresQualityControl && (
                  qcApproved ? (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <ShieldCheck className="size-3.5 shrink-0 text-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-800">Inspección QC completada</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <ShieldCheck className="size-3.5 shrink-0 text-amber-500" />
                      <span className="text-xs font-semibold text-amber-800">Requiere inspección de calidad</span>
                    </div>
                  )
                )}
                {asn.crossDocking && (
                  <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                    <Zap className="size-3.5 shrink-0 text-blue-500" />
                    <span className="text-xs font-semibold text-blue-800">Cross-docking — salida directa</span>
                  </div>
                )}
                {asn.closeReason && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <XCircle className="mt-0.5 size-3.5 shrink-0 text-red-500" />
                    <div>
                      <p className="text-xs font-semibold text-red-800">Cerrada con diferencia</p>
                      <p className="mt-0.5 text-[11px] text-red-600">
                        {DISCREPANCY_REASONS.find((r) => r.value === asn.closeReason)?.label ?? asn.closeReason}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Keep old exports for backward compat (used nowhere else but imported in page) ──

export const AsnInfoCard = ({ asn, po, isOverdue }: { asn: Asn; po: PurchaseOrder | null; isOverdue: boolean }) => null
export const AsnProgressCard = (_: unknown) => null
export const AsnFlagsCard = (_: unknown) => null

// ─── Completion banner ────────────────────────────────────────────────────────

interface CompletionBannerProps {
  receivedQty: number
  finalLocationCode: string | null
}

export const CompletionBanner = ({ receivedQty, finalLocationCode }: CompletionBannerProps) => (
  <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500">
      <CheckCircle2 className="size-4 text-white" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-emerald-800">Recepción completada</p>
      <p className="text-xs text-emerald-700">
        Mercancía ubicada
        {finalLocationCode && (
          <> en posición <span className="font-mono font-bold">{finalLocationCode}</span></>
        )}
        {' '}· {formatNumber(receivedQty)} uds en inventario disponible
      </p>
    </div>
  </div>
)

// ─── Overdue badge ────────────────────────────────────────────────────────────

export const OverdueBadge = () => (
  <Badge variant="destructive" className="gap-1 text-xs">
    <AlertTriangle className="size-3" /> Atrasada
  </Badge>
)
