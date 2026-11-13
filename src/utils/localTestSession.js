import { attendanceTeamKey, normalizeAttendanceSide } from './attendance.js'
import { normalizeDisciplineInput, publicCardEvent } from './discipline.js'
import { applyLiveEvent, canCorrectLiveEvent, rebuildLiveEvents, scoreRevision } from './liveEvents.js'
import { clockRevision, matchClockValue, stoppedMatchClock } from './matchClock.js'
import { periodRevision, planPeriodChange } from './matchPeriods.js'
import { getMatchState, MATCH_STATE } from './match.js'
import { normalizeSetScores, validateFinalSets, validateSportScores } from './sportRules.js'
import { normalizeTieBreak } from './tieBreak.js'

export const TEST_SPORTS = [
  { id: 'futebol', nome: 'Futebol', scoringMode: 'goals', pairs: [['9º A', '9º B']] },
  { id: 'handebol', nome: 'Handebol', scoringMode: 'goals', pairs: [['8º A', '8º B']] },
  { id: 'basquete', nome: 'Basquete', scoringMode: 'points', pairs: [['7º A', '7º B'], ['6º A', '6º B']] },
  { id: 'volei', nome: 'Vôlei', scoringMode: 'sets', pairs: [['1º A', '1º B'], ['2º A', '2º B']] },
]

