import type { Asn, AsnLine } from '@/types/wms'

// ─── ASN multi-línea ──────────────────────────────────────────────────────────
// Asn.lines[] es la fuente de verdad. Los campos productId/expectedQuantity/
// receivedQuantity/damagedQuantity del ASN son ESPEJO de lines[] y existen solo
// para compatibilidad con el código previo al soporte multi-SKU.
//
// Regla: toda mutación de lines[] pasa por syncAsnAggregates() antes de guardarse.

export const asnExpectedTotal = (lines: AsnLine[]): number => {
  return lines.reduce((sum, l) => sum + l.expectedQuantity, 0)
}

export const asnReceivedTotal = (lines: AsnLine[]): number => {
  return lines.reduce((sum, l) => sum + l.receivedQuantity, 0)
}

export const asnDamagedTotal = (lines: AsnLine[]): number => {
  return lines.reduce((sum, l) => sum + l.damagedQuantity, 0)
}

// Recalcula los campos espejo desde lines[]. Devuelve un ASN nuevo (inmutable).
export const syncAsnAggregates = (asn: Asn): Asn => {
  const lines = asn.lines
  if (!lines || lines.length === 0) return asn
  return {
    ...asn,
    productId: lines[0].productId,
    expectedQuantity: asnExpectedTotal(lines),
    receivedQuantity: asnReceivedTotal(lines),
    damagedQuantity: asnDamagedTotal(lines),
  }
}

// Acceso seguro a las líneas: hidrata desde los campos legacy si vienen vacías.
export const linesOf = (asn: Asn): AsnLine[] => {
  return ensureAsnLines(asn).lines ?? []
}

// Construye lines[] a partir de los campos legacy. Se usa al hidratar ASNs del
// seed o de persistencia que fueron creados antes del soporte multi-línea.
export const ensureAsnLines = (asn: Asn): Asn => {
  if (asn.lines && asn.lines.length > 0) return asn
  return {
    ...asn,
    lines: [
      {
        productId: asn.productId,
        expectedQuantity: asn.expectedQuantity,
        receivedQuantity: asn.receivedQuantity,
        damagedQuantity: asn.damagedQuantity,
        suggestedPutawayLocationId: asn.suggestedPutawayLocationId,
      },
    ],
  }
}

// Cuánto falta por recibir en una línea (nunca negativo — el excedente no resta).
export const lineOutstanding = (line: AsnLine): number => {
  return Math.max(0, line.expectedQuantity - line.receivedQuantity - line.damagedQuantity)
}

// Un ASN está completo cuando ninguna línea tiene saldo pendiente.
export const isAsnFullyReceived = (lines: AsnLine[]): boolean => {
  return lines.length > 0 && lines.every((l) => lineOutstanding(l) === 0)
}

// Aplica una recepción sobre una línea concreta, devolviendo lines[] nuevo.
export const applyLineReceipt = (
  lines: AsnLine[],
  productId: string,
  receivedQty: number,
  damagedQty: number
): AsnLine[] => {
  const idx = lines.findIndex((l) => l.productId === productId)
  if (idx === -1) throw new Error(`El producto no pertenece a este ASN`)
  const line = lines[idx]
  const next = [...lines]
  next[idx] = {
    ...line,
    receivedQuantity: line.receivedQuantity + receivedQty,
    damagedQuantity: line.damagedQuantity + damagedQty,
  }
  return next
}
