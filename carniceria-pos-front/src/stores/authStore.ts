import { create } from 'zustand'
import type { User } from '@/features/auth/types'
import { useCashSessionStore } from '@/features/cashSession/store/cashSessionStore'

const USER_KEY = 'authUser'

function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY)

  if (!raw) return null

  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

interface AuthState {
  user: User | null
  /** Solo en memoria (A-01) — nunca se persiste en localStorage ni
   * sessionStorage. Se pierde al recargar la pagina; el refresh
   * silencioso al arrancar la app (bloque siguiente) es responsable de
   * recuperarlo usando la cookie httpOnly del refresh token. */
  accessToken: string | null
  isAuthenticated: boolean
  /** El refreshToken ya no llega al frontend en ningun momento (A-01):
   * viaja exclusivamente como cookie httpOnly, gestionada por el
   * backend. `setAuth` ya no lo recibe como parametro. */
  setAuth: (user: User, accessToken: string) => void
  setAccessToken: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  accessToken: null,
  isAuthenticated: false,

  setAuth: (user, accessToken) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user))

    set({
      user,
      accessToken,
      isAuthenticated: true,
    })
  },

  setAccessToken: (token) => {
    set({
      accessToken: token,
      isAuthenticated: true,
    })
  },

  logout: () => {
    localStorage.removeItem(USER_KEY)

    useCashSessionStore.getState().clearCashSessionId()

    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    })
  },
}))