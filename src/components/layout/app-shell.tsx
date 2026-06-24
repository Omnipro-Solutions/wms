'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AppSidebar } from '@/components/app-sidebar'
import { BottomNav } from '@/components/layout/bottom-nav'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { NAV_GROUPS } from '@/lib/constants'

const useBreadcrumb = () => {
  const pathname = usePathname()

  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))) {
        return { group: group.title, label: item.label }
      }
    }
  }

  return null
}

export const AppShell = ({ children }: { children: ReactNode }) => {
  const crumb = useBreadcrumb()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              {crumb?.group && (
                <>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink asChild>
                      <Link href="/">{crumb.group}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                </>
              )}
              <BreadcrumbItem>
                <BreadcrumbPage>{crumb?.label ?? 'Dashboard'}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <main className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-1 flex-col gap-4 p-6 pb-20 md:pb-6">
            {children}
          </div>
        </main>

        <BottomNav />
      </SidebarInset>
    </SidebarProvider>
  )
}
