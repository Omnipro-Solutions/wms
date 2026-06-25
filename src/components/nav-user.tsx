'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { ChevronsUpDownIcon, MoonIcon, RefreshCwIcon, ShieldCheckIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { useOperatorPicker } from '@/components/layout/operator-picker-provider'

const ROLE_LABELS: Record<string, string> = {
  picker: 'Picker',
  packer: 'Empacador',
  receiver: 'Recepcionista',
  driver: 'Conductor',
  supervisor: 'Supervisor',
}

export function NavUser() {
  const { isMobile } = useSidebar()
  const { operator } = useCurrentOperator()
  const { openPicker } = useOperatorPicker()
  const { theme, setTheme } = useTheme()

  const displayName = operator?.name ?? 'Sin operador'
  const displayRole = operator ? (ROLE_LABELS[operator.role] ?? operator.role) : '—'
  const initials = operator ? operator.name.slice(0, 2).toUpperCase() : '?'

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">{displayRole}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
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
              </DropdownMenuGroup>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? (
                <SunIcon className="mr-2 size-4" />
              ) : (
                <MoonIcon className="mr-2 size-4" />
              )}
              {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={openPicker}>
              <RefreshCwIcon className="mr-2 size-4" />
              Cambiar operador
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
