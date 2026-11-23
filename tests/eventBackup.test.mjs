import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEventBackup, decodeBackupValue, encodeBackupValue, eventRestoreChunks, planEventRestore, validateEventBackup, validBackupPath } from '../src/utils/eventBackup.js'

const project = 'demo-interclasse-ensaio'
const records = [
  { path: 'sports/football', data: { nome: 'Futebol', regulation: { notes: 'Regra da escola' }, createdAt: new Date('2026-11-23T12:00:00.123Z') } },
  { path: 'teams/blue', data: { nome: '9º A', sportId: 'football' } },
  { path: 'teams/blue/players/ana', data: { nome: 'Ana', capitao: true } },
  { path: 'games/one', data: { timeA: '9º A', timeB: '9º B', placarA: 2, placarB: 1, status: 'finalizado' } },
]
test('portable backups preserve nested data and dates, and validate integrity within their source project', async () => {
  const backup = await createEventBackup(project, records)
  assert.equal(backup.documents.length, 4)
  await validateEventBackup(JSON.parse(JSON.stringify(backup)), project)
  const sport = backup.documents.find((record) => record.path === 'sports/football')
  const restored = decodeBackupValue(sport.data, (seconds, nanoseconds) => new Date(seconds * 1000 + nanoseconds / 1e6))
  assert.deepEqual(restored, records[0].data)
  const timestamp = { seconds: 1795435200, nanoseconds: 123456789, toDate: () => new Date() }
  assert.deepEqual(encodeBackupValue(timestamp), { $type: 'timestamp', seconds: timestamp.seconds, nanoseconds: timestamp.nanoseconds })
  await assert.rejects(validateEventBackup(backup, 'other-project'), /outro projeto/)
  const changed = structuredClone(backup)
  changed.documents[0].data.timeA = 'Alterado'
  await assert.rejects(validateEventBackup(changed, project), /corrompido/)
})

test('recovery files cannot contain account paths, invalid timestamps, duplicate paths or prototype fields', async () => {
  for (const path of ['users/master', 'users/teacher/preferences/scheduleNotices', 'games/../events/one', '/games/one', 'games/one/unknown/sub', 'teams/one/players/two/other/three']) assert.equal(validBackupPath(path), false)
  const backup = await createEventBackup(project, records)
  const duplicate = structuredClone(backup)
  duplicate.documents.push(duplicate.documents[0])
  await assert.rejects(validateEventBackup(duplicate, project), /duplicados/)
  assert.throws(() => decodeBackupValue({ $type: 'timestamp', seconds: 1, nanoseconds: -1 }, () => null), /data inválida/)
  assert.throws(() => decodeBackupValue(JSON.parse('{"__proto__":{"role":"master"}}'), () => null), /reservado/)
  assert.throws(() => encodeBackupValue({ value: NaN }), /não suportado/)
  const deleting = await createEventBackup(project, [{ path: 'games/deleting', data: { deletionPending: 'running' } }])
  await assert.rejects(validateEventBackup(deleting, project), /exclusão/)
  const orphan = await createEventBackup(project, [{ path: 'games/missing/documents/matchReport', data: { notes: 'Sem partida' } }])
  await assert.rejects(validateEventBackup(orphan, project), /equipe ou partida/)
})

test('private recovery chunks bound both documents and distinct game-parent security lookups', () => {
  const records = Array.from({ length: 21 }, (_, index) => ({ path: `games/g-${index}/documents/attendance` }))
  const chunks = eventRestoreChunks(records)
  assert.deepEqual(chunks.map((chunk) => chunk.length), [8, 8, 5])
  assert.deepEqual(chunks.flat(), records)
  const sameGame = Array.from({ length: 205 }, (_, index) => ({ path: `games/one/events/e-${index}` }))
  assert.deepEqual(eventRestoreChunks(sameGame).map((chunk) => chunk.length), [100, 100, 5])
})

test('missing-only recovery preserves edits; replacement never deletes later data or restores the live guard', async () => {
  const backup = await createEventBackup(project, [...records, { path: 'operations/liveMatches', data: { gameIds: ['one'] } }])
  const current = [records[0], { ...records[1], data: { nome: 'Nome atualizado' } }, { path: 'games/later', data: { timeA: 'Novo jogo' } }]
  const missing = planEventRestore(backup, current)
  assert.deepEqual(missing.counts, { created: 2, replaced: 0, preserved: 3 })
  assert(!missing.changes.some((item) => item.path === 'teams/blue'))
  const replace = planEventRestore(backup, current, 'replace')
  assert.deepEqual(replace.counts, { created: 2, replaced: 1, preserved: 2 })
  assert(replace.changes.some((item) => item.path === 'teams/blue'))
  assert(!replace.changes.some((item) => item.path === 'games/later' || item.path === 'operations/liveMatches'))
  assert.throws(() => planEventRestore(backup, current, 'delete-all'), /forma válida/)
})
