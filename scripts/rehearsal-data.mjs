import { initializeApp, deleteApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, updateProfile } from 'firebase/auth'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PROJECT = 'demo-interclasse-ensaio'
export const AUTH_ORIGIN = 'http://127.0.0.1:9909'
export const FIRESTORE_ORIGIN = 'http://127.0.0.1:8180'
export const APP_ORIGIN = 'http://127.0.0.1:5179'
export const REHEARSAL_PASSWORD = 'Ensaio2026!'

export async function localRequest(url, options = {}) {
  const target = new URL(url)
  if (target.hostname !== '127.0.0.1' || target.protocol !== 'http:' || !['8180', '9909', '4401'].includes(target.port)) throw new Error('O ensaio só pode acessar os emuladores locais.')
  const response = await fetch(url, { ...options, headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(30000) })
  const body = await response.text()
  if (!response.ok) throw new Error(`Emulador local: ${response.status} ${body.slice(0, 250)}`)
  return body ? JSON.parse(body) : {}
}

function field(value) {
  if (value === null) return { nullValue: null }
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(field) } }
  if (typeof value === 'object') return { mapValue: { fields: fields(value) } }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  return { stringValue: String(value) }
}
const fields = (value) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, field(item)]))

export async function resetRehearsal() {
  await localRequest(`${FIRESTORE_ORIGIN}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' })
  await localRequest(`${AUTH_ORIGIN}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' })
  const app = initializeApp({ apiKey: 'demo-interclasse-key', projectId: PROJECT }, `seed-${Date.now()}`)
  const auth = getAuth(app)
  connectAuthEmulator(auth, AUTH_ORIGIN, { disableWarnings: true })
  const users = [
    { nome: 'Organização · Ensaio', email: 'suporte@bolao-sesivinhedo.local', role: 'master' },
    { nome: 'Professor · Ensaio', email: 'professor@ensaio.local', role: 'user' },
    { nome: 'Palpite parcial', email: 'parcial@ensaio.local', role: 'user', guess: [2, 0] },
    { nome: 'Acerto do vencedor', email: 'vencedor@ensaio.local', role: 'user', guess: [3, 0] },
    { nome: 'Palpite errado', email: 'erro@ensaio.local', role: 'user', guess: [0, 1] },
    { nome: 'Consulta · Ensaio', email: 'sesivinhedo@interclasse-sesivinhedo.local', role: 'viewer' },
  ]
  try {
    for (const user of users) {
      const credential = await createUserWithEmailAndPassword(auth, user.email, REHEARSAL_PASSWORD)
      await updateProfile(credential.user, { displayName: user.nome })
      user.uid = credential.user.uid
    }
  } finally { await deleteApp(app) }
  const documents = []
  const write = (path, value) => documents.push({ update: { name: `projects/${PROJECT}/databases/(default)/documents/${path}`, fields: fields(value) } })
  const now = new Date()
  const start = new Date(Date.now() + 90 * 60000)
  for (const user of users) {
    write(`users/${user.uid}`, { uid: user.uid, nome: user.nome, email: user.email, role: user.role, participaRanking: user.role === 'user', pontos: 0, acertosExatos: 0, acertosResultado: 0, createdAt: now, updatedAt: now })
    if (user.guess) write(`predictions/${user.uid}_ensaio-futebol`, { userId: user.uid, gameId: 'ensaio-futebol', nomeUsuario: user.nome, palpiteA: user.guess[0], palpiteB: user.guess[1], pontos: 0, acertoExato: false, acertoResultado: false, createdAt: now, updatedAt: now })
  }
  const sports = [
    { id: 'futebol', nome: 'Futebol', scoringMode: 'goals', classes: [['9º A', '9º B']], turno: 'manha', venue: 'Campo de ensaio' },
    { id: 'handebol', nome: 'Handebol', scoringMode: 'goals', classes: [['8º A', '8º B']], turno: 'tarde', venue: 'Quadra externa de ensaio' },
    { id: 'basquete', nome: 'Basquete', scoringMode: 'points', classes: [['7º A', '7º B'], ['6º A', '6º B']], turno: 'tarde', venue: 'Ginásio de ensaio' },
    { id: 'volei', nome: 'Vôlei', scoringMode: 'sets', classes: [['1º A', '1º B'], ['2º A', '2º B']], turno: 'manha', venue: 'Ginásio de ensaio' },
  ]
  for (const sport of sports) {
    const sportId = `esporte-${sport.id}`
    write(`sports/${sportId}`, { nome: sport.nome, scoringMode: sport.scoringMode, volleyballBestOf: 3, winPoints: 3, drawPoints: 1, lossPoints: 0, createdAt: now, updatedAt: now })
    for (const [index, names] of sport.classes.entries()) {
      const suffix = sport.classes.length > 1 ? `-${index + 1}` : ''
      const gameId = `ensaio-${sport.id}${suffix}`
      const teamIds = ['a', 'b'].map((side) => `${gameId}-${side}`)
      for (const [sideIndex, teamId] of teamIds.entries()) {
        write(`teams/${teamId}`, { sportId, esporteNome: sport.nome, nome: names[sideIndex], turma: names[sideIndex], turno: sport.turno, playerCount: 2, createdAt: now, updatedAt: now })
        for (const [playerIndex, nome] of (sideIndex === 0 ? ['Ana Beatriz Silva', 'Bruno Henrique Souza'] : ['Carla Maria Ramos', 'Diego Augusto Santos']).entries()) {
          write(`teams/${teamId}/players/${teamId}-p${playerIndex + 1}`, { nome, posicao: '', capitao: playerIndex === 0, createdAt: now, updatedAt: now })
        }
      }
      write(`games/${gameId}`, { sportId, esporteNome: sport.nome, scoringMode: sport.scoringMode, volleyballBestOf: 3, winPoints: 3, drawPoints: 1, lossPoints: 0, timeA: names[0], timeB: names[1], teamIdA: teamIds[0], teamIdB: teamIds[1], turmaA: names[0], turmaB: names[1], turno: sport.turno,
        fase: 'Fase de grupos', groupName: 'Grupo de ensaio', stageType: 'group', tournamentId: `torneio-ensaio-${sport.id}`, tournamentName: 'ENSAIO LOCAL', dataHora: start, limitePalpites: new Date(start.getTime() - 5 * 60000), status: 'aberto', liveStatus: 'scheduled', matchCondition: 'normal',
        venue: sport.venue, venueArea: sport.classes.length > 1 ? `${sport.nome} · Quadra ${index + 1}` : '', vestA: 'Azul', vestB: 'Vermelho', durationMinutes: 20, liveScoreA: 0, liveScoreB: 0, placarA: null, placarB: null, scoreRevision: 0, setScores: [], currentSet: { a: 0, b: 0 }, liveEvents: [], scorerStats: [], createdAt: now, updatedAt: now })
    }
  }
  write('broadcastSettings/scoreboard', { gameIds: [], revision: 0, updatedAt: now })
  write('broadcastSettings/tv', { autoCallsEnabled: false, showMatchClock: true, leadMinutes: 10, updatedAt: now })
  await localRequest(`${FIRESTORE_ORIGIN}/v1/projects/${PROJECT}/databases/(default)/documents:commit`, { method: 'POST', body: JSON.stringify({ writes: documents }) })
  console.log('Ensaio reiniciado: 6 jogos, 12 equipes, 24 jogadores e contas de teste. Nenhum dado oficial foi acessado.')
  return { users, games: sports.reduce((total, sport) => total + sport.classes.length, 0) }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await resetRehearsal()
