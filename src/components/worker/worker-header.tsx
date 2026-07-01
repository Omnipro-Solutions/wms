'use client'

import Image from 'next/image'
import { LogOut, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-2">
        <Image src="/logo.svg" alt="Logo" width={28} height={28} className="shrink-0" />
        <span className="font-semibold text-sm">{APP_CONFIG.name}</span>
      </div>
      {operator && (
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-sm font-medium leading-tight">{operator.name}</p>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', ROLE_COLORS[operator.role])}>
              {ROLE_LABELS[operator.role]}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSwitcherOpen(true)} title="Cambiar rol demo">
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
