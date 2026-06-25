'use client'

import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Hash,
  MapPin,
  PackageCheck,
  Trash2,
  User,
  Wrench,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { StatusBadge } from '@/components/shared/status-badge'
import { cn } from '@/lib/utils'
import type { Product, ReentryBatch, RepairTicket, ReturnInspection, ReturnOrder, ScrapRecord } from '@/types/wms'
import {
  DISPOSITION_COLORS,
  DISPOSITION_LABELS,
  TYPE_LABELS,
} from '../columns'

interface Props {
  open: boolean
  returnOrder: ReturnOrder | null
  inspection: ReturnInspection | undefined
  repairTickets: RepairTicket[]
  scrapRecord: ScrapRecord | undefined
  reentryBatch: ReentryBatch | undefined
  warehouseName: (id: string) => string
  productName: (id: string) => string
  getProduct: (id: string) => Product | undefined
  onClose: () => void
}

const CONDITION_LABELS: Record<string, string> = {
  new: 'Nuevo',
  like_new: 'Como nuevo',
  good: 'Buen estado',
  fair: 'Aceptable',
  defective: 'Defectuoso',
}

const CONDITION_COLORS: Record<string, string> = {
  new: 'bg-green-100 text-green-800',
  like_new: 'bg-emerald-100 text-emerald-800',
  good: 'bg-blue-100 text-blue-800',
  fair: 'bg-amber-100 text-amber-800',
  defective: 'bg-red-100 text-red-800',
}

const RESULT_LABELS: Record<string, string> = {
  pass: 'Aprobada',
  partial_pass: 'Aprobación parcial',
  fail: 'Rechazada',
}

const RESULT_STYLES: Record<string, string> = {
  pass: 'bg-green-100 text-green-800 border-green-200',
  partial_pass: 'bg-amber-100 text-amber-800 border-amber-200',
  fail: 'bg-red-100 text-red-800 border-red-200',
}

const REPAIR_TYPE_LABELS: Record<string, string> = {
  cosmetic: 'Cosmética',
  functional: 'Funcional',
  warranty: 'Garantía',
}

const REPAIR_STATUS_LABELS: Record<string, string> = {
  open: 'Abierto',
  in_progress: 'En proceso',
  ready_to_receive: 'Listo para recibir',
  received: 'Recibido',
  completed: 'Completado',
  failed: 'Fallido',
}

const SCRAP_METHOD_LABELS: Record<string, string> = {
  incinerate: 'Incineración',
  landfill: 'Relleno sanitario',
  donate: 'Donación',
  liquidate: 'Liquidación',
  recycle: 'Reciclaje',
}

const InfoRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-border/50 last:border-0">
    <span className="text-xs text-muted-foreground shrink-0">{label}</span>
    <span className="text-xs text-right">{children}</span>
  </div>
)

