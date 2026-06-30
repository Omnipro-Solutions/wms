import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { hashPassword, setAuthCookie, clearAuthCookie } from '@/lib/auth'
import { useWmsStore } from '@/store/wms-store'
import type { Operator } from '@/types/wms'

export interface AuthState {
  operatorId: string | null
  login: (email: string, password: string, remember: boolean) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  getOperator: () => Operator | null
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      operatorId: null,

      login: async (email, password, remember) => {
        const operators = useWmsStore.getState().operators
        const operator = operators.find((o) => o.email?.toLowerCase() === email.toLowerCase())

        if (!operator) return { success: false, error: 'Credenciales incorrectas' }
        if (!operator.active) return { success: false, error: 'Usuario inactivo' }

        const hash = await hashPassword(password)
        if (!operator.passwordHash || hash !== operator.passwordHash) return { success: false, error: 'Credenciales incorrectas' }

        setAuthCookie(operator.id, remember)
        // Write role cookie so middleware can redirect without DB access
        document.cookie = `wms-operator-role=${operator.role}; path=/; SameSite=Lax`
        set({ operatorId: operator.id })
        useWmsStore.getState().setCurrentOperator(operator.id)
        return { success: true }
      },

      logout: () => {
        clearAuthCookie()
        document.cookie = 'wms-operator-role=; path=/; max-age=0'
        set({ operatorId: null })
      },

      getOperator: () => {
        const { operatorId } = get()
        if (!operatorId) return null
        return useWmsStore.getState().operators.find((o) => o.id === operatorId) ?? null
      },
    }),
    {
      name: 'wms-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ operatorId: state.operatorId }),
      onRehydrateStorage: () => (state) => {
        if (state?.operatorId) {
          useWmsStore.getState().setCurrentOperator(state.operatorId)
        }
      },
    }
  )
)
