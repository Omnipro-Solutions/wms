import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  children: ReactNode
  className?: string
}

/**
 * Sticky bottom action bar that keeps the primary CTA in the operator's thumb
 * zone — no scrolling to the end of a form to confirm. Pass the primary (and
 * optional secondary) buttons as children; they stack full-width.
 *
 * Sits inside the worker `max-w-lg` content column and bleeds to the viewport
 * edges via `-mx-4` (cancelling the layout's `p-4`), with a safe-area inset so
 * it clears the phone's home indicator.
 */
export const WorkerActionBar = ({ children, className }: Props) => (
  <div
    className={cn(
      'border-border sticky bottom-0 z-20 -mx-4 mt-2 border-t bg-background/95 px-4 pt-3 backdrop-blur-sm',
      'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
      className
    )}
  >
    <div className="flex flex-col gap-2">{children}</div>
  </div>
)
