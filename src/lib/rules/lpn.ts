import type { Lpn, LpnLine, LpnStatus } from '@/types/wms'

// ─── LPN / License Plate Number ───────────────────────────────────────────────
// Funciones puras sobre unidades de carga. Sin dependencia de store ni React.

// FSM del LPN. 'open' admite contenido; a partir de 'closed' queda sellado.
export const lpnTransitions: Record<LpnStatus, LpnStatus[]> = {
  open: ['closed', 'consumed'],
  closed: ['in_transit', 'stored', 'consumed'],
  in_transit: ['stored', 'consumed'],
  stored: ['in_transit', 'consumed'],
  consumed: [],
}

export const canLpnTransition = (from: LpnStatus, to: LpnStatus): boolean => {
  return lpnTransitions[from]?.includes(to) ?? false
}

// Genera el siguiente código correlativo: LPN-000001, LPN-000002, …
export const nextLpnCode = (existing: Lpn[], prefix = 'LPN'): string => {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`)
  const max = existing.reduce((acc, lpn) => {
    const match = pattern.exec(lpn.code)
    if (!match) return acc
    return Math.max(acc, Number(match[1]))
  }, 0)
  return `${prefix}-${String(max + 1).padStart(6, '0')}`
}

export const lpnLinesOf = (lpnId: string, lines: LpnLine[]): LpnLine[] => {
  return lines.filter((l) => l.lpnId === lpnId)
}

export const lpnTotalUnits = (lpnId: string, lines: LpnLine[]): number => {
  return lpnLinesOf(lpnId, lines).reduce((sum, l) => sum + l.quantity, 0)
}

// Un LPN es mixto cuando contiene más de un SKU distinto.
export const isMixedLpn = (lpnId: string, lines: LpnLine[]): boolean => {
  const skus = new Set(lpnLinesOf(lpnId, lines).map((l) => l.productId))
  return skus.size > 1
}

export const lpnSkuCount = (lpnId: string, lines: LpnLine[]): number => {
  return new Set(lpnLinesOf(lpnId, lines).map((l) => l.productId)).size
}

// Peso total del LPN — necesario para validar contra maxWeightKg de la ubicación.
export const lpnWeightKg = (
  lpnId: string,
  lines: LpnLine[],
  unitWeightByProduct: Record<string, number>
): number => {
  return lpnLinesOf(lpnId, lines).reduce(
    (sum, l) => sum + l.quantity * (unitWeightByProduct[l.productId] ?? 0),
    0
  )
}

export const lpnVolumeM3 = (
  lpnId: string,
  lines: LpnLine[],
  unitVolumeByProduct: Record<string, number>
): number => {
  return lpnLinesOf(lpnId, lines).reduce(
    (sum, l) => sum + l.quantity * (unitVolumeByProduct[l.productId] ?? 0),
    0
  )
}

export interface LpnValidation {
  valid: boolean
  reasons: string[]
}

// Un LPN se puede cerrar solo si tiene contenido y sigue abierto.
export const canCloseLpn = (lpn: Lpn, lines: LpnLine[]): LpnValidation => {
  const reasons: string[] = []
  if (lpn.status !== 'open') reasons.push('el LPN ya está cerrado')
  if (lpnLinesOf(lpn.id, lines).length === 0) reasons.push('el LPN está vacío')
  return { valid: reasons.length === 0, reasons }
}

// Solo un LPN cerrado (y no consumido) se puede mover a una ubicación.
export const canMoveLpn = (lpn: Lpn): LpnValidation => {
  const reasons: string[] = []
  if (lpn.status === 'open') reasons.push('el LPN debe cerrarse antes de moverse')
  if (lpn.status === 'consumed') reasons.push('el LPN ya fue consumido')
  return { valid: reasons.length === 0, reasons }
}
