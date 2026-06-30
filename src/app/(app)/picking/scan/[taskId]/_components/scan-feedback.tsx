'use client'

import { cn } from '@/lib/utils'

interface Props {
  show: boolean
  success: boolean
}

export const ScanFeedback = ({ show, success }: Props) => {
  if (!show) return null
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        success ? 'bg-emerald-500/90' : 'bg-red-500/90'
      )}
    >
      <span className="text-6xl text-white">{success ? '✓' : '✗'}</span>
    </div>
  )
}
