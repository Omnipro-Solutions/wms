'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Camera, CameraOff, Keyboard, X, ScanBarcode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface BarcodeScannerProps {
  onScan: (value: string) => void
  /**
   * Called before onScan. Return true if the value is a duplicate/invalid read —
   * the scan is rejected (error feedback, onScan not fired).
   */
  onDuplicate?: (value: string) => boolean
  /** Label shown above the manual input fallback */
  placeholder?: string
  /** Restrict accepted barcode formats */
  formats?: string[]
  className?: string
  /** Auto-start camera on mount */
  autoStart?: boolean
  /** Freeze the camera loop (e.g. goal reached) without unmounting */
  paused?: boolean
}

// Short haptic + audio cue so the operator gets feedback without watching the screen.
const scanFeedback = (ok: boolean) => {
  if (typeof window === 'undefined') return
  navigator.vibrate?.(ok ? 60 : [40, 40, 40])
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = ok ? 880 : 220
    gain.gain.value = 0.08
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
    osc.onended = () => ctx.close()
  } catch {
    // audio is best-effort; vibration still fired
  }
}

type ScanMode = 'idle' | 'camera' | 'manual'

declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => {
      detect: (source: HTMLVideoElement | HTMLCanvasElement) => Promise<{ rawValue: string }[]>
    }
  }
}

const DEFAULT_FORMATS = [
  'code_128',
  'code_39',
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'qr_code',
  'pdf417',
  'data_matrix',
]

export const BarcodeScanner = ({
  onScan,
  onDuplicate,
  placeholder = 'Escanear o ingresar código...',
  formats = DEFAULT_FORMATS,
  className,
  autoStart = false,
  paused = false,
}: BarcodeScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<InstanceType<NonNullable<Window['BarcodeDetector']>> | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastScannedRef = useRef<string>('')
  const lastScannedAtRef = useRef<number>(0)

  const [mode, setMode] = useState<ScanMode>(autoStart ? 'camera' : 'idle')
  const [manualValue, setManualValue] = useState('')
  const [cameraSupported, setCameraSupported] = useState(false)
  const [apiSupported, setApiSupported] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)

  // Detect API support on mount
  useEffect(() => {
    setCameraSupported(
      typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia
    )
    setApiSupported(typeof window !== 'undefined' && 'BarcodeDetector' in window)
  }, [])

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    detectorRef.current = null
  }, [])

  const emitScan = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return
      // Debounce: ignore same code within 2s
      const now = Date.now()
      if (trimmed === lastScannedRef.current && now - lastScannedAtRef.current < 2000) return
      lastScannedRef.current = trimmed
      lastScannedAtRef.current = now
      if (onDuplicate?.(trimmed)) {
        scanFeedback(false)
        return
      }
      scanFeedback(true)
      setLastResult(trimmed)
      onScan(trimmed)
    },
    [onScan, onDuplicate]
  )

  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      if (!window.BarcodeDetector) {
        setCameraError('BarcodeDetector no disponible en este navegador. Usa Chrome 83+ en Android o Chrome en escritorio.')
        setMode('manual')
        return
      }

      detectorRef.current = new window.BarcodeDetector({ formats })

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      const scan = async () => {
        if (!videoRef.current || !detectorRef.current) return
        if (videoRef.current.readyState >= 2) {
          try {
            const barcodes = await detectorRef.current.detect(videoRef.current)
            if (barcodes.length > 0) emitScan(barcodes[0].rawValue)
          } catch {
            // detection errors are non-fatal
          }
        }
        rafRef.current = requestAnimationFrame(scan)
      }
      rafRef.current = requestAnimationFrame(scan)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Permission')) {
        setCameraError('Permiso de cámara denegado. Habilita el acceso en la configuración del navegador.')
      } else {
        setCameraError('No se pudo acceder a la cámara.')
      }
      setMode('manual')
    }
  }, [formats, emitScan])

  useEffect(() => {
    if (mode === 'camera' && !paused) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [mode, paused, startCamera, stopCamera])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    emitScan(manualValue)
    setManualValue('')
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Mode selector */}
      <div className="flex items-center gap-2">
        {cameraSupported && apiSupported && (
          <Button
            type="button"
            variant={mode === 'camera' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode(mode === 'camera' ? 'idle' : 'camera')}
            className="gap-1.5"
          >
            {mode === 'camera' ? (
              <>
                <CameraOff className="size-3.5" /> Detener cámara
              </>
            ) : (
              <>
                <Camera className="size-3.5" /> Usar cámara
              </>
            )}
          </Button>
        )}
        <Button
          type="button"
          variant={mode === 'manual' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode(mode === 'manual' ? 'idle' : 'manual')}
          className="gap-1.5"
        >
          <Keyboard className="size-3.5" /> Manual
        </Button>
        {!apiSupported && (
          <Badge variant="secondary" className="text-xs">
            BarcodeDetector no soportado — usar manual
          </Badge>
        )}
        {lastResult && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-green-700">
            <ScanBarcode className="size-3.5" />
            <span className="font-mono font-medium">{lastResult}</span>
            <button onClick={() => setLastResult(null)} className="text-muted-foreground hover:text-foreground">
              <X className="size-3" />
            </button>
          </div>
        )}
      </div>

      {/* Auto-stop notice when the parent reports the goal is reached */}
      {mode === 'camera' && paused && (
        <p className="flex items-center justify-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-3 text-sm font-medium text-green-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <ScanBarcode className="size-4" /> Meta alcanzada — cámara detenida
        </p>
      )}

      {/* Camera view */}
      {mode === 'camera' && !paused && (
        <div className="relative overflow-hidden rounded-lg border bg-black">
          <video
            ref={videoRef}
            className="h-48 w-full object-cover"
            muted
            playsInline
            aria-label="Vista de cámara para escanear códigos de barras"
          />
          {/* Scanning crosshair overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-32 w-48">
              <span className="absolute top-0 left-0 h-5 w-5 border-t-2 border-l-2 border-white/80" />
              <span className="absolute top-0 right-0 h-5 w-5 border-t-2 border-r-2 border-white/80" />
              <span className="absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 border-white/80" />
              <span className="absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 border-white/80" />
            </div>
          </div>
          <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/70">
            Apunta la cámara al código de barras
          </p>
        </div>
      )}

      {/* Camera error */}
      {cameraError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {cameraError}
        </p>
      )}

      {/* Manual input */}
      {mode === 'manual' && (
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <Input
            autoFocus
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder={placeholder}
            className="font-mono text-sm"
          />
          <Button type="submit" size="sm" disabled={!manualValue.trim()}>
            OK
          </Button>
        </form>
      )}
    </div>
  )
}
