'use client'

import { useEffect, useRef, useState } from 'react'
import { ScanFeedback } from './scan-feedback'

interface Props {
  title: string
  hint: string
  expectedCode: string
  onMatch: () => void
  onError?: (scanned: string) => void
  children?: React.ReactNode
}

export const ScanStep = ({ title, hint, expectedCode, onMatch, onError, children }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [buffer, setBuffer] = useState('')
  const [feedback, setFeedback] = useState<{ show: boolean; success: boolean }>({
    show: false,
    success: false,
  })

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleScan = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    const success = trimmed === expectedCode
    setFeedback({ show: true, success })
    setTimeout(() => {
      setFeedback({ show: false, success: false })
      if (success) onMatch()
      else onError?.(trimmed)
    }, 800)
    setBuffer('')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <ScanFeedback show={feedback.show} success={feedback.success} />
      <p className="text-muted-foreground text-sm uppercase tracking-widest">{title}</p>
      {children}
      <p className="text-center text-sm text-gray-500">{hint}</p>
      <input
        ref={inputRef}
        value={buffer}
        onChange={(e) => setBuffer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleScan(buffer)
        }}
        inputMode="none"
        className="sr-only"
        aria-label="Escanear código"
      />
      <p className="text-muted-foreground text-xs">Escanea el código o escribe y presiona Enter</p>
    </div>
  )
}
