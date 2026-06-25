import { useMemo } from 'react'
import { useWmsStore } from '@/store/wms-store'
import { useShallow } from 'zustand/react/shallow'
import type { Operator } from '@/types/wms'

export type OperatorRole = Operator['role']

const ROLE_CAPABILITIES: Record<string, OperatorRole[]> = {
  approve_adjustment: ['supervisor'],
  freeze_inventory:   ['supervisor'],
  manage_admin:       ['supervisor'],
  pick:               ['picker', 'supervisor'],
  pack:               ['packer', 'supervisor'],
  receive:            ['receiver', 'supervisor'],
  drive:              ['driver', 'supervisor'],
}

export type OperatorCapability = keyof typeof ROLE_CAPABILITIES

export const useCurrentOperator = () => {
  // useShallow prevents infinite loop — object selector returns new ref each call without it
  const { currentOperatorId, operators, setCurrentOperator } = useWmsStore(
    useShallow((s) => ({
      currentOperatorId: s.currentOperatorId,
      operators: s.operators,
      setCurrentOperator: s.setCurrentOperator,
    }))
  )

  // useMemo so operator reference is stable — prevents useEffect dependency loops in consumers
  const operator = useMemo(
    () => operators.find((o) => o.id === currentOperatorId) ?? null,
    [operators, currentOperatorId]
  )

  const isRole = (role: OperatorRole) => operator?.role === role

  const isSupervisor = operator?.role === 'supervisor'

  const canDo = (capability: OperatorCapability): boolean => {
    if (!operator) return false
    return ROLE_CAPABILITIES[capability]?.includes(operator.role) ?? false
  }

  return { operator, role: operator?.role ?? null, isRole, isSupervisor, canDo, setCurrentOperator }
}
