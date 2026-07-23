import { availableStock, isNearExpiration, agingDays, isLowRotation, resolveStockState } from '@/lib/rules/inventory'
import type { StockStateCode } from '@/lib/rules/inventory'
import {
  activeMatchingRules,
  buildAffinityMatrix,
  candidateAllowedByRules,
  classifyAbc,
  classifyXyz,
  estimatedDistanceSaved,
  estimatedTimeSaved,
  idealLocationTier,
  matchesSlottingRule,
  resolvePreferredTier,
  slottingScore,
} from '@/lib/rules/slotting'
import type { ProductAffinityPair } from '@/lib/rules/slotting'
import { otifPercentage } from '@/lib/rules/shipping'
import { productivityByOperator } from '@/lib/rules/picking'
import { isAppointmentAtRisk } from '@/lib/rules/yard'
import { dashboardHistory } from '@/data/seed'
import { statusLabel } from '@/lib/status'
import type { WmsState } from './wms-store'
import type {
  AbcClass,
  Dock,
  DockAppointment,
  InternalMoveTask,
  ProductivityRow,
  RouteSlottingRecommendation,
  SlottingRecommendation,
  XyzClass,
} from '@/types/wms'

export interface DashboardKpis {
  pendingOrders: number
  ordersInPicking: number
  partialPickingTasks: number
  activeWaves: number
  pendingReceipts: number
  returnsInTransit: number
  inventoryOnHold: number
  otif: number
  misplacedAClassSkus: number
  criticalAlerts: number
  // Sprint 2
  pendingAdjustments: number
  inventoryFreezeActive: boolean
  ira: number
  // Sprint 6
  expiringItems: number
  criticalStockItems: number
  // Sprint 7
  slaBreaches: number
  slaAtRisk: number
}

// ── Returns module (#12) KPIs ─────────────────────────────────────────────────
// Aggregated once here (per the architecture rule: KPIs live in selectors, never
// derived inline in components).
export interface ReturnsKpis {
  total: number
  active: number // non-terminal (not closed/rejected)
  inTransit: number
  underValidation: number // under_validation + sent_to_quality_control
  inspected: number
  toReenter: number
  inRepair: number
  openRepairTickets: number
  toScrap: number
  closed: number
  rejected: number
  returnRatePct: number // returns vs commerce orders (order-level proxy)
  avgCycleDays: number | null // avg days createdAt → closedAt over finished returns (null if none)
}

