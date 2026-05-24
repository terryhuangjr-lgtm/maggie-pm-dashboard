import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

const INACTIVITY_TIMEOUT = 30 * 60 * 1000 // 30 minutes
const WARNING_BEFORE = 60 * 1000 // 60 seconds warning

interface UserProfile {
  role: 'admin' | 'basic'
  full_name: string | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  showInactivityWarning: boolean
  dismissInactivityWarning: () => void
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  showInactivityWarning: false,
  dismissInactivityWarning: () => {},
  signIn: async () => ({ error: 'Auth not initialized' }),
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showInactivityWarning, setShowInactivityWarning] = useState(false)

  // Inactivity timer
  useEffect(() => {
    // Inactivity detection — only active when logged in
    if (!user) {
      setShowInactivityWarning(false)
      return
    }

    let warningTimer: ReturnType<typeof setTimeout>
    let logoutTimer: ReturnType<typeof setTimeout>

    function startTimers() {
      setShowInactivityWarning(false)

      warningTimer = setTimeout(() => {
        setShowInactivityWarning(true)
      }, INACTIVITY_TIMEOUT - WARNING_BEFORE)

      logoutTimer = setTimeout(async () => {
        setShowInactivityWarning(false)
        await supabase.auth.signOut()
      }, INACTIVITY_TIMEOUT)
    }

    function handleActivity() {
      clearTimeout(warningTimer)
      clearTimeout(logoutTimer)
      startTimers()
    }

    // Activity events to listen to
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, handleActivity))

    startTimers()

    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity))
      clearTimeout(warningTimer)
      clearTimeout(logoutTimer)
    }
  }, [user])

  function dismissInactivityWarning() {
    setShowInactivityWarning(false)
    // The activity handler will restart timers — but we need to trigger it manually
    window.dispatchEvent(new Event('mousedown'))
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        setProfile({ role: 'basic', full_name: null })
      } else {
        setProfile(data)
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
      setProfile({ role: 'basic', full_name: null })
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message || null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading,
      showInactivityWarning, dismissInactivityWarning,
      signIn, signOut
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
