import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recentScoreEvent, scoreboardIncidents } from '../src/utils/scoreboard.js'
import { scorePresentation } from '../src/utils/scorePresentation.js'

const now = new Date('2026-11-13T14:00:00-03:00')
const game = (id, esporteNome, extra = {}) => ({ id, esporteNome, sportId: esporteNome, timeA: '9º A', timeB: '9º B', turno: 'manha', dataHora: '2026-11-13T14:00', status: 'encerrado', liveStatus: 'live', liveScoreA: 0, liveScoreB: 0, ...extra })

test('volleyball promotes current set points and switches to the set result when the winning target is reached', () => {
  const playing = game('volley', 'Vôlei', { liveScoreA: 1, liveScoreB: 0, currentSet: { a: 21, b: 19 }, setScores: [{ a: 25, b: 22 }] })
  assert.deepEqual(scorePresentation(playing).values, [21, 19])
  const won = { ...playing, liveScoreA: 2, currentSet: { a: 0, b: 0 }, setScores: [...playing.setScores, { a: 25, b: 19 }] }
  assert.deepEqual(scorePresentation(won).values, [2, 0])
  assert.doesNotMatch(scorePresentation(won).caption, /3º set/)
  assert.deepEqual(scorePresentation({ ...won, status: 'finalizado', placarA: 2, placarB: 0 }).values, [2, 0])
})

test('a recent scoring event celebrates briefly and never replays an old goal or exposes a full student name', () => {
  const match = game('goal', 'Futebol', { liveEvents: [{ id: 'event-1', side: 'A', kind: 'goal', value: 1, playerName: 'Ana Beatriz Silva', recordedAt: now.getTime() - 1000 }] })
  assert.deepEqual(recentScoreEvent(match, now), { id: 'event-1', side: 'A', kind: 'goal', minute: null, label: 'Gol!', team: '9º A', player: 'Ana' })
  assert.equal(recentScoreEvent(match, new Date(now.getTime() + 9000)), null)
  assert.equal(recentScoreEvent({ ...match, status: 'finalizado' }, now), null)
  assert.equal(recentScoreEvent({ ...match, liveEvents: [] }, now), null)
  assert.equal(recentScoreEvent(game('basket', 'Basquete', { liveEvents: [{ id: '3', side: 'B', kind: 'point', value: 3, recordedAt: now.getTime() }] }), now).label, 'Cesta de 3!')
})

test('goal authors persist beyond the last eight events; incidents keep both teams, real minutes and only first names', () => {
  const match = game('goals', 'Futebol', {
    scorerStats: [{ side: 'A', playerId: 'ana', playerName: 'Ana Beatriz', total: 2, minutes: [3, 12] }],
    liveEvents: [{ id: 'duplicate', kind: 'goal', side: 'A', playerName: 'Ana Beatriz', elapsedMs: 720000 }],
    publicCardEvents: [{ id: 'yellow', kind: 'yellow', side: 'B', playerName: 'Bruna Silva', elapsedMs: 360000 }, { id: 'red', kind: 'red', side: 'A', playerName: 'Carla Santos', elapsedMs: null }, { id: 'invalid', kind: 'red', side: 'C' }],
  })
  assert.deepEqual(scoreboardIncidents(match), [
    { id: 'scorer-A-ana', kind: 'goal', side: 'A', player: 'Ana', minutes: [3, 12], total: 2, minute: 3 },
    { id: 'yellow', kind: 'yellow', side: 'B', player: 'Bruna', minute: 6 },
    { id: 'red', kind: 'red', side: 'A', player: 'Carla', minute: null },
  ])
  assert.deepEqual(scoreboardIncidents({ ...match, status: 'finalizado' }), scoreboardIncidents(match))
})

test('cards are announced as cards, not points; newer scores supersede the card and old incidents do not celebrate again', () => {
  const card = { id: 'red', kind: 'red', side: 'B', playerName: 'Bruna Silva', elapsedMs: 420000, recordedAt: now.getTime() - 1000 }
  const match = game('cards', 'Futebol', { publicCardEvents: [card] })
  assert.deepEqual(recentScoreEvent(match, now), { id: 'red', kind: 'red', side: 'B', player: 'Bruna', minute: 7, label: 'Cartão vermelho', team: '9º B' })
  assert.equal(recentScoreEvent({ ...match, publicCardEvents: [{ ...card, kind: 'yellow' }] }, now).label, 'Cartão amarelo')
  assert.equal(recentScoreEvent(match, new Date(now.getTime() + 9000)), null)
  assert.equal(recentScoreEvent({ ...match, liveEvents: [{ id: 'goal', kind: 'goal', side: 'A', recordedAt: now.getTime() }] }, now).label, 'Gol!')
  assert.equal(recentScoreEvent({ ...match, publicCardEvents: [{ ...card, kind: 'suspension' }] }, now), null)
})

test('legacy goals retain their minutes while basketball shows one accumulated row per author', () => {
  const event = { id: 'old-goal', kind: 'goal', side: 'A', value: 1, playerName: 'Ana Silva', elapsedMs: 61000 }
  assert.equal(scoreboardIncidents(game('legacy', 'Futebol', { liveEvents: [event] }))[0].minute, 1)
  const shots = [3, 2, 2].map((value, index) => ({ ...event, id: `shot-${index}`, kind: 'point', value }))
  const totals = scoreboardIncidents(game('basket', 'Basquete', { liveEvents: shots }))
  assert.equal(totals.length, 1)
  assert.equal(totals[0].total, 7)
  assert.equal(totals[0].player, 'Ana')
  assert.equal(totals[0].minute, null)
})

test('volleyball totals include previous sets and stay separate from the latest points and cards', () => {
  const match = game('volley', 'Vôlei', {
    currentSet: { a: 18, b: 15 }, liveScoreA: 1, setScores: [{ a: 25, b: 21 }],
    scorerStats: [
      { side: 'A', playerId: 'one', playerName: 'Gustavo Souza', total: 19, minutes: [2, 5] },
      { side: 'A', playerId: 'two', playerName: 'Gustavo Lima', total: 7 },
      { side: 'B', playerId: 'one', playerName: 'Gustavo', total: 11 },
    ],
    liveEvents: [{ id: 'latest', kind: 'point', side: 'A', playerId: 'one', playerName: 'Gustavo', value: 1, elapsedMs: 300000 }],
    publicCardEvents: [{ id: 'yellow', kind: 'yellow', side: 'A', playerName: 'Gustavo Lima', elapsedMs: 120000 }],
  })
  const rows = scoreboardIncidents(match)
  assert.deepEqual(rows.filter((row) => row.kind === 'point').map(({ id, total, minute }) => [id, total, minute]), [
    ['scorer-A-one', 19, null], ['scorer-B-one', 11, null], ['scorer-A-two', 7, null],
  ])
  assert.equal(rows[0].kind, 'yellow')
  assert.equal(rows[0].minute, 2)
})

test('multiple handball goals remain one row with each minute, including goals scored in the same minute', () => {
  const liveEvents = [1, 5, 5].map((minute, index) => ({ id: `goal-${index}`, kind: 'goal', side: 'A', playerId: 'gustavo', playerName: 'Gustavo', elapsedMs: minute * 60000, value: 1 }))
  const rows = scoreboardIncidents(game('handball', 'Handebol', { liveEvents }))
  assert.equal(rows.length, 1)
  assert.equal(rows[0].total, 3)
  assert.deepEqual(rows[0].minutes, [1, 5, 5])
})
