import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock wms-store
vi.mock('@/store/wms-store', () => ({
  useWmsStore: {
    getState: () => ({
      operators: [
        {
          id: 'op-0',
          email: 'carlos.granados@wms.co',
          passwordHash: 'aa7ad6993070380cb2035d9a835b2addea685886e4c639b8196bca55ad0129f5',
          active: true,
          name: 'Carlos Granados',
          role: 'supervisor',
          code: 'OP-000',
        },
        {
          id: 'op-1',
          email: 'inactive@wms.co',
          passwordHash: 'aa7ad6993070380cb2035d9a835b2addea685886e4c639b8196bca55ad0129f5',
          active: false,
          name: 'Inactive User',
          role: 'picker',
          code: 'OP-001',
        },
      ],
    }),
  },
}))

// Mock auth utils
vi.mock('@/lib/auth', () => ({
  hashPassword: vi.fn(async (pwd: string) =>
    pwd === 'wms2024'
      ? 'aa7ad6993070380cb2035d9a835b2addea685886e4c639b8196bca55ad0129f5'
      : 'wronghash'
  ),
  setAuthCookie: vi.fn(),
  clearAuthCookie: vi.fn(),
}))

import { useAuthStore } from './auth-store'
import { setAuthCookie, clearAuthCookie } from '@/lib/auth'

beforeEach(() => {
  useAuthStore.setState({ operatorId: null })
  vi.clearAllMocks()
})

describe('login', () => {
  it('succeeds with valid credentials', async () => {
    const result = await useAuthStore.getState().login('carlos.granados@wms.co', 'wms2024', false)
    expect(result.success).toBe(true)
    expect(useAuthStore.getState().operatorId).toBe('op-0')
    expect(setAuthCookie).toHaveBeenCalledWith('op-0', false)
  })

  it('fails with unknown email', async () => {
    const result = await useAuthStore.getState().login('unknown@wms.co', 'wms2024', false)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Credenciales incorrectas')
    expect(useAuthStore.getState().operatorId).toBeNull()
  })

  it('fails with wrong password', async () => {
    const result = await useAuthStore.getState().login('carlos.granados@wms.co', 'wrong', false)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Credenciales incorrectas')
  })

  it('fails for inactive operator', async () => {
    const result = await useAuthStore.getState().login('inactive@wms.co', 'wms2024', false)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Usuario inactivo')
  })

  it('is case-insensitive for email', async () => {
    const result = await useAuthStore.getState().login('CARLOS.GRANADOS@WMS.CO', 'wms2024', false)
    expect(result.success).toBe(true)
  })
})

describe('logout', () => {
  it('clears operatorId and calls clearAuthCookie', () => {
    useAuthStore.setState({ operatorId: 'op-0' })
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().operatorId).toBeNull()
    expect(clearAuthCookie).toHaveBeenCalled()
  })
})
