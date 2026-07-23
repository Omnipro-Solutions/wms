import type {
  AbcClass,
  CommerceOrder,
  LocationType,
  Product,
  RackType,
  SlottingDirective,
  SlottingDirectiveKind,
  SlottingRule,
  SlottingRuleMatchType,
  SlottingTier,
  StorageLocation,
  XyzClass,
} from '@/types/wms'
import { checkRackCompatibility, LOCATION_TYPE_LABELS } from '@/lib/rules/locations'

// ABC via Pareto over a movement metric (pickingFrequency or unitsSold).
// A = top thresholdA of cumulative volume, B = up to thresholdB, C = rest.
export function classifyAbc(
  items: { productId: string; metric: number }[],
  thresholdA = 0.8,
  thresholdB = 0.95
): Record<string, AbcClass> {
  const total = items.reduce((sum, i) => sum + i.metric, 0)
  const result: Record<string, AbcClass> = {}
  if (total <= 0) {
    for (const item of items) result[item.productId] = 'C'
    return result
  }
  const sorted = [...items].sort((a, b) => b.metric - a.metric)
  const epsilon = 1e-9
  let cumulative = 0
  for (const item of sorted) {
    cumulative += item.metric / total
    if (cumulative <= thresholdA + epsilon) result[item.productId] = 'A'
    else if (cumulative <= thresholdB + epsilon) result[item.productId] = 'B'
    else result[item.productId] = 'C'
  }
  return result
}

// XYZ via demand variability (coefficient of variation = stddev / mean).
export function classifyXyz(samples: number[], cvX = 0.5, cvY = 1.0): XyzClass {
  if (samples.length === 0) return 'Z'
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length
  if (mean === 0) return 'Z'
  const variance = samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length
  const cv = Math.sqrt(variance) / mean
  if (cv <= cvX) return 'X'
  if (cv <= cvY) return 'Y'
  return 'Z'
}

// Returns the coefficient of variation (0–∞) for a demand sample array.
export function demandCv(samples: number[]): number {
  if (samples.length === 0) return 0
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length
  if (mean === 0) return 0
  const variance = samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length
  return Math.sqrt(variance) / mean
}

// XYZ multiplier on the ideal location tier.
// AX → must be in golden (full score)
// AY → golden preferred but Y variability reduces urgency slightly
// AZ → erratic demand, golden is wasted — penalise moving to golden
// B* → medium urgency, XYZ softens or amplifies
// C* → low priority regardless
const XYZ_MULTIPLIER: Record<XyzClass, number> = { X: 1.0, Y: 0.75, Z: 0.35 }

// Ideal-location tiers by ABC/XYZ combination.
// golden=true means the candidate should be a golden pick face.
// If the product is AZ, we actively discourage golden placement (volatile demand
// means golden slots are better used by stable high-movers).
export function idealLocationTier(abcClass: AbcClass, xyzClass: XyzClass): 'golden' | 'standard' | 'remote' {
  if (abcClass === 'A' && xyzClass !== 'Z') return 'golden'
  if (abcClass === 'A' && xyzClass === 'Z') return 'standard'
  if (abcClass === 'B' && xyzClass === 'X') return 'standard'
  if (abcClass === 'C' && xyzClass === 'Z') return 'remote'
  return 'standard'
}

