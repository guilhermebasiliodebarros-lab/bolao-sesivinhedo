import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

const calls = []
let profile = { role: 'viewer', participaRanking: false }
globalThis.__consultationAuth = {
  createUserWithEmailAndPassword: async () => { throw new Error('Unexpected registration') },
  onAuthStateChanged: () => {},
  signInWithEmailAndPassword: async (_auth, email) => {
    calls.push(['login', email])
    return { user: { uid: 'consultation', email } }
  },
  signOut: async () => { calls.push(['logout']) },
  updateProfile: async () => {},
  createMasterProfile: async () => { calls.push(['master']) },
  createParticipantProfile: async () => { calls.push(['participant']) },
  getUserProfile: async () => profile,
}

registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/services/authService.js')) {
      if (specifier === './firebase.js') return { url: 'test:auth-config', shortCircuit: true }
      if (specifier === 'firebase/auth' || specifier === './firestoreService.js') return { url: 'test:auth-sdk', shortCircuit: true }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url === 'test:auth-config') return { format: 'module', source: 'export const auth = {}', shortCircuit: true }
    if (url === 'test:auth-sdk') return { format: 'module', source: Object.keys(globalThis.__consultationAuth).map((name) => `export const ${name} = globalThis.__consultationAuth.${name}`).join('\n'), shortCircuit: true }
    return next(url, context)
  },
})

const { loginWithEmail } = await import('../src/services/authService.js')

test('the consultation alias signs into the shared viewer account without creating other roles', async () => {
  const result = await loginWithEmail({ email: ' SESIVINHEDO ', password: 'test-password' })
  assert.equal(result.profile.role, 'viewer')
  assert.deepEqual(calls.splice(0), [['login', 'sesivinhedo@interclasse-sesivinhedo.local']])
})

test('a missing consultation profile signs out instead of creating a participant or master', async () => {
  profile = null
  await assert.rejects(loginWithEmail({ email: 'sesivinhedo', password: 'test-password' }), /conta de consulta ainda não foi configurada/)
  assert.deepEqual(calls.splice(0), [['login', 'sesivinhedo@interclasse-sesivinhedo.local'], ['logout']])
})
