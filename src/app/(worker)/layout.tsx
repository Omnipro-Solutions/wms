import type { ReactNode } from 'react'
import { WorkerHeader } from '@/components/worker/worker-header'

export default function WorkerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <WorkerHeader />
      <main className="flex-1 p-4">
        <div className="mx-auto max-w-lg">{children}</div>
      </main>
    </div>
  )
}
