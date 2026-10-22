import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface Auth {
  loading: boolean
  session: Session | null
  /** fetch with the Supabase access token. The server decides what this account may do. */
  secureFetch: (url: string, init?: RequestInit) => Promise<Response>
  signOut: () => Promise<void>
}

export function useAuth(): Auth {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const token = session?.access_token
  const secureFetch = useCallback(
    (url: string, init: RequestInit = {}) =>
      fetch(url, { ...init, headers: { ...init.headers, authorization: `Bearer ${token ?? ''}` } }),
    [token],
  )
  const signOut = useCallback(async () => void (await supabase.auth.signOut()), [])
  return { loading, session, secureFetch, signOut }
}