export const ReturnDetailSheet = ({
  open,
  returnOrder,
  inspection,
  repairTickets,
  scrapRecord,
  reentryBatch,
  warehouseName,
  productName,
  getProduct,
  onClose,
}: Props) => {
  if (!returnOrder) return null

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto px-6">
        <SheetHeader className="pb-5 pt-2">
          <SheetTitle className="flex items-center gap-2 text-base">
            {returnOrder.rmaCode}
            <StatusBadge status={returnOrder.status} />
          </SheetTitle>
          <SheetDescription className="sr-only">
            Detalle de la devolución {returnOrder.rmaCode}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Identidad */}
          <section className="space-y-0.5">
            <InfoRow label="Cliente">
              <span className="flex items-center gap-1 font-medium">
                <User className="size-3" /> {returnOrder.customerName}
              </span>
            </InfoRow>
            <InfoRow label="Tipo">
              <Badge variant="outline" className="text-xs">
                {TYPE_LABELS[returnOrder.type]}
              </Badge>
            </InfoRow>
            <InfoRow label="Disposición">
              <Badge
                variant="outline"
                className={cn('text-xs', DISPOSITION_COLORS[returnOrder.disposition])}
              >
                {DISPOSITION_LABELS[returnOrder.disposition]}
              </Badge>
            </InfoRow>
            <InfoRow label="Ruta">
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                {warehouseName(returnOrder.originId)}
                <ArrowRight className="size-3" />
                {warehouseName(returnOrder.destinationId)}
              </span>
            </InfoRow>
            <InfoRow label="Creada">
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {format(parseISO(returnOrder.createdAt), 'dd MMM yyyy', { locale: es })}
              </span>
            </InfoRow>
          </section>

          <Separator />

          {/* Ítems */}
          <section>
            <p className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Ítems
            </p>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground" colSpan={2}>Producto</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground w-14">Uds.</th>
                    {inspection && (
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-28">Condición</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {returnOrder.items.map((line) => {
                    const product = getProduct(line.productId)
                    const itemInspection = inspection?.items.find(
                      (i) => i.returnLineId === line.id
                    )
                    return (
                      <tr key={line.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2 w-10">
                          {product?.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="size-8 rounded object-cover border border-border"
                            />
                          ) : (
                            <div className="size-8 rounded bg-muted border border-border" />
                          )}
                        </td>
                        <td className="px-2 py-2">{productName(line.productId)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{line.requestedQuantity}</td>
                        {inspection && (
                          <td className="px-3 py-2">
                            {itemInspection ? (
                              <Badge
                                className={CONDITION_COLORS[itemInspection.conditionRating]}
                                variant="outline"
                              >
                                {CONDITION_LABELS[itemInspection.conditionRating]}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Inspección */}
          {inspection && (
            <>
              <Separator />
              <section>
                <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <ClipboardCheck className="size-3" /> Inspección
                </p>
                <div
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs space-y-1',
                    RESULT_STYLES[inspection.overallResult]
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span>Inspector: <strong>{inspection.inspectorName}</strong></span>
                    <Badge
                      variant="outline"
                      className={cn('text-xs font-semibold', RESULT_STYLES[inspection.overallResult])}
                    >
                      {RESULT_LABELS[inspection.overallResult]}
                    </Badge>
                  </div>
                  <p className="text-xs opacity-80">
                    {format(parseISO(inspection.inspectedAt), 'dd MMM yyyy HH:mm', { locale: es })}
                  </p>
                  {inspection.notes && (
                    <p className="text-xs opacity-80 italic">{inspection.notes}</p>
                  )}
                </div>
                {inspection.items.some((i) => i.serial) && (
                  <div className="mt-2 space-y-1">
                    {inspection.items.filter((i) => i.serial).map((item) => (
                      <div
                        key={item.returnLineId}
                        className={cn(
                          'flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs',
                          item.serialMatchesDispatch === false
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : item.serialMatchesDispatch === true
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-border bg-muted/30 text-muted-foreground'
                        )}
                      >
                        <Hash className="size-3 shrink-0" />
                        <span className="font-mono font-semibold">{item.serial}</span>
                        <span className="text-[10px]">
                          {item.serialMatchesDispatch === true && '✓ Verificado'}
                          {item.serialMatchesDispatch === false && '⚠ No encontrado'}
                          {item.serialMatchesDispatch === undefined && '— Sin verificación'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {/* Tickets de reparación */}
          {repairTickets.length > 0 && (
            <>
              <Separator />
              <section>
                <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Wrench className="size-3" /> Reparaciones
                </p>
                <div className="space-y-2">
                  {repairTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{ticket.vendorName}</span>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-700">
                            {REPAIR_TYPE_LABELS[ticket.repairType]}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {REPAIR_STATUS_LABELS[ticket.status]}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs opacity-80">
                        Retorno esperado: {format(parseISO(ticket.expectedReturnDate), 'dd MMM yyyy', { locale: es })}
                      </p>
                      {ticket.finalCostUsd !== undefined && (
                        <p className="text-xs opacity-80">Costo final: USD {ticket.finalCostUsd}</p>
                      )}
                      {ticket.outcomeNotes && (
                        <p className="text-xs opacity-70 italic">{ticket.outcomeNotes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Reingreso */}
          {reentryBatch && (
            <>
              <Separator />
              <section>
                <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <PackageCheck className="size-3" /> Reingreso
                </p>
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Operador: <strong>{reentryBatch.operatorName}</strong></span>
                    <Badge variant="outline" className="text-[10px] border-green-300 text-green-700">
                      {reentryBatch.status === 'executed' ? 'Ejecutado' : 'Pendiente'}
                    </Badge>
                  </div>
                  <p className="opacity-80">
                    {format(parseISO(reentryBatch.createdAt), 'dd MMM yyyy HH:mm', { locale: es })}
                  </p>
                </div>
              </section>
            </>
          )}

          {/* Scrap */}
          {scrapRecord && (
            <>
              <Separator />
              <section>
                <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Trash2 className="size-3" /> Baja (Scrap)
                </p>
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Operador: <strong>{scrapRecord.operatorName}</strong></span>
                    <Badge variant="outline" className="text-[10px] border-red-300 text-red-700">
                      {SCRAP_METHOD_LABELS[scrapRecord.disposalMethod]}
                    </Badge>
                  </div>
                  <p className="opacity-80">
                    {format(parseISO(scrapRecord.createdAt), 'dd MMM yyyy HH:mm', { locale: es })}
                  </p>
                  {scrapRecord.referenceDoc && (
                    <p className="opacity-80">Ref: {scrapRecord.referenceDoc}</p>
                  )}
                  {scrapRecord.notes && (
                    <p className="opacity-70 italic">{scrapRecord.notes}</p>
                  )}
                </div>
              </section>
            </>
          )}

          {/* Estado terminal */}
          {(returnOrder.status === 'closed' || returnOrder.status === 'rejected') && (
            <>
              <Separator />
              <div className="flex items-center gap-2 rounded-lg border border-muted px-3 py-2 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 shrink-0" />
                <span>
                  {returnOrder.status === 'closed' ? 'Devolución cerrada.' : 'Devolución rechazada.'}
                </span>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
