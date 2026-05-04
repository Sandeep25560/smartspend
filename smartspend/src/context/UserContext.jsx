import { createContext, useContext, useState, useCallback } from 'react'
import { getProfile, isAuthError } from '../services/api'

const UserContext = createContext(null)

function cachedUser() {
  try { return JSON.parse(localStorage.getItem('ss_user') || 'null') } catch { return null }
}

export function UserProvider({ children }) {
  const [user, setUserState] = useState(cachedUser)
  const [syncError, setSyncError] = useState('')

  const setUser = useCallback((u) => {
    setUserState(u)
    if (u) localStorage.setItem('ss_user', JSON.stringify(u))
    else localStorage.removeItem('ss_user')
  }, [])

  const refresh = useCallback(async () => {
    try {
      const u = await getProfile()
      setSyncError('')
      setUser(u)
      return u
    } catch (error) {
      if (isAuthError(error)) {
        localStorage.removeItem('ss_token')
        setUser(null)
        throw error
      }

      const cached = cachedUser()
      setSyncError(error.message || 'Could not sync. Showing saved setup.')
      if (cached) {
        setUserState(cached)
        return cached
      }

      throw error
    }
  }, [setUser])

  return (
    <UserContext.Provider value={{ user, setUser, refresh, syncError, setSyncError }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within UserProvider')
  return ctx
}
