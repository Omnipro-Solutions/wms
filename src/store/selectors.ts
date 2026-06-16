import { availableStock } from '@/lib/rules/inventory'
import {
  buildAffinityMatrix,
  classifyAbc,
  classifyXyz,
  estimatedDistanceSaved,
  estimatedTimeSaved,
  idealLocationTier,
  slottingScore,
} from '@/lib/rules/slotting'
import type { ProductAffinityPair } from '@/lib/rules/slotting'
import { otifPercentage } from '@/lib/rules/shipping'
import type { WmsState } from './wms-store'
import type { AbcClass, SlottingRecommendation, XyzClass } from '@/types/wms'

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

// XYZ class per product, computed from demand variability (coefficient of variation).
export function xyzByProduct(state: WmsState): Record<string, XyzClass> {
  const result: Record<string, XyzClass> = {}
  for (const d of state.demandStats) {
    result[d.productId] = classifyXyz(d.demandSamples, state.settings.xyzCvX, state.settings.xyzCvY)
  }
  return result
}

// Items misplaced according to their ABC/XYZ combined tier.
// AX and AY items outside golden zones, or CZ items inside golden zones.
export function misplacedItems(state: WmsState) {
  const abc = abcByProduct(state)
  const xyz = xyzByProduct(state)
  return state.inventoryItems.filter((item) => {
    const abcClass = abc[item.productId]
    const xyzClass = xyz[item.productId] ?? 'Z'
    const loc = state.locations.find((l) => l.id === item.locationId)
    if (!abcClass || !loc) return false
    const tier = idealLocationTier(abcClass, xyzClass)
    if (tier === 'golden' && !loc.golden) return true   // high-value item wasting remote slot
    if (tier === 'remote' && loc.golden) return true    // low-value item occupying prime slot
    return false
  })
}

