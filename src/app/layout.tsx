import type { ReactNode } from 'react'

import type { Metadata } from 'next'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { getThemeBootScript } from '@/scripts/theme-boot'
import { PreferencesStoreProvider } from '@/store/preferences/preferences-provider'

import { APP_CONFIG } from '@/config/app-config'
import { fontVars } from '@/lib/fonts/registry'
import { PREFERENCE_DEFAULTS } from '@/lib/preferences/preferences-config'

import './globals.css'

export const metadata: Metadata = {
  title: APP_CONFIG.meta.title,
  description: APP_CONFIG.meta.description,
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
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
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: required for pre-hydration boot script */}
        <script dangerouslySetInnerHTML={{ __html: getThemeBootScript() }} />
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
              {children}
              <Toaster />
            </PreferencesStoreProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
