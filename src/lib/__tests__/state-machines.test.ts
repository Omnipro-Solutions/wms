import { describe, it, expect } from 'vitest'
import { canTransition, asnTransitions } from '../state-machines'

describe('asnTransitions — etiquetado', () => {
  it('in_progress puede ir a labels_pending', () => {
    expect(canTransition(asnTransitions, 'in_progress', 'labels_pending')).toBe(true)
  })
  it('partial puede ir a labels_pending', () => {
    expect(canTransition(asnTransitions, 'partial', 'labels_pending')).toBe(true)
  })
  it('labels_pending puede ir a putaway_ready', () => {
    expect(canTransition(asnTransitions, 'labels_pending', 'putaway_ready')).toBe(true)
  })
  it('putaway_ready puede ir a completed', () => {
    expect(canTransition(asnTransitions, 'putaway_ready', 'completed')).toBe(true)
  })
  it('labels_pending NO puede ir directamente a completed', () => {
    expect(canTransition(asnTransitions, 'labels_pending', 'completed')).toBe(false)
  })
})