// This session owns only in-memory fixtures. It has no Firebase, fetch or persistence dependency.
// Every operation rejects IDs outside this session; real match IDs cannot enter this adapter.
export function createLocalTestSession({ now = () => new Date() } = {}) {
  const listeners = new Set(), rosters = new Map(), attendance = new Map(), histories = new Map(), cards = new Map(), requests = new Map()
  let snapshot, serial = 0, generation = 0
  const emit = () => listeners.forEach((listener) => listener())
  function reset() {
    rosters.clear(); attendance.clear(); histories.clear(); cards.clear(); requests.clear()
    const games = [], teams = [], stamp = now()
    for (const sport of TEST_SPORTS) sport.pairs.forEach(([timeA, timeB], index) => {
      const id = `teste-${sport.id}-${index + 1}`, sportId = `teste-esporte-${sport.id}`
      const game = { id, sportId, esporteNome: sport.nome, scoringMode: sport.scoringMode, timeA, timeB, teamIdA: `${id}-a`, teamIdB: `${id}-b`, fase: 'Jogo de demonstração', stageType: 'group', tournamentName: 'MODO TESTE · JOGO FICTÍCIO', turno: ['futebol', 'volei'].includes(sport.id) ? 'manha' : 'tarde', status: 'encerrado', liveStatus: 'live', matchCondition: 'normal', venue: 'Quadra de teste', venueArea: `Jogo ${index + 1}`, vestA: 'Azul', vestB: 'Vermelho', durationMinutes: 20, volleyballBestOf: 3, liveScoreA: 0, liveScoreB: 0, placarA: null, placarB: null, clock: { elapsedMs: 0, runningSince: stamp, revision: 0 }, startedAt: stamp, period: null, currentSet: { a: 0, b: 0 }, setScores: [], liveEvents: [], scorerStats: [], publicCardEvents: [], scoreRevision: 0, lastScoreEventId: null }
      const checked = { teamKey: attendanceTeamKey(game), responsible: 'Professor de teste', checkedAt: stamp.getTime() }
      for (const side of ['A', 'B']) {
        const teamId = game[`teamId${side}`]
        const names = side === 'A' ? ['Ana Beatriz de Teste', 'Bruno Henrique de Teste'] : ['Carla Maria de Teste', 'Diego Augusto de Teste']
        const players = names.map((nome, i) => ({ id: `${teamId}-aluno-${i + 1}`, nome, posicao: '', capitao: i === 0 }))
        rosters.set(teamId, players)
        checked[side] = normalizeAttendanceSide({ status: 'present', players: Object.fromEntries(players.map((player) => [player.id, 'present'])) }, players)
        teams.push({ id: teamId, nome: game[`time${side}`], sportId, esporteNome: sport.nome, turno: game.turno, playerCount: players.length })
      }
      attendance.set(id, checked); histories.set(id, [])
      game.attendanceSummary = { teamKey: checked.teamKey, teamA: 'present', teamB: 'present', checkedAt: stamp.getTime() }
      games.push(game)
    })
    snapshot = { generation: ++generation, games, teams }; emit()
  }
  const getGame = (id) => {
    const game = typeof id === 'string' && id.startsWith('teste-') && snapshot.games.find((item) => item.id === id)
    if (!game) throw new Error('Este modo aceita somente os jogos fictícios desta sessão.')
    return game
  }
  const liveGame = (id) => {
    const game = getGame(id)
    if (getMatchState(game) !== MATCH_STATE.LIVE) throw new Error('O jogo de teste foi encerrado. Reinicie o teste para jogar novamente.')
    return game
  }
  const publish = (game) => { getGame(game.id); snapshot = { ...snapshot, games: snapshot.games.map((item) => item.id === game.id ? game : item) }; emit() }
  const checkScore = (game, revision) => { if (revision !== scoreRevision(game)) throw new Error('O placar mudou. Confira os valores atuais.') }
  const getPlayer = (game, side, playerId) => {
    const player = attendance.get(game.id)?.[side]?.players.find((item) => item.id === playerId && item.status === 'present')
    if (!player) throw new Error('Escolha um aluno presente desta equipe.')
    return player
  }
  const api = {
    localTest: true,
    async loadMatchReport(input) {
      const game = getGame(input.id)
      return structuredClone({ playersA: rosters.get(game.teamIdA), playersB: rosters.get(game.teamIdB), attendance: attendance.get(game.id), report: {} })
    },
    async saveMatchAttendance({ gameId, sides, expectedTeamKey }) {
      const game = getGame(gameId)
      if (expectedTeamKey !== attendanceTeamKey(game)) throw new Error('As equipes mudaram. Confira a presença novamente.')
      const checked = { ...attendance.get(game.id), checkedAt: ++serial + now().getTime(), ...Object.fromEntries(['A', 'B'].map((side) => [side, normalizeAttendanceSide(sides[side], rosters.get(game[`teamId${side}`]))])) }
      attendance.set(game.id, checked)
      publish({ ...game, attendanceSummary: { teamKey: checked.teamKey, teamA: checked.A.status, teamB: checked.B.status, checkedAt: checked.checkedAt } })
    },
    async recordLiveEvent(input) {
      const game = liveGame(input.gameId)
      if (histories.get(game.id).some((record) => record.id === input.requestId)) return
      if (game.period?.phase === 'interval') throw new Error('Inicie o próximo período antes de marcar gols ou pontos.')
      checkScore(game, input.expectedScoreRevision)
      const player = input.playerId ? getPlayer(game, input.side, input.playerId) : null
      const result = applyLiveEvent(game, input, { player, now: now() })
      histories.get(game.id).push({ id: result.event.id, before: result.before, event: result.event, previousEventId: game.lastScoreEventId })
      publish({ ...game, ...result.after, scoreRevision: scoreRevision(game) + 1 })
    },
    async undoLiveEvent({ gameId, eventId, expectedScoreRevision }) {
      const game = liveGame(gameId), history = histories.get(gameId), record = history.at(-1)
      checkScore(game, expectedScoreRevision)
      if (!record || record.id !== eventId || game.lastScoreEventId !== eventId) throw new Error('Só é possível desfazer o último lance.')
      history.pop(); publish({ ...game, ...structuredClone(record.before), scoreRevision: scoreRevision(game) + 1 })
    },
    async correctLiveEvent({ gameId, eventId, requestId, action, playerId, expectedScoreRevision }) {
      const game = liveGame(gameId), history = histories.get(gameId)
      const fingerprint = JSON.stringify([gameId, eventId, action, playerId || ''])
      if (requests.has(requestId)) { if (requests.get(requestId) !== fingerprint) throw new Error('Solicitação de correção inválida.'); return }
      checkScore(game, expectedScoreRevision)
      const index = history.findIndex((item) => item.id === eventId), record = history[index]
      if (!['remove', 'transfer'].includes(action) || !record || !canCorrectLiveEvent(game, record.event)) throw new Error('Este lance não pode ser corrigido agora.')
      const player = action === 'transfer' ? getPlayer(game, record.event.side === 'A' ? 'B' : 'A', playerId) : null
      const rebuilt = rebuildLiveEvents(game, history.slice(index), { action, player })
      histories.set(gameId, [...history.slice(0, index), ...rebuilt.changes]); requests.set(requestId, fingerprint)
      publish({ ...game, ...rebuilt.after, scoreRevision: scoreRevision(game) + 1 })
    },
    async controlMatchClock({ gameId, action, expectedRevision }) {
      const game = liveGame(gameId), value = matchClockValue(game, now())
      if (expectedRevision !== clockRevision(game)) throw new Error('O relógio mudou. Confira o estado atual.')
      if (!['pause', 'resume'].includes(action) || (action === 'pause') !== value.running) throw new Error('Confira o estado do cronômetro.')
      if (action === 'resume' && game.period?.phase === 'interval') throw new Error('Inicie o próximo período para sair do intervalo.')
      publish({ ...game, clock: { elapsedMs: value.elapsedMs, runningSince: action === 'resume' ? now() : null, revision: clockRevision(game) + 1 } })
    },
    async changeMatchPeriod({ gameId, action, format, expectedRevision, expectedClockRevision }) {
      const game = liveGame(gameId)
      if (expectedRevision !== periodRevision(game) || expectedClockRevision !== clockRevision(game)) throw new Error('O período ou o relógio mudou. Confira a atualização.')
      const stamp = now(), plan = planPeriodChange(game, { action, format }, stamp)
      publish({ ...game, period: plan.period, ...(plan.clockAction ? { clock: { elapsedMs: matchClockValue(game, stamp).elapsedMs, runningSince: plan.clockAction === 'resume' ? stamp : null, revision: clockRevision(game) + 1 } } : {}) })
    },
    async saveDisciplinaryRecord(teamId, input) {
      const game = liveGame(input.gameId), value = normalizeDisciplineInput(input)
      const player = rosters.get(teamId)?.find((item) => item.id === value.playerId)
      if (!player || ![game.teamIdA, game.teamIdB].includes(teamId)) throw new Error('Escolha um aluno desta partida fictícia.')
      const id = `teste-cartao-${++serial}`, card = publicCardEvent(game, { ...value, id, teamId, playerName: player.nome }, now())
      if (!card) throw new Error('Neste teste, escolha cartão amarelo ou vermelho.')
      cards.set(id, { teamId, gameId: game.id, revision: 1, active: true })
      publish({ ...game, publicCardEvents: [...game.publicCardEvents, card] }); return id
    },
    async resolveDisciplinaryRecord({ teamId, recordId, status, reason, expectedRevision }) {
      const card = cards.get(recordId)
      if (!card || card.teamId !== teamId || !card.active || card.revision !== expectedRevision) throw new Error('O cartão de teste não está mais disponível.')
      if (status !== 'void' || String(reason || '').trim().length < 3) throw new Error('Informe o motivo da anulação.')
      const game = getGame(card.gameId)
      cards.set(recordId, { ...card, active: false, revision: card.revision + 1 })
      publish({ ...game, publicCardEvents: game.publicCardEvents.filter((item) => item.id !== recordId) })
    },
    async updateLiveScore(input) {
      const game = liveGame(input.gameId); checkScore(game, input.expectedScoreRevision)
      const [a, b] = validateSportScores(game, input.placarA, input.placarB)
      const partials = normalizeSetScores(input.setScores ?? game.setScores)
      const currentSet = input.currentSet && game.scoringMode === 'sets' ? normalizeSetScores([input.currentSet])[0] : game.currentSet
      const tieBreak = normalizeTieBreak(game, input.tieBreak, a, b)
      histories.set(game.id, [])
      publish({ ...game, liveScoreA: a, liveScoreB: b, currentSet, setScores: partials, tieBreak, liveEvents: [], scorerStats: [], eventsAdjusted: true, lastScoreEventId: null, scoreRevision: scoreRevision(game) + 1 })
    },
    async finalizeGame(input) {
      const game = liveGame(input.gameId); checkScore(game, input.expectedScoreRevision)
      const [a, b] = validateSportScores(game, input.placarA, input.placarB, { final: true })
      const partials = normalizeSetScores(input.setScores ?? game.setScores); validateFinalSets(game, a, b, partials)
      const tieBreak = normalizeTieBreak(game, input.tieBreak, a, b, { final: true })
      publish({ ...game, status: 'finalizado', liveStatus: 'finished', placarA: a, placarB: b, setScores: partials, tieBreak, clock: stoppedMatchClock(game, now()), endedAt: now() })
    },
  }
  reset()
  return {
    api, reset,
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    advance(gameId, seconds = 60) {
      const game = liveGame(gameId), value = matchClockValue(game, now())
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600 || game.period?.phase === 'interval') throw new Error('Avance de 1 a 3.600 segundos durante um período em andamento.')
      publish({ ...game, clock: { elapsedMs: value.elapsedMs + seconds * 1000, runningSince: value.running ? now() : null, revision: clockRevision(game) + 1 } })
    },
  }
}
