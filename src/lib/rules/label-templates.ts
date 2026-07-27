// Pure helpers for configurable label templates. No store or React imports.

import type {
  LabelDpi,
  LabelField,
  LabelFieldKey,
  LabelSizePreset,
  LabelTemplate,
  LabelType,
  WmsLabel,
} from '@/types/wms'

/** Physical label dimensions in dots for a size preset at a given print density. */
export const labelSizeDots = (
  preset: LabelSizePreset,
  dpi: LabelDpi
): { width: number; height: number } => {
  const [wIn, hIn] = preset.split('x').map(Number)
  return { width: wIn * dpi, height: hIn * dpi }
}

/**
 * Resolve which template renders a label of `type`. A per-warehouse override
 * wins over the global default; otherwise the global default is used. Returns
 * undefined when no template exists for the type.
 */
export const resolveLabelTemplate = (
  templates: LabelTemplate[],
  type: LabelType,
  warehouseId?: string
): LabelTemplate | undefined => {
  if (warehouseId) {
    const override = templates.find((t) => t.type === type && t.warehouseId === warehouseId)
    if (override) return override
  }
  return templates.find((t) => t.type === type && t.warehouseId === undefined)
}

// Sensible default field set per label type (order matters — it's the print order).
const FIELDS_BY_TYPE: Record<LabelType, LabelFieldKey[]> = {
  product: ['reference', 'date', 'logo'],
  location: ['reference', 'warehouse'],
  box: ['reference', 'quantity', 'operator', 'date'],
  pallet: ['reference', 'quantity', 'lot', 'expirationDate', 'warehouse'],
  shipping: ['reference', 'warehouse', 'date', 'logo'],
  return: ['reference', 'operator', 'date'],
  receipt: ['reference', 'lot', 'expirationDate', 'quantity', 'poNumber', 'date'],
  lpn: ['reference', 'lot', 'expirationDate', 'quantity', 'warehouse'],
}

/** Default (all-enabled, ordered) field list for a label type. */
export const defaultFieldsForType = (type: LabelType): LabelField[] =>
  FIELDS_BY_TYPE[type].map((key, order) => ({ key, enabled: true, order }))

/** Map a WmsLabel to the printable field values a template can render. */
export const labelFieldValues = (label: WmsLabel): Partial<Record<LabelFieldKey, string>> => {
  const values: Partial<Record<LabelFieldKey, string>> = {
    reference: label.reference,
    operator: label.createdBy,
    date: label.createdAt?.substring(0, 10),
  }
  if (label.lot) values.lot = label.lot
  if (label.expirationDate) values.expirationDate = label.expirationDate.substring(0, 10)
  if (label.receivedQty !== undefined) values.quantity = String(label.receivedQty)
  if (label.poNumber) values.poNumber = label.poNumber
  return values
}
