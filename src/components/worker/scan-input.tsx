'use client'

import { useState, useRef, useEffect } from 'react'
import { ScanLine, CheckCircle2, XCircle, Keyboard } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { scanFeedback } from '@/lib/scan-feedback'

interface Props {
  label: string
  expectedValue: string
  onMatch: () => void
  onError?: (scanned: string) => void
}

export const ScanInput = ({ label, expectedValue, onMatch, onError }: Props) => {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = () => {
    if (value.trim() === expectedValue) {
      scanFeedback(true)
      setStatus('ok')
      setTimeout(onMatch, 400)
    } else {
      scanFeedback(false)
      setStatus('error')
      onError?.(value.trim())
      setValue('')
      setTimeout(() => setStatus('idle'), 1200)
    }
  }

  return (
    <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md transition-colors',
            status === 'idle' && 'bg-[var(--worker-info-surface)] text-[var(--worker-info)]',
            status === 'ok' && 'bg-[var(--worker-ok-surface)] text-[var(--worker-ok)]',
            status === 'error' && 'bg-[var(--worker-danger-surface)] text-[var(--worker-danger)]'
          )}
        >
          <ScanLine className="size-4" />
        </span>
        <p className="text-muted-foreground font-mono text-xs font-semibold tracking-wider uppercase">
          {label}
        </p>
      </div>
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Escanear o escribir…"
          className={cn(
            'h-14 pr-10 font-mono text-base tracking-wide',
            status === 'ok' && 'border-[var(--worker-ok)] bg-[var(--worker-ok-surface)]',
            status === 'error' && 'border-[var(--worker-danger)] bg-[var(--worker-danger-surface)]'
          )}
        />
        {status === 'ok' && (
          <CheckCircle2 className="absolute top-1/2 right-3 size-5 -translate-y-1/2 text-[var(--worker-ok)]" />
        )}
        {status === 'error' && (
          <XCircle className="absolute top-1/2 right-3 size-5 -translate-y-1/2 text-[var(--worker-danger)]" />
        )}
      </div>
      <Button className="h-12 text-base font-semibold" onClick={handleSubmit} disabled={!value.trim()}>
        Confirmar
      </Button>
      <Button variant="ghost" size="sm" onClick={onMatch} className="text-muted-foreground gap-1.5">
        <Keyboard className="size-3.5" /> Confirmar manualmente
      </Button>
    </div>
  )
}