// Score 0-100; higher means relocating this product is more beneficial.
// Now factors in XYZ variability so that stable fast-movers (AX) outrank
// erratic ones (AZ) even with the same ABC class.
//
// `tierOverride` lets a configured slotting rule pin the target tier (see
// resolvePreferredTier). When absent, the tier is derived from ABC/XYZ.
export function slottingScore(args: {
  abcClass: AbcClass
  xyzClass: XyzClass
  product: { unitWeightKg: number }
  current: { accessibilityScore: number; golden: boolean; distanceToDispatchM: number }
  candidate: {
    accessibilityScore: number
    golden: boolean
    distanceToDispatchM: number
    maxWeightKg: number
  }
  tierOverride?: SlottingTier
}): number {
  const { abcClass, xyzClass, product, current, candidate, tierOverride } = args

  // Hard constraint: product must fit physically.
  if (product.unitWeightKg > candidate.maxWeightKg) return 0

  const tier = tierOverride ?? idealLocationTier(abcClass, xyzClass)

  // Do not push items to golden if their tier doesn't warrant it.
  // AZ → standard: golden is wasted on erratic demand; CZ → remote.
  if (candidate.golden && tier !== 'golden') return 0

  const abcWeight = abcClass === 'A' ? 1.0 : abcClass === 'B' ? 0.5 : 0.2
  const xyzMult = XYZ_MULTIPLIER[xyzClass]

  const accessibilityGain = Math.max(0, candidate.accessibilityScore - current.accessibilityScore)
  // Golden bonus only when the product's tier is golden and it's not already there.
  const goldenGain = candidate.golden && !current.golden && tier === 'golden' ? 30 : 0
  // Cap distance gain at 30 (not 40) so the XYZ multiplier keeps AX > AY before the 100-cap.
  const distanceGain = Math.max(0, current.distanceToDispatchM - candidate.distanceToDispatchM)

  const raw = abcWeight * xyzMult * (accessibilityGain + goldenGain + Math.min(30, distanceGain))
  return Math.max(0, Math.min(100, Math.round(raw)))
}

export function estimatedDistanceSaved(
  currentDistanceM: number,
  candidateDistanceM: number,
  pickingFrequency: number
): number {
  return Math.max(0, (currentDistanceM - candidateDistanceM) * pickingFrequency)
}

// Rough walking-time estimate: ~1.2 m/s operator walking speed.
export function estimatedTimeSaved(distanceSavedM: number): number {
  return Math.round(distanceSavedM / 1.2)
}

// Validation result before executing a relocation.
export interface RelocationValidation {
  valid: boolean
  warnings: string[]
  errors: string[]
}

// ─── Affinity matrix ──────────────────────────────────────────────────────────
// Pair of productIds that appear together in orders, with a co-occurrence score.
export interface ProductAffinityPair {
  productA: string
  productB: string
  coOccurrences: number  // number of orders containing both
  totalOrdersA: number   // orders that had A (denominator for lift)
  totalOrdersB: number
  liftScore: number      // coOccurrences / (totalOrdersA × totalOrdersB / totalOrders)
  proximityScore: number // 0–100, higher = should be placed closer together
}

// Builds an affinity matrix from historical commerce orders.
// Only multi-line orders (2+ distinct products) contribute to co-occurrence.
export function buildAffinityMatrix(orders: CommerceOrder[]): ProductAffinityPair[] {
  const totalOrders = orders.length
  if (totalOrders === 0) return []

  // Count per-product order appearances and pair co-occurrences.
  const productOrderCount: Record<string, number> = {}
  const pairCount: Record<string, number> = {}

  for (const order of orders) {
    const productIds = [...new Set(order.items.map((i) => i.productId))]
    if (productIds.length < 2) continue

    for (const pid of productIds) {
      productOrderCount[pid] = (productOrderCount[pid] ?? 0) + 1
    }

    // All unique pairs in this order
    for (let i = 0; i < productIds.length; i++) {
      for (let j = i + 1; j < productIds.length; j++) {
        const key = [productIds[i], productIds[j]].sort().join('|')
        pairCount[key] = (pairCount[key] ?? 0) + 1
      }
    }
  }

  const pairs: ProductAffinityPair[] = []

  for (const [key, coOccurrences] of Object.entries(pairCount)) {
    const [productA, productB] = key.split('|')
    const totalOrdersA = productOrderCount[productA] ?? 1
    const totalOrdersB = productOrderCount[productB] ?? 1

    // Lift = observed co-occurrence / expected under independence
    const expected = (totalOrdersA * totalOrdersB) / totalOrders
    const liftScore = coOccurrences / expected

    // Proximity score 0–100: blend of raw co-occurrence rate and lift
    const coRate = coOccurrences / Math.min(totalOrdersA, totalOrdersB)
    const proximityScore = Math.min(100, Math.round(coRate * 60 + Math.min(liftScore, 5) * 8))

    pairs.push({ productA, productB, coOccurrences, totalOrdersA, totalOrdersB, liftScore, proximityScore })
  }

  return pairs.sort((a, b) => b.proximityScore - a.proximityScore)
}

