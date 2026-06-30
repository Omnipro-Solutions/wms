import type { Operator } from '@/types/wms'

export type OperatorRole = Operator['role']

const ROLE_ROUTES: Record<OperatorRole, string> = {
  picker:     '/worker/picking',
  packer:     '/worker/packing',
  receiver:   '/worker/receiving',
  driver:     '/worker/driver',
  supervisor: '/',
}

export const resolveWorkerRoute = (role: OperatorRole): string => ROLE_ROUTES[role]
