'use client'

import { useCurrentOperator, type OperatorCapability } from '@/hooks/use-current-operator'

interface Props {
  capability: OperatorCapability
  fallback?: React.ReactNode
  children: React.ReactNode
}

export const OperatorGate = ({ capability, fallback = null, children }: Props) => {
  const { canDo } = useCurrentOperator()
  if (!canDo(capability)) return <>{fallback}</>
  return <>{children}</>
}
