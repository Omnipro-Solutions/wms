// ZPL II label builder — generates Zebra Programming Language templates
// Compatible with Zebra ZD410/ZD420/ZT410/ZT610 and compatible printers.
// Driven by a LabelTemplate: size/dpi, symbology, and which fields print.

import type { LabelFieldKey, LabelSymbology, LabelTemplate, LabelType } from '@/types/wms'
import { labelSizeDots } from '@/lib/rules/label-templates'

export type ZplLabelType = LabelType

export interface ZplLabelData {
  code: string
  type: ZplLabelType
  /** Field values keyed by field. A field prints only when enabled AND present here. */
  values?: Partial<Record<LabelFieldKey, string>>
}

/** Legacy default when no template is supplied: 4"×2" @ 203 dpi = 812×406 dots. */
const DEFAULT_SIZE = { width: 812, height: 406 }

const TYPE_ES: Record<LabelType, string> = {
  product: 'PRODUCTO',
  location: 'UBICACIÓN',
  box: 'CAJA',
  pallet: 'PALLET',
  shipping: 'DESPACHO',
  return: 'DEVOLUCIÓN',
  receipt: 'RECEPCIÓN',
  lpn: 'LPN',
}

const FIELD_ES: Record<LabelFieldKey, string> = {
  reference: 'Ref',
  lot: 'Lote',
  expirationDate: 'Vence',
  quantity: 'Cant',
  poNumber: 'OC',
  operator: 'Operario',
  date: 'Fecha',
  warehouse: 'Bodega',
  logo: '', // rendered as branding in the header, not as a text line
}

// Sanitize strings for ZPL (strip ^ ~ which are ZPL control chars).
const esc = (s: string): string => s.replace(/[\^~]/g, '').substring(0, 60)

/** ISO date → GS1 YYMMDD (e.g. 2026-12-31 → 261231). */
const gs1Date = (iso: string): string =>
  `${iso.substring(2, 4)}${iso.substring(5, 7)}${iso.substring(8, 10)}`

/** Build the barcode field block for a given symbology at (x, y). */
const barcodeBlock = (
  symbology: LabelSymbology,
  code: string,
  values: Partial<Record<LabelFieldKey, string>>,
  x: number,
  y: number
): string => {
  const c = esc(code)
  switch (symbology) {
    case 'qr':
      return `^FO${x},${y}^BQN,2,6^FDLA,${c}^FS`
    case 'datamatrix':
      return `^FO${x},${y}^BXN,8,200^FD${c}^FS`
    case 'gs1-128': {
      // Human-readable AI notation; >8 is the ZPL FNC1 marker for GS1-128.
      let data = `(00)${c}`
      if (values.lot) data += `(10)${esc(values.lot)}`
      if (values.expirationDate) data += `(17)${gs1Date(values.expirationDate)}`
      return `^FO${x},${y}^BCN,80,Y,N,N^FD>;>8${data}^FS`
    }
    case 'code128':
    default:
      return `^FO${x},${y}^BY2,3,80^BCN,80,Y,N,N^FD${c}^FS`
  }
}

/**
 * Build a ZPL II string for a WMS label, driven by an optional template.
 *
 * Layout:
 *   - Header bar with label type (+ WMS branding when the `logo` field is on)
 *   - Barcode per template symbology, with human-readable code beneath
 *   - One line per enabled field that has a value, in template order
 *   - Footer separator
 */
export const buildZpl = (data: ZplLabelData, template?: LabelTemplate): string => {
  const { width: W, height: H } = template
    ? labelSizeDots(template.sizePreset, template.dpi)
    : DEFAULT_SIZE
  const symbology: LabelSymbology = template?.symbology ?? 'code128'
  const values = data.values ?? {}
  const typeLabel = TYPE_ES[data.type] ?? data.type.toUpperCase()
  const showLogo = template ? template.fields.some((f) => f.key === 'logo' && f.enabled) : true

  // Enabled, ordered fields that carry a value (logo excluded — it's branding).
  const printableFields = (template?.fields ?? [])
    .filter((f) => f.enabled && f.key !== 'logo' && values[f.key])
    .sort((a, b) => a.order - b.order)

  const fieldLines = printableFields
    .map((f, i) => {
      const yy = 200 + i * 28
      return `^FO20,${yy}^A0N,22,22^FD${FIELD_ES[f.key]}: ${esc(values[f.key] as string)}^FS`
    })
    .join('\n')

  return [
    '^XA',
    `^PW${W}`,
    `^LL${H}`,
    '^CI28', // UTF-8 encoding

    // Header background bar + type text
    `^FO0,0^GB${W},48,48^FS`,
    `^FO16,10^A0R,30,30^FR^FD${typeLabel}^FS`,
    showLogo ? `^FO${W - 180},10^A0N,26,26^FR^FDWMS^FS` : '',

    // Barcode + human-readable code
    barcodeBlock(symbology, data.code, values, 40, 60),
    `^FO40,150^A0N,20,20^FD${esc(data.code)}^FS`,

    // Field lines
    fieldLines,

    // Footer separator
    `^FO0,${H - 36}^GB${W},2,2^FS`,

    '^XZ',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Attempt to send ZPL to a Zebra printer via the browser Print dialog.
 * Falls back to copying ZPL to clipboard when the printer URL isn't available.
 */
export const printZpl = (zpl: string, printerIp?: string): void => {
  if (printerIp) {
    // POST to Zebra Link-OS TCP→HTTP bridge (printer must expose port 9100 via proxy)
    fetch(`http://${printerIp}:9100`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: zpl,
    }).catch(() => {
      // Printer not reachable — fall through to clipboard
      copyToClipboard(zpl)
    })
  } else {
    copyToClipboard(zpl)
  }
}

const copyToClipboard = (text: string): void => {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
  }
}
