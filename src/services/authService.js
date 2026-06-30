import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { auth } from './firebase.js'
import { createMasterProfile, createParticipantProfile, getUserProfile } from './firestoreService.js'

const LOGIN_ALIASES = {
  suporte: 'suporte@bolao-sesivinhedo.local',
}

function ensureAuth() {
  if (!auth) {
    throw new Error('Configure o Firebase para usar login e cadastro.')
  }

  return auth
}

function resolveLoginEmail(value) {
  const login = String(value || '').trim().toLowerCase()

  return LOGIN_ALIASES[login] || login
}

function isMasterLogin(email) {
  return Object.values(LOGIN_ALIASES).includes(String(email || '').trim().toLowerCase())
}

export function watchAuthState(callback) {
  if (!auth) {
    callback(null)
    return () => {}
  }

  return onAuthStateChanged(auth, callback)
}

export async function registerParticipant({ nome, name, email, password }) {
  const firebaseAuth = ensureAuth()
  const displayName = String(nome || name || '').trim()

  if (!displayName) {
    throw new Error('Informe seu nome para cadastrar.')
  }

  const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password)
  await updateProfile(credential.user, { displayName })
  await createParticipantProfile(credential.user, displayName)

  return {
    user: credential.user,
    profile: await getUserProfile(credential.user.uid),
  }
}

export async function loginWithEmail({ email, password }) {
  const firebaseAuth = ensureAuth()
  const resolvedEmail = resolveLoginEmail(email)
  const credential = await signInWithEmailAndPassword(firebaseAuth, resolvedEmail, password)
  let profile = await getUserProfile(credential.user.uid)

  if (!profile) {
    const fallbackName = credential.user.displayName || credential.user.email?.split('@')[0] || 'Participante'
    if (isMasterLogin(resolvedEmail)) {
      await createMasterProfile(credential.user, 'Suporte')
    } else {
      await createParticipantProfile(credential.user, fallbackName)
    }
    profile = await getUserProfile(credential.user.uid)
  }

  return {
    user: credential.user,
    profile,
  }
}

export async function logoutUser() {
  if (!auth) {
    return
  }

  await signOut(auth)
}
