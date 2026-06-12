import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Asn, PurchaseOrder } from '@/types/wms'

type StepStatus = 'done' | 'active' | 'pending'

interface Step {
  label: string
  status: StepStatus
}

const StepNode = ({ step, index }: { step: Step; index: number }) => (
  <div className="flex flex-col items-center gap-1.5 min-w-0">
    <div
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all',
        step.status === 'done' &&
          'border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-200',
        step.status === 'active' && 'border-primary bg-primary text-primary-foreground shadow-sm',
        step.status === 'pending' &&
          'border-muted-foreground/25 bg-muted/40 text-muted-foreground/40'
      )}
    >
      {step.status === 'done' ? <Check className="size-3.5 stroke-[2.5]" /> : index + 1}
    </div>
    <span
      className={cn(
        'max-w-18 whitespace-nowrap text-center text-[11px] font-medium leading-tight',
        step.status === 'done' && 'text-emerald-700',
        step.status === 'active' && 'text-primary',
        step.status === 'pending' && 'text-muted-foreground/40'
      )}
    >
      {step.label}
    </span>
  </div>
)

const Connector = ({ done }: { done: boolean }) => (
  <div
    className={cn(
      'mb-5 h-0.5 w-16 shrink-0 rounded-full transition-colors',
      done ? 'bg-emerald-400' : 'bg-muted-foreground/15'
    )}
  />
)

const buildSteps = (asn: Asn, _po: PurchaseOrder | null): Step[] => {
  const s = asn.status

  const citaStatus: StepStatus =
    s === 'pending'
      ? 'active'
      : s === 'partial' ||
          s === 'in_progress' ||
          s === 'completed' ||
          s === 'short_received' ||
          s === 'putaway_done'
        ? 'done'
        : 'pending'

  const countStatus: StepStatus =
    s === 'in_progress'
      ? 'active'
      : s === 'partial' || s === 'completed' || s === 'short_received' || s === 'putaway_done'
        ? 'done'
        : 'pending'

  const qcStatus: StepStatus = asn.requiresQualityControl
    ? s === 'partial'
      ? 'active'
      : s === 'completed' || s === 'putaway_done'
        ? 'done'
        : 'pending'
    : 'done'

  const putawayStatus: StepStatus =
    s === 'putaway_done' ? 'done' : s === 'completed' ? 'active' : 'pending'

  return [
    { label: 'PO confirmada', status: 'done' },
    { label: 'Cita programada', status: citaStatus },
    { label: 'Conteo físico', status: countStatus },
    ...(asn.requiresQualityControl ? [{ label: 'Inspección QC', status: qcStatus }] : []),
    { label: 'Ubicado', status: putawayStatus },
  ]
}

interface Props {
  asn: Asn
  po: PurchaseOrder | null
}

export const AsnStepper = ({ asn, po }: Props) => {
  const steps = buildSteps(asn, po)
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center">
          <StepNode step={step} index={i} />
          {i < steps.length - 1 && <Connector done={step.status === 'done'} />}
        </div>
      ))}
    </div>
  )
}