export function validateRelocation(args: {
  product: { unitWeightKg: number; name: string }
  destination: {
    code: string
    isBlocked: boolean
    maxWeightKg: number
    golden: boolean
    isPickFace: boolean
  }
  abcClass: AbcClass
  xyzClass: XyzClass
  destinationHasOtherProduct: boolean
}): RelocationValidation {
  const { product, destination, abcClass, xyzClass, destinationHasOtherProduct } = args
  const errors: string[] = []
  const warnings: string[] = []

  if (destination.isBlocked) {
    errors.push(`La ubicación ${destination.code} está bloqueada y no acepta stock.`)
  }

  if (product.unitWeightKg > destination.maxWeightKg) {
    errors.push(
      `${product.name} pesa ${product.unitWeightKg} kg y excede la capacidad de ${destination.code} (máx ${destination.maxWeightKg} kg).`
    )
  }

  if (destinationHasOtherProduct) {
    warnings.push(
      `La ubicación ${destination.code} ya contiene otro producto. Se mezclarán en la misma posición.`
    )
  }

  const tier = idealLocationTier(abcClass, xyzClass)
  if (destination.golden && tier === 'remote') {
    warnings.push(
      `${product.name} es clase ${abcClass}${xyzClass} (demanda errática). Ocupar golden zone puede no ser óptimo.`
    )
  }

  if (!destination.golden && abcClass === 'A' && xyzClass === 'X') {
    warnings.push(
      `${product.name} es AX (alta rotación, demanda estable) y el destino no es golden zone. Considera una ubicación prioritaria.`
    )
  }

  return { valid: errors.length === 0, warnings, errors }
}

// ─── Slotting rules (configurable placement directives) ───────────────────────
// A rule GOVERNS placement for the products it matches via directives: a soft
// 'preferTier' (resolvePreferredTier overrides the ABC/XYZ ideal tier) and hard
// constraints (candidateAllowedByRules filters out violating candidate locations).

export const SLOTTING_TIER_LABELS: Record<SlottingTier, string> = {
  golden: 'Zona golden',
  standard: 'Zona estándar',
  remote: 'Zona remota',
}

export const SLOTTING_MATCH_TYPE_LABELS: Record<SlottingRuleMatchType, string> = {
  category: 'Categoría del producto',
  abcClass: 'Clase ABC',
  weightAboveKg: 'Peso ≥ (kg)',
  trackBy: 'Trazabilidad',
}

export const SLOTTING_DIRECTIVE_LABELS: Record<SlottingDirectiveKind, string> = {
  preferTier: 'Preferir zona (preferencia)',
  requireLocationType: 'Solo tipo de ubicación',
  requireZone: 'Solo zona',
  requireGolden: 'Solo zona golden',
  forbidGolden: 'Nunca en golden',
  maxLevel: 'Nivel máximo',
  requireRackCompatible: 'Rack compatible con el producto',
}

// One-line, human-readable summary of a directive for the settings table.
export function describeDirective(d: SlottingDirective): string {
  switch (d.kind) {
    case 'preferTier':
      return `Preferir ${SLOTTING_TIER_LABELS[d.tier].toLowerCase()}`
    case 'requireLocationType':
      return `Solo ${LOCATION_TYPE_LABELS[d.locationType]}`
    case 'requireZone':
      return `Solo zona ${d.zone}`
    case 'requireGolden':
      return 'Solo golden'
    case 'forbidGolden':
      return 'Nunca golden'
    case 'maxLevel':
      return `Nivel ≤ ${d.level}`
    case 'requireRackCompatible':
      return 'Rack compatible'
  }
}

// Does this product (with its computed ABC class) fall in the rule's scope?
export function matchesSlottingRule(
  product: Pick<Product, 'category' | 'unitWeightKg' | 'trackBy'>,
  abcClass: AbcClass,
  rule: SlottingRule
): boolean {
  switch (rule.matchType) {
    case 'category':
      return product.category === rule.matchValue
    case 'abcClass':
      return abcClass === rule.matchValue
    case 'weightAboveKg': {
      const threshold = Number(rule.matchValue)
      return Number.isFinite(threshold) && product.unitWeightKg >= threshold
    }
    case 'trackBy':
      return product.trackBy === rule.matchValue
    default:
      return false
  }
}

