import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { createFirestoreClient, fields, record } from './lib/firestore-rest.mjs'
import { buildRosterSyncPlan } from './lib/roster-sync.mjs'

const { values: options } = parseArgs({ options: { project: { type: 'string' }, manifest: { type: 'string' }, source: { type: 'string' }, apply: { type: 'boolean', default: false }, emulator: { type: 'boolean', default: false } } })
if (!options.manifest || !options.source) throw new Error('Informe --manifest e --source com a transcrição revisada e o PDF original.')
const manifest = JSON.parse(readFileSync(options.manifest, 'utf8'))
if (createHash('sha256').update(readFileSync(options.source)).digest('hex') !== manifest.source?.sha256) throw new Error('O PDF não corresponde à transcrição revisada.')
const client = await createFirestoreClient(options)
const directory = join('artifacts', 'rehearsal', 'rosters-2026', options.emulator ? 'emulator' : options.project)
mkdirSync(directory, { recursive: true })
async function snapshot() {
  const [sports, teams, games] = await Promise.all(['sports', 'teams', 'games'].map(client.list))
  const players = []
  for (let index = 0; index < teams.length; index += 12) players.push(...(await Promise.all(teams.slice(index, index + 12).map((team) => client.list(`teams/${record(team).id}/players`)))).flat())
  return { sports, teams, games, players }
}
const decoded = (raw) => ({ sports: raw.sports.map(record), teams: raw.teams.map(record), players: raw.players.map((doc) => ({ ...record(doc), teamId: doc.name.split('/').at(-3) })) })
const before = await snapshot(), plan = buildRosterSyncPlan(decoded(before), manifest)
writeFileSync(join(directory, 'plan.json'), JSON.stringify({ project: options.project, source: manifest.source, ...plan }, null, 2))
console.log(JSON.stringify({ project: options.project, mode: options.apply ? 'apply' : 'preview', ...plan.summary }))
if (!options.apply || !plan.changes.length) {
  console.log(plan.changes.length ? 'Prévia pronta. Nenhum dado foi alterado.' : 'As inscrições já estão cadastradas; nenhuma gravação necessária.')
  process.exit(0)
}
const markerPath = `operations/rosters-${manifest.source.sha256.slice(0, 20)}`, marker = await client.request(`/${markerPath}`, {}, true)
const rawByPath = new Map(Object.values(before).flat().map((doc) => [doc.name.split('/documents/')[1], doc]))
const backup = join(directory, `before-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
writeFileSync(backup, JSON.stringify({ project: options.project, source: manifest.source, snapshot: before, previousMarker: marker, markerPath, changes: plan.changes, createdPaths: [...plan.changes.filter((item) => item.type === 'create').map((item) => item.path), ...(!marker ? [markerPath] : [])] }, null, 2), { flag: 'wx' })
const writes = plan.changes.map((change) => {
  const previous = rawByPath.get(change.path)
  return { update: { name: client.documentName(change.path), fields: fields(change.fields) }, ...(previous ? { updateMask: { fieldPaths: Object.keys(change.fields) }, currentDocument: { updateTime: previous.updateTime } } : { currentDocument: { exists: false } }), updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }, ...(!previous ? [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }] : [])] }
})
writes.push({ update: { name: client.documentName(markerPath), fields: fields({ source: manifest.source, summary: plan.summary, positionPolicy: 'unmarked-is-starter' }) }, ...(marker ? { currentDocument: { updateTime: marker.updateTime } } : { currentDocument: { exists: false } }), updateTransforms: [{ fieldPath: 'appliedAt', setToServerValue: 'REQUEST_TIME' }] })
if (writes.length > 450) throw new Error('Divida esta importação em lotes menores, mantendo cada equipe em um único lote.')
const committed = await client.request(':commit', { method: 'POST', body: JSON.stringify({ writes }) })
const after = await snapshot(), remaining = buildRosterSyncPlan(decoded(after), manifest)
assert.equal(remaining.changes.length, 0, 'Os cadastros gravados não correspondem à prévia.')
assert.deepEqual([...after.games].sort((a, b) => a.name.localeCompare(b.name)), [...before.games].sort((a, b) => a.name.localeCompare(b.name)), 'Uma partida oficial foi alterada.')
const affected = new Set(plan.changes.map((change) => client.documentName(change.path)))
for (const collection of ['sports', 'teams', 'players']) for (const doc of before[collection].filter((doc) => !affected.has(doc.name))) assert.deepEqual(after[collection].find((item) => item.name === doc.name), doc, 'Um cadastro fora da importação foi alterado.')
const receipt = { project: options.project, appliedAt: committed.commitTime, source: manifest.source, summary: plan.summary, writes: writes.length, verifiedPlayers: remaining.expectedPlayers.length, unrelatedRecordsPreserved: true, gamesPreserved: true, backup, markerPath }
writeFileSync(join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2))
console.log(JSON.stringify({ applied: true, verifiedPlayers: receipt.verifiedPlayers, writes: writes.length, backup }))
