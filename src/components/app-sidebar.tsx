'use client'

import * as React from 'react'
import Link from 'next/link'
import { TerminalIcon } from 'lucide-react'
import { NavMain } from '@/components/nav-main'
import { NavSecondary } from '@/components/nav-secondary'
import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { NAV_GROUPS } from '@/lib/constants'

const user = {
  name: 'Carlos Granados',
  email: 'carlos.granados@omni.pro',
  avatar: '/avatars/user.jpg',
}

const MAIN_GROUPS = ['General', 'Entrada', 'Operación', 'Despacho']
const SECONDARY_GROUPS = ['Sistema']

export const AppSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
  const mainGroups = NAV_GROUPS.filter((g) => MAIN_GROUPS.includes(g.title))
  const secondaryGroups = NAV_GROUPS.filter((g) => SECONDARY_GROUPS.includes(g.title))

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <TerminalIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">WMS Platform</span>
                  <span className="truncate text-xs">Enterprise</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={mainGroups} label="Platform" />
        <NavSecondary groups={secondaryGroups} label="Sistema" className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
