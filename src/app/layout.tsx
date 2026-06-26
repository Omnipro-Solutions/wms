import type { ReactNode } from 'react'

import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppSidebar } from '@/components/sidebar/app-sidebar'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { OperatorPickerProvider } from '@/components/layout/operator-picker-provider'

import { APP_CONFIG } from '@/config/app-config'
import { fontVars } from '@/lib/fonts/registry'
import { PREFERENCE_DEFAULTS } from '@/lib/preferences/preferences-config'
import { ThemeBootScript } from '@/scripts/theme-boot'
import { PreferencesStoreProvider } from '@/store/preferences/preferences-provider'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { BreadcrumbNav } from '@/components/sidebar/breadcrumb-nav'
import { HeaderActions } from '@/components/sidebar/header-actions'
import { SIDEBAR_COLLAPSIBLE_VALUES, SIDEBAR_VARIANT_VALUES } from '@/lib/preferences/layout'
import { cn } from '@/lib/utils'
import { getPreference } from '@/server/server-actions'

import './globals.css'

export const metadata: Metadata = {
  title: APP_CONFIG.meta.title,
  description: APP_CONFIG.meta.description,
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false'
  const [variant, collapsible] = await Promise.all([
    getPreference('sidebar_variant', SIDEBAR_VARIANT_VALUES, 'inset'),
    getPreference('sidebar_collapsible', SIDEBAR_COLLAPSIBLE_VALUES, 'icon'),
  ])

  const {
    theme_mode,
    theme_preset,
    content_layout,
    navbar_style,
    sidebar_variant,
    sidebar_collapsible,
    font,
  } = PREFERENCE_DEFAULTS

  return (
    <html
      lang="en"
      data-theme-mode={theme_mode}
      data-theme-preset={theme_preset}
      data-content-layout={content_layout}
      data-navbar-style={navbar_style}
      data-sidebar-variant={sidebar_variant}
      data-sidebar-collapsible={sidebar_collapsible}
      data-font={font}
      suppressHydrationWarning
    >
      <head>
        {/* Applies theme and layout preferences on load to avoid flicker and unnecessary server rerenders. */}
        <ThemeBootScript />
      </head>
      <body className={`${fontVars} min-h-screen antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <TooltipProvider>
          <PreferencesStoreProvider
            themeMode={theme_mode}
            themePreset={theme_preset}
            contentLayout={content_layout}
            navbarStyle={navbar_style}
            font={font}
          >
            <OperatorPickerProvider>
            <SidebarProvider
              defaultOpen={defaultOpen}
              style={
                {
                  '--sidebar-width': 'calc(var(--spacing) * 68)',
                } as React.CSSProperties
              }
            >
              <AppSidebar variant={variant} collapsible={collapsible} />
              <SidebarInset
                className={cn(
                  '[html[data-content-layout=centered]_&>*]:mx-auto',
                  '[html[data-content-layout=centered]_&>*]:w-full',
                  'peer-data-[variant=inset]:border',
                  '[--dashboard-header-height:--spacing(12)]',
                  'min-w-0 overflow-x-hidden'
                )}
              >
                <header
                  className={cn(
                    'flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12',
                    '[html[data-navbar-style=sticky]_&]:bg-background/50 [html[data-navbar-style=sticky]_&]:sticky [html[data-navbar-style=sticky]_&]:top-0 [html[data-navbar-style=sticky]_&]:z-50 [html[data-navbar-style=sticky]_&]:overflow-hidden [html[data-navbar-style=sticky]_&]:rounded-t-[inherit] [html[data-navbar-style=sticky]_&]:backdrop-blur-md'
                  )}
                >
                  <div className="flex w-full items-center justify-between px-4 lg:px-6">
                    <div className="flex items-center gap-1 lg:gap-2">
                      <SidebarTrigger className="-ml-1" />
                      <Separator
                        orientation="vertical"
                        className="mx-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
                      />
                      <BreadcrumbNav />
                    </div>
                    <HeaderActions />
                  </div>
                </header>
                {/* Pages can set data-content-padding="false" to render full-bleed app layouts. */}
                <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-4 has-data-[content-padding=false]:p-0 md:p-6 md:has-data-[content-padding=false]:p-0">
                  {children}
                </div>
              </SidebarInset>
            </SidebarProvider>
            </OperatorPickerProvider>
            <Toaster />
          </PreferencesStoreProvider>
        </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
