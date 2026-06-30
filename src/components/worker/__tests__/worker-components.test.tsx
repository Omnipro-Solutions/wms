import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuantityStepper } from '../quantity-stepper'
import { WorkerStepper } from '../worker-stepper'
import { WorkerCard } from '../worker-card'

describe('QuantityStepper', () => {
  it('renders value and calls onChange on + click', () => {
    const onChange = vi.fn()
    render(<QuantityStepper value={3} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '+' }))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('does not go below min', () => {
    const onChange = vi.fn()
    render(<QuantityStepper value={1} onChange={onChange} min={1} />)
    fireEvent.click(screen.getByRole('button', { name: '−' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('WorkerStepper', () => {
  it('shows current and total', () => {
    render(<WorkerStepper current={2} total={4} />)
    expect(screen.getByText('Paso 2 de 4')).toBeInTheDocument()
  })
})

describe('WorkerCard', () => {
  it('calls onClick when tapped', () => {
    const onClick = vi.fn()
    render(<WorkerCard title="Zona A" subtitle="A-01-03" onClick={onClick} />)
    fireEvent.click(screen.getByText('Zona A'))
    expect(onClick).toHaveBeenCalled()
  })

  it('shows urgent badge when urgent=true', () => {
    render(<WorkerCard title="Task" subtitle="sub" urgent onClick={vi.fn()} />)
    expect(screen.getByText('URGENTE')).toBeInTheDocument()
  })
})
