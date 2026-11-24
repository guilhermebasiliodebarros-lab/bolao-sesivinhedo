import { test } from 'node:test'
import assert from 'node:assert/strict'
import { OFFICIAL_SCHEDULE_2026 } from '../src/data/officialSchedule2026.js'
import { buildOfficialSchedulePlan, validateOfficialSchedule } from '../src/utils/officialSchedule.js'
import { SCHOOL_CLASSES } from '../src/utils/schoolClasses.js'
import { findScheduleConflicts } from '../src/utils/scheduleConflicts.js'
import { schoolDay } from '../src/utils/tvSchedule.js'

const sports = Object.entries(OFFICIAL_SCHEDULE_2026.sports).map(([id, definition]) => ({ id, nome: definition.name }))
const teams = sports.flatMap((sport) => SCHOOL_CLASSES.map((item) => ({ id: `${sport.id}-${item.code}`, sportId: sport.id, esporteNome: sport.nome, nome: item.nome, turma: item.turma, turno: item.turno, playerCount: 2 })))
const initial = () => ({ sports: structuredClone(sports), teams: structuredClone(teams), games: [] })

test('official mural has 96 unique games, full round robins, sixteen semifinals and eight finals', () => {
  const rows = validateOfficialSchedule()
  assert.equal(rows.length, 96)
  assert.equal(rows.filter((row) => row.shift === 'manha').length, 60)
  assert.equal(rows.filter((row) => row.shift === 'tarde').length, 36)
  assert.equal(rows.filter((row) => row.group).length, 72)
  assert.equal(rows.filter((row) => row.phase.startsWith('S')).length, 16)
  assert.equal(rows.filter((row) => row.phase === 'F').length, 8)
  assert.equal(new Set(rows.map((row) => row.date)).size, 4)
  assert.equal(rows.find((row) => row.shift === 'tarde' && row.date === '2026-11-30').start, '14:20')
})

test('all games fit the official whole/half court reservations and known classes do not clash', () => {
  const plan = buildOfficialSchedulePlan(initial())
  for (const game of plan.officialGames) assert.deepEqual(findScheduleConflicts(game, plan.officialGames, teams), [], game.id)
  assert.equal(plan.organization.blocks.length, 9)
  assert(!plan.officialGames.some((game) => /cultural|organiza/i.test(game.esporteNome)))
})

test('dates, short finals and five-minute deadlines keep Sao Paulo school time', () => {
  const plan = buildOfficialSchedulePlan(initial(), { predictionPolicy: 'open-defined' })
  const first = plan.officialGames.find((game) => game.officialSchedule.key === 'manha-basquete-grupo-a-1-a_3-a')
  assert.equal(first.dataHora.toISOString(), '2026-11-30T10:30:00.000Z')
  assert.equal(first.limitePalpites.toISOString(), '2026-11-30T10:25:00.000Z')
  for (const game of plan.officialGames) {
    assert.equal(schoolDay(game.dataHora), game.officialSchedule.date)
    assert.equal(game.dataHora - game.limitePalpites, 300000)
    assert.equal(game.dataHoraFim - game.dataHora, game.durationMinutes * 60000)
    assert.equal(game.status, game.stageType === 'group' ? 'aberto' : 'encerrado')
    if (game.scoringMode === 'sets') assert.equal(game.volleyballBestOf, 3)
  }
  assert.equal(plan.officialGames.find((game) => game.officialSchedule.key === 'manha-futsal-f').durationMinutes, 7)
})

test('semifinal 1 is B1 versus A2 and each final links to the right semifinal winners', () => {
  const plan = buildOfficialSchedulePlan(initial())
  for (const shift of ['manha', 'tarde']) for (const sport of sports) {
    const games = plan.officialGames.filter((game) => game.sportId === sport.id && game.turno === shift)
    const semi1 = games.find((game) => game.rodada === 'Semifinal 1')
    const semi2 = games.find((game) => game.rodada === 'Semifinal 2')
    const final = games.find((game) => game.fase === 'Final')
    assert.equal(semi1.seedLabelA, '1o Grupo B'); assert.equal(semi1.seedLabelB, '2o Grupo A')
    assert.equal(semi2.seedLabelA, '1o Grupo A'); assert.equal(semi2.seedLabelB, '2o Grupo B')
    assert.equal(final.sourceGameIdA, semi1.id); assert.equal(final.sourceGameIdB, semi2.id)
    assert.equal(semi1.nextGameId, final.id); assert.equal(semi2.nextGameSlot, 'B')
  }
})

test('a second import is idempotent, retains IDs and does not touch other sports or rosters', () => {
  const data = initial(), rosterBefore = structuredClone(data.teams)
  const first = buildOfficialSchedulePlan(data, { predictionPolicy: 'open-defined' })
  const other = { id: 'mancala-game', sportId: 'mancala', status: 'encerrado', timeA: '9º A', timeB: '9º B', turno: 'manha' }
  const current = { ...data, games: [...first.officialGames, other] }
  const second = buildOfficialSchedulePlan(current, { predictionPolicy: 'open-defined' })
  assert.equal(second.changes.length, 0)
  for (const game of current.games.filter((item) => item.officialSchedule)) game.officialSchedule = Object.fromEntries(Object.entries(game.officialSchedule).reverse())
  assert.equal(buildOfficialSchedulePlan(current, { predictionPolicy: 'open-defined' }).changes.length, 0, 'Firestore may return map keys in a different order')
  assert.equal(second.summary.untouchedGames, 1)
  assert.deepEqual(second.officialGames.map((game) => game.id), first.officialGames.map((game) => game.id))
  assert.deepEqual(data.teams, rosterBefore)
  assert.deepEqual(current.games.at(-1), other)
})

test('live/results, changed pair orientation with predictions, duplicated rows and unknown old games require review', () => {
  const data = initial(), first = buildOfficialSchedulePlan(data)
  const games = structuredClone(first.officialGames)
  games[0].liveStatus = 'live'
  assert.throws(() => buildOfficialSchedulePlan({ ...data, games }), /início, resultado ou lances/)
  games[0] = { ...first.officialGames[0], timeA: first.officialGames[0].timeB, timeB: first.officialGames[0].timeA }
  assert.throws(() => buildOfficialSchedulePlan({ ...data, games, predictions: [{ gameId: games[0].id }] }), /inversão de equipes/)
  const manifest = structuredClone(OFFICIAL_SCHEDULE_2026)
  manifest.days[0].games.push(manifest.days[0].games[0])
  assert.throws(() => validateOfficialSchedule(manifest), /96 partidas/)
  assert.throws(() => buildOfficialSchedulePlan({ ...data, games: [...first.officialGames, { id: 'extra', sportId: 'basquete', turno: 'manha' }] }), /sem correspondência/)
})
