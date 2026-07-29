'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { WorkerStepper } from '@/components/worker/worker-stepper'
import { Button } from '@/components/ui/button'

interface Props {
  /** Route to return to (the role's task list) — used when no onBack is given. */
  backHref: string
  current: number
  total: number
  /**
   * Optional step-back handler. When provided, the arrow goes back one step
   * (the wizard decides what "back" means, incl. exiting to the list from the
   * first step). Without it, the arrow always returns to `backHref`.
   */
  onBack?: () => void
  /**
   * Hide the back arrow entirely — used on committed/terminal wrap-up steps
   * where going back would re-run an already-executed operation.
   */
  hideBack?: boolean
}

/**
 * Top bar for every worker wizard: a back button plus the step progress. With
 * `onBack` it steps backwards through the wizard; otherwise it exits to the
 * role's list. Either way the operator always has a way out.
 */
export const WorkerWizardHeader = ({ backHref, current, total, onBack, hideBack }: Props) => {
  const router = useRouter()
  const handleBack = onBack ?? (() => router.push(backHref))
  return (
    <div className="flex items-center gap-2">
      {!hideBack && (
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 shrink-0"
          onClick={handleBack}
          aria-label="Volver"
        >
          <ArrowLeft className="size-5" />
        </Button>
      )}
      <WorkerStepper current={current} total={total} />
    </div>
  )
}