// Active rules that match a product, sorted by priority (highest first).
export function activeMatchingRules(
  product: Pick<Product, 'category' | 'unitWeightKg' | 'trackBy'>,
  abcClass: AbcClass,
  rules: SlottingRule[]
): SlottingRule[] {
  return rules
    .filter((r) => r.active && matchesSlottingRule(product, abcClass, r))
    .sort((a, b) => b.priority - a.priority)
}

// The soft 'preferTier' directive of a rule, if it declares one.
export function preferredTier(directives: SlottingDirective[]): SlottingTier | undefined {
  for (const d of directives) if (d.kind === 'preferTier') return d.tier
  return undefined
}

export function isHardDirective(d: SlottingDirective): boolean {
  return d.kind !== 'preferTier'
}

export interface EffectiveTier {
  tier: SlottingTier
  appliedRule: SlottingRule | null // the rule whose preferTier won, if any
}

// Resolves the tier a product SHOULD occupy (soft preference): the base ABC/XYZ
// tier unless a matching rule declares a preferTier — highest priority wins.
export function resolvePreferredTier(
  baseTier: SlottingTier,
  matchingRules: SlottingRule[]
): EffectiveTier {
  for (const rule of matchingRules) {
    const tier = preferredTier(rule.directives)
    if (tier) return { tier, appliedRule: rule }
  }
  return { tier: baseTier, appliedRule: null }
}

export interface PlacementVerdict {
  allowed: boolean
  reasons: string[] // why the candidate was rejected (empty = allowed)
}

// Evaluates the HARD directives of a single rule against one candidate location.
// preferTier is soft and ignored here (it feeds slottingScore's tierOverride).
export function evaluatePlacement(
  directives: SlottingDirective[],
  product: Pick<Product, 'category' | 'unitWeightKg'>,
  candidate: Pick<StorageLocation, 'type' | 'zone' | 'golden' | 'level'>,
  rackType?: RackType
): PlacementVerdict {
  const reasons: string[] = []
  for (const d of directives) {
    switch (d.kind) {
      case 'preferTier':
        break // soft — handled by scoring
      case 'requireLocationType':
        if (candidate.type !== d.locationType)
          reasons.push(`no es de tipo ${LOCATION_TYPE_LABELS[d.locationType]}`)
        break
      case 'requireZone':
        if (candidate.zone !== d.zone) reasons.push(`no está en la zona ${d.zone}`)
        break
      case 'requireGolden':
        if (!candidate.golden) reasons.push('no es golden')
        break
      case 'forbidGolden':
        if (candidate.golden) reasons.push('es golden')
        break
      case 'maxLevel': {
        const lvl = Number(candidate.level)
        if (Number.isFinite(lvl) && lvl > d.level)
          reasons.push(`el nivel ${candidate.level} supera el máximo ${d.level}`)
        break
      }
      case 'requireRackCompatible':
        if (rackType) {
          const c = checkRackCompatibility(rackType, candidate, product)
          if (!c.compatible) reasons.push(...c.reasons)
        }
        break
    }
  }
  return { allowed: reasons.length === 0, reasons }
}

// Composes the hard directives of ALL matching rules against a candidate. To be
// a valid destination the candidate must satisfy every matching rule.
export function candidateAllowedByRules(
  matchingRules: SlottingRule[],
  product: Pick<Product, 'category' | 'unitWeightKg'>,
  candidate: Pick<StorageLocation, 'type' | 'zone' | 'golden' | 'level'>,
  rackType?: RackType
): PlacementVerdict {
  const reasons: string[] = []
  for (const rule of matchingRules) {
    const v = evaluatePlacement(rule.directives, product, candidate, rackType)
    if (!v.allowed) reasons.push(`[${rule.code}] ${v.reasons.join(', ')}`)
  }
  return { allowed: reasons.length === 0, reasons }
}
