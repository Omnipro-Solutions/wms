'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, Package, PackageCheck, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { useReceiveDialog } from '../_hooks/use-receive-dialog'
import { ReceiveDialog } from '../_components/receive-dialog'
import { useQcDialog, QcDialog } from '../_components/qc-dialog'
import { usePutawayDialog, PutawayDialog } from '../_components/putaway-dialog'
import { useAsnDetail } from './_hooks/use-asn-detail'
import { AsnStepper } from './_components/asn-stepper'
import { MovementTimeline } from './_components/movement-timeline'
import { ProductCard } from './_components/product-card'
import { AsnLeftPanel, CompletionBanner, OverdueBadge } from './_components/asn-info-cards'
import { Badge } from '@/components/ui/badge'
import { ArrowRight } from 'lucide-react'

// ─── Not found state ──────────────────────────────────────────────────────────

const AsnNotFound = ({ onBack }: { onBack: () => void }) => (
  <div className="text-muted-foreground flex flex-col items-center gap-4 py-24">
    <Package className="size-12 opacity-30" />
    <p className="text-sm">Recepción no encontrada</p>
    <Button variant="outline" size="sm" onClick={onBack}>
      <ArrowLeft className="mr-1.5 size-4" /> Volver a Recepciones
    </Button>
  </div>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ asnId: string }>
}

export default function AsnDetailPage({ params }: PageProps) {
  const { asnId } = use(params)
  const router = useRouter()
  const handleBack = () => router.push('/receiving')

  const detail = useAsnDetail(asnId)

  const receiveState = useReceiveDialog()
  const qcState = useQcDialog()
  const putawayState = usePutawayDialog()

  if (!detail) return <AsnNotFound onBack={handleBack} />

  const {
    asn,
    product,
    po,
    movements,
    stagingInventory,
    abcClass,
    progressPct,
    pendingQty,
    isOverdue,
    isDone,
    finalLocationCode,
    canReceive,
    canPutaway,
    canQc,
  } = detail

  const handleOpenReceive = () =>
    receiveState.open({
      asnId,
      asnCode: asn.code,
      productName: product.name,
      supplierName: asn.supplierName,
      expectedTotal: asn.expectedQuantity,
      receivedSoFar: asn.receivedQuantity,
      pendingQty,
      deliveryCount: asn.deliveryCount,
      requiresQC: asn.requiresQualityControl,
      isCrossDocking: asn.crossDocking ?? false,
    })

  const handleOpenQc = () =>
    qcState.dialog.open({
      asnId,
      asnCode: asn.code,
      productName: product.name,
      supplierName: asn.supplierName,
      blockedQty: asn.receivedQuantity,
    })

  const handleOpenPutaway = () =>
    putawayState.open(asnId, asn.code, product.name, abcClass, asn.crossDocking ?? false)

  return (
    <>
      {/* ── Header card ── */}
      <Card className="mb-4 overflow-hidden shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-stretch gap-0">
            {/* Back nav — left accent strip */}
            <button
              onClick={handleBack}
              className="group flex flex-col items-center justify-center gap-1 border-r px-4 py-5"
            >
              <ArrowLeft className="text-muted-foreground size-4 transition-transform group-hover:-translate-x-0.5" />
              <span className="text-muted-foreground/60 text-[10px] font-semibold tracking-wider uppercase">
                Volver
              </span>
            </button>

            {/* Identity + stepper */}
            <div className="flex min-w-0 flex-1 flex-col">
              {/* Identity row */}
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl leading-none font-bold tracking-tight">{asn.code}</h1>
                    <StatusBadge status={asn.status} />
                    {isOverdue && <OverdueBadge />}
                  </div>
                  <p className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-xs">
                    <span className="text-foreground/60 font-semibold">{asn.supplierName}</span>
                    {po && (
                      <>
                        <span className="opacity-40">·</span>
                        <span className="font-mono">{po.code}</span>
                      </>
                    )}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {canQc && (
                    <Button
                      size="sm"
                      className="bg-amber-500 hover:bg-amber-600"
                      onClick={handleOpenQc}
                    >
                      <ShieldCheck className="mr-1.5 size-4" /> Inspeccionar QC
                    </Button>
                  )}
                  {canPutaway && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={handleOpenPutaway}
                    >
                      <MapPin className="mr-1.5 size-4" />
                      {asn.crossDocking ? 'Enviar a salida' : 'Asignar ubicación'}
                    </Button>
                  )}
                  {canReceive && (
                    <Button size="sm" onClick={handleOpenReceive}>
                      <PackageCheck className="mr-1.5 size-4" />
                      {asn.status === 'partial' ? 'Nueva entrega' : 'Registrar recepción'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Stepper row */}
              <div className="overflow-x-auto border-t px-5 py-3.5">
                <AsnStepper asn={asn} po={po} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Completion banner ── */}
      {isDone && (
        <CompletionBanner
          receivedQty={asn.receivedQuantity}
          finalLocationCode={finalLocationCode}
        />
      )}

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="lg:col-span-1">
          <AsnLeftPanel
            asn={asn}
            po={po}
            isOverdue={isOverdue}
            progressPct={progressPct}
            pendingQty={pendingQty}
            isDone={isDone}
          />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <ProductCard asn={asn} product={product} po={po} abcClass={abcClass} />

          <Card className="shadow-sm">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <ArrowRight className="text-muted-foreground size-4" /> Trazabilidad de movimientos
              </p>
              {movements.length > 0 && (
                <Badge variant="secondary" className="text-xs tabular-nums">
                  {movements.length} {movements.length === 1 ? 'evento' : 'eventos'}
                </Badge>
              )}
            </div>
            <CardContent>
              <MovementTimeline movements={movements} stagingInventory={stagingInventory} />
            </CardContent>
          </Card>
        </div>
      </div>

      <ReceiveDialog state={receiveState} />
      <QcDialog state={qcState} />
      <PutawayDialog state={putawayState} />
    </>
  )
}
