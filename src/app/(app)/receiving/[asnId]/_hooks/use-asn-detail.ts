'use client'

import { useMemo } from 'react'
import { useWmsStore } from '@/store/wms-store'
import { abcByProduct } from '@/store/selectors'
import { useStoreHelpers } from '@/hooks/use-store-helpers'
import type { Asn, Product, PurchaseOrder, StockMovement, InventoryItem } from '@/types/wms'

const TODAY = '2026-06-10'

export interface AsnDetail {
  asn: Asn
  product: Product
  po: PurchaseOrder | null
  movements: StockMovement[]
  stagingInventory: InventoryItem | null
  abcClass: string
  progressPct: number
  pendingQty: number
  isOverdue: boolean
  isDone: boolean
  finalLocationCode: string | null
  canReceive: boolean
  canPutaway: boolean
  canQc: boolean
}

export const useAsnDetail = (asnId: string): AsnDetail | null => {
  const state = useWmsStore()
  const { locationCode } = useStoreHelpers()

  const abc = useMemo(() => abcByProduct(state), [state.demandStats, state.inventoryItems])

  const asn = state.asnRecords.find((a) => a.id === asnId)
  const product = asn ? state.products.find((p) => p.id === asn.productId) : null

  const movements = useMemo(
    () => state.stockMovements.filter((m) => m.referenceType === 'asn' && m.referenceId === asnId),
    [state.stockMovements, asnId]
  )

  if (!asn || !product) return null

  const po = asn.purchaseOrderId
    ? state.purchaseOrders.find((p) => p.id === asn.purchaseOrderId) ?? null
    : null

  const stagingLocationId = asn.requiresQualityControl ? 'loc-qc' : 'loc-stageout'
  const stagingInventory =
    state.inventoryItems.find(
      (i) => i.productId === asn.productId && i.locationId === stagingLocationId
    ) ?? null

  const abcClass = abc[asn.productId] ?? 'C'
  const progressPct =
    asn.expectedQuantity > 0 ? Math.round((asn.receivedQuantity / asn.expectedQuantity) * 100) : 0
  const pendingQty = asn.expectedQuantity - asn.receivedQuantity

  const isOverdue =
    asn.appointmentDate < TODAY &&
    asn.status !== 'completed' &&
    asn.status !== 'short_received' &&
    asn.status !== 'cancelled'

  const isDone = asn.status === 'putaway_done'

  const finalPutawayMovement = isDone
    ? [...movements].reverse().find((m) => m.type === 'putaway' && m.fromLocationId !== 'loc-qc')
    : null
  const finalLocationCode = finalPutawayMovement?.toLocationId
    ? locationCode(finalPutawayMovement.toLocationId)
    : null

  const canReceive =
    asn.status === 'pending' || asn.status === 'partial' || asn.status === 'in_progress'
  const canPutaway =
    asn.status === 'completed' || (!asn.requiresQualityControl && asn.status === 'partial')
  const canQc = asn.requiresQualityControl && asn.status === 'partial'

  return {
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
  }
}
