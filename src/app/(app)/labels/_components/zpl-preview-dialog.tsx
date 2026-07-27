'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronDown, ChevronUp, Clipboard, Printer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useWmsStore } from '@/store/wms-store'
import { buildZpl, printZpl } from '@/lib/rules/zpl'
import { labelFieldValues, resolveLabelTemplate } from '@/lib/rules/label-templates'
import { cn } from '@/lib/utils'
import type { LabelFieldKey, LabelTemplate, WmsLabel } from '@/types/wms'

const TYPE_ES: Record<WmsLabel['type'], string> = {
  product: 'Producto',
  location: 'Ubicación',
  box: 'Caja',
  pallet: 'Pallet',
  shipping: 'Despacho',
  return: 'Devolución',
  receipt: 'Recepción',
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
  logo: 'Logo',
}

const SYMBOLOGY_ES: Record<LabelTemplate['symbology'], string> = {
  code128: 'Code 128',
  'gs1-128': 'GS1-128',
  qr: 'QR',
  datamatrix: 'DataMatrix',
}

interface ZplPreviewDialogProps {
  label: WmsLabel | null
  open: boolean
  onClose: () => void
}

export const ZplPreviewDialog = ({ label, open, onClose }: ZplPreviewDialogProps) => {
  const labelTemplates = useWmsStore((s) => s.labelTemplates)
  const [printerIp, setPrinterIp] = useState('')
  const [copied, setCopied] = useState(false)
  const [showZpl, setShowZpl] = useState(false)

  useEffect(() => {
    if (open) {
      setPrinterIp('')
      setShowZpl(false)
      setCopied(false)
    }
  }, [open])

  if (!label) return null

  const template = resolveLabelTemplate(labelTemplates, label.type)
  const values = labelFieldValues(label)
  const zpl = buildZpl({ code: label.code, type: label.type, values }, template)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(zpl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    printZpl(zpl, printerIp.trim() || undefined)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="size-4" />
            Etiqueta — {label.code}
            <Badge variant="secondary" className="ml-1 text-xs">
              {TYPE_ES[label.type]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Visual label preview */}
          <LabelPreview label={label} template={template} values={values} />

          {/* Template caption */}
          {template && (
            <p className="text-muted-foreground text-center text-xs">
              Plantilla: <span className="font-medium">{template.name}</span> · {template.sizePreset}{' '}
              · {template.dpi} dpi · {SYMBOLOGY_ES[template.symbology]}
            </p>
          )}

          {/* Printer IP */}
          <div className="space-y-1">
            <Label htmlFor="printer-ip" className="text-sm">
              IP de impresora Zebra{' '}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="printer-ip"
              value={printerIp}
              onChange={(e) => setPrinterIp(e.target.value)}
              placeholder="192.168.1.100"
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-xs">
              Sin IP, el ZPL se copia al portapapeles para enviarlo manualmente.
            </p>
          </div>

          {/* ZPL accordion */}
          <div className="rounded-md border">
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowZpl((v) => !v)}
            >
              <span>Ver código ZPL</span>
              {showZpl ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </button>
            {showZpl && (
              <div className="border-t px-3 pb-3 pt-2 space-y-2">
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5 text-xs">
                    {copied ? (
                      <>
                        <Check className="size-3 text-green-600" /> Copiado
                      </>
                    ) : (
                      <>
                        <Clipboard className="size-3" /> Copiar ZPL
                      </>
                    )}
                  </Button>
                </div>
                <pre className="bg-muted max-h-40 overflow-auto rounded-md p-3 font-mono text-xs leading-relaxed whitespace-pre">
                  {zpl}
                </pre>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="mr-1.5 size-3.5" /> Cerrar
          </Button>
          <Button onClick={handlePrint} className="gap-1.5">
            <Printer className="size-3.5" />
            {printerIp ? 'Enviar a impresora' : 'Copiar ZPL'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Visual HTML preview of the label ─────────────────────────────────────────

const TYPE_COLORS: Record<WmsLabel['type'], string> = {
  product: 'bg-blue-700',
  location: 'bg-emerald-700',
  box: 'bg-amber-700',
  pallet: 'bg-orange-700',
  shipping: 'bg-slate-800',
  return: 'bg-red-700',
  receipt: 'bg-green-700',
  lpn: 'bg-indigo-700',
}

interface LabelPreviewProps {
  label: WmsLabel
  template?: LabelTemplate
  values: Partial<Record<LabelFieldKey, string>>
}

export const LabelPreview = ({ label, template, values }: LabelPreviewProps) => {
  const headerBg = TYPE_COLORS[label.type] ?? 'bg-slate-800'
  const symbology = template?.symbology ?? 'code128'
  const is2d = symbology === 'qr' || symbology === 'datamatrix'
  const showLogo = template ? template.fields.some((f) => f.key === 'logo' && f.enabled) : true

  // Aspect ratio from the size preset drives the preview height.
  const [wIn, hIn] = (template?.sizePreset ?? '4x2').split('x').map(Number)
  const width = 320
  const height = Math.round((width * hIn) / wIn)

  // Which field lines to render, in template order (logo excluded — it's branding).
  const fieldLines = (template?.fields ?? [{ key: 'reference', enabled: true, order: 0 }])
    .filter((f) => f.enabled && f.key !== 'logo' && values[f.key])
    .sort((a, b) => a.order - b.order)

  const bars = Array.from({ length: 40 }, (_, i) => ({
    x: i * 7 + 4,
    w: i % 3 === 0 ? 5 : i % 5 === 0 ? 3 : 2,
  }))

  // Deterministic 2D matrix pattern (visual only, not scannable).
  const matrixCells = Array.from({ length: 12 * 12 }, (_, i) => {
    const row = Math.floor(i / 12)
    const col = i % 12
    return (row * 7 + col * 13 + label.code.length) % 3 === 0
  })

  return (
    <div className="flex justify-center">
      <div
        className="relative overflow-hidden rounded-lg border-2 border-gray-300 dark:border-zinc-600 bg-white shadow-sm"
        style={{ width, height, fontFamily: 'monospace' }}
        aria-label={`Vista previa etiqueta ${label.code}`}
      >
        {/* Header bar */}
        <div className={cn(headerBg, 'flex items-center justify-between px-3 py-1')}>
          <span className="text-xs font-bold tracking-widest text-white">
            {TYPE_ES[label.type].toUpperCase()}
          </span>
          {showLogo && <span className="text-xs font-semibold text-white/70">WMS</span>}
        </div>

        {/* Barcode area */}
        <div className="flex flex-col items-center py-1">
          {is2d ? (
            <svg width={64} height={64} aria-hidden="true">
              {matrixCells.map((on, i) => (
                <rect
                  key={i}
                  x={(i % 12) * 5 + 2}
                  y={Math.floor(i / 12) * 5 + 2}
                  width={5}
                  height={5}
                  fill={on ? '#111' : '#fff'}
                />
              ))}
            </svg>
          ) : (
            <svg width={288} height={44} aria-hidden="true">
              {bars.map((b, i) => (
                <rect
                  key={i}
                  x={b.x}
                  y={2}
                  width={b.w}
                  height={40}
                  fill={i % 2 === 0 ? '#111' : '#fff'}
                />
              ))}
            </svg>
          )}
          <span className="font-mono text-[10px] tracking-widest text-gray-800">{label.code}</span>
        </div>

        {/* Field lines */}
        <div className="space-y-0.5 px-3">
          {fieldLines.map((f) => (
            <div key={f.key} className="truncate">
              <span className="text-[10px] text-gray-500">{FIELD_ES[f.key]}: </span>
              <span className="font-mono text-[10px] text-gray-800">{values[f.key]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
