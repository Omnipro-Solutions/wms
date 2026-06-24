// Pure UoM conversion helpers. No store or React dependencies.

import type { UomConversion, UnitOfMeasure } from '@/types/wms'

/**
 * Convert a quantity from one UoM to another using the product's conversion table.
 * The conversions array must include a direct or reverse path between the two UoMs.
 * Returns the converted quantity (always in base/target units).
 *
 * Example: convertQty(2, 'uom-caj', 'uom-und', conversions)
 *   → if 1 caja = 12 unidades → returns 24
 */
export const convertQty = (
  qty: number,
  fromUomId: string,
  toUomId: string,
  conversions: UomConversion[]
): number => {
  if (fromUomId === toUomId) return qty

  // Direct path: fromUomId → toUomId
  const direct = conversions.find(
    (c) => c.fromUomId === fromUomId && c.toUomId === toUomId
  )
  if (direct) return qty * direct.factor

  // Reverse path: toUomId → fromUomId (invert factor)
  const reverse = conversions.find(
    (c) => c.fromUomId === toUomId && c.toUomId === fromUomId
  )
  if (reverse) return qty / reverse.factor

  throw new Error(
    `No se encontró conversión entre ${fromUomId} y ${toUomId}`
  )
}

/**
 * Convert a quantity from any UoM to the product's base UoM.
 * Convenience wrapper over convertQty.
 */
export const toBaseQty = (
  qty: number,
  fromUomId: string,
  baseUomId: string,
  conversions: UomConversion[]
): number => convertQty(qty, fromUomId, baseUomId, conversions)

/**
 * Format a quantity with its UoM abbreviation.
 * E.g.: formatQtyUom(2, 'uom-caj', uoms) → "2 caj"
 */
export const formatQtyUom = (
  qty: number,
  uomId: string | undefined,
  uoms: UnitOfMeasure[]
): string => {
  const uom = uoms.find((u) => u.id === uomId)
  if (!uom) return String(qty)
  return `${qty} ${uom.abbreviation}`
}

/**
 * Get the display label for a UoM.
 */
export const uomLabel = (uomId: string | undefined, uoms: UnitOfMeasure[]): string => {
  return uoms.find((u) => u.id === uomId)?.name ?? uomId ?? '—'
}

/**
 * Validate that a product has a base UoM set and that the requested UoM
 * has a valid conversion path to the base. Returns an error string or null.
 */
export const validateUomConversion = (
  fromUomId: string,
  baseUomId: string | undefined,
  conversions: UomConversion[] | undefined
): string | null => {
  if (!baseUomId) return 'El producto no tiene unidad de medida base configurada.'
  if (fromUomId === baseUomId) return null
  const convs = conversions ?? []
  const hasDirect = convs.some(
    (c) => c.fromUomId === fromUomId && c.toUomId === baseUomId
  )
  const hasReverse = convs.some(
    (c) => c.fromUomId === baseUomId && c.toUomId === fromUomId
  )
  if (!hasDirect && !hasReverse)
    return `No existe conversión configurada para esta unidad de medida.`
  return null
}