export const selectReturnsKpis = (state: WmsState): ReturnsKpis => {
  const returns = state.returnOrders
  let inTransit = 0,
    underValidation = 0,
    toReenter = 0,
    inRepair = 0,
    toScrap = 0,
    closed = 0,
    rejected = 0

  let cycleSum = 0
  let cycleCount = 0

  for (const r of returns) {
    switch (r.status) {
      case 'in_transit_to_dc':
        inTransit++
        break
      case 'under_validation':
      case 'sent_to_quality_control':
        underValidation++
        break
      case 'reentered':
        toReenter++
        break
      case 'sent_to_repair':
        inRepair++
        break
      case 'sent_to_scrap':
        toScrap++
        break
      case 'closed':
        closed++
        break
      case 'rejected':
        rejected++
        break
    }
    if (r.closedAt) {
      const days = Math.round(
        (new Date(r.closedAt).getTime() - new Date(r.createdAt).getTime()) / 86_400_000
      )
      if (Number.isFinite(days) && days >= 0) {
        cycleSum += days
        cycleCount++
      }
    }
  }

  const active = returns.filter((r) => r.status !== 'closed' && r.status !== 'rejected').length
  const openRepairTickets = state.repairTickets.filter(
    (t) => t.status !== 'completed' && t.status !== 'failed'
  ).length
  const orders = state.commerceOrders.length

  return {
    total: returns.length,
    active,
    inTransit,
    underValidation,
    inspected: state.returnInspections.length,
    toReenter,
    inRepair,
    openRepairTickets,
    toScrap,
    closed,
    rejected,
    returnRatePct: orders > 0 ? (returns.length / orders) * 100 : 0,
    avgCycleDays: cycleCount > 0 ? Math.round(cycleSum / cycleCount) : null,
  }
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
    if (tier === 'golden' && !loc.golden) return true // high-value item wasting remote slot
    if (tier === 'remote' && loc.golden) return true // low-value item occupying prime slot
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

export const selectExpiringItems = (state: WmsState) =>
  state.inventoryItems.filter(
    (item) => availableStock(item) > 0 && isNearExpiration(item, state.settings.expirationAlertDays)
  )

export const selectCriticalStockItems = (state: WmsState) =>
  state.inventoryItems.filter(
    (item) => availableStock(item) > 0 && availableStock(item) <= state.settings.stockAlertThreshold
  )

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
  const otif = otifPercentage(state.shipments)
  const misplaced = misplacedAClassItems(state).length
  const integrationErrors = state.integrations.filter((i) => i.status === 'error').length
  const pendingAdjustments = state.adjustmentRequests.filter((r) => r.status === 'pending_approval').length
  const accuracy = selectInventoryAccuracy(state)
  const expiringItems = selectExpiringItems(state).length
  const criticalStockItems = selectCriticalStockItems(state).length
  const slaData = selectSlaBreaches(state, Date.now())
  const slaBreaches = slaData.filter((s) => s.isBreached).length
  const slaAtRisk = slaData.filter((s) => s.isAtRisk && !s.isBreached).length
  const criticalAlerts =
    integrationErrors +
    (otif < 90 ? 1 : 0) +
    misplaced +
    pendingAdjustments +
    (expiringItems > 0 ? 1 : 0) +
    (criticalStockItems > 0 ? 1 : 0) +
    slaBreaches

  return {
    pendingOrders,
    ordersInPicking,
    partialPickingTasks,
    activeWaves,
    pendingReceipts,
    returnsInTransit,
    inventoryOnHold,
    otif,
    misplacedAClassSkus: misplaced,
    criticalAlerts,
    pendingAdjustments,
    inventoryFreezeActive: state.settings.inventoryFreezeActive,
    ira: accuracy.ira,
    expiringItems,
    criticalStockItems,
    slaBreaches,
    slaAtRisk,
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

    // Configured slotting rules govern placement in two ways:
    //  · soft → the highest-priority 'preferTier' overrides the ABC/XYZ tier,
    //           steering the score (golden gating) and the recommendation text.
    //  · hard → any matching rule's constraints (forbidGolden, requireZone,
    //           maxLevel, rack compatibility…) filter out candidate locations.
    const baseTier = idealLocationTier(abcClass, xyzClass)
    const matchingRules = activeMatchingRules(product, abcClass, state.slottingRules)
    const { tier, appliedRule } = resolvePreferredTier(baseTier, matchingRules)

    let best: { loc: (typeof candidates)[number]; score: number } | null = null
    for (const candidate of candidates) {
      if (candidate.id === current.id) continue
      // Slotting is an intra-warehouse optimization: candidates must live in the
      // same warehouse as the item. Moving stock across warehouses is a transfer,
      // not a relocation.
      if (candidate.warehouseId !== item.warehouseId) continue
      // Hard directives: a candidate that violates any matching rule is not a
      // valid destination for this product.
      if (matchingRules.length > 0) {
        const rackType = candidate.rackTypeId
          ? state.rackTypes.find((r) => r.id === candidate.rackTypeId)
          : undefined
        if (!candidateAllowedByRules(matchingRules, product, candidate, rackType).allowed) continue
      }
      const score = slottingScore({
        abcClass,
        xyzClass,
        product: { unitWeightKg: product.unitWeightKg },
        current,
        candidate,
        tierOverride: tier,
      })
      if (score > 0 && (!best || score > best.score)) best = { loc: candidate, score }
    }
    if (!best) continue

    const distanceSaved = estimatedDistanceSaved(
      current.distanceToDispatchM,
      best.loc.distanceToDispatchM,
      demand.pickingFrequency
    )

    const tierLabel =
      tier === 'golden' ? 'zona golden' : tier === 'remote' ? 'zona remota' : 'zona estándar'
    const ruleNote = appliedRule
      ? ` · regla «${appliedRule.name}»`
      : matchingRules.length > 0
        ? ` · ${matchingRules.length} regla(s) de restricción`
        : ''
    const recommendation = `Reubicar ${product.name} (${abcClass}${xyzClass}) a ${best.loc.code} [${tierLabel}] — ahorra ${Math.round(distanceSaved)} m por ciclo${ruleNote}.`

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

// Product ids matched by each slotting rule (regardless of active flag). Used by
// Configuración → Slotting to preview a rule's scope before saving/activating it.
export function selectSlottingRuleMatches(state: WmsState): Record<string, string[]> {
  const abc = abcByProduct(state)
  const result: Record<string, string[]> = {}
  for (const rule of state.slottingRules) {
    result[rule.id] = state.products
      .filter((p) => matchesSlottingRule(p, abc[p.id] ?? 'C', rule))
      .map((p) => p.id)
  }
  return result
}

// ─── Batch simulation (what-if dry-run) ──────────────────────────────────────

export interface SimulationRow {
  productId: string
  productName: string
  abcClass: AbcClass
  xyzClass: XyzClass
  fromCode: string
  toCode: string
  isGoldenMove: boolean // current → non-golden, candidate → golden
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

// Resolves min/max for a product at a pick face, in precedence order:
//   1. per-pick-face override (StorageLocation.min/maxStockUnits)
//   2. per-SKU override        (Product.min/maxStockUnits)
//   3. demand-based estimate   (pickingFrequency × 2 / × 6)
//   4. global default          (settings.replenishmentDefault*Units)
export function resolveStockLimits(
  state: WmsState,
  productId: string,
  location?: { minStockUnits?: number; maxStockUnits?: number }
): { minStock: number; maxStock: number } {
  const product = state.products.find((p) => p.id === productId)
  const demand = state.demandStats.find((d) => d.productId === productId)
  const { replenishmentDefaultMinUnits, replenishmentDefaultMaxUnits } = state.settings

  const minStock =
    location?.minStockUnits ??
    product?.minStockUnits ??
    (demand ? Math.round(demand.pickingFrequency * 2) : replenishmentDefaultMinUnits)
  const maxStock =
    location?.maxStockUnits ??
    product?.maxStockUnits ??
    (demand ? Math.round(demand.pickingFrequency * 6) : replenishmentDefaultMaxUnits)

  return { minStock, maxStock }
}

// Priority as a function of how far below minimum the stock sits, using two
// configurable fractions of the minimum (high < medium ≤ 1):
//   stock/min < high   → 'high'   (critical, e.g. < 50% of min)
//   stock/min < medium → 'medium' (e.g. < 80% of min)
//   stock < min        → 'low'    (approaching min)
export function replenishmentPriority(
  currentStock: number,
  minStock: number,
  highFactor: number,
  mediumFactor: number
): 'high' | 'medium' | 'low' {
  if (minStock <= 0) return 'low'
  const ratio = currentStock / minStock
  if (ratio < highFactor) return 'high'
  if (ratio < mediumFactor) return 'medium'
  return 'low'
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const

// Detects pick faces whose stock is below minStock and have no active task already.
// Priority is derived from replenishmentHighFactor / replenishmentMediumFactor.
export function selectReplenishmentNeeds(state: WmsState): ReplenishmentNeed[] {
  const abc = abcByProduct(state)
  const { replenishmentHighFactor, replenishmentMediumFactor } = state.settings

  // Pick faces that already have an active (non-terminal) task — skip them.
  const activeDests = new Set(
    state.replenishmentTasks
      .filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
      .map((t) => t.destinationLocationId)
  )

  // First non-blocked reserve location per warehouse.
  const reserveByWarehouse: Record<string, string> = {}
  for (const loc of state.locations) {
    if (loc.type !== 'reserve' || loc.isBlocked) continue
    if (!reserveByWarehouse[loc.warehouseId]) reserveByWarehouse[loc.warehouseId] = loc.id
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
      const { minStock, maxStock } = resolveStockLimits(state, item.productId, loc)
      if (minStock <= 0) continue

      const currentStock = item.onHandQuantity - item.reservedQuantity - item.holdQuantity
      if (currentStock >= minStock) continue

      const reserveLocationId = reserveByWarehouse[loc.warehouseId]
      if (!reserveLocationId) continue

      needs.push({
        productId: item.productId,
        pickFaceLocationId: loc.id,
        reserveLocationId,
        currentStock,
        minStock,
        maxStock,
        suggestedQuantity: Math.max(0, maxStock - currentStock),
        priority: replenishmentPriority(
          currentStock,
          minStock,
          replenishmentHighFactor,
          replenishmentMediumFactor
        ),
        abcClass: abc[item.productId] ?? 'C',
      })
    }
  }

  return needs.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
}

// ─── Store (retail) replenishment needs ───────────────────────────────────────

export interface StoreReplenishmentNeed {
  storeWarehouseId: string
  productId: string
  sourceWarehouseId: string
  currentStock: number
  minStock: number
  maxStock: number
  suggestedQuantity: number
  priority: 'high' | 'medium' | 'low'
  abcClass: AbcClass
  hasActiveTask: boolean
}

// For each active store min/max policy, sums the store's on-floor stock and, when
// it sits below the policy minimum, emits a DC→store replenishment need sourced
// from settings.replenishmentStoreSourceWarehouseId.
export function selectStoreReplenishmentNeeds(state: WmsState): StoreReplenishmentNeed[] {
  const abc = abcByProduct(state)
  const {
    replenishmentHighFactor,
    replenishmentMediumFactor,
    replenishmentStoreSourceWarehouseId,
  } = state.settings

  // (store, product) pairs that already have an active (non-terminal) task.
  const activeKeys = new Set(
    state.storeReplenishmentTasks
      .filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
      .map((t) => `${t.storeWarehouseId}::${t.productId}`)
  )

  const needs: StoreReplenishmentNeed[] = []

  for (const policy of state.storeReplenishmentPolicies) {
    if (!policy.active) continue
    if (policy.minStock <= 0) continue

    const currentStock = state.inventoryItems
      .filter(
        (i) =>
          i.warehouseId === policy.storeWarehouseId &&
          i.productId === policy.productId &&
          i.status !== 'on_hold'
      )
      .reduce((sum, i) => sum + (i.onHandQuantity - i.reservedQuantity - i.holdQuantity), 0)

    if (currentStock >= policy.minStock) continue

    needs.push({
      storeWarehouseId: policy.storeWarehouseId,
      productId: policy.productId,
      sourceWarehouseId: replenishmentStoreSourceWarehouseId,
      currentStock,
      minStock: policy.minStock,
      maxStock: policy.maxStock,
      suggestedQuantity: Math.max(0, policy.maxStock - currentStock),
      priority: replenishmentPriority(
        currentStock,
        policy.minStock,
        replenishmentHighFactor,
        replenishmentMediumFactor
      ),
      abcClass: abc[policy.productId] ?? 'C',
      hasActiveTask: activeKeys.has(`${policy.storeWarehouseId}::${policy.productId}`),
    })
  }

  return needs.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
}

// ─── Affinity recommendations ────────────────────────────────────────────────

export interface AffinityRecommendation {
  pair: ProductAffinityPair
  productNameA: string
  productNameB: string
  locationCodeA: string | null // current pick location of A
  locationCodeB: string | null
  distanceBetweenM: number | null
  isAlreadyClose: boolean // both already in the same zone
  suggestion: string
}

export function selectAffinityRecommendations(state: WmsState): AffinityRecommendation[] {
  const matrix = buildAffinityMatrix(state.commerceOrders)
  const CLOSE_THRESHOLD_M = 15 // locations within 15 m to dispatch are "close enough"

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
      locA && locB ? Math.abs(locA.distanceToDispatchM - locB.distanceToDispatchM) : null

    const isAlreadyClose = distanceBetweenM !== null && distanceBetweenM <= CLOSE_THRESHOLD_M

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
  misplacedDelta: number | null // negative = improvement
  relocationsAvailableDelta: number | null
  distanceSavedDelta: number | null // positive = more opportunity (worse)
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

// ── Inventory Accuracy (IRA) — Sprint 2 #60 ─────────────────────────────────
//
// IRA = 1 - (sum of |delta| from approved adjustments / theoretical stock at time of count)
// Ranges 0–100%. 100% = perfect accuracy (no deviations found in cycle counts).
// Uses approved InventoryAdjustmentRequests as the source of truth for deviations.

export interface InventoryAccuracy {
  ira: number          // 0–100
  totalCounted: number // units counted across all approved adjustments
  totalDeviation: number // sum of absolute deltas
  adjustmentsApproved: number
  adjustmentsPending: number
  adjustmentsRejected: number
}

export function selectInventoryAccuracy(state: WmsState): InventoryAccuracy {
  const approved = state.adjustmentRequests.filter((r) => r.status === 'approved')
  const pending = state.adjustmentRequests.filter((r) => r.status === 'pending_approval')
  const rejected = state.adjustmentRequests.filter((r) => r.status === 'rejected')

  const totalCounted = approved.reduce((s, r) => s + r.countedQty, 0)
  const totalDeviation = approved.reduce((s, r) => s + Math.abs(r.delta), 0)

  // IRA formula: (totalCounted - totalDeviation) / totalCounted * 100
  // If no counts yet, return 100% (assumed accurate until proven otherwise)
  const ira =
    totalCounted === 0
      ? 100
      : Math.max(0, Math.round(((totalCounted - totalDeviation) / totalCounted) * 100))

  return {
    ira,
    totalCounted,
    totalDeviation,
    adjustmentsApproved: approved.length,
    adjustmentsPending: pending.length,
    adjustmentsRejected: rejected.length,
  }
}

export { availableStock }

// ── Cycle count schedule (#13 Estándar) — ABC-driven "due for count" list ──────
//
// For each product×warehouse combo with stock on hand, finds the last time it was
// physically counted (max countedAt across cyclicCountLines) and compares the days
// elapsed against the frequency configured for its ABC class. Only overdue entries
// are returned (never counted counts as overdue), most overdue first — this feeds
// both the "Vencidos por clase ABC" table and the suggested-plan generator.

export interface CycleCountScheduleEntry {
  productId: string
  warehouseId: string
  abcClass: AbcClass
  lastCountedAt: string | null
  daysSinceCount: number | null
  frequencyDays: number
  overdue: boolean
}

export function selectCycleCountSchedule(state: WmsState): CycleCountScheduleEntry[] {
  const abc = abcByProduct(state)
  const frequencyByClass: Record<AbcClass, number> = {
    A: state.settings.cycleCountFrequencyDaysA,
    B: state.settings.cycleCountFrequencyDaysB,
    C: state.settings.cycleCountFrequencyDaysC,
  }

  const combos = new Map<string, { productId: string; warehouseId: string }>()
  for (const item of state.inventoryItems) {
    if (item.onHandQuantity <= 0) continue
    const key = `${item.productId}__${item.warehouseId}`
    if (!combos.has(key)) combos.set(key, { productId: item.productId, warehouseId: item.warehouseId })
  }

  const now = new Date()
  const entries: CycleCountScheduleEntry[] = []
  for (const { productId, warehouseId } of combos.values()) {
    const abcClass = abc[productId] ?? 'C'
    const frequencyDays = frequencyByClass[abcClass]
    const countedDates = state.cyclicCountLines
      .filter((l) => l.productId === productId && l.warehouseId === warehouseId && l.countedAt)
      .map((l) => l.countedAt as string)
    const lastCountedAt = countedDates.length > 0 ? countedDates.sort().at(-1)! : null
    const daysSinceCount = lastCountedAt
      ? Math.floor((now.getTime() - new Date(lastCountedAt).getTime()) / (1000 * 60 * 60 * 24))
      : null
    const overdue = daysSinceCount === null || daysSinceCount >= frequencyDays
    if (!overdue) continue
    entries.push({ productId, warehouseId, abcClass, lastCountedAt, daysSinceCount, frequencyDays, overdue })
  }

  return entries.sort((a, b) => (b.daysSinceCount ?? Number.MAX_SAFE_INTEGER) - (a.daysSinceCount ?? Number.MAX_SAFE_INTEGER))
}

// ── ATP (Available-to-Promise) per product per warehouse — Sprint 7 #96 ───────
//
// ATP = sum of available stock across all locations for a product in a warehouse.
// Available = onHand - reserved - hold (already computed by availableStock).

export interface AtpRecord {
  productId: string
  warehouseId: string
  available: number
}

export const selectAtp = (state: WmsState): AtpRecord[] => {
  const map = new Map<string, number>()
  for (const item of state.inventoryItems) {
    const key = `${item.productId}|${item.warehouseId}`
    map.set(key, (map.get(key) ?? 0) + availableStock(item))
  }
  return Array.from(map.entries()).map(([key, available]) => {
    const [productId, warehouseId] = key.split('|')
    return { productId, warehouseId, available }
  })
}

// ── Reservations with TTL — Estándar #1 ("Reservas con TTL y ATP en tiempo real") ─
//
// nowMs must be passed in by the caller (e.g. Date.now()) — keeps Date.now() out of
// the selector so Zustand can compare results by reference without spurious re-renders.

export interface ReservationRow {
  itemId: string
  productId: string
  warehouseId: string
  locationId: string
  reservedQuantity: number
  reservationExpiresAt?: string
  isExpired: boolean
  hoursRemaining: number | null
}

export const selectActiveReservations = (state: WmsState, nowMs = 0): ReservationRow[] =>
  state.inventoryItems
    .filter((i) => i.reservedQuantity > 0)
    .map((i) => {
      const expiresAtMs = i.reservationExpiresAt ? new Date(i.reservationExpiresAt).getTime() : null
      return {
        itemId: i.id,
        productId: i.productId,
        warehouseId: i.warehouseId,
        locationId: i.locationId,
        reservedQuantity: i.reservedQuantity,
        reservationExpiresAt: i.reservationExpiresAt,
        isExpired: expiresAtMs !== null && expiresAtMs < nowMs,
        hoursRemaining: expiresAtMs === null ? null : Math.round(((expiresAtMs - nowMs) / 36e5) * 10) / 10,
      }
    })
    .sort((a, b) => (a.hoursRemaining ?? Infinity) - (b.hoursRemaining ?? Infinity))

// ── Aging / low-rotation report — Estándar #4 ("Antigüedad de inventario y alertas
// por baja rotación") ────────────────────────────────────────────────────────────

export interface AgingReportRow {
  itemId: string
  productId: string
  warehouseId: string
  locationId: string
  lot?: string
  serial?: string
  onHandQuantity: number
  available: number
  abcClass: AbcClass
  receivedDate?: string
  agingInDays: number
  isLowRotation: boolean
}

export const selectAgingReport = (state: WmsState): AgingReportRow[] => {
  const abc = abcByProduct(state)
  return state.inventoryItems
    .filter((i) => i.onHandQuantity > 0)
    .map((i) => {
      const aging = agingDays(i)
      return {
        itemId: i.id,
        productId: i.productId,
        warehouseId: i.warehouseId,
        locationId: i.locationId,
        lot: i.lot,
        serial: i.serial,
        onHandQuantity: i.onHandQuantity,
        available: availableStock(i),
        abcClass: abc[i.productId] ?? 'C',
        receivedDate: i.receivedDate,
        agingInDays: aging,
        isLowRotation: isLowRotation(aging, state.settings.agingLowRotationDays),
      }
    })
    .sort((a, b) => b.agingInDays - a.agingInDays)
}

export const selectLowRotationAlerts = (state: WmsState): AgingReportRow[] =>
  selectAgingReport(state).filter((r) => r.isLowRotation)

// ── Stock-state breakdown — Base #2 ("Múltiples estados de stock") ──────────────
// Counts positions (not units) per computed StockStateCode. Zero-onHand rows excluded.

export const selectStockStateCounts = (state: WmsState): Record<StockStateCode, number> => {
  const counts: Record<StockStateCode, number> = {
    available: 0,
    reserved: 0,
    on_hold: 0,
    quarantine: 0,
    damaged: 0,
    expired: 0,
    in_transit: 0,
  }
  for (const item of state.inventoryItems) {
    if (item.onHandQuantity <= 0) continue
    const loc = state.locations.find((l) => l.id === item.locationId)
    counts[resolveStockState(item, loc?.type)] += 1
  }
  return counts
}

// ── SLA breach detection — Sprint 7 #97/98 ───────────────────────────────────

export interface SlaBreachRecord {
  orderId: string
  orderNumber: string
  channel: string
  fulfillmentType: string
  createdAt: string
  maxHours: number
  elapsedHours: number
  breachPercent: number  // elapsed / maxHours * 100
  isBreached: boolean    // elapsed >= maxHours
  isAtRisk: boolean      // elapsed >= maxHours * (alertAtPercent/100)
  slaLabel: string
}

// nowMs must be passed in by the caller (e.g. Date.now()) — keeps Date.now() out of the selector
// so Zustand can compare results by reference without spurious re-renders.
export const selectSlaBreaches = (state: WmsState, nowMs = 0): SlaBreachRecord[] => {
  const activeOrders = state.commerceOrders.filter(
    (o) => !['completed', 'cancelled'].includes(o.status)
  )
  const now = new Date(nowMs || Date.now())
  const results: SlaBreachRecord[] = []

  for (const order of activeOrders) {
    const sla = state.settings.slaConfigs.find(
      (s) =>
        (s.channel === order.channel || s.channel === 'all') &&
        (s.fulfillmentType === order.fulfillmentType || s.fulfillmentType === 'all')
    )
    if (!sla) continue

    const created = new Date(order.createdAt)
    const elapsedMs = now.getTime() - created.getTime()
    const elapsedHours = elapsedMs / (1000 * 60 * 60)
    const breachPercent = Math.round((elapsedHours / sla.maxHours) * 100)
    const alertThresholdHours = sla.maxHours * (sla.alertAtPercent / 100)

    if (elapsedHours >= alertThresholdHours) {
      results.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        channel: order.channel,
        fulfillmentType: order.fulfillmentType,
        createdAt: order.createdAt,
        maxHours: sla.maxHours,
        elapsedHours: Math.round(elapsedHours * 10) / 10,
        breachPercent,
        isBreached: elapsedHours >= sla.maxHours,
        isAtRisk: elapsedHours >= alertThresholdHours,
        slaLabel: sla.label,
      })
    }
  }
  return results.sort((a, b) => b.breachPercent - a.breachPercent)
}

// ─── Route-affinity slotting ─────────────────────────────────────────────────
//
// Identifies products whose picks are concentrated on a single SAP route and
// suggests moving them closer to that route's staging locations.
//
// Linkage: LoadManifest.orderIds → PickingTask.orderId (one orderId per task).
// Route code comes from LoadManifest.sapRouteId (matches StorageLocation.routeCode).

export function selectRouteSlottingRecommendations(
  state: WmsState
): RouteSlottingRecommendation[] {
  // Step 1: build taskId → sapRouteId index from completed manifests
  const taskRouteMap = new Map<string, string>()
  for (const manifest of state.loadManifests) {
    if (!['dispatched', 'completed'].includes(manifest.status)) continue
    if (!manifest.sapRouteId) continue
    for (const orderId of manifest.orderIds) {
      for (const task of state.pickingTasks) {
        if (task.orderId === orderId) taskRouteMap.set(task.id, manifest.sapRouteId)
      }
    }
  }

  // Step 2: count completed picks per product per route
  const productRouteCounts = new Map<string, Map<string, number>>()
  for (const task of state.pickingTasks) {
    if (task.status !== 'completed') continue
    const routeCode = taskRouteMap.get(task.id)
    if (!routeCode) continue
    if (!productRouteCounts.has(task.productId)) {
      productRouteCounts.set(task.productId, new Map())
    }
    const routeMap = productRouteCounts.get(task.productId)!
    routeMap.set(routeCode, (routeMap.get(routeCode) ?? 0) + 1)
  }

  const recs: RouteSlottingRecommendation[] = []

  for (const [productId, routeMap] of productRouteCounts.entries()) {
    const totalPicks = Array.from(routeMap.values()).reduce((a, b) => a + b, 0)
    if (totalPicks === 0) continue

    // Find dominant route
    let dominantRoute = ''
    let dominantCount = 0
    for (const [routeCode, count] of routeMap.entries()) {
      if (count > dominantCount) {
        dominantRoute = routeCode
        dominantCount = count
      }
    }
    const routePickFrequency = dominantCount / totalPicks
    if (routePickFrequency < 0.4) continue // no dominant route

    const demand = state.demandStats.find((d) => d.productId === productId)
    const product = state.products.find((p) => p.id === productId)
    if (!product || !demand) continue

    // Current inventory location for this product
    const item = state.inventoryItems.find(
      (i) => i.productId === productId && i.status === 'available' && i.onHandQuantity > 0
    )
    if (!item) continue
    const currentLoc = state.locations.find((l) => l.id === item.locationId)
    if (!currentLoc) continue

    // Staging locations tagged with the dominant route — use their avg distance as proxy
    const stagingLocs = state.locations.filter((l) => l.routeCode === dominantRoute)
    if (stagingLocs.length === 0) continue
    const avgStagingDist =
      stagingLocs.reduce((sum, l) => sum + l.distanceToDispatchM, 0) / stagingLocs.length

    const currentDistToStaging = Math.abs(currentLoc.distanceToDispatchM - avgStagingDist)

    // Best candidate: pick face without a routeCode, not blocked, weight-compatible
    let best: { loc: typeof currentLoc; distM: number } | null = null
    for (const candidate of state.locations) {
      if (!candidate.isPickFace || candidate.isBlocked) continue
      if (candidate.id === currentLoc.id || candidate.routeCode) continue
      if (product.unitWeightKg > candidate.maxWeightKg) continue
      const distToStaging = Math.abs(candidate.distanceToDispatchM - avgStagingDist)
      if (!best || distToStaging < best.distM) best = { loc: candidate, distM: distToStaging }
    }
    if (!best) continue

    const distanceGainM = currentDistToStaging - best.distM
    if (distanceGainM <= 10) continue // below noise threshold

    // ponytail: simple linear score — replace with slottingScore() if complexity warrants it
    const score = Math.min(100, Math.round(routePickFrequency * 50 + (distanceGainM / 100) * 50))

    recs.push({
      productId,
      routeCode: dominantRoute,
      routeLabel: `Ruta ${dominantRoute}`,
      currentLocationId: currentLoc.id,
      candidateLocationId: best.loc.id,
      routePickFrequency,
      currentDistanceToStagingM: currentDistToStaging,
      candidateDistanceToStagingM: best.distM,
      distanceGainM,
      totalDistanceSavedM: distanceGainM * demand.pickingFrequency,
      score,
    })
  }

  return recs.sort((a, b) => b.totalDistanceSavedM - a.totalDistanceSavedM)
}

// ─── Dashboard chart data ────────────────────────────────────────────────────

export interface DashboardChartData {
  gauges: { name: string; value: number; fill: string }[]
  weeklyDemand: Record<string, string | number>[]
  ordersByStatus: { status: string; count: number; fill: string }[]
  operatorProductivity: ProductivityRow[]
}

export function selectDashboardChartData(state: WmsState): DashboardChartData {
  const otif = otifPercentage(state.shipments)
  const { ira } = selectInventoryAccuracy(state)

  // IRA first → inner ring, OTIF second → outer ring (recharts RadialBarChart: first item = innermost)
  const gauges = [
    {
      name: 'IRA',
      value: Math.round(ira * 10) / 10,
      fill: '#3b82f6',
    },
    {
      name: 'OTIF',
      value: Math.round(otif * 10) / 10,
      // ponytail: hex instead of var(--color-*) — Tailwind 4 CSS vars don't resolve in recharts fill props
      fill: otif >= 90 ? '#22c55e' : otif >= 80 ? '#f59e0b' : '#ef4444',
    },
  ]

  const top5Ids = Object.keys(dashboardHistory.weeklyDemand)
  const productNames: Record<string, string> = {}
  for (const id of top5Ids) {
    const product = state.products.find((p) => p.id === id)
    productNames[id] = product?.name ?? id
  }

  const demandByProduct = dashboardHistory.weeklyDemand as Record<string, number[]>
  const weeklyDemand: Record<string, string | number>[] = Array.from({ length: 8 }, (_, i) => {
    const row: Record<string, string | number> = { week: `Sem ${i + 1}` }
    for (const id of top5Ids) {
      row[productNames[id]] = demandByProduct[id][i]
    }
    return row
  })

  const statusCounts = { pending: 0, in_progress: 0, completed: 0, cancelled: 0 }
  for (const o of state.commerceOrders) {
    if (o.status in statusCounts) statusCounts[o.status as keyof typeof statusCounts]++
  }
  const statusColors: Record<string, string> = {
    pending: '#3b82f6',
    in_progress: '#f59e0b',
    completed: '#22c55e',
    cancelled: '#6b7280',
  }
  const ordersByStatus = Object.entries(statusCounts).map(([key, count]) => ({
    status: statusLabel(key),
    count,
    fill: statusColors[key],
  }))

  const operatorProductivity = productivityByOperator(state.pickingTasks).slice(0, 8)

  return { gauges, weeklyDemand, ordersByStatus, operatorProductivity }
}

// ─── Internal moves (movimientos internos) ──────────────────────────────────

export interface ConsolidationOpportunity {
  warehouseId: string
  productId: string
  locations: { locationId: string; quantity: number }[]
  totalQuantity: number
  // Ubicación destino sugerida: la que ya concentra más stock disponible.
  targetLocationId: string
  sourceCount: number
}

export interface MisplacedStockRow {
  itemId: string
  productId: string
  warehouseId: string
  locationId: string
  quantity: number
  idealTier: 'golden' | 'standard' | 'remote'
  inGolden: boolean
}

// Active internal-move tasks (not yet dropped/cancelled), oldest first (FIFO queue).
export const selectInternalMoveQueue = (state: WmsState): InternalMoveTask[] =>
  state.internalMoves
    .filter((t) => t.status === 'pending' || t.status === 'assigned' || t.status === 'picked')
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

// Same SKU with available stock spread across ≥2 pick-face bins in one warehouse:
// a candidate to consolidate into the fullest bin and free up the others.
export function selectConsolidationOpportunities(state: WmsState): ConsolidationOpportunity[] {
  const pickLocationIds = new Set(
    state.locations.filter((l) => l.type === 'pick' && !l.isBlocked).map((l) => l.id)
  )
  // key = warehouseId::productId → per-location available quantities
  const groups = new Map<string, { locationId: string; quantity: number }[]>()
  for (const item of state.inventoryItems) {
    if (!pickLocationIds.has(item.locationId)) continue
    const qty = availableStock(item)
    if (qty <= 0) continue
    const key = `${item.warehouseId}::${item.productId}`
    const rows = groups.get(key) ?? []
    const existing = rows.find((r) => r.locationId === item.locationId)
    if (existing) existing.quantity += qty
    else rows.push({ locationId: item.locationId, quantity: qty })
    groups.set(key, rows)
  }

  const out: ConsolidationOpportunity[] = []
  for (const [key, locations] of groups) {
    if (locations.length < 2) continue
    const [warehouseId, productId] = key.split('::')
    const sorted = [...locations].sort((a, b) => b.quantity - a.quantity)
    out.push({
      warehouseId,
      productId,
      locations: sorted,
      totalQuantity: sorted.reduce((s, l) => s + l.quantity, 0),
      targetLocationId: sorted[0].locationId,
      sourceCount: sorted.length,
    })
  }
  return out.sort((a, b) => b.sourceCount - a.sourceCount || b.totalQuantity - a.totalQuantity)
}

// Stock sitting in the wrong location tier for its ABC/XYZ profile — each row is a
// candidate reslotting move (high-value in a remote bin, or low-value in a golden bin).
export function selectMisplacedStock(state: WmsState): MisplacedStockRow[] {
  const abc = abcByProduct(state)
  const xyz = xyzByProduct(state)
  const rows: MisplacedStockRow[] = []
  for (const item of state.inventoryItems) {
    const abcClass = abc[item.productId]
    const loc = state.locations.find((l) => l.id === item.locationId)
    if (!abcClass || !loc) continue
    if (availableStock(item) <= 0) continue
    const tier = idealLocationTier(abcClass, xyz[item.productId] ?? 'Z')
    const misplaced = (tier === 'golden' && !loc.golden) || (tier === 'remote' && loc.golden)
    if (!misplaced) continue
    rows.push({
      itemId: item.id,
      productId: item.productId,
      warehouseId: item.warehouseId,
      locationId: item.locationId,
      quantity: item.onHandQuantity,
      idealTier: tier,
      inGolden: !!loc.golden,
    })
  }
  return rows
}

// ── Yard / Dock management (#8) ───────────────────────────────────────────────

const OCCUPYING_APPOINTMENT_STATUSES = new Set<DockAppointment['status']>(['arrived', 'in_progress'])

export interface DockBoardRow {
  dock: Dock
  // The appointment currently holding the dock (arrived or in progress), if any.
  currentAppointment: DockAppointment | null
  // The next still-scheduled appointment for this dock, earliest first.
  nextAppointment: DockAppointment | null
}

// One row per dock with what's happening on it right now — powers the live
// board in /yard (Tab "Hoy").
export const selectDockBoard = (state: WmsState): DockBoardRow[] =>
  state.docks.map((dock) => {
    const onThisDock = state.dockAppointments
      .filter((a) => a.dockId === dock.id)
      .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
    return {
      dock,
      currentAppointment: onThisDock.find((a) => OCCUPYING_APPOINTMENT_STATUSES.has(a.status)) ?? null,
      nextAppointment: onThisDock.find((a) => a.status === 'scheduled') ?? null,
    }
  })

export interface YardKpis {
  appointmentsToday: number
  docksAvailable: number
  docksOccupied: number
  docksOutOfService: number
  atRiskCount: number
  noShowToday: number
}

// nowMs must be passed in by the caller (e.g. Date.now()) — keeps Date.now() out of the selector.
export const selectYardKpis = (state: WmsState, nowMs = 0): YardKpis => {
  const now = new Date(nowMs || Date.now())
  const todayStr = now.toISOString().slice(0, 10)

  const occupiedDockIds = new Set(
    state.dockAppointments
      .filter((a) => OCCUPYING_APPOINTMENT_STATUSES.has(a.status) && a.dockId)
      .map((a) => a.dockId as string)
  )

  return {
    appointmentsToday: state.dockAppointments.filter((a) => a.scheduledStart.slice(0, 10) === todayStr).length,
    docksAvailable: state.docks.filter((d) => d.status === 'active' && !occupiedDockIds.has(d.id)).length,
    docksOccupied: state.docks.filter((d) => d.status === 'active' && occupiedDockIds.has(d.id)).length,
    docksOutOfService: state.docks.filter((d) => d.status !== 'active').length,
    atRiskCount: state.dockAppointments.filter((a) =>
      isAppointmentAtRisk(a, now.getTime(), state.settings.yardLateThresholdMinutes)
    ).length,
    noShowToday: state.dockAppointments.filter(
      (a) => a.status === 'no_show' && a.scheduledStart.slice(0, 10) === todayStr
    ).length,
  }
}
