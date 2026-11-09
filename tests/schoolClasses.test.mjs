import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SCHOOL_CLASSES, schoolClassCode, schoolClassPlan, schoolClassTeamId, synchronizeSchoolClasses } from '../src/utils/schoolClasses.js'
import { getTeamShift } from '../src/utils/schoolShifts.js'

function memoryStore(initial) {
  const records = new Map(Object.entries(structuredClone(initial)))
  let failSport = ''
  return { records, fail: (id) => { failSport = id },
    list: async (name) => [...records].filter(([path]) => path.split('/').length === 2 && path.startsWith(`${name}/`)).map(([path, data]) => ({ ...structuredClone(data), id: path.split('/')[1] })),
    timestamp: () => '2026-11-09T12:00:00Z',
    runTransaction: async (action) => {
      const writes = []
      const result = await action({
        get: async (path) => { assert.equal(writes.length, 0, 'Reads must precede all writes'); return records.has(path) ? { ...structuredClone(records.get(path)), id: path.split('/').at(-1) } : null },
        create: (path, data) => writes.push({ type: 'create', path, data }),
        update: (path, data) => writes.push({ type: 'update', path, data }),
      })
      if (failSport && writes.some((item) => item.path === `sports/${failSport}`)) { failSport = ''; throw new Error('Connection lost before commit') }
      for (const item of writes) {
        if (item.type === 'create') assert.equal(records.has(item.path), false)
        else assert.equal(records.has(item.path), true)
      }
      for (const item of writes) records.set(item.path, structuredClone(item.type === 'update' ? { ...records.get(item.path), ...item.data } : item.data))
      return result
    },
  }
}

test('every sport starts with the fourteen A/B classes in their school shifts', () => {
  assert.equal(SCHOOL_CLASSES.length, 14)
  assert.equal(new Set(SCHOOL_CLASSES.map((item) => item.code)).size, 14)
  assert.equal(SCHOOL_CLASSES.filter((item) => item.turno === 'manha').length, 8)
  assert.equal(SCHOOL_CLASSES.filter((item) => item.turno === 'tarde').length, 6)
  for (const schoolClass of SCHOOL_CLASSES) assert.equal(getTeamShift(schoolClass), schoolClass.turno)
  assert.deepEqual(SCHOOL_CLASSES.filter((item) => item.categoria === 'Ensino Médio').map((item) => item.nome), ['1º A', '1º B', '2º A', '2º B', '3º A', '3º B'])
  assert.equal(schoolClassCode('Turma 7o A'), '7-a')
  assert.equal(schoolClassCode('1ª série B'), '1-b')
  assert.equal(schoolClassCode('1o Grupo A'), '')
  const football = schoolClassPlan({ id: 'football', nome: 'Futebol' })
  const chess = schoolClassPlan({ id: 'chess', nome: 'Xadrez' })
  assert(football.every((item) => item.type === 'create' && item.data.sportId === 'football'))
  assert.equal(new Set([...football, ...chess].map((item) => item.id)).size, 28)
})

test('setup completes existing sports without duplicating compact names or changing players and games', async () => {
  const morning = ['9ºA', '9ºB', '1ºA', '1ºB', '2ºA', '2ºB', '3ºA', '3ºB']
  const initial = { 'sports/football': { nome: 'Futebol', winPoints: 3 }, 'sports/chess': { nome: 'Xadrez', winPoints: 1 }, 'games/played': { timeA: '9ºA', timeB: '1ºA', placarA: 2, placarB: 1 }, 'teams/old-0/players/ana': { nome: 'Ana', posicao: 'Goleira' } }
  morning.forEach((nome, index) => { initial[`teams/old-${index}`] = { nome, sportId: 'football', playerCount: 7, notes: 'Preservar', ...(index === 0 ? { categoria: 'Categoria existente' } : {}) } })
  const store = memoryStore(initial)
  assert.deepEqual(await synchronizeSchoolClasses(store), { sports: 2, created: 20, updated: 8 })
  const teams = await store.list('teams')
  for (const sportId of ['football', 'chess']) {
    const sportTeams = teams.filter((item) => item.sportId === sportId)
    assert.equal(sportTeams.length, 14)
    assert.equal(new Set(sportTeams.map((item) => schoolClassCode(item.turma))).size, 14)
    assert.equal(sportTeams.filter((item) => item.turno === 'manha').length, 8)
    assert.equal(sportTeams.filter((item) => item.turno === 'tarde').length, 6)
  }
  assert.equal(store.records.get('teams/old-0').nome, '9ºA')
  assert.equal(store.records.get('teams/old-0').categoria, 'Categoria existente')
  assert.equal(store.records.get('teams/old-0').playerCount, 7)
  assert.equal(store.records.get('teams/old-0').notes, 'Preservar')
  assert.deepEqual(store.records.get('teams/old-0/players/ana'), initial['teams/old-0/players/ana'])
  assert.deepEqual(store.records.get('games/played'), initial['games/played'])
  const before = structuredClone([...store.records])
  assert.deepEqual(await synchronizeSchoolClasses(store), { sports: 0, created: 0, updated: 0 })
  assert.deepEqual([...store.records], before)
})

test('class metadata matches named teams by turma and fixes their explicit shift without renaming', () => {
  const plan = schoolClassPlan({ id: 'sport', nome: 'Handebol' }, [{ id: 'blue', sportId: 'sport', nome: 'Azul', turma: '8ºA', turno: 'manha', categoria: 'Especial' }])
  const blue = plan.find((item) => item.id === 'blue')
  assert.deepEqual(blue, { type: 'update', id: 'blue', data: { turno: 'tarde' } })
  assert.equal(plan.filter((item) => item.type === 'create').length, 13)
})

test('a failed sport commit stays pending and retries without duplicating completed sports', async () => {
  const store = memoryStore({ 'sports/a': { nome: 'Basquete' }, 'sports/b': { nome: 'Vôlei' } })
  store.fail('b')
  await assert.rejects(synchronizeSchoolClasses(store), /Connection lost/)
  assert.equal((await store.list('teams')).length, 14)
  assert.equal(store.records.get('sports/b').schoolClassesVersion, undefined)
  assert.deepEqual(await synchronizeSchoolClasses(store), { sports: 1, created: 14, updated: 0 })
  assert.equal((await store.list('teams')).length, 28)
  // A later deliberate removal is not undone on every page reload.
  store.records.delete(`teams/${schoolClassTeamId('a', '6-a')}`)
  assert.deepEqual(await synchronizeSchoolClasses(store), { sports: 0, created: 0, updated: 0 })
  assert.equal(store.records.has(`teams/${schoolClassTeamId('a', '6-a')}`), false)
})
