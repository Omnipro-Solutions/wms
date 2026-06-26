import { describe, it, expect } from 'vitest'
import { hashPassword } from './auth'

describe('hashPassword', () => {
  it('returns consistent SHA-256 hex for known input', async () => {
    const hash = await hashPassword('wms2024')
    expect(hash).toBe('aa7ad6993070380cb2035d9a835b2addea685886e4c639b8196bca55ad0129f5')
  })

  it('returns different hashes for different inputs', async () => {
    const a = await hashPassword('abc')
    const b = await hashPassword('xyz')
    expect(a).not.toBe(b)
  })

  it('is case-sensitive', async () => {
    const lower = await hashPassword('wms2024')
    const upper = await hashPassword('WMS2024')
    expect(lower).not.toBe(upper)
  })
})
