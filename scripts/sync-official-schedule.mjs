import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { buildOfficialSchedulePlan } from '../src/utils/officialSchedule.js'
import { OFFICIAL_SCHEDULE_2026 } from '../src/data/officialSchedule2026.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { values: options } = parseArgs({ options: { project: { type: 'string' }, apply: { type: 'boolean', default: false }, emulator: { type: 'boolean', default: false }, 'prediction-policy': { type: 'string', default: 'preserve' }, 'source-directory': { type: 'string', default: join(homedir(), 'Downloads') } } })
const project = options.project, configured = JSON.parse(readFileSync(join(root, '.firebaserc'), 'utf8')).projects.default
if (!project || (options.emulator ? !project.startsWith('demo-') : project !== configured)) throw new Error('Informe explicitamente o projeto configurado, ou um projeto demo com --emulator.')
if (!['preserve', 'open-defined'].includes(options['prediction-policy'])) throw new Error('Use --prediction-policy preserve ou open-defined.')
const sourceDefinitions = [
  { file: 'Informações para mural - interclasse 2026 (1).pdf', sha256: '6523ae9217460578f34ea9d2ad0490bdd3079e9e3eb7ea69ad97745c6bd20188', shift: 'tarde', pages: 4 },
  { file: 'Informações para mural - interclasse 2026 (2).pdf', sha256: 'b137e0751d6be2e63bd229c090ac8f2bea475d144d905975886f89ae0a3802c5', shift: 'manha', pages: 5 },
]
for (const source of sourceDefinitions) if (createHash('sha256').update(readFileSync(join(options['source-directory'], source.file))).digest('hex') !== source.sha256) throw new Error(`O PDF ${source.file} mudou. Confira a transcrição antes de aplicar.`)
const output = join(root, 'artifacts', 'rehearsal', 'official-schedule', options.emulator ? 'emulator' : project)
mkdirSync(output, { recursive: true })
const base = `${options.emulator ? 'http://127.0.0.1:8180' : 'https://firestore.googleapis.com'}/v1/projects/${project}/databases/(default)/documents`
let bearer = 'owner'
if (!options.emulator) {
  const require = createRequire(import.meta.url)
  const caches = [join(root, 'node_modules', 'firebase-tools'), ...[join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), join(homedir(), '.npm', '_npx')].filter(existsSync).flatMap((cache) => readdirSync(cache).map((entry) => join(cache, entry, 'node_modules', 'firebase-tools')))]
  const installation = caches.find((path) => existsSync(join(path, 'lib', 'auth.js')))
  if (!installation) throw new Error('Instale ou execute o Firebase CLI e entre na sua conta antes de sincronizar.')
  const auth = require(join(installation, 'lib', 'auth.js')), account = auth.getGlobalDefaultAccount()
  if (!account?.tokens?.refresh_token) throw new Error('Entre no Firebase CLI com a conta da organização antes de sincronizar.')
  bearer = (await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase'])).access_token
}
async function request(path, options = {}, allowMissing = false) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(60000) })
  if (allowMissing && response.status === 404) return null
  const data = await response.json()
  if (!response.ok) throw new Error(`Firestore ${response.status}: ${data.error?.message || 'A operação não foi concluída.'}`)
  return data
}
async function readCollection(name) {
  const records = []; let pageToken = ''
  do {
    const response = await request(`/${name}?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`)
    records.push(...response.documents || []); pageToken = response.nextPageToken || ''
  } while (pageToken)
  return records
}
const decode = (field) => field == null ? null : 'stringValue' in field ? field.stringValue : 'timestampValue' in field ? new Date(field.timestampValue) : 'integerValue' in field ? Number(field.integerValue) : 'doubleValue' in field ? field.doubleValue : 'booleanValue' in field ? field.booleanValue : field.arrayValue ? (field.arrayValue.values || []).map(decode) : field.mapValue ? Object.fromEntries(Object.entries(field.mapValue.fields || {}).map(([key, value]) => [key, decode(value)])) : null
const record = (doc) => ({ ...Object.fromEntries(Object.entries(doc.fields || {}).map(([key, value]) => [key, decode(value)])), id: doc.name.split('/').at(-1) })
const encode = (value) => value === null ? { nullValue: null } : value instanceof Date ? { timestampValue: value.toISOString() } : Array.isArray(value) ? { arrayValue: { values: value.map(encode) } } : typeof value === 'object' ? { mapValue: { fields: fields(value) } } : typeof value === 'boolean' ? { booleanValue: value } : typeof value === 'number' ? Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value } : { stringValue: String(value) }
const fields = (value) => Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]))
const raw = Object.fromEntries(await Promise.all(['sports', 'teams', 'games', 'predictions'].map(async (collection) => [collection, await readCollection(collection)])))
const input = Object.fromEntries(Object.entries(raw).map(([collection, docs]) => [collection, docs.map(record)]))
const plan = buildOfficialSchedulePlan(input, { predictionPolicy: options['prediction-policy'] })
const manifestHash = createHash('sha256').update(JSON.stringify(OFFICIAL_SCHEDULE_2026)).digest('hex')
writeFileSync(join(output, 'plan.json'), JSON.stringify({ project, sources: sourceDefinitions, manifestHash, ...plan }, null, 2))
console.log(JSON.stringify({ project, mode: options.apply ? 'apply' : 'preview', predictionPolicy: plan.predictionPolicy, ...plan.summary }))
if (!options.apply || !plan.changes.length) {
  console.log(plan.changes.length ? 'Prévia pronta. Nenhum dado foi alterado.' : 'A programação já corresponde aos PDFs; nenhuma gravação necessária.')
  process.exit(0)
}

