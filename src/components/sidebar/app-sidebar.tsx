'use client'

import Image from 'next/image'
import Link from 'next/link'

import { useShallow } from 'zustand/react/shallow'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { APP_CONFIG } from '@/config/app-config'
import { sidebarItems } from '@/components/navigation/sidebar/sidebar-items'
import { usePreferencesStore } from '@/store/preferences/preferences-provider'

import { NavMain } from './nav-main'
import { NavUser } from './nav-user'

export const AppSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
  const { sidebarVariant, sidebarCollapsible, isSynced } = usePreferencesStore(
    useShallow((s) => ({
      sidebarVariant: s.sidebarVariant,
      sidebarCollapsible: s.sidebarCollapsible,
      isSynced: s.isSynced,
    }))
  )

  const variant = isSynced ? sidebarVariant : props.variant
  const collapsible = isSynced ? sidebarCollapsible : props.collapsible

  return (
    <Sidebar {...props} variant={variant} collapsible={collapsible}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link prefetch={false} href="/">
                <Image src="/logo.svg" alt="Logo" width={32} height={32} className="shrink-0" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{APP_CONFIG.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{APP_CONFIG.brand}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={sidebarItems} />
        {/* <NavDocuments items={data.documents} /> */}
        {/* <NavSecondary items={data.navSecondary} className="mt-auto" /> */}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
