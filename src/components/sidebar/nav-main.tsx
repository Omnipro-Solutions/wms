'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { ChevronRight } from 'lucide-react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import type {
  NavBadge,
  NavGroup,
  NavMainItem,
  NavMainLinkItem,
  NavMainParentItem,
} from '@/components/navigation/sidebar/sidebar-items'

interface NavMainProps {
  readonly items: readonly NavGroup[]
}
interface NavItemProps {
  readonly item: NavMainItem
  readonly isItemActive: (item: NavMainItem) => boolean
  readonly isSubItemActive: (url: string) => boolean
  readonly isSubmenuOpen: (item: NavMainParentItem) => boolean
}

interface NavLinkItemProps {
  readonly item: NavMainLinkItem
  readonly isActive: boolean
  readonly showIconFallback: boolean
}

interface NavDropdownItemProps {
  readonly item: NavMainParentItem
  readonly isActive: boolean
  readonly isSubItemActive: (url: string) => boolean
}

interface NavCollapsibleItemProps {
  readonly item: NavMainParentItem
  readonly isActive: boolean
  readonly defaultOpen: boolean
  readonly isSubItemActive: (url: string) => boolean
}

const CollapsedIconFallback = ({ title }: { title: string }) => {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center rounded-xs text-[10px] font-medium outline">
      {title.slice(0, 1)}
    </span>
  )
}

const hasSubItems = (item: NavMainItem): item is NavMainParentItem => {
  return Boolean(item.subItems?.length)
}

export const NavMain = ({ items }: NavMainProps) => {
  const path = usePathname()
  const { operator } = useCurrentOperator()
  const role = operator?.role

  const isItemActive = (item: NavMainItem) => {
    if (hasSubItems(item)) {
      return item.subItems.some((sub) => path.startsWith(sub.url))
    }

    return path === item.url
  }

  const isSubItemActive = (url: string) => {
    return path === url
  }

  const isSubmenuOpen = (item: NavMainParentItem) => {
    return item.subItems.some((sub: { url: string }) => path.startsWith(sub.url))
  }

  return (
    <>
      {items.map((group) => {
        const visibleItems = group.items.filter(
          (item) => !item.allowedRoles || !role || item.allowedRoles.includes(role)
        )
        if (!visibleItems.length) return null
        return (
          <SidebarGroup key={group.id}>
            {group.label && (
              <SidebarGroupLabel className="group-data-[collapsible=icon]:pointer-events-none">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.map((item) => (
                  <NavItem
                    key={item.id}
                    item={item}
                    isItemActive={isItemActive}
                    isSubItemActive={isSubItemActive}
                    isSubmenuOpen={isSubmenuOpen}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )
      })}
    </>
  )
}

const NavItem = ({ item, isItemActive, isSubItemActive, isSubmenuOpen }: NavItemProps) => {
  const { state, isMobile } = useSidebar()
  const isCollapsedDesktop = state === 'collapsed' && !isMobile

  if (!hasSubItems(item)) {
    return (
      <NavLinkItem
        item={item}
        isActive={isItemActive(item)}
        showIconFallback={isCollapsedDesktop}
      />
    )
  }

  if (isCollapsedDesktop) {
    return (
      <NavDropdownItem
        item={item}
        isActive={isItemActive(item)}
        isSubItemActive={isSubItemActive}
      />
    )
  }

  return (
    <NavCollapsibleItem
      item={item}
      isActive={isItemActive(item)}
      defaultOpen={isSubmenuOpen(item)}
      isSubItemActive={isSubItemActive}
    />
  )
}

const NavLinkItem = ({ item, isActive, showIconFallback }: NavLinkItemProps) => {
  const Icon = item.icon

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        aria-disabled={item.disabled}
        tooltip={item.title}
        isActive={isActive}
      >
        <Link
          prefetch={false}
          href={item.url}
          target={item.newTab ? '_blank' : undefined}
          rel={item.newTab ? 'noreferrer' : undefined}
        >
          {Icon ? <Icon /> : showIconFallback ? <CollapsedIconFallback title={item.title} /> : null}
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
      <NavItemBadge badge={item.badge} />
    </SidebarMenuItem>
  )
}

const NavDropdownItem = ({ item, isActive, isSubItemActive }: NavDropdownItemProps) => {
  const Icon = item.icon

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton tooltip={item.title} isActive={isActive} disabled={item.disabled}>
            {Icon ? <Icon /> : <CollapsedIconFallback title={item.title} />}
            <span>{item.title}</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="right" align="start" sideOffset={12} className="w-48">
          <DropdownMenuGroup>
            {item.subItems.map((subItem) => {
              const SubIcon = subItem.icon

              return (
                <DropdownMenuItem key={subItem.id} asChild disabled={subItem.disabled}>
                  <Link
                    prefetch={false}
                    href={subItem.url}
                    target={subItem.newTab ? '_blank' : undefined}
                    rel={subItem.newTab ? 'noreferrer' : undefined}
                    aria-current={isSubItemActive(subItem.url) ? 'page' : undefined}
                    className="flex items-center gap-2"
                  >
                    {SubIcon && <SubIcon />}
                    <span>{subItem.title}</span>
                  </Link>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

const NavCollapsibleItem = ({
  item,
  isActive,
  defaultOpen,
  isSubItemActive,
}: NavCollapsibleItemProps) => {
  const Icon = item.icon

  return (
    <Collapsible asChild defaultOpen={defaultOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title} isActive={isActive} disabled={item.disabled}>
            {Icon && <Icon />}
            <span>{item.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <NavItemBadge badge={item.badge} />

        <CollapsibleContent>
          <SidebarMenuSub>
            {item.subItems.map((subItem) => {
              const SubIcon = subItem.icon

              return (
                <SidebarMenuSubItem key={subItem.id}>
                  <SidebarMenuSubButton
                    asChild
                    aria-disabled={subItem.disabled}
                    isActive={isSubItemActive(subItem.url)}
                  >
                    <Link
                      prefetch={false}
                      href={subItem.url}
                      target={subItem.newTab ? '_blank' : undefined}
                      rel={subItem.newTab ? 'noreferrer' : undefined}
                    >
                      {SubIcon && <SubIcon />}
                      <span>{subItem.title}</span>
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
}

const NavItemBadge = ({ badge }: { badge?: NavBadge }) => {
  if (!badge) {
    return null
  }

  return (
    <SidebarMenuBadge
      className={cn(
        'rounded-sm border capitalize',
        badge === 'new' &&
          'border-green-600 text-green-600 peer-hover/menu-button:text-green-600 peer-data-active/menu-button:text-green-600',
        badge === 'soon' && 'border-muted-foreground text-muted-foreground'
      )}
    >
      {badge}
    </SidebarMenuBadge>
  )
}
