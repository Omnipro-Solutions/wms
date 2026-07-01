import { describe, it, expect } from 'vitest'
import { resolveSwitchDestination } from './operator-switch'

describe('resolveSwitchDestination', () => {
  it('routes worker roles to their worker route regardless of current path', () => {
    expect(resolveSwitchDestination('picker', '/')).toBe('/worker/picking')
    expect(resolveSwitchDestination('packer', '/worker/receiving')).toBe('/worker/packing')
    expect(resolveSwitchDestination('receiver', '/slotting')).toBe('/worker/receiving')
    expect(resolveSwitchDestination('driver', '/worker/picking')).toBe('/worker/driver')
  })

  it('routes supervisor to / when switching from a worker route', () => {
    expect(resolveSwitchDestination('supervisor', '/worker/picking')).toBe('/')
    expect(resolveSwitchDestination('supervisor', '/worker')).toBe('/')
  })

  it('keeps supervisor on the current path when already on desktop', () => {
    expect(resolveSwitchDestination('supervisor', '/slotting')).toBe('/slotting')
    expect(resolveSwitchDestination('supervisor', '/')).toBe('/')
  })
})
