# UI Redesign — Sidebar-03 + SubNav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current sidebar (inset variant, tabs inside pages) with sidebar-03 style (expandable groups + submenus) and a URL-driven SubNav horizontal scroll bar that replaces `<Tabs>` in all pages with tabs, plus a mobile BottomNav for operators.

**Architecture:** The shadcn `Sidebar` component already supports the sidebar-03 pattern via `SidebarMenuSub` + `Collapsible` — `nav-main.tsx` already implements this. Changes are: (1) switch sidebar from `variant="inset"` to `variant="sidebar"`, (2) build a `SubNav` component that reads `?tab=` from URL searchParams and replaces `<Tabs>` in 6 pages, (3) add a `BottomNav` component visible only on mobile. No store changes, no type changes, no DataTable changes.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript 5 · Tailwind CSS 4 · shadcn/ui · `useSearchParams` / `useRouter` from `next/navigation`

## Global Constraints

- All UI labels in Spanish (es-CO)
- No modifications to `src/components/ui/` files — these are shadcn primitives
- No modifications to `src/store/`, `src/lib/rules/`, `src/types/`
- Arrow functions for all components: `const Foo = () => {}`
- `cn()` from `@/lib/utils` for all conditional class merging
- No `any` types
- Default exports only in `src/app/[route]/page.tsx` files
- Components max 150 lines — split if larger
- Tailwind v4 class syntax (e.g. `size-4`, `gap-2`, `bg-muted/40`)

---

## File Map

### Created
- `src/components/shared/sub-nav.tsx` — URL-driven horizontal nav that replaces `<Tabs>` in pages
- `src/components/layout/bottom-nav.tsx` — Mobile bottom navigation bar (5 items, `md:hidden`)

### Modified
- `src/components/app-sidebar.tsx` — Change `variant="inset"` → `variant="sidebar"`, remove `MAIN_GROUPS`/`SECONDARY_GROUPS` split, use single `NavMain` for all groups
- `src/components/layout/app-shell.tsx` — Remove `SidebarInset` wrapper quirks for `variant="sidebar"`, add `BottomNav`, improve breadcrumb with group label
- `src/lib/constants.ts` — Add `icon` to all `NavItem` entries that are missing one (currently most items lack item-level icons)
- `src/app/picking/page.tsx` — Replace `<Tabs>` with `<SubNav>` + `useSearchParams`
- `src/app/receiving/page.tsx` — Replace `<Tabs>` with `<SubNav>` + `useSearchParams`
- `src/app/slotting/page.tsx` — Replace `<Tabs>` with `<SubNav>` + `useSearchParams`
- `src/app/returns/page.tsx` — Replace `<Tabs>` with `<SubNav>` + `useSearchParams` (if uses Tabs)
- `src/app/admin/page.tsx` — Replace `<Tabs>` with `<SubNav>` + `useSearchParams`
- `src/app/packing/page.tsx` — Replace `<Tabs>` with `<SubNav>` + `useSearchParams`
- `src/app/shipping/page.tsx` — Replace `<Tabs>` with `<SubNav>` + `useSearchParams`

---

## Task 1: SubNav Component

**Files:**
- Create: `src/components/shared/sub-nav.tsx`

**Interfaces:**
- Produces: `SubNav` component, `SubNavItem` type

```tsx
export interface SubNavItem {
  value: string   // matches ?tab= query param value
  label: string
  icon?: LucideIcon
  count?: number
}

interface SubNavProps {
  items: SubNavItem[]
  defaultValue: string  // shown when no ?tab= in URL
  className?: string
}

export const SubNav = ({ items, defaultValue, className }: SubNavProps) => {}
```

- [ ] **Step 1: Create the component file**

