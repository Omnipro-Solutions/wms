import type { ReactNode } from 'react'
import { WorkerHeader } from '@/components/worker/worker-header'

export default function WorkerLayout({ children }: { children: ReactNode }) {
  return (
    <div data-worker-theme="" className="flex min-h-svh flex-col bg-background">
      <WorkerHeader />
      <main className="flex-1 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-lg">{children}</div>
      </main>
    </div>
  )
}
