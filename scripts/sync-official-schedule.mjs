import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { buildOfficialSchedulePlan } from '../src/utils/officialSchedule.js'
import { OFFICIAL_SCHEDULE_2026 } from '../src/data/officialSchedule2026.js'
import { createFirestoreClient, fields, record } from './lib/firestore-rest.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const downloads = join(homedir(), 'Downloads')
const { values: options } = parseArgs({ options: {
  project: { type: 'string' },
  apply: { type: 'boolean', default: false },
  emulator: { type: 'boolean', default: false },
  'prediction-policy': { type: 'string', default: 'preserve' },
  'source-directory': { type: 'string', default: downloads },
  'previous-source-directory': { type: 'string', default: downloads },
} })
if (!['preserve', 'open-defined'].includes(options['prediction-policy'])) throw new Error('Use --prediction-policy preserve ou open-defined.')
const sourceDefinitions = [
  { key: 'manha', file: 'Cronograma - Manhã.pdf', sha256: 'ea32349adb90996c78c928c8b9f11033fda92a04efeee9134820cb756db9a68e', shift: 'manha', pages: 4 },
  { key: 'tarde', file: 'Cronograma - Tarde.pdf', sha256: '51101a47aa3751302aeb5a51f9ba706320bdbe34fcd20d4a40e0a516dbbc3d0b', shift: 'tarde', pages: 5 },
  { key: 'secundarios', file: 'Cronograma - Esportes Secundários.pdf', sha256: '5fff01b9b5cf91ae657b2901fec43a38b0540d7bc7844db4c6c79b6f1598d5e6', shift: 'manha', pages: 5 },
  { key: 'manha-anterior', file: 'Informações para mural - interclasse 2026 (2).pdf', sha256: 'b137e0751d6be2e63bd229c090ac8f2bea475d144d905975886f89ae0a3802c5', shift: 'manha', pages: 5 },
]
for (const source of sourceDefinitions) {
  const directory = source.key === 'manha-anterior' ? options['previous-source-directory'] : options['source-directory']
  if (createHash('sha256').update(readFileSync(join(directory, source.file))).digest('hex') !== source.sha256) throw new Error(`O PDF ${source.file} mudou. Confira a transcrição antes de aplicar.`)
}
const client = await createFirestoreClient(options)
const { project, request, list, documentName } = client
const output = join(root, 'artifacts', 'rehearsal', 'official-schedule', options.emulator ? 'emulator' : project)
mkdirSync(output, { recursive: true })
async function readScheduleCollections() {
  const collections = ['sports', 'teams', 'games', 'predictions']
  const docs = await Promise.all(collections.map(list))
  return Object.fromEntries(collections.map((collection, index) => [collection, docs[index]]))
}
const raw = await readScheduleCollections()
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
    update: { name: documentName(path), fields: fields(change.fields) },
    ...(previous ? { updateMask: { fieldPaths: Object.keys(change.fields) }, currentDocument: { updateTime: previous.updateTime } } : { currentDocument: { exists: false } }),
    updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }, ...(!previous ? [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }] : [])],
  }
})
if (plan.notices.length) writes.push({ update: { name: documentName(`scheduleNotices/${noticeId}`), fields: fields({ changes: plan.notices, source: plan.version }) }, currentDocument: { exists: false }, updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }] })
writes.push({ update: { name: documentName(markerPath), fields: fields({ version: plan.version, manifestHash, sources: sourceDefinitions, summary: plan.summary, predictionPolicy: plan.predictionPolicy, organization: plan.organization, noticeId: plan.notices.length ? noticeId : '' }) }, ...(previousMarker ? { currentDocument: { updateTime: previousMarker.updateTime } } : { currentDocument: { exists: false } }), updateTransforms: [{ fieldPath: 'appliedAt', setToServerValue: 'REQUEST_TIME' }, { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }] })
if (writes.length > 450) throw new Error('A importação excedeu o limite conservador de uma gravação atômica.')
const committed = await request(':commit', { method: 'POST', body: JSON.stringify({ writes }) })
const [afterRaw, marker] = await Promise.all([readScheduleCollections(), request(`/${markerPath}`)])
assert.equal(record(marker).manifestHash, manifestHash, 'O marcador no servidor não corresponde à programação gravada.')
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
