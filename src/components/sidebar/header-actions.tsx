'use client'

import { MoonIcon, SunIcon, ShieldCheckIcon, LogOutIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { useAuthStore } from '@/store/auth-store'

const ROLE_LABELS: Record<string, string> = {
  picker: 'Picker',
  packer: 'Empacador',
  receiver: 'Recepcionista',
  driver: 'Conductor',
  supervisor: 'Supervisor',
}

export const HeaderActions = () => {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const { operator } = useCurrentOperator()
  const logout = useAuthStore((s) => s.logout)
  const router = useRouter()

  const displayName = operator?.name ?? 'Sin operador'
  const displayRole = operator ? (ROLE_LABELS[operator.role] ?? operator.role) : '—'
  const initials = operator ? operator.name.slice(0, 2).toUpperCase() : '?'

  const handleLogout = () => {
    logout()
    router.push('/auth/login')
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label="Cambiar tema"
      >
        {mounted && (theme === 'dark' ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />)}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <Avatar className="h-7 w-7 rounded-full">
              <AvatarFallback className="rounded-full text-xs">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar className="h-7 w-7 rounded-md">
                <AvatarFallback className="rounded-md text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">{displayRole}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {operator?.role === 'supervisor' && (
            <DropdownMenuGroup>
              <DropdownMenuItem disabled>
                <ShieldCheckIcon className="mr-2 size-4" />
                Modo supervisor activo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </DropdownMenuGroup>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
            <LogOutIcon className="mr-2 size-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
