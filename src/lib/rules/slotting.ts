import type { AbcClass, CommerceOrder, XyzClass } from '@/types/wms'

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
}): number {
  const { abcClass, xyzClass, product, current, candidate } = args

  // Hard constraint: product must fit physically.
  if (product.unitWeightKg > candidate.maxWeightKg) return 0

  const tier = idealLocationTier(abcClass, xyzClass)

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
