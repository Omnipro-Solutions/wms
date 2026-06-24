'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ClipboardList,
  HomeIcon,
  MoreHorizontal,
  Package,
  PackageCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/components/ui/sidebar'

const BOTTOM_ITEMS = [
  { label: 'Inicio', href: '/', icon: HomeIcon, exact: true },
  { label: 'Recepción', href: '/receiving', icon: PackageCheck, exact: false },
  { label: 'Picking', href: '/picking', icon: ClipboardList, exact: false },
  { label: 'Packing', href: '/packing', icon: Package, exact: false },
] as const

export const BottomNav = () => {
  const pathname = usePathname()
  const { toggleSidebar } = useSidebar()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t bg-background md:hidden">
      {BOTTOM_ITEMS.map(({ label, href, icon: Icon, exact }) => {
        const isActive = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
              isActive
                ? 'text-foreground border-t-2 border-foreground'
                : 'text-muted-foreground border-t-2 border-transparent hover:text-foreground'
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        )
      })}
      <button
        onClick={toggleSidebar}
        className="flex flex-1 flex-col items-center justify-center gap-1 border-t-2 border-transparent text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <MoreHorizontal className="size-5" />
        Más
      </button>
    </nav>
  )
}
