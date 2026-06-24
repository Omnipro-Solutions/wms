'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { ChevronRightIcon } from 'lucide-react'
import type { NavGroup } from '@/types/navigation'

interface Props {
  groups: NavGroup[]
  label?: string
  className?: string
}

export const NavMain = ({ groups, label, className }: Props) => {
  const pathname = usePathname()

  return (
    <SidebarGroup className={className}>
      <SidebarGroupLabel>{label ?? 'Platform'}</SidebarGroupLabel>
      <SidebarMenu>
        {groups.map((group) => {
          const isGroupActive = group.items.some(
            (item) =>
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          )

          return (
            <Collapsible
              key={group.title}
              asChild
              defaultOpen={group.isActive || isGroupActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={group.title}>
                  <CollapsibleTrigger asChild>
                    <button className="flex w-full items-center gap-2">
                      <group.icon className="size-4 shrink-0" />
                      <span>{group.title}</span>
                    </button>
                  </CollapsibleTrigger>
                </SidebarMenuButton>
                <CollapsibleTrigger asChild>
                  <SidebarMenuAction className="data-[state=open]:rotate-90">
                    <ChevronRightIcon />
                    <span className="sr-only">Toggle</span>
                  </SidebarMenuAction>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {group.items.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        (item.href !== '/' && pathname.startsWith(item.href))
                      return (
                        <SidebarMenuSubItem key={item.href}>
                          <SidebarMenuSubButton asChild isActive={isActive}>
                            <Link href={item.href} className="flex items-center gap-2">
                              {item.icon && <item.icon className="size-3.5 shrink-0 text-muted-foreground" />}
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
