import type { ReactNode } from 'react'

import { Logo } from '@/components/shared/logo'
import { APP_CONFIG } from '@/config/app-config'

export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main>
      <div className="grid h-dvh justify-center p-2 lg:grid-cols-2">
        <div className="relative order-2 hidden h-full flex-col justify-between rounded-3xl bg-[url('/bg.jpg')] bg-cover bg-center px-10 py-10 lg:flex">
          <div className="text-primary-foreground space-y-2">
            <div className="flex items-center gap-3">
              <Logo className="size-9 shrink-0 text-white" />
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase opacity-70">
                  {APP_CONFIG.brand}
                </p>
                <h1 className="text-2xl leading-tight font-semibold">{APP_CONFIG.name}</h1>
              </div>
            </div>
            <p className="text-sm opacity-80">Warehouse Management System</p>
          </div>

          <p className="text-primary-foreground text-xs opacity-50">
            Control total del ciclo logístico — de la recepción al despacho.
          </p>
        </div>
        <div className="relative order-1 flex h-full">{children}</div>
      </div>
    </main>
  )
}
