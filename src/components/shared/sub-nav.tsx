'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export interface SubNavItem {
  value: string
  label: string
  icon?: LucideIcon
  count?: number
}

interface SubNavProps {
  items: SubNavItem[]
  defaultValue: string
  className?: string
}

export const SubNav = ({ items, defaultValue, className }: SubNavProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') ?? defaultValue

  const handleSelect = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === defaultValue) {
        params.delete('tab')
      } else {
        params.set('tab', value)
      }
      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname)
    },
    [router, pathname, searchParams, defaultValue]
  )

  return (
    <nav
      className={cn(
        'flex overflow-x-auto border-b scrollbar-none',
        className
      )}
      aria-label="Sección"
    >
      {items.map((item) => {
        const isActive = activeTab === item.value
        const Icon = item.icon
        return (
          <button
            key={item.value}
            onClick={() => handleSelect(item.value)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none',
              isActive
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
            aria-selected={isActive}
            role="tab"
          >
            {Icon && <Icon className="size-3.5 shrink-0" />}
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                  isActive
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
