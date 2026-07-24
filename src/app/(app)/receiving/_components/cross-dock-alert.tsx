'use client'

import { Zap } from 'lucide-react'

import { useWmsStore } from '@/store/wms-store'
import { selectCrossDockOpportunities } from '@/store/selectors'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import type { Asn } from '@/types/wms'

interface Props {
  onOpenCrossDock: (asn: Asn) => void
}

/**
 * Alerta proactiva: en vez de esperar a que el operario abra el diálogo, avisa
 * cuando la mercancía que está entrando desbloquea un pedido pendiente.
 * Los backorders (sin stock que los cubra) se destacan primero.
 */
export const CrossDockAlert = ({ onOpenCrossDock }: Props) => {
  const state = useWmsStore()
  const { productName } = useStoreHelpers()
  const opportunities = selectCrossDockOpportunities(state)

  if (opportunities.length === 0) return null

  const backorders = opportunities.filter((o) => o.isBackorder)
  // Un mismo ASN puede desbloquear varios pedidos — se muestra una fila por ASN.
  const byAsn = [...new Map(opportunities.map((o) => [o.asnId, o])).values()]

  return (
    <Alert className="border-amber-300 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30">
      <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-900 dark:text-amber-200">
        {opportunities.length} oportunidad{opportunities.length === 1 ? '' : 'es'} de cross-docking
        {backorders.length > 0 && ` · ${backorders.length} en backorder`}
      </AlertTitle>
      <AlertDescription>
        <div className="mt-2 flex flex-col gap-2">
          {byAsn.slice(0, 4).map((op) => (
            <div
              key={`${op.asnId}-${op.productId}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-background/60 px-3 py-2 dark:border-amber-900/40"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono font-medium">{op.asnCode}</span>
                <span className="text-muted-foreground">→</span>
                <span>{productName(op.productId)}</span>
                <Badge variant="outline">{op.neededQuantity} u. pendientes</Badge>
                {op.isBackorder && (
                  <Badge className="bg-red-500/10 text-red-700 dark:text-red-300">Backorder</Badge>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const asn = state.asnRecords.find((a) => a.id === op.asnId)
                  if (asn) onOpenCrossDock(asn)
                }}
              >
                Enviar a despacho
              </Button>
            </div>
          ))}
          {byAsn.length > 4 && (
            <p className="text-xs text-muted-foreground">
              y {byAsn.length - 4} más en la pestaña Recibiendo.
            </p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}
