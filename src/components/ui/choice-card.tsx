'use client'

/**
 * ChoiceCard — a styled radio-group card primitive built on shadcn Field + RadioGroup.
 *
 * Usage:
 *   <ChoiceCardGroup value={value} onValueChange={setValue}>
 *     <ChoiceCard value="a" icon={CheckCircle2} accent="emerald" title="Option A" description="..." />
 *     <ChoiceCard value="b" icon={XCircle}      accent="red"     title="Option B" description="..." />
 *   </ChoiceCardGroup>
 */

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field'

// ─── Accent palette ───────────────────────────────────────────────────────────

type Accent = 'emerald' | 'red' | 'amber' | 'blue' | 'neutral'

const ACCENT: Record<
  Accent,
  {
    border: string
    borderSelected: string
    bg: string
    bgSelected: string
    icon: string
    radio: string
  }
> = {
  emerald: {
    border: 'border-emerald-200 dark:border-emerald-800/50',
    borderSelected: 'border-emerald-500 ring-emerald-200 dark:ring-emerald-800/50',
    bg: 'hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40',
    bgSelected: 'bg-emerald-50 dark:bg-emerald-950/40',
    icon: 'text-emerald-600 dark:text-emerald-300',
    radio: 'data-[state=checked]:border-emerald-500 data-[state=checked]:text-emerald-600 dark:data-[state=checked]:text-emerald-300',
  },
  red: {
    border: 'border-red-200 dark:border-red-800/50',
    borderSelected: 'border-red-400  ring-red-200 dark:ring-red-800/50',
    bg: 'hover:bg-red-50/60 dark:hover:bg-red-950/40',
    bgSelected: 'bg-red-50 dark:bg-red-950/40',
    icon: 'text-red-500 dark:text-red-300',
    radio: 'data-[state=checked]:border-red-400 data-[state=checked]:text-red-500 dark:data-[state=checked]:text-red-300',
  },
  amber: {
    border: 'border-amber-200 dark:border-amber-800/50',
    borderSelected: 'border-amber-400  ring-amber-200 dark:ring-amber-800/50',
    bg: 'hover:bg-amber-50/60 dark:hover:bg-amber-950/40',
    bgSelected: 'bg-amber-50 dark:bg-amber-950/40',
    icon: 'text-amber-600 dark:text-amber-300',
    radio: 'data-[state=checked]:border-amber-400 data-[state=checked]:text-amber-600 dark:data-[state=checked]:text-amber-300',
  },
  blue: {
    border: 'border-blue-200 dark:border-blue-800/50',
    borderSelected: 'border-blue-400  ring-blue-200 dark:ring-blue-800/50',
    bg: 'hover:bg-blue-50/60 dark:hover:bg-blue-950/40',
    bgSelected: 'bg-blue-50 dark:bg-blue-950/40',
    icon: 'text-blue-600 dark:text-blue-300',
    radio: 'data-[state=checked]:border-blue-400 data-[state=checked]:text-blue-600 dark:data-[state=checked]:text-blue-300',
  },
  neutral: {
    border: 'border-border',
    borderSelected: 'border-foreground/40  ring-foreground/10',
    bg: 'hover:bg-muted/40',
    bgSelected: 'bg-muted/30',
    icon: 'text-muted-foreground',
    radio: 'data-[state=checked]:border-foreground/60',
  },
}

// ─── ChoiceCardGroup ──────────────────────────────────────────────────────────

interface ChoiceCardGroupProps {
  value: string | null
  onValueChange: (value: string) => void
  className?: string
  children: React.ReactNode
}

const ChoiceCardGroup = ({ value, onValueChange, className, children }: ChoiceCardGroupProps) => (
  <RadioGroup
    value={value ?? ''}
    onValueChange={onValueChange}
    className={cn('gap-2.5', className)}
  >
    {children}
  </RadioGroup>
)

// ─── ChoiceCard ───────────────────────────────────────────────────────────────

interface ChoiceCardProps {
  value: string
  title: string
  description: string
  icon?: LucideIcon
  accent?: Accent
  disabled?: boolean
  className?: string
}

const ChoiceCard = ({
  value,
  title,
  description,
  icon: Icon,
  accent = 'neutral',
  disabled,
  className,
}: ChoiceCardProps) => {
  const pal = ACCENT[accent]
  const id = `choice-${value}`

  return (
    <FieldLabel
      htmlFor={id}
      className={cn(
        'w-full cursor-pointer rounded-xl border-2 p-4 transition-all select-none has-data-[state=checked]:border-current',
        'has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-row *:data-[slot=field]:p-0',
        pal.border,
        pal.bg,
        'has-data-[state=checked]:',
        `has-data-[state=checked]:${pal.borderSelected}`,
        `has-data-[state=checked]:${pal.bgSelected}`,
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      <Field orientation="horizontal">
        {Icon && <Icon className={cn('mt-0.5 size-5 shrink-0', pal.icon)} aria-hidden />}
        <FieldContent>
          <FieldTitle className="text-sm font-semibold">{title}</FieldTitle>
          <FieldDescription className="text-xs">{description}</FieldDescription>
        </FieldContent>
        <RadioGroupItem
          id={id}
          value={value}
          disabled={disabled}
          className={cn('mt-0.5 shrink-0', pal.radio)}
        />
      </Field>
    </FieldLabel>
  )
}

export { ChoiceCard, ChoiceCardGroup }
export type { Accent }
