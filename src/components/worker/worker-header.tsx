'use client'

import Image from 'next/image'
import { LogOut, UserCog } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { useOperatorPicker } from '@/components/layout/operator-picker-provider'
import { useAuthStore } from '@/store/auth-store'
import { cn } from '@/lib/utils'
import { APP_CONFIG } from '@/config/app-config'

const ROLE_LABELS: Record<string, string> = {
  picker:     'Picker',
  packer:     'Empacador',
  receiver:   'Recepcionista',
  driver:     'Conductor',
  supervisor: 'Supervisor',
}

const ROLE_COLORS: Record<string, string> = {
  picker:     'bg-blue-100 text-blue-800',
  packer:     'bg-purple-100 text-purple-800',
  receiver:   'bg-green-100 text-green-800',
  driver:     'bg-orange-100 text-orange-800',
  supervisor: 'bg-red-100 text-red-800',
}

export const WorkerHeader = () => {
  const { operator } = useCurrentOperator()
  const { openPicker } = useOperatorPicker()
  const logout = useAuthStore((s) => s.logout)
  const router = useRouter()

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
          <Button variant="ghost" size="icon" onClick={openPicker} title="Cambiar operador">
            <UserCog className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Cerrar sesión">
            <LogOut className="size-4" />
          </Button>
        </div>
      )}
    </header>
  )
}
