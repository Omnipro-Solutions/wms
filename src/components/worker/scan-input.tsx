'use client'

import { useState, useRef, useEffect } from 'react'
import { ScanLine, CheckCircle2, XCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
      setStatus('ok')
      setTimeout(onMatch, 400)
    } else {
      setStatus('error')
      onError?.(value.trim())
      setValue('')
      setTimeout(() => setStatus('idle'), 1200)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="relative">
        <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Escanear o escribir..."
          className={cn(
            'pl-9 h-12 text-base',
            status === 'ok' && 'border-emerald-500 bg-emerald-50',
            status === 'error' && 'border-red-500 bg-red-50'
          )}
        />
        {status === 'ok' && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 size-5" />}
        {status === 'error' && <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 size-5" />}
      </div>
      <Button className="h-12 text-base" onClick={handleSubmit} disabled={!value.trim()}>
        Confirmar
      </Button>
      <Button variant="ghost" size="sm" onClick={onMatch} className="text-muted-foreground">
        Confirmar manualmente
      </Button>
    </div>
  )
}
