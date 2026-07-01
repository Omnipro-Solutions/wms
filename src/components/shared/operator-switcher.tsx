'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth-store'
import { resolveSwitchDestination } from '@/lib/operator-switch'
import { cn } from '@/lib/utils'
import type { Operator } from '@/types/wms'

export const ROLE_LABELS: Record<Operator['role'], string> = {
  supervisor: 'Supervisor',
  receiver: 'Recepcionista',
  picker: 'Picker',
  packer: 'Empacador',
  driver: 'Conductor',
}

export const ROLE_COLORS: Record<Operator['role'], string> = {
  supervisor: 'bg-red-100 text-red-800',
  receiver: 'bg-green-100 text-green-800',
  picker: 'bg-blue-100 text-blue-800',
  packer: 'bg-purple-100 text-purple-800',
  driver: 'bg-orange-100 text-orange-800',
}

interface DemoOperator {
  role: Operator['role']
  name: string
  email: string
  password: string
}

const DEMO_OPERATORS: DemoOperator[] = [
  { role: 'supervisor', name: 'Carlos Granados', email: 'carlos.granados@wms.co', password: 'wms2024' },
  { role: 'receiver', name: 'María Recepcionista', email: 'receiver@demo.com', password: '123456' },
  { role: 'picker', name: 'Ana Picker', email: 'picker@demo.com', password: '123456' },
  { role: 'packer', name: 'Pedro Packer', email: 'packer@demo.com', password: '123456' },
  { role: 'driver', name: 'Carlos Driver', email: 'driver@demo.com', password: '123456' },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const OperatorSwitcher = ({ open, onOpenChange }: Props) => {
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const router = useRouter()
  const pathname = usePathname()
  const [loadingRole, setLoadingRole] = useState<Operator['role'] | null>(null)

  const handleSwitch = async (demoOperator: DemoOperator) => {
    setLoadingRole(demoOperator.role)
    logout()
    const result = await login(demoOperator.email, demoOperator.password, false)
    setLoadingRole(null)
    if (!result.success) return
    onOpenChange(false)
    router.push(resolveSwitchDestination(demoOperator.role, pathname))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Cambiar operador (demo)</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-2">
          {DEMO_OPERATORS.map((demoOperator) => (
            <Button
              key={demoOperator.role}
              variant="outline"
              className="justify-start gap-3"
              disabled={loadingRole !== null}
              onClick={() => handleSwitch(demoOperator)}
            >
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', ROLE_COLORS[demoOperator.role])}>
                {ROLE_LABELS[demoOperator.role]}
              </span>
              <span className="text-sm">{demoOperator.name}</span>
              {loadingRole === demoOperator.role && (
                <span className="ml-auto text-xs text-muted-foreground">...</span>
              )}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