// A-class inventory items that are NOT in a golden pick face (kept for dashboard KPI compatibility).
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
// Candidates now include ALL pick faces (not just golden) so CZ items in golden
// zones also appear as relocation opportunities (move them OUT).
export function selectSlottingRecommendations(state: WmsState): SlottingRecommendation[] {
  const abc = abcByProduct(state)
  const xyz = xyzByProduct(state)
  // Include non-golden pick faces too — needed for downgrade moves (CZ out of golden).
  const candidates = state.locations.filter((l) => l.isPickFace && !l.isBlocked)
  const recs: SlottingRecommendation[] = []

  for (const item of state.inventoryItems) {
    const product = state.products.find((p) => p.id === item.productId)
    const current = state.locations.find((l) => l.id === item.locationId)
    const demand = state.demandStats.find((d) => d.productId === item.productId)
    if (!product || !current || !demand) continue

    const abcClass: AbcClass = abc[item.productId] ?? 'C'
    const xyzClass: XyzClass = xyz[item.productId] ?? 'Z'

    let best: { loc: (typeof candidates)[number]; score: number } | null = null
    for (const candidate of candidates) {
      if (candidate.id === current.id) continue
      const score = slottingScore({
        abcClass,
        xyzClass,
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

    const tier = idealLocationTier(abcClass, xyzClass)
    const tierLabel =
      tier === 'golden' ? 'zona golden' : tier === 'remote' ? 'zona remota' : 'zona estándar'
    const recommendation = `Reubicar ${product.name} (${abcClass}${xyzClass}) a ${best.loc.code} [${tierLabel}] — ahorra ${Math.round(distanceSaved)} m por ciclo.`

    recs.push({
      id: `rec-${item.id}`,
      productId: item.productId,
      abcClass,
      xyzClass,
      currentLocationId: current.id,
      suggestedLocationId: best.loc.id,
      rotationRate: demand.pickingFrequency,
      unitsSold: demand.unitsSold,
      pickingFrequency: demand.pickingFrequency,
      score: best.score,
      estimatedDistanceSavedM: distanceSaved,
      estimatedTimeSavedSeconds: estimatedTimeSaved(distanceSaved),
      recommendation,
    })
  }

  return recs.sort((a, b) => b.score - a.score)
}

// Aggregated impact of applying ALL pending recommendations.
export interface SlottingImpactSummary {
  totalDistanceSavedM: number
  totalTimeSavedMin: number
  relocationsCount: number
  aClassToGoldenCount: number
  czOutOfGoldenCount: number
}

export function selectSlottingImpact(
  state: WmsState,
  activeRecs: SlottingRecommendation[]
): SlottingImpactSummary {
  let czOutOfGolden = 0

  for (const rec of activeRecs) {
    if (rec.abcClass === 'C' && rec.xyzClass === 'Z') {
      const currentLoc = state.locations.find((l) => l.id === rec.currentLocationId)
      if (currentLoc?.golden) czOutOfGolden++
    }
  }

  return {
    totalDistanceSavedM: Math.round(activeRecs.reduce((s, r) => s + r.estimatedDistanceSavedM, 0)),
    totalTimeSavedMin: Math.round(
      activeRecs.reduce((s, r) => s + r.estimatedTimeSavedSeconds, 0) / 60
    ),
    relocationsCount: activeRecs.length,
    aClassToGoldenCount: activeRecs.filter((r) => r.abcClass === 'A').length,
    czOutOfGoldenCount: czOutOfGolden,
  }
}

// ─── Batch simulation (what-if dry-run) ──────────────────────────────────────

export interface SimulationRow {
  productId: string
  productName: string
  abcClass: AbcClass
  xyzClass: XyzClass
  fromCode: string
  toCode: string
  isGoldenMove: boolean   // current → non-golden, candidate → golden
  score: number
  distanceSavedM: number
  timeSavedSeconds: number
}

export interface SimulationSummary {
  rows: SimulationRow[]
  totalDistanceSavedM: number
  totalTimeSavedMin: number
  aToGoldenCount: number
  czOutOfGoldenCount: number
}

export function simulateRelocateAll(
  state: WmsState,
  recs: SlottingRecommendation[]
): SimulationSummary {
  const rows: SimulationRow[] = recs.map((rec) => {
    const product = state.products.find((p) => p.id === rec.productId)
    const fromLoc = state.locations.find((l) => l.id === rec.currentLocationId)
    const toLoc = state.locations.find((l) => l.id === rec.suggestedLocationId)
    return {
      productId: rec.productId,
      productName: product?.name ?? rec.productId,
      abcClass: rec.abcClass,
      xyzClass: rec.xyzClass,
      fromCode: fromLoc?.code ?? rec.currentLocationId,
      toCode: toLoc?.code ?? rec.suggestedLocationId,
      isGoldenMove: !fromLoc?.golden && (toLoc?.golden ?? false),
      score: rec.score,
      distanceSavedM: rec.estimatedDistanceSavedM,
      timeSavedSeconds: rec.estimatedTimeSavedSeconds,
    }
  })

  const totalDistanceSavedM = Math.round(rows.reduce((s, r) => s + r.distanceSavedM, 0))
  const totalTimeSavedMin = Math.round(rows.reduce((s, r) => s + r.timeSavedSeconds, 0) / 60)
  const aToGoldenCount = rows.filter((r) => r.abcClass === 'A' && r.isGoldenMove).length
  const czOutOfGoldenCount = rows.filter(
    (r) => r.abcClass === 'C' && r.xyzClass === 'Z' && !r.isGoldenMove
  ).length

  return { rows, totalDistanceSavedM, totalTimeSavedMin, aToGoldenCount, czOutOfGoldenCount }
}

// ─── Replenishment needs ──────────────────────────────────────────────────────

export interface ReplenishmentNeed {
  productId: string
  pickFaceLocationId: string
  reserveLocationId: string
  currentStock: number
  minStock: number
  maxStock: number
  suggestedQuantity: number
  priority: 'high' | 'medium' | 'low'
  abcClass: AbcClass
}

// Detects pick faces whose stock is below minStock and have no active task already.
// Uses replenishmentHighFactor from settings to determine HIGH priority:
//   high   → stock < minStock * replenishmentHighFactor (e.g. < 50% of min)
//   medium → stock < minStock
//   (above minStock → not a need)
export function selectReplenishmentNeeds(state: WmsState): ReplenishmentNeed[] {
  const abc = abcByProduct(state)
  const { replenishmentHighFactor } = state.settings

  // Pick faces that already have an active (non-terminal) task — skip them.
  const activeDests = new Set(
    state.replenishmentTasks
      .filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
      .map((t) => t.destinationLocationId)
  )

  // Best reserve location per warehouse (highest maxWeightKg, not blocked).
  const reserveByWarehouse: Record<string, string> = {}
  for (const loc of state.locations) {
    if (loc.type !== 'reserve' || loc.isBlocked) continue
    const current = reserveByWarehouse[loc.warehouseId]
    if (!current) {
      reserveByWarehouse[loc.warehouseId] = loc.id
    }
  }

  const needs: ReplenishmentNeed[] = []

  for (const loc of state.locations) {
    if (!loc.isPickFace || loc.isBlocked) continue
    if (activeDests.has(loc.id)) continue

    // Sum available stock for all products in this pick face.
    const itemsHere = state.inventoryItems.filter(
      (i) => i.locationId === loc.id && i.status !== 'on_hold'
    )
    if (itemsHere.length === 0) continue

    for (const item of itemsHere) {
      // We need demand context to get minStock. Use the median of demandSamples as proxy.
      const demand = state.demandStats.find((d) => d.productId === item.productId)
      if (!demand) continue

      // Infer min/max from demand stats. Min = pickingFrequency × 2 periods, max = × 6.
      const minStock = Math.round(demand.pickingFrequency * 2)
      const maxStock = Math.round(demand.pickingFrequency * 6)
      if (minStock <= 0) continue

      const currentStock = item.onHandQuantity - item.reservedQuantity - item.holdQuantity
      if (currentStock >= minStock) continue

      const reserveLocationId = reserveByWarehouse[loc.warehouseId]
      if (!reserveLocationId) continue

      const highThreshold = minStock * replenishmentHighFactor
      const priority: 'high' | 'medium' | 'low' =
        currentStock < highThreshold ? 'high' : 'medium'

      needs.push({
        productId: item.productId,
        pickFaceLocationId: loc.id,
        reserveLocationId,
        currentStock,
        minStock,
        maxStock,
        suggestedQuantity: maxStock - currentStock,
        priority,
        abcClass: abc[item.productId] ?? 'C',
      })
    }
  }

  return needs.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.priority] - order[b.priority]
  })
}

