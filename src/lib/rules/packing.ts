import type { PackingBoxType, PackingOrder, PackingRule, Product } from '@/types/wms'

// Select the smallest box that fits weight and volume with a 10% safety margin.
export const suggestBox = (
  weightKg: number,
  volumeM3: number,
  boxes: PackingBoxType[]
): PackingBoxType | undefined => {
  const sorted = [...boxes].sort((a, b) => a.volumeM3 - b.volumeM3)
  return sorted.find((b) => b.maxWeightKg >= weightKg * 1.1 && b.volumeM3 >= volumeM3 * 1.1)
}

// Determine which packing rules apply to a set of products.
export const applicableRules = (
  products: Product[],
  rules: PackingRule[]
): PackingRule[] => {
  const triggers = new Set<string>()

  for (const p of products) {
    if (p.unitWeightKg >= 15) triggers.add('heavy')
    if (p.unitVolumeM3 >= 0.05) triggers.add('oversized')
    if (p.category === 'fragrances' || p.category === 'liquids') triggers.add('liquid')
    if (p.category === 'fragile' || p.category === 'electronics') triggers.add('fragile')
    if (p.category === 'cold_chain') triggers.add('cold_chain')
    if (p.unitWeightKg * 1 > 500) triggers.add('high_value')
  }

  return rules.filter((r) => r.active && triggers.has(r.trigger))
}

// Calculate total weight and volume for a packing order based on product catalog.
export const calcPackingDimensions = (
  items: { productId: string; requestedQuantity: number }[],
  products: Product[]
): { weightKg: number; volumeM3: number } => {
  let weightKg = 0
  let volumeM3 = 0
  for (const item of items) {
    const p = products.find((prod) => prod.id === item.productId)
    if (!p) continue
    weightKg += p.unitWeightKg * item.requestedQuantity
    volumeM3 += p.unitVolumeM3 * item.requestedQuantity
  }
  return { weightKg: Math.round(weightKg * 100) / 100, volumeM3: Math.round(volumeM3 * 10000) / 10000 }
}

// Verification: compare scanned vs expected, return status.
export const verificationStatus = (
  scanned: number,
  expected: number
): PackingOrder['verificationStatus'] => {
  if (scanned === 0 && expected > 0) return 'pending'
  return scanned === expected ? 'verified' : 'mismatch'
}

// Scan progress percentage.
export const scanProgress = (scanned: number, expected: number): number =>
  expected > 0 ? Math.min(100, Math.round((scanned / expected) * 100)) : 0

// Generate a label code for a packing order.
export const generateLabelCode = (orderId: string, sequence: number): string =>
  `LBL-SHP-${String(sequence).padStart(4, '0')}-${orderId.toUpperCase().replace(/[^A-Z0-9]/g, '')}`

// Count rules requiring specific requirements.
export const rulesSummary = (rules: PackingRule[]) => ({
  requiresBubbleWrap: rules.some((r) => r.requiresBubbleWrap),
  requiresDoublePacking: rules.some((r) => r.requiresDoublePacking),
  requiresDryIce: rules.some((r) => r.requiresDryIce),
  requiresVoidFill: rules.some((r) => r.requiresVoidFill),
  labelNotes: rules.map((r) => r.labelNote).filter(Boolean),
})
