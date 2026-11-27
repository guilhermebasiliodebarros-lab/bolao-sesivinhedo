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

test('the official schedule has 156 unique games, full round robins, 24 semifinals and 12 finals', () => {
  const rows = validateOfficialSchedule()
  assert.equal(rows.length, 156)
  assert.equal(rows.filter((row) => row.shift === 'manha').length, 120)
  assert.equal(rows.filter((row) => row.shift === 'tarde').length, 36)
  assert.equal(rows.filter((row) => row.group).length, 120)
  assert.equal(rows.filter((row) => row.semifinal).length, 24)
  assert.equal(rows.filter((row) => row.phase === 'F').length, 12)
  assert.equal(rows.filter((row) => row.source === 'secundarios').length, 60)
  assert.equal(new Set(rows.map((row) => row.date)).size, 4)
})

test('the November 27 schedule follows the new afternoon timetable and retains Thursday morning', () => {
  const rows = validateOfficialSchedule()
  const afternoon = rows.filter((row) => row.shift === 'tarde')
  assert(afternoon.every((row) => row.start >= '14:20' && row.end <= '18:00'))
  const afternoonSlots = Object.fromEntries(afternoon.map((row) => [row.number, [row.start, row.end]]))
  assert.deepEqual(afternoonSlots[3], ['14:40', '15:00'])
  assert.deepEqual(afternoonSlots[14], ['17:00', '17:20'])
  assert.deepEqual(afternoonSlots[16], ['15:30', '15:43'])
  assert.deepEqual(afternoonSlots[23], ['14:50', '15:10'])
  assert.deepEqual(afternoonSlots[31], ['15:30', '15:55'])
  assert.deepEqual(afternoonSlots[35], ['16:20', '16:40'])
  assert.deepEqual(afternoonSlots[36], ['16:40', '17:00'])
  const retained = rows.filter((row) => row.source === 'manha-anterior')
  assert.equal(retained.length, 15)
  assert(retained.every((row) => row.date === '2026-12-03' && row.shift === 'manha'))
})

test('court reservations fit, and secondary sports have their own simultaneous matches', () => {
  const plan = buildOfficialSchedulePlan(initial())
  const courtGames = plan.officialGames.filter((game) => game.venue === 'Quadra')
  for (const game of courtGames) assert.deepEqual(findScheduleConflicts(game, courtGames, teams), [], game.id)
  const secondaryGames = plan.officialGames.filter((game) => game.officialSchedule.source === 'secundarios')
  assert(secondaryGames.every((game) => game.turno === 'manha' && game.venue === '' && game.durationMinutes === 20))
  const secondaryFinals = secondaryGames.filter((game) => game.fase === 'Final')
  assert.equal(secondaryFinals.length, 4)
  assert(secondaryFinals.every((game) => game.officialSchedule.date === '2026-12-03' && game.officialSchedule.start === '10:40'))
  const futmesaSemi = secondaryGames.find((game) => game.officialSchedule.key === 'manha-futmesa-s2')
  assert.equal(futmesaSemi.officialSchedule.date, '2026-12-03')
  assert.equal(futmesaSemi.officialSchedule.start, '08:20')
  assert.equal(plan.organization.blocks.length, 17)
  assert(plan.organization.blocks.some((block) => block.date === '2026-12-04' && block.start === '12:40'))
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

test('each semifinal uses its own schedule seeds and each final links to both semifinal winners', () => {
  const plan = buildOfficialSchedulePlan(initial())
  for (const [shift, competitions] of Object.entries(OFFICIAL_SCHEDULE_2026.groups)) for (const sportId of Object.keys(competitions)) {
    const games = plan.officialGames.filter((game) => game.sportId === sportId && game.turno === shift)
    const semi1 = games.find((game) => game.rodada === 'Semifinal 1')
    const semi2 = games.find((game) => game.rodada === 'Semifinal 2')
    const final = games.find((game) => game.fase === 'Final')
    const first = semi1.officialSchedule.source === 'secundarios' ? 'A' : 'B'
    const second = first === 'A' ? 'B' : 'A'
    assert.deepEqual([semi1.seedLabelA, semi1.seedLabelB], [`1o Grupo ${first}`, `2o Grupo ${second}`])
    assert.deepEqual([semi2.seedLabelA, semi2.seedLabelB], [`1o Grupo ${second}`, `2o Grupo ${first}`])
    assert.deepEqual([final.sourceGameIdA, final.sourceGameIdB], [semi1.id, semi2.id])
    assert.deepEqual([semi1.nextGameId, semi1.nextGameSlot], [final.id, 'A'])
    assert.deepEqual([semi2.nextGameId, semi2.nextGameSlot], [final.id, 'B'])
  }
})

test('a second import is idempotent, retains IDs and does not touch other sports or rosters', () => {
  const data = initial(), rosterBefore = structuredClone(data.teams)
  const first = buildOfficialSchedulePlan(data, { predictionPolicy: 'open-defined' })
  const other = { id: 'xadrez-tarde', sportId: 'xadrez', status: 'encerrado', timeA: '6º A', timeB: '6º B', turno: 'tarde' }
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

test('an existing unscheduled secondary game keeps its ID, assigned venue and prediction status by default', () => {
  const game = { id: 'futmesa-existente', sportId: 'futmesa', turno: 'manha', stageType: 'group', groupName: 'Grupo A', timeA: '3º A', timeB: '1º A', status: 'encerrado', venue: 'Pátio', venueArea: 'Mesa 1' }
  const plan = buildOfficialSchedulePlan({ ...initial(), games: [game] })
  const scheduled = plan.officialGames.find((match) => match.id === game.id)
  assert.equal(plan.summary.updateGames, 1)
  assert.equal(plan.summary.createGames, 155)
  assert.equal(scheduled.officialSchedule.start, '07:30')
  assert.equal(scheduled.officialSchedule.court, '')
  assert.deepEqual([scheduled.venue, scheduled.venueArea, scheduled.status], ['Pátio', 'Mesa 1', 'encerrado'])
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
  assert.throws(() => validateOfficialSchedule(manifest), /partidas duplicadas/)
  assert.throws(() => buildOfficialSchedulePlan({ ...data, games: [...first.officialGames, { id: 'extra', sportId: 'basquete', turno: 'manha' }] }), /sem correspondência/)
})
