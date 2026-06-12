'use client'

import * as React from 'react'
import { Progress as ProgressPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

const indicatorVariants: Record<string, string> = {
  default: 'bg-primary',
  success: 'bg-emerald-500',
  destructive: 'bg-destructive',
  warning: 'bg-amber-500',
}

interface ProgressProps extends React.ComponentProps<typeof ProgressPrimitive.Root> {
  variant?: 'default' | 'success' | 'destructive' | 'warning'
}

function Progress({ className, value, variant = 'default', ...props }: ProgressProps) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        'bg-muted relative flex h-1 w-full items-center overflow-x-hidden rounded-full',
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn('size-full flex-1 transition-all', indicatorVariants[variant])}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
