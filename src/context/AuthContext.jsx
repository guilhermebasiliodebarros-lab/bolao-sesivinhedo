import { useEffect, useRef, useState } from 'react'
import { auth } from '../services/firebase.js'
import { loginWithEmail, logoutUser, registerParticipant, watchAuthState } from '../services/authService.js'
import { isRankingProfile, subscribeUserProfile, toFriendlyError } from '../services/firestoreService.js'
import { AuthContext } from './auth-context.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(Boolean(auth))
  const [profileLoading, setProfileLoading] = useState(false)
  const [error, setError] = useState('')
  const profileUnsubscribe = useRef(() => {})

  useEffect(() => {
    if (!auth) {
      return () => {}
    }

    const unsubscribeAuth = watchAuthState((firebaseUser) => {
      profileUnsubscribe.current()
      setUser(firebaseUser)
      setError('')

      if (!firebaseUser) {
        setProfile(null)
        setLoading(false)
        setProfileLoading(false)
        profileUnsubscribe.current = () => {}
        return
      }

      setLoading(true)
      setProfileLoading(true)

      profileUnsubscribe.current = subscribeUserProfile(
        firebaseUser.uid,
        (nextProfile) => {
          setProfile(nextProfile)
          setLoading(false)
          setProfileLoading(false)
        },
        (message) => {
          setError(message)
          setLoading(false)
          setProfileLoading(false)
        },
      )
    })

    return () => {
      profileUnsubscribe.current()
      unsubscribeAuth()
    }
  }, [])

  const register = async ({ nome, name, email, password }) => {
    try {
      setError('')
      setLoading(true)
      const result = await registerParticipant({ nome, name, email, password })
      setUser(result.user)
      setProfile(result.profile)
      return result
    } catch (requestError) {
      const message = toFriendlyError(requestError)
      setError(message)
      throw new Error(message, { cause: requestError })
    } finally {
      setLoading(false)
    }
  }

  const login = async ({ email, password }) => {
    try {
      setError('')
      setLoading(true)
      const result = await loginWithEmail({ email, password })
      setUser(result.user)

      if (result.profile) {
        setProfile(result.profile)
      }

      return result
    } catch (requestError) {
      const message = toFriendlyError(requestError)
      setError(message)
      throw new Error(message, { cause: requestError })
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    await logoutUser()
    setUser(null)
    setProfile(null)
  }

  const isMaster = Boolean(user && profile?.role === 'master')
  const isParticipant = Boolean(user && isRankingProfile(profile))
  const value = {
    user,
    profile,
    loading,
    profileLoading,
    error,
    isMaster,
    isParticipant,
    register,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
