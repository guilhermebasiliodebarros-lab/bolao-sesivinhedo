import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { AUTH_ORIGIN, FIRESTORE_ORIGIN, PROJECT, REHEARSAL_PASSWORD } from './rehearsal-data.mjs'

// Use the real rules in the local emulator. Never send these checks to production.
assert.equal(PROJECT, 'demo-interclasse-ensaio')
const base = `${FIRESTORE_ORIGIN}/v1/projects/${PROJECT}/databases/(default)/documents`
const cases = []
const record = (name) => { cases.push(name); console.log(`OK · ${name}`) }

async function localFetch(url, options = {}) {
  const target = new URL(url)
  assert.equal(target.hostname, '127.0.0.1')
  assert.equal(target.protocol, 'http:')
  assert(['8180', '9909'].includes(target.port))
  return fetch(target, { ...options, signal: AbortSignal.timeout(10000) })
}

async function login(email) {
  const response = await localFetch(`${AUTH_ORIGIN}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-interclasse-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: REHEARSAL_PASSWORD, returnSecureToken: true }),
  })
  assert.equal(response.status, 200, `Login de ensaio indisponível: ${email}. Inicie npm run ensaio.`)
  const value = await response.json()
  assert.equal(JSON.parse(Buffer.from(value.idToken.split('.')[1], 'base64url')).aud, PROJECT)
  return value.idToken
}

async function request(path, token, options = {}, expected = 200) {
  const response = await localFetch(`${base}/${path}`, {
    ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  assert.equal(response.status, expected, `${path}: esperado ${expected}, recebido ${response.status}`)
  return response
}

const master = await login('suporte@bolao-sesivinhedo.local')
const participant = await login('professor@ensaio.local')
const viewer = await login('sesivinhedo@interclasse-sesivinhedo.local')
const fixture = `ensaio-acesso-${Date.now()}`
const announcements = [`announcements/${fixture}-ativo`, `announcements/${fixture}-inativo`]
const created = []
try {
  for (const [index, path] of announcements.entries()) {
    await request(path, master, { method: 'PATCH', body: JSON.stringify({ fields: { active: { booleanValue: index === 0 }, text: { stringValue: 'Aviso fictício para validar acesso.' } } }) })
    created.push(path)
  }
  record('Master mantém a gravação de avisos')

  const documents = ['games/ensaio-futebol', 'sports/esporte-futebol', 'teams/ensaio-futebol-a', 'broadcastSettings/scoreboard', announcements[0]]
  const collections = ['games', 'sports', 'teams', 'broadcastSettings']
  for (const path of [...documents, ...collections, 'users', 'predictions', 'operations', 'teams/ensaio-futebol-a/players']) await request(path, null, {}, 403)
  record('Sem login, documentos e listas do campeonato são negados pelo servidor')

  const activeAnnouncements = { structuredQuery: { from: [{ collectionId: 'announcements' }], where: { fieldFilter: { field: { fieldPath: 'active' }, op: 'EQUAL', value: { booleanValue: true } } } } }
  const queryAnnouncements = async (token, expected) => {
    const response = await localFetch(`${base}:runQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(activeAnnouncements) })
    assert.equal(response.status, expected, 'Consulta de avisos ativos deve exigir autenticação')
  }
  await queryAnnouncements(null, 403)
  record('Avisos ativos também exigem login, inclusive em consultas filtradas')

  for (const [label, token] of [['Master', master], ['Participante', participant], ['Consulta', viewer]]) {
    for (const path of [...documents, ...collections]) await request(path, token)
    await queryAnnouncements(token, 200)
    record(`${label} mantém acesso aos dados do campeonato após o login`)
  }

  for (const [label, token] of [['Visitante', null], ['Participante', participant], ['Consulta', viewer]]) {
    await request('games/ensaio-futebol?updateMask.fieldPaths=venue', token, { method: 'PATCH', body: JSON.stringify({ fields: { venue: { stringValue: 'Alteração que deve ser bloqueada' } } }) }, 403)
    if (token) {
      await request(announcements[1], token, {}, 403)
      await request('operations', token, {}, 403)
      await request('teams/ensaio-futebol-a/players', token, {}, 403)
    }
    record(`${label} continua sem permissão de administrar partidas ou ler dados privados`)
  }
  await request(announcements[1], master)
  await request('teams/ensaio-futebol-a/players', master)
  record('Master mantém acesso aos avisos inativos e aos elencos privados')

  mkdirSync('artifacts/rehearsal', { recursive: true })
  writeFileSync('artifacts/rehearsal/access-result.json', JSON.stringify({ project: PROJECT, executedAt: new Date().toISOString(), passed: cases.length, productionDataUntouched: true, cases }, null, 2))
  console.log(`${cases.length} etapas aprovadas com as regras reais dos emuladores locais.`)
} finally {
  for (const path of created) await request(path, master, { method: 'DELETE' })
}
