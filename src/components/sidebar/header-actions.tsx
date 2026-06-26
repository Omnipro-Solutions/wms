'use client'

import { MoonIcon, SunIcon, RefreshCwIcon, ShieldCheckIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
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
import { useOperatorPicker } from '@/components/layout/operator-picker-provider'

const ROLE_LABELS: Record<string, string> = {
  picker: 'Picker',
  packer: 'Empacador',
  receiver: 'Recepcionista',
  driver: 'Conductor',
  supervisor: 'Supervisor',
}

export const HeaderActions = () => {
  const { theme, setTheme } = useTheme()
  const { operator } = useCurrentOperator()
  const { openPicker } = useOperatorPicker()

  const displayName = operator?.name ?? 'Sin operador'
  const displayRole = operator ? (ROLE_LABELS[operator.role] ?? operator.role) : '—'
  const initials = operator ? operator.name.slice(0, 2).toUpperCase() : '?'

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label="Cambiar tema"
      >
        {theme === 'dark' ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
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
          <DropdownMenuItem onClick={openPicker}>
            <RefreshCwIcon className="mr-2 size-4" />
            Cambiar operador
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
