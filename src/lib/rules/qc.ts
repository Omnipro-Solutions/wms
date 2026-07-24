import type { AbcClass, Product, QcRule } from '@/types/wms'

// ─── Reglas de desvío automático a control de calidad ─────────────────────────
// Evaluadas al crear el ASN. La regla de mayor prioridad (menor `priority`) gana.
// Ver types/wms.ts §QcRule y la página /qc-settings.

export const matchesQcRule = (
  product: Pick<Product, 'id' | 'category'>,
  supplierName: string,
  abcClass: AbcClass,
  rule: QcRule
): boolean => {
  switch (rule.matchType) {
    case 'all':
      return true
    case 'category':
      return product.category === rule.matchValue
    case 'supplier':
      // Comparación laxa: los nombres de proveedor llegan con mayúsculas/espacios variables.
      return supplierName.trim().toLowerCase() === rule.matchValue.trim().toLowerCase()
    case 'product':
      return product.id === rule.matchValue
    case 'abc_class':
      return abcClass === rule.matchValue
    default:
      return false
  }
}

// Reglas activas que aplican, ordenadas por prioridad ascendente (menor gana).
export const activeQcRules = (
  product: Pick<Product, 'id' | 'category'>,
  supplierName: string,
  abcClass: AbcClass,
  rules: QcRule[]
): QcRule[] => {
  return rules
    .filter((r) => r.active && matchesQcRule(product, supplierName, abcClass, r))
    .sort((a, b) => a.priority - b.priority)
}

export interface QcVerdict {
  requiresQc: boolean
  rule?: QcRule
  // Unidades a desviar a cuarentena, redondeadas hacia arriba: un muestreo del
  // 10% sobre 15 unidades desvía 2, no 1.5.
  sampledQuantity: number
  reason?: string
}

// Decide si un ASN entrante debe desviarse a QC y cuántas unidades.
export const evaluateQcRules = (
  product: Pick<Product, 'id' | 'category'>,
  supplierName: string,
  abcClass: AbcClass,
  expectedQuantity: number,
  rules: QcRule[]
): QcVerdict => {
  const winner = activeQcRules(product, supplierName, abcClass, rules)[0]
  if (!winner) return { requiresQc: false, sampledQuantity: 0 }

  const pct = Math.min(100, Math.max(0, winner.samplingPercent))
  if (pct === 0) return { requiresQc: false, sampledQuantity: 0 }

  const sampled = Math.min(expectedQuantity, Math.ceil((expectedQuantity * pct) / 100))
  return {
    requiresQc: sampled > 0,
    rule: winner,
    sampledQuantity: sampled,
    reason: winner.reason,
  }
}
