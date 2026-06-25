// ZPL II label builder — generates Zebra Programming Language templates
// Compatible with Zebra ZD410/ZD420/ZT410/ZT610 and compatible printers.

export type ZplLabelType = 'product' | 'location' | 'box' | 'pallet' | 'shipping' | 'return'

export interface ZplLabelData {
  code: string
  type: ZplLabelType
  reference: string
  createdAt: string
  createdBy: string
  /** Optional extra lines printed below the main barcode */
  lines?: { label: string; value: string }[]
}

/** Label dimensions in dots at 203 dpi (default ZPL unit). 4"×2" label = 812×406 dots */
const W = 812
const H = 406

const TYPE_ES: Record<ZplLabelType, string> = {
  product: 'PRODUCTO',
  location: 'UBICACIÓN',
  box: 'CAJA',
  pallet: 'PALLET',
  shipping: 'DESPACHO',
  return: 'DEVOLUCIÓN',
}

/**
 * Build a ZPL II string for a WMS label.
 *
 * Layout (4"×2"):
 *   - Header bar with label type
 *   - Code-128 barcode (auto-selected by ^BC)
 *   - Human-readable code beneath barcode
 *   - Reference + metadata lines
 *   - Footer with createdBy / date
 */
export const buildZpl = (data: ZplLabelData): string => {
  const typeLabel = TYPE_ES[data.type] ?? data.type.toUpperCase()
  const date = data.createdAt ? data.createdAt.substring(0, 10) : ''

  // Sanitize strings for ZPL (strip ^ ~ which are ZPL control chars)
  const esc = (s: string) => s.replace(/[\^~]/g, '').substring(0, 60)

  const extraLines = (data.lines ?? [])
    .slice(0, 4)
    .map(({ label, value }, i) => {
      const y = 260 + i * 28
      return `^FO20,${y}^A0N,18,18^FD${esc(label)}:^FS^FO180,${y}^A0N,18,18^FD${esc(value)}^FS`
    })
    .join('\n')

  return [
    '^XA',
    `^PW${W}`,
    `^LL${H}`,
    '^CI28', // UTF-8 encoding

    // Header background bar (filled rectangle)
    `^FO0,0^GB${W},48,48^FS`,
    // Header text — label type
    `^FO16,10^A0R,30,30^FR^FD${typeLabel}^FS`,
    // WMS system label (right-aligned)
    `^FO${W - 180},10^A0N,26,26^FR^FDWMS^FS`,

    // Barcode — Code 128, height 100 dots, human-readable below
    `^FO40,60^BY2,3,80^BCN,80,Y,N,N^FD${esc(data.code)}^FS`,

    // Reference line
    `^FO20,200^A0N,22,22^FDRef: ${esc(data.reference)}^FS`,

    // Extra data lines
    extraLines,

    // Footer separator
    `^FO0,${H - 36}^GB${W},2,2^FS`,
    // Footer: createdBy + date
    `^FO10,${H - 28}^A0N,18,18^FD${esc(data.createdBy)}^FS`,
    `^FO${W - 200},${H - 28}^A0N,18,18^FD${date}^FS`,

    '^XZ',
  ].join('\n')
}

/**
 * Attempt to send ZPL to a Zebra printer via the browser Print dialog.
 * Opens a new window with the raw ZPL in a <pre> element styled for printing,
 * which works when the Zebra browser print driver is installed (Zebra Link-OS).
 *
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
