'use client'

import { LogOut, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/shared/logo'
import { OperatorSwitcher, ROLE_LABELS, ROLE_COLORS } from '@/components/shared/operator-switcher'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { useAuthStore } from '@/store/auth-store'
import { cn } from '@/lib/utils'
import { APP_CONFIG } from '@/config/app-config'

export const WorkerHeader = () => {
  const { operator } = useCurrentOperator()
  const logout = useAuthStore((s) => s.logout)
  const router = useRouter()
  const [switcherOpen, setSwitcherOpen] = useState(false)

  const handleLogout = () => {
    logout()
    router.push('/auth/login')
  }

  return (
    <header className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Logo className="text-primary size-7 shrink-0 dark:text-white" />
        <span className="text-sm font-semibold">{APP_CONFIG.name}</span>
      </div>
      {operator && (
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-sm leading-tight font-medium">{operator.name}</p>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-semibold',
                ROLE_COLORS[operator.role]
              )}
            >
              {ROLE_LABELS[operator.role]}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSwitcherOpen(true)}
            title="Cambiar rol demo"
          >
            <Users className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Cerrar sesión">
            <LogOut className="size-4" />
          </Button>
        </div>
      )}

      <OperatorSwitcher open={switcherOpen} onOpenChange={setSwitcherOpen} />
    </header>
  )
}
