import { describe, it, expect } from 'vitest'

// We test the redirect logic in isolation by importing the role-resolve helper
import { resolveWorkerRoute } from '@/lib/worker-routes'

describe('resolveWorkerRoute', () => {
  it('picker → /worker/picking', () => {
    expect(resolveWorkerRoute('picker')).toBe('/worker/picking')
  })
  it('packer → /worker/packing', () => {
    expect(resolveWorkerRoute('packer')).toBe('/worker/packing')
  })
  it('receiver → /worker/receiving', () => {
    expect(resolveWorkerRoute('receiver')).toBe('/worker/receiving')
  })
  it('driver → /worker/driver', () => {
    expect(resolveWorkerRoute('driver')).toBe('/worker/driver')
  })
  it('supervisor → /', () => {
    expect(resolveWorkerRoute('supervisor')).toBe('/')
  })
})
