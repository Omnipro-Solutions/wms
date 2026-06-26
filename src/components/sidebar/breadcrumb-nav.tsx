'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { sidebarItems } from '@/components/navigation/sidebar/sidebar-items'

const useCrumb = () => {
  const pathname = usePathname()

  for (const group of sidebarItems) {
    for (const item of group.items) {
      if ('url' in item) {
        if (item.url === pathname || (item.url !== '/' && pathname.startsWith(item.url))) {
          return { group: group.label, label: item.title }
        }
      }
    }
  }

  return null
}

export const BreadcrumbNav = () => {
  const crumb = useCrumb()

  return (
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
  )
}