// ─── Affinity recommendations ────────────────────────────────────────────────

export interface AffinityRecommendation {
  pair: ProductAffinityPair
  productNameA: string
  productNameB: string
  locationCodeA: string | null  // current pick location of A
  locationCodeB: string | null
  distanceBetweenM: number | null
  isAlreadyClose: boolean       // both already in the same zone
  suggestion: string
}

export function selectAffinityRecommendations(state: WmsState): AffinityRecommendation[] {
  const matrix = buildAffinityMatrix(state.commerceOrders)
  const CLOSE_THRESHOLD_M = 15  // locations within 15 m to dispatch are "close enough"

  return matrix.map((pair) => {
    const productA = state.products.find((p) => p.id === pair.productA)
    const productB = state.products.find((p) => p.id === pair.productB)

    const itemA = state.inventoryItems.find(
      (i) => i.productId === pair.productA && i.onHandQuantity > 0
    )
    const itemB = state.inventoryItems.find(
      (i) => i.productId === pair.productB && i.onHandQuantity > 0
    )

    const locA = itemA ? state.locations.find((l) => l.id === itemA.locationId) : null
    const locB = itemB ? state.locations.find((l) => l.id === itemB.locationId) : null

    const distanceBetweenM =
      locA && locB
        ? Math.abs(locA.distanceToDispatchM - locB.distanceToDispatchM)
        : null

    const isAlreadyClose =
      distanceBetweenM !== null && distanceBetweenM <= CLOSE_THRESHOLD_M

    const nameA = productA?.name ?? pair.productA
    const nameB = productB?.name ?? pair.productB
    const pct = Math.round(
      (pair.coOccurrences / Math.min(pair.totalOrdersA, pair.totalOrdersB)) * 100
    )

    const suggestion = isAlreadyClose
      ? `${nameA} y ${nameB} ya están próximos (${distanceBetweenM} m entre ubicaciones).`
      : distanceBetweenM !== null
        ? `Acercar ${nameA} y ${nameB} — separados ${distanceBetweenM} m, se piden juntos en el ${pct}% de las órdenes (lift ${pair.liftScore.toFixed(1)}×).`
        : `${nameA} y ${nameB} se piden juntos en el ${pct}% de las órdenes — verificar ubicaciones.`

    return {
      pair,
      productNameA: nameA,
      productNameB: nameB,
      locationCodeA: locA?.code ?? null,
      locationCodeB: locB?.code ?? null,
      distanceBetweenM,
      isAlreadyClose,
      suggestion,
    }
  })
}

// ─── Slotting snapshot trends ────────────────────────────────────────────────

export interface SlottingTrend {
  // delta between the two most recent snapshots; null if fewer than 2 snapshots
  misplacedDelta: number | null       // negative = improvement
  relocationsAvailableDelta: number | null
  distanceSavedDelta: number | null   // positive = more opportunity (worse)
  pendingReplenishmentDelta: number | null
  // percentage change for headline KPI (misplaced A-class), -100..+100
  misplacedPct: number | null
}

export function selectSlottingTrends(state: WmsState): SlottingTrend {
  const snaps = state.slottingSnapshots
  if (snaps.length < 2) {
    return {
      misplacedDelta: null,
      relocationsAvailableDelta: null,
      distanceSavedDelta: null,
      pendingReplenishmentDelta: null,
      misplacedPct: null,
    }
  }
  const prev = snaps[snaps.length - 2]
  const curr = snaps[snaps.length - 1]

  const misplacedDelta = curr.misplacedAClassCount - prev.misplacedAClassCount
  const misplacedPct =
    prev.misplacedAClassCount === 0
      ? null
      : Math.round((misplacedDelta / prev.misplacedAClassCount) * 100)

  return {
    misplacedDelta,
    relocationsAvailableDelta: curr.relocationsAvailable - prev.relocationsAvailable,
    distanceSavedDelta: curr.totalDistanceSavedM - prev.totalDistanceSavedM,
    pendingReplenishmentDelta: curr.pendingReplenishment - prev.pendingReplenishment,
    misplacedPct,
  }
}

export { availableStock }