```tsx
'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export interface SubNavItem {
  value: string
  label: string
  icon?: LucideIcon
  count?: number
}

interface SubNavProps {
  items: SubNavItem[]
  defaultValue: string
  className?: string
}

export const SubNav = ({ items, defaultValue, className }: SubNavProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') ?? defaultValue

  const handleSelect = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === defaultValue) {
        params.delete('tab')
      } else {
        params.set('tab', value)
      }
      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname)
    },
    [router, pathname, searchParams, defaultValue]
  )

  return (
    <nav
      className={cn(
        'flex overflow-x-auto border-b scrollbar-none',
        className
      )}
      aria-label="Sección"
    >
      {items.map((item) => {
        const isActive = activeTab === item.value
        const Icon = item.icon
        return (
          <button
            key={item.value}
            onClick={() => handleSelect(item.value)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none',
              isActive
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
            aria-selected={isActive}
            role="tab"
          >
            {Icon && <Icon className="size-3.5 shrink-0" />}
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                  isActive
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Add `scrollbar-none` utility to globals.css**

Open `src/app/globals.css`, add at the end of `@layer base`:

```css
@layer utilities {
  .scrollbar-none {
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
}
```

- [ ] **Step 3: Export from shared index (if one exists, otherwise skip)**

```bash
ls src/components/shared/
```

If there is no `index.ts`, skip. If there is, add:
```ts
export { SubNav } from './sub-nav'
export type { SubNavItem } from './sub-nav'
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `sub-nav.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/sub-nav.tsx src/app/globals.css
git commit -m "feat: add SubNav component — URL-driven tab navigation with ?tab= searchParam"
```

---

## Task 2: Sidebar variant="sidebar" + nav-main icons

**Files:**
- Modify: `src/components/app-sidebar.tsx`
- Modify: `src/lib/constants.ts`
- Modify: `src/components/layout/app-shell.tsx`

**Interfaces:**
- Consumes: existing `NAV_GROUPS`, `NavMain`, `NavSecondary`, `NavUser`
- Produces: sidebar in `variant="sidebar"` mode showing group collapsibles with item icons

- [ ] **Step 1: Add missing item-level icons in constants.ts**

Open `src/lib/constants.ts`. Add icon imports at top (merge with existing import):

```ts
import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  Boxes,
  Cable,
  ClipboardList,
  Grid3x3,
  ListChecks,
  MapPinned,
  Package,
  PackageCheck,
  Route,
  Settings2,
  ShoppingCart,
  ScanLine,
  Tags,
  Truck,
  Undo2,
  Warehouse,
  Waves,
  GitBranch,
  Layers,
  Zap,
  Hash,
} from 'lucide-react'
```

Replace the `NAV_GROUPS` array with this version that adds `icon` to every `NavItem`:

```ts
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Entrada',
    icon: PackageCheck,
    items: [
      { label: 'Recepción', href: '/receiving', icon: PackageCheck },
      { label: 'Inventario', href: '/inventory', icon: Boxes },
      { label: 'Trazabilidad lotes', href: '/inventory/lot-trace', icon: Layers },
      { label: 'Trazabilidad N/S', href: '/serial-trace', icon: ScanLine },
      { label: 'Ubicaciones', href: '/locations', icon: MapPinned },
      { label: 'Slotting', href: '/slotting', icon: Grid3x3 },
    ],
  },
  {
    title: 'Operación',
    icon: ClipboardList,
    items: [
      { label: 'Traslados', href: '/transfers', icon: ArrowRightLeft },
      { label: 'Devoluciones', href: '/returns', icon: Undo2 },
      { label: 'Commerce', href: '/commerce', icon: ShoppingCart },
      { label: 'Picking', href: '/picking', icon: ClipboardList },
      { label: 'Packing', href: '/packing', icon: Package },
      { label: 'Etiquetas', href: '/labels', icon: Tags },
    ],
  },
  {
    title: 'Despacho',
    icon: Truck,
    items: [
      { label: 'Shipping', href: '/shipping', icon: Truck },
      { label: 'Manifiestos', href: '/load-manifests', icon: Route },
    ],
  },
  {
    title: 'Sistema',
    icon: BarChart3,
    items: [
      { label: 'Integraciones', href: '/integrations', icon: Cable },
      { label: 'Reportes', href: '/reports', icon: BarChart3 },
      { label: 'Administración', href: '/admin', icon: Settings2 },
    ],
  },
]
```

- [ ] **Step 2: Update app-sidebar.tsx**

Replace entire file content:

```tsx
'use client'

import * as React from 'react'
import Link from 'next/link'
import { TerminalIcon } from 'lucide-react'
import { NavMain } from '@/components/nav-main'
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

export const AppSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
  return (
    <Sidebar variant="sidebar" collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <TerminalIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">WMS Platform</span>
                  <span className="truncate text-xs text-muted-foreground">Enterprise</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={NAV_GROUPS} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
```

- [ ] **Step 3: Update nav-main.tsx to show item icons**

In `src/components/nav-main.tsx`, inside `SidebarMenuSubButton`, add the icon render before the label:

```tsx
<SidebarMenuSubButton asChild isActive={isActive}>
  <Link href={item.href} className="flex items-center gap-2">
    {item.icon && <item.icon className="size-3.5 shrink-0 text-muted-foreground" />}
    <span>{item.label}</span>
  </Link>
</SidebarMenuSubButton>
```

- [ ] **Step 4: Update app-shell.tsx**

Replace entire file:

```tsx
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
```

Note: `pb-20 md:pb-6` gives space for bottom nav on mobile.

- [ ] **Step 5: Verify TypeScript**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/app-sidebar.tsx src/lib/constants.ts src/components/nav-main.tsx src/components/layout/app-shell.tsx
git commit -m "feat: switch sidebar to variant=sidebar with group collapsibles and item icons"
```

---

## Task 3: BottomNav component

**Files:**
- Create: `src/components/layout/bottom-nav.tsx`

**Interfaces:**
- Produces: `BottomNav` — fixed bottom bar, `md:hidden`, 5 items, uses `useSidebar().toggleSidebar` for "Más"

- [ ] **Step 1: Create bottom-nav.tsx**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ClipboardList,
  HomeIcon,
  MoreHorizontal,
  Package,
  PackageCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/components/ui/sidebar'

const BOTTOM_ITEMS = [
  { label: 'Inicio', href: '/', icon: HomeIcon, exact: true },
  { label: 'Recepción', href: '/receiving', icon: PackageCheck, exact: false },
  { label: 'Picking', href: '/picking', icon: ClipboardList, exact: false },
  { label: 'Packing', href: '/packing', icon: Package, exact: false },
] as const

export const BottomNav = () => {
  const pathname = usePathname()
  const { toggleSidebar } = useSidebar()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t bg-background md:hidden">
      {BOTTOM_ITEMS.map(({ label, href, icon: Icon, exact }) => {
        const isActive = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
              isActive
                ? 'text-foreground border-t-2 border-foreground'
                : 'text-muted-foreground border-t-2 border-transparent hover:text-foreground'
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        )
      })}
      <button
        onClick={toggleSidebar}
        className="flex flex-1 flex-col items-center justify-center gap-1 border-t-2 border-transparent text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <MoreHorizontal className="size-5" />
        Más
      </button>
    </nav>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/bottom-nav.tsx
git commit -m "feat: add BottomNav for mobile operators — 4 direct links + sidebar sheet trigger"
```

---

## Task 4: Replace Tabs with SubNav in Picking page

**Files:**
- Modify: `src/app/picking/page.tsx`

**Interfaces:**
- Consumes: `SubNav`, `SubNavItem` from `@/components/shared/sub-nav`
- Current tab values: `tasks`, `waves`, `waveless`, `batch`, `zone`, `cluster`, `put-to-store`
- Current state: `const [activeTab, setActiveTab] = useState<TabValue>('tasks')` or `useRouter`/`useSearchParams`

- [ ] **Step 1: Read current tab management in picking page**

```bash
grep -n "activeTab\|setActiveTab\|handleTabChange\|TabValue\|useState" src/app/picking/page.tsx | head -20
```

- [ ] **Step 2: Replace Tabs imports and state**

Remove from imports:
```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
```

Add:
```tsx
import { SubNav, type SubNavItem } from '@/components/shared/sub-nav'
import { useSearchParams } from 'next/navigation'
```

Remove the `TabValue` type, `activeTab` state, and `handleTabChange` — the `SubNav` handles this via URL.

Add a searchParams hook and derive active tab:
```tsx
const searchParams = useSearchParams()
const activeTab = searchParams.get('tab') ?? 'tasks'
```

- [ ] **Step 3: Define SubNav items and replace TabsList**

Add this constant near the top of the component (after state declarations):
```tsx
const PICKING_TABS: SubNavItem[] = [
  { value: 'tasks', label: 'Tareas', count: pickingTasks.length },
  { value: 'waves', label: 'Oleadas', count: waves.length },
  { value: 'waveless', label: 'Waveless', count: wavelessOrders.length },
  { value: 'batch', label: 'Batch', count: batchTasks.length },
  { value: 'zone', label: 'Zona' },
  { value: 'cluster', label: 'Cluster', count: clusterTasks.length },
  { value: 'put-to-store', label: 'Put-to-store', count: putToStoreTasks.length },
]
```

Replace the `<Tabs value={activeTab} onValueChange={...}>` wrapper and `<TabsList>/<TabsTrigger>` block with:
```tsx
<SubNav items={PICKING_TABS} defaultValue="tasks" className="-mx-0 mb-4" />
```

- [ ] **Step 4: Replace TabsContent with conditional rendering**

Replace every `<TabsContent value="X">...</TabsContent>` with:
```tsx
{activeTab === 'X' && (
  // original content
)}
```

Do this for all 7 tabs: `tasks`, `waves`, `waveless`, `batch`, `zone`, `cluster`, `put-to-store`.

- [ ] **Step 5: Remove the closing `</Tabs>` tag**

The outer `<Tabs>` wrapper is gone. Remove the closing tag.

- [ ] **Step 6: Verify TypeScript**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "picking" | head -20
```

Expected: no errors for picking page

- [ ] **Step 7: Commit**

```bash
git add src/app/picking/page.tsx
git commit -m "feat: replace Tabs with SubNav in /picking — 7 strategies URL-driven"
```

---

## Task 5: Replace Tabs with SubNav in Receiving page

**Files:**
- Modify: `src/app/receiving/page.tsx`

**Interfaces:**
- Consumes: `SubNav`, `SubNavItem`
- Current tab values: `ordenes`, `citas`, `recibiendo`, `qc`, `putaway`

- [ ] **Step 1: Replace Tabs import**

Remove:
```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
```

Add:
```tsx
import { SubNav, type SubNavItem } from '@/components/shared/sub-nav'
import { useSearchParams } from 'next/navigation'
```

- [ ] **Step 2: Replace activeTab state with searchParams**

Remove `useState` for `activeTab`. Add:
```tsx
const searchParams = useSearchParams()
const activeTab = searchParams.get('tab') ?? 'ordenes'
```

- [ ] **Step 3: Define SubNav items and replace TabsList**

```tsx
const RECEIVING_TABS: SubNavItem[] = [
  { value: 'ordenes', label: 'Órdenes de compra', count: pendingPoCount },
  { value: 'citas', label: 'Citas ASN', count: appointmentRows.length },
  { value: 'recibiendo', label: 'Recibiendo activo' },
  { value: 'qc', label: 'Control de calidad', count: qcRows.length },
  { value: 'putaway', label: 'Putaway staging' },
]
```

Replace `<Tabs ...>/<TabsList>/<TabsTrigger>` block with:
```tsx
<SubNav items={RECEIVING_TABS} defaultValue="ordenes" className="mb-4" />
```

- [ ] **Step 4: Replace TabsContent with conditionals**

Replace every `<TabsContent value="X">...</TabsContent>` with `{activeTab === 'X' && (...)}` for all 5 tabs.

- [ ] **Step 5: Verify TypeScript**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | grep "receiving" | head -10
```

- [ ] **Step 6: Commit**

```bash
git add src/app/receiving/page.tsx
git commit -m "feat: replace Tabs with SubNav in /receiving — 5 tabs URL-driven"
```

---

## Task 6: Replace Tabs with SubNav in Slotting, Returns, Admin, Packing, Shipping

**Files:**
- Modify: `src/app/slotting/page.tsx`
- Modify: `src/app/returns/page.tsx` (if it has Tabs — check first)
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/packing/page.tsx`
- Modify: `src/app/shipping/page.tsx`

**Interfaces:**
- Consumes: `SubNav`, `SubNavItem`
- Tab values per page:
  - slotting: `optimization`, `classification`, `replenishment`, `affinity`, `history`
  - admin: `operators`, `reasons`, `carriers`, `inventory-control`, `cyclic-counts`, `uom`, `settings`
  - packing: `verificacion`, `reglas`, `etiquetas`
  - shipping: `shipments`, `otif`

- [ ] **Step 1: Slotting — replace Tabs**

In `src/app/slotting/page.tsx`:

Remove Tabs imports, add SubNav + useSearchParams.

Replace activeTab state with:
```tsx
const searchParams = useSearchParams()
const activeTab = searchParams.get('tab') ?? 'optimization'
```

SubNav items:
```tsx
const SLOTTING_TABS: SubNavItem[] = [
  { value: 'optimization', label: 'Recomendaciones' },
  { value: 'classification', label: 'Clasificación ABC/XYZ' },
  { value: 'replenishment', label: 'Reposición' },
  { value: 'affinity', label: 'Afinidad' },
  { value: 'history', label: 'Historial' },
]
```

Replace `<Tabs>/<TabsList>/<TabsTrigger>` with `<SubNav items={SLOTTING_TABS} defaultValue="optimization" className="mb-4" />`.

Replace all 5 `TabsContent` with `{activeTab === 'X' && (...)}`.

- [ ] **Step 2: Admin — replace Tabs**

In `src/app/admin/page.tsx`:

Remove Tabs imports, add SubNav + useSearchParams.

Replace activeTab state with:
```tsx
const searchParams = useSearchParams()
const activeTab = searchParams.get('tab') ?? 'operators'
```

SubNav items:
```tsx
const ADMIN_TABS: SubNavItem[] = [
  { value: 'operators', label: 'Operadores' },
  { value: 'reasons', label: 'Razones' },
  { value: 'carriers', label: 'Carriers' },
  { value: 'inventory-control', label: 'Control inventario' },
  { value: 'cyclic-counts', label: 'Conteos cíclicos' },
  { value: 'uom', label: 'Unidades de medida' },
  { value: 'settings', label: 'Configuración' },
]
```

Replace `<Tabs>/<TabsList>/<TabsTrigger>` with `<SubNav items={ADMIN_TABS} defaultValue="operators" className="mb-4" />`.

Replace all 7 `TabsContent` with conditionals.

- [ ] **Step 3: Packing — replace Tabs**

In `src/app/packing/page.tsx`:

Remove Tabs imports, add SubNav + useSearchParams.

Replace activeTab state with:
```tsx
const searchParams = useSearchParams()
const activeTab = searchParams.get('tab') ?? 'verificacion'
```

SubNav items:
```tsx
const PACKING_TABS: SubNavItem[] = [
  { value: 'verificacion', label: 'Verificación' },
  { value: 'reglas', label: 'Reglas de empaque' },
  { value: 'etiquetas', label: 'Etiquetas' },
]
```

Replace `<Tabs>/<TabsList>/<TabsTrigger>` with `<SubNav items={PACKING_TABS} defaultValue="verificacion" className="mb-4" />`.

Replace all 3 `TabsContent` with conditionals.

- [ ] **Step 4: Shipping — replace Tabs**

In `src/app/shipping/page.tsx`:

SubNav items:
```tsx
const SHIPPING_TABS: SubNavItem[] = [
  { value: 'shipments', label: 'Envíos' },
  { value: 'otif', label: 'OTIF' },
]
```

Replace activeTab state with:
```tsx
const searchParams = useSearchParams()
const activeTab = searchParams.get('tab') ?? 'shipments'
```

Replace `<Tabs>/<TabsList>/<TabsTrigger>` with `<SubNav items={SHIPPING_TABS} defaultValue="shipments" className="mb-4" />`.

Replace both `TabsContent` with conditionals.

- [ ] **Step 5: Check returns page**

```bash
grep -n "TabsTrigger\|TabsContent\|<Tabs" src/app/returns/page.tsx | head -10
```

If Tabs exist, apply the same pattern. If not, skip.

- [ ] **Step 6: Verify TypeScript for all modified pages**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/app/slotting/page.tsx src/app/admin/page.tsx src/app/packing/page.tsx src/app/shipping/page.tsx src/app/returns/page.tsx
git commit -m "feat: replace Tabs with SubNav in slotting, admin, packing, shipping, returns"
```

---

## Task 7: PageHeader cleanup + mobile padding

**Files:**
- Modify: `src/components/shared/page-header.tsx`
- Modify: `src/app/globals.css` (if needed)

**Interfaces:**
- `PageHeader` already has `title`, `description`, `actions` — no interface changes needed

The current `PageHeader` has `border-b pb-4`. With the new layout where `SubNav` sits directly below PageHeader inside the page content, we need to remove the border-b from PageHeader since the SubNav provides visual separation.

- [ ] **Step 1: Update PageHeader to remove bottom border**

In `src/components/shared/page-header.tsx`:

```tsx
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
```

(Only change: remove `border-b pb-4` from the wrapper className.)

- [ ] **Step 2: Verify build**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/page-header.tsx
git commit -m "fix: remove border-b from PageHeader — SubNav provides visual separation"
```

---

## Self-Review

### Spec coverage check

| Requirement | Covered by task |
|---|---|
| Sidebar variant="sidebar" (sidebar-03 style) | Task 2 |
| Groups + submenus with icons | Task 2 (constants.ts + nav-main.tsx) |
| collapsible="offcanvas" (user can close) | Task 2 (app-sidebar.tsx) |
| SubNav replaces Tabs — URL-driven | Task 1 |
| Picking (7 tabs) | Task 4 |
| Receiving (5 tabs) | Task 5 |
| Slotting (5 tabs) | Task 6 |
| Admin (7 tabs) | Task 6 |
| Packing (3 tabs) | Task 6 |
| Shipping (2 tabs) | Task 6 |
| BottomNav for mobile operators | Task 3 |
| BottomNav hidden md:hidden | Task 3 |
| pb-20 on main to clear BottomNav | Task 2 (app-shell.tsx) |
| Breadcrumb shows group + label | Task 2 (app-shell.tsx) |
| PageHeader border cleanup | Task 7 |
| No changes to shadcn ui/ primitives | ✅ no task touches ui/ |
| No store/types/lib/rules changes | ✅ confirmed |

### Placeholder scan
- No TBD, no TODO, no "similar to task N"
- All code blocks are complete
- All file paths are exact

### Type consistency
- `SubNavItem.value: string` used consistently in Tasks 1, 4, 5, 6
- `SubNav` props: `items: SubNavItem[]`, `defaultValue: string` — used correctly in all tasks
- `activeTab` derived from `searchParams.get('tab') ?? defaultValue` in every page — consistent pattern
- `BottomNav` consumes `useSidebar().toggleSidebar` — correct hook signature from sidebar.tsx