const now = new Date(), runId = now.toISOString().replace(/[:.]/g, '-')
const noticeId = `oficial-2026-${manifestHash.slice(0, 12)}-${now.getTime()}`
const markerPath = 'operations/official-schedule-2026', previousMarker = await request(`/${markerPath}`, {}, true)
const rawByPath = new Map(Object.entries(raw).flatMap(([collection, docs]) => docs.map((doc) => [`${collection}/${doc.name.split('/').at(-1)}`, doc])))
if (previousMarker) rawByPath.set(markerPath, previousMarker)
const backup = { format: 'interclasse-official-schedule-journal', version: 1, project, createdAt: now.toISOString(), manifestHash, sources: sourceDefinitions, snapshot: raw, previousMarker, markerPath, noticeId, changes: plan.changes, createdPaths: [...plan.changes.filter((item) => item.type === 'create').map((item) => `${item.collection}/${item.id}`), ...(plan.notices.length ? [`scheduleNotices/${noticeId}`] : []), ...(!previousMarker ? [markerPath] : [])] }
const backupPath = join(output, `before-${runId}.json`)
writeFileSync(backupPath, JSON.stringify(backup, null, 2), { flag: 'wx' })
const writes = plan.changes.map((change) => {
  const path = `${change.collection}/${change.id}`, previous = rawByPath.get(path)
  return {
    update: { name: `projects/${project}/databases/(default)/documents/${path}`, fields: fields(change.fields) },
    ...(previous ? { updateMask: { fieldPaths: Object.keys(change.fields) }, currentDocument: { updateTime: previous.updateTime } } : { currentDocument: { exists: false } }),
    updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }, ...(!previous ? [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }] : [])],
  }
})
if (plan.notices.length) writes.push({ update: { name: `projects/${project}/databases/(default)/documents/scheduleNotices/${noticeId}`, fields: fields({ changes: plan.notices, source: plan.version }) }, currentDocument: { exists: false }, updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }] })
writes.push({ update: { name: `projects/${project}/databases/(default)/documents/${markerPath}`, fields: fields({ version: plan.version, manifestHash, sources: sourceDefinitions, summary: plan.summary, predictionPolicy: plan.predictionPolicy, organization: plan.organization, noticeId: plan.notices.length ? noticeId : '' }) }, ...(previousMarker ? { currentDocument: { updateTime: previousMarker.updateTime } } : { currentDocument: { exists: false } }), updateTransforms: [{ fieldPath: 'appliedAt', setToServerValue: 'REQUEST_TIME' }, { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }] })
if (writes.length > 450) throw new Error('A importação excedeu o limite conservador de uma gravação atômica.')
const committed = await request(':commit', { method: 'POST', body: JSON.stringify({ writes }) })
const afterRaw = Object.fromEntries(await Promise.all(['sports', 'teams', 'games', 'predictions'].map(async (collection) => [collection, await readCollection(collection)])))
const after = Object.fromEntries(Object.entries(afterRaw).map(([collection, docs]) => [collection, docs.map(record)]))
const remaining = buildOfficialSchedulePlan(after, { predictionPolicy: plan.predictionPolicy })
assert.equal(remaining.changes.length, 0, 'O servidor não corresponde à prévia gravada.')
const affected = new Set(plan.officialGames.map((game) => game.id))
for (const doc of raw.games.filter((doc) => !affected.has(doc.name.split('/').at(-1)))) assert.deepEqual(afterRaw.games.find((item) => item.name === doc.name), doc, 'Uma partida de outra modalidade foi alterada.')
for (const prediction of input.predictions) {
  const current = after.predictions.find((item) => item.id === prediction.id)
  for (const field of ['userId', 'gameId', 'palpiteA', 'palpiteB', 'guessA', 'guessB']) assert.deepEqual(current?.[field], prediction[field], 'O conteúdo de um palpite foi alterado.')
}
const receipt = { project, appliedAt: committed.commitTime, manifestHash, sources: sourceDefinitions, summary: plan.summary, writes: writes.length, verifiedGames: remaining.officialGames.length, predictionInputsPreserved: true, unrelatedGamesPreserved: true, markerPath, noticeId, backup: backupPath }
writeFileSync(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2))
console.log(JSON.stringify({ applied: true, verifiedGames: receipt.verifiedGames, writes: writes.length, backup: backupPath }))
