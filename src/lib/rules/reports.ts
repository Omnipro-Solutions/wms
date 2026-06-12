import type { Asn, DiscrepancyRow, PickingTask, StockMovement } from '@/types/wms'

// Traceability: filter the movement audit log by product / lot / serial.
export function traceMovements(
  movements: StockMovement[],
  filter: { productId?: string; lot?: string; serial?: string }
): StockMovement[] {
  return movements.filter(
    (m) =>
      (!filter.productId || m.productId === filter.productId) &&
      (!filter.lot || m.lot === filter.lot) &&
      (!filter.serial || m.serial === filter.serial)
  )
}

// Discrepancies: expected vs actual for ASN receiving.
export function receivingDiscrepancies(asns: Asn[]): DiscrepancyRow[] {
  return asns
    .map((a) => ({
      referenceType: 'asn' as const,
      referenceCode: a.code,
      expected: a.expectedQuantity,
      actual: a.receivedQuantity,
      difference: a.receivedQuantity - a.expectedQuantity,
    }))
    .filter((row) => row.difference !== 0)
}

// Discrepancies: requested vs picked for picking tasks.
export function pickingDiscrepancies(tasks: PickingTask[]): DiscrepancyRow[] {
  return tasks
    .map((t) => ({
      referenceType: 'picking' as const,
      referenceCode: t.code,
      expected: t.requestedQuantity,
      actual: t.pickedQuantity,
      difference: t.pickedQuantity - t.requestedQuantity,
    }))
    .filter((row) => row.difference !== 0)
}
