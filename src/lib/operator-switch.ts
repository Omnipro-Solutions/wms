import { resolveWorkerRoute } from '@/lib/worker-routes'
import type { OperatorRole } from '@/lib/worker-routes'

export const resolveSwitchDestination = (role: OperatorRole, currentPathname: string): string => {
  if (role !== 'supervisor') return resolveWorkerRoute(role)
  return currentPathname.startsWith('/worker') ? '/' : currentPathname
}
