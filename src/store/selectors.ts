import { availableStock } from '@/lib/rules/inventory'
import {
  classifyAbc,
  estimatedDistanceSaved,
  estimatedTimeSaved,
  slottingScore,
} from '@/lib/rules/slotting'
import { otifPercentage } from '@/lib/rules/shipping'
import type { WmsState } from './wms-store'
import type { AbcClass, SlottingRecommendation } from '@/types/wms'

export interface DashboardKpis {
  pendingOrders: number
  ordersInPicking: number
  partialPickingTasks: number
  activeWaves: number
  pendingReceipts: number
  returnsInTransit: number
  inventoryOnHold: number
  activeRoutes: number
  otif: number
  misplacedAClassSkus: number
  criticalAlerts: number
}

// ABC class per product, computed from demand stats (picking frequency).
export function abcByProduct(state: WmsState): Record<string, AbcClass> {
  return classifyAbc(
    state.demandStats.map((d) => ({ productId: d.productId, metric: d.pickingFrequency })),
    state.settings.abcThresholdA,
    state.settings.abcThresholdB
  )
}

// A-class inventory items that are NOT in a golden pick face.
export function misplacedAClassItems(state: WmsState) {
  const abc = abcByProduct(state)
  return state.inventoryItems.filter((item) => {
    if (abc[item.productId] !== 'A') return false
    const loc = state.locations.find((l) => l.id === item.locationId)
    return !loc?.golden
  })
}

export function selectDashboardKpis(state: WmsState): DashboardKpis {
  const pendingOrders = state.commerceOrders.filter((o) => o.status === 'pending').length
  const ordersInPicking = state.commerceOrders.filter((o) => o.status === 'in_progress').length
  const partialPickingTasks = state.pickingTasks.filter((t) =>
    ['partially_picked', 'partial_with_shortage', 'partial_approved', 'partial_rejected'].includes(
      t.status
    )
  ).length
  const activeWaves = state.pickingWaves.filter((w) => w.status === 'in_progress').length
  const pendingReceipts = state.asnRecords.filter(
    (a) => a.status === 'pending' || a.status === 'partial'
  ).length
  const returnsInTransit = state.returnOrders.filter((r) => r.status === 'in_transit_to_dc').length
  const inventoryOnHold = state.inventoryItems.reduce((sum, i) => sum + i.holdQuantity, 0)
  const activeRoutes = state.sapRoutes.filter(
    (r) => r.status === 'in_transit' || r.status === 'in_progress'
  ).length
  const otif = otifPercentage(state.shipments)
  const misplaced = misplacedAClassItems(state).length
  const integrationErrors = state.integrations.filter((i) => i.status === 'error').length
  const criticalAlerts = integrationErrors + (otif < 90 ? 1 : 0) + misplaced

  return {
    pendingOrders,
    ordersInPicking,
    partialPickingTasks,
    activeWaves,
    pendingReceipts,
    returnsInTransit,
    inventoryOnHold,
    activeRoutes,
    otif,
    misplacedAClassSkus: misplaced,
    criticalAlerts,
  }
}

// Top slotting relocation opportunities, computed live.
export function selectSlottingRecommendations(state: WmsState): SlottingRecommendation[] {
  const abc = abcByProduct(state)
  const goldenCandidates = state.locations.filter((l) => l.golden && l.isPickFace)
  const recs: SlottingRecommendation[] = []

  for (const item of state.inventoryItems) {
    const product = state.products.find((p) => p.id === item.productId)
    const current = state.locations.find((l) => l.id === item.locationId)
    const demand = state.demandStats.find((d) => d.productId === item.productId)
    if (!product || !current || !demand) continue
    const abcClass = abc[item.productId] ?? 'C'

    let best: { loc: (typeof goldenCandidates)[number]; score: number } | null = null
    for (const candidate of goldenCandidates) {
      if (candidate.id === current.id) continue
      const score = slottingScore({
        abcClass,
        product: { unitWeightKg: product.unitWeightKg },
        current,
        candidate,
      })
      if (score > 0 && (!best || score > best.score)) best = { loc: candidate, score }
    }
    if (!best) continue

    const distanceSaved = estimatedDistanceSaved(
      current.distanceToDispatchM,
      best.loc.distanceToDispatchM,
      demand.pickingFrequency
    )
    recs.push({
      id: `rec-${item.id}`,
      productId: item.productId,
      abcClass,
      xyzClass: 'X',
      currentLocationId: current.id,
      suggestedLocationId: best.loc.id,
      rotationRate: demand.pickingFrequency,
      unitsSold: demand.unitsSold,
      pickingFrequency: demand.pickingFrequency,
      score: best.score,
      estimatedDistanceSavedM: distanceSaved,
      estimatedTimeSavedSeconds: estimatedTimeSaved(distanceSaved),
      recommendation: `Reubicar ${product.name} (clase ${abcClass}) a ${best.loc.code} para reducir distancia de picking.`,
    })
  }

  return recs.sort((a, b) => b.score - a.score)
}

export { availableStock }
