'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentOperator } from '@/hooks/use-current-operator'
import { resolveWorkerRoute } from '@/lib/worker-routes'

export default function WorkerHubPage() {
  const { operator } = useCurrentOperator()
  const router = useRouter()

  useEffect(() => {
    if (operator) router.replace(resolveWorkerRoute(operator.role))
  }, [operator, router])

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="text-muted-foreground text-sm">Cargando...</p>
    </div>
  )
}
