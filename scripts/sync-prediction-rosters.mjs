import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPredictionRoster, usesTopScorer } from '../functions/domain/predictionPlayers.js'
import { canonical } from '../functions/domain/ranking.js'
import { createFirestoreClient, fields, record } from './lib/firestore-rest.mjs'

const args = process.argv.slice(2)
const project = args.find((value) => value.startsWith('--project='))?.slice(10)
const client = await createFirestoreClient({ project, emulator: args.includes('--emulator') })
const apply = args.includes('--apply')
const output = resolve(fileURLToPath(new URL('../artifacts/rehearsal/prediction-rosters/', import.meta.url)), project)
mkdirSync(output, { recursive: true })
const teams = (await client.list('teams')).filter((doc) => usesTopScorer(record(doc)))
const changes = []
for (let index = 0; index < teams.length; index += 6) {
  const plans = await Promise.all(teams.slice(index, index + 6).map(async (teamDoc) => {
    const team = record(teamDoc), path = `teams/${team.id}/public/predictionPlayers`
    const [players, previous] = await Promise.all([client.list(`teams/${team.id}/players`), client.request(`/${path}`, {}, true)])
    const roster = { ...buildPredictionRoster(team, players.map(record)), sourceUpdatedAt: team.updatedAt || null }
    const old = previous ? record(previous) : {}
    delete old.id; delete old.updatedAt
    if (canonical(old) === canonical(roster)) return null
    return { path, roster, previous, sources: [teamDoc, ...players] }
  }))
  changes.push(...plans.filter(Boolean))
}
const summary = { project, teams: teams.length, changed: changes.length, players: changes.reduce((sum, item) => sum + item.roster.players.length, 0), applied: false }
writeFileSync(resolve(output, 'plan.json'), JSON.stringify({ summary, changes }, null, 2))
if (apply && changes.length) {
  writeFileSync(resolve(output, `before-${Date.now()}.json`), JSON.stringify(changes, null, 2))
  let writes = []
  for (const change of changes) {
    const next = [
      ...change.sources.map((source) => ({ verify: source.name, currentDocument: { updateTime: source.updateTime } })),
      { update: { name: client.documentName(change.path), fields: fields({ ...change.roster, updatedAt: new Date() }) }, currentDocument: change.previous ? { updateTime: change.previous.updateTime } : { exists: false } },
    ]
    if (next.length > 450) throw new Error('Elenco acima do limite de sincronização. Revise esta equipe antes de publicar.')
    if (writes.length + next.length > 450) { await client.request(':commit', { method: 'POST', body: JSON.stringify({ writes }) }); writes = [] }
    writes.push(...next)
  }
  if (writes.length) await client.request(':commit', { method: 'POST', body: JSON.stringify({ writes }) })
}
if (apply) {
  for (const change of changes) {
    const current = record(await client.request(`/${change.path}`))
    delete current.id; delete current.updatedAt
    if (canonical(current) !== canonical(change.roster)) throw new Error('O elenco mudou durante a sincronização. Execute novamente para conferir os dados atuais.')
  }
  summary.applied = true
  writeFileSync(resolve(output, 'receipt.json'), JSON.stringify(summary, null, 2))
}
console.log(JSON.stringify(summary))
