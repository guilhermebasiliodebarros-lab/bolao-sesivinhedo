import {
  collection,
  deleteDoc as firestoreDeleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction as firestoreRunTransaction,
  serverTimestamp,
  setDoc as firestoreSetDoc,
  Timestamp,
  updateDoc as firestoreUpdateDoc,
  where,
  writeBatch as firestoreWriteBatch,
} from 'firebase/firestore'
import { db } from './firebase.js'
import { watchGames, watchSnapshot as onSnapshot } from './realtime.js'
import { trackWrite } from './pendingWrites.js'
import { asNumberOrNull, toDate } from '../utils/format.js'
import { calcularPontuacao, hasFinalScore } from '../utils/scoring.js'
import { getMatchState, getMatchCondition, getMatchOutcome, isPredictionVoided, MATCH_STATE } from '../utils/match.js'
import { normalizeMatchReportInput } from '../utils/matchReport.js'
import { eventDate } from '../utils/tvSchedule.js'
import { clockRevision, matchClockValue, stoppedMatchClock } from '../utils/matchClock.js'
import { applyLiveEvent, scoreRevision } from '../utils/liveEvents.js'
import { normalizeRegulation } from '../utils/regulations.js'
import { buildScheduleRedistribution, scheduleFingerprint, schedulePlanFingerprint } from '../utils/tournamentSchedule.js'
import { getTeamShift, getGameShift, resolveCompetitionShifts, validateTeamShift, validateGameShift } from '../utils/schoolShifts.js'
import { SCHOOL_CLASSES_VERSION, schoolClassPlan, synchronizeSchoolClasses } from '../utils/schoolClasses.js'
import { normalizeTieBreak } from '../utils/tieBreak.js'
import { attendanceTeamKey, currentAttendance, normalizeAttendanceSide } from '../utils/attendance.js'
import { normalizeBroadcastSettings } from '../utils/automaticCalls.js'
import { isMatchPrepared, matchStartChecklist, preparationKey } from '../utils/matchStart.js'
import { normalizePlayerInput } from '../utils/player.js'
import { normalizeDisciplineInput } from '../utils/discipline.js'
import { sourceParticipant, thirdPlaceParticipants, thirdPlaceSemifinals } from '../utils/thirdPlace.js'
import { bracketScheduleConflicts } from '../utils/bracketSchedule.js'
import { automaticPredictionDeadline, predictionDeadlineInput } from '../utils/predictionDeadline.js'
import { calendarCandidate, calendarConflictSignature, calendarConflicts, calendarFingerprint } from '../utils/visualSchedule.js'
import { deletionFingerprint, validateDeletionSelection } from '../utils/bulkGameDeletion.js'
import { getSportProfile, normalizeMatchDetails, normalizeSetScores, validateFinalSets, validateSportScores } from '../utils/sportRules.js'

const runTransaction = (...args) => trackWrite(() => firestoreRunTransaction(...args))
const setDoc = (...args) => trackWrite(() => firestoreSetDoc(...args))
const updateDoc = (...args) => trackWrite(() => firestoreUpdateDoc(...args))
const deleteDoc = (...args) => trackWrite(() => firestoreDeleteDoc(...args))
const writeBatch = (...args) => {
  const batch = firestoreWriteBatch(...args)
  const commit = batch.commit.bind(batch)
  batch.commit = (...options) => trackWrite(() => commit(...options))
  return batch
}

export const GAME_STATUS = {
  OPEN: 'aberto',
  CLOSED: 'encerrado',
  FINISHED: 'finalizado',
}

export const STATUS_LABELS = {
  [GAME_STATUS.OPEN]: 'Aberto para palpites',
  [GAME_STATUS.CLOSED]: 'Palpites encerrados',
  [GAME_STATUS.FINISHED]: 'Finalizado',
}

const LEGACY_STATUS = {
  open: GAME_STATUS.OPEN,
  closed: GAME_STATUS.CLOSED,
  finished: GAME_STATUS.FINISHED,
}

function ensureDb() {
  if (!db) {
    throw new Error('Configure o Firebase para usar autenticação e Firestore.')
  }

  return db
}

function numberOrZero(value) {
  const parsed = asNumberOrNull(value)
  return parsed ?? 0
}

function normalizeRole(role) {
  if (role === 'master' || role === 'admin') {
    return 'master'
  }

  return 'user'
}

function normalizeStatus(status) {
  return LEGACY_STATUS[status] || status || GAME_STATUS.OPEN
}

function sortByDate(a, b) {
  const first = a?.dataHora?.toMillis?.() ?? new Date(a?.dataHora || 0).getTime()
  const second = b?.dataHora?.toMillis?.() ?? new Date(b?.dataHora || 0).getTime()

  return (Number.isFinite(first) ? first : 0) - (Number.isFinite(second) ? second : 0)
}

function sortByName(a, b) {
  return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
}

function getSportRankingKey(game) {
  const key = String(game?.sportId || game?.esporteNome || 'geral').trim() || 'geral'

  return key.replace(/[./[\]~*]/g, '-')
}

function getGroupSeedLabel(position, groupName) {
  return `${position}o ${groupName}`
}

export function calculateGroupStandings(games) {
  const standings = new Map()

  const ensureTeam = (teamName) => {
    if (!standings.has(teamName)) {
      standings.set(teamName, {
        nome: teamName,
        pontos: 0,
        jogos: 0,
        vitorias: 0,
        empates: 0,
        derrotas: 0,
        golsPro: 0,
        golsContra: 0,
        saldo: 0,
      })
    }

    return standings.get(teamName)
  }

  games.forEach((game) => {
    const teamA = ensureTeam(game.timeA)
    const teamB = ensureTeam(game.timeB)

    const outcome = getMatchOutcome(game)
    if (!outcome) {
      return
    }

    teamA.jogos += 1
    teamB.jogos += 1
    if (hasFinalScore(game)) {
      teamA.golsPro += game.placarA
      teamA.golsContra += game.placarB
      teamB.golsPro += game.placarB
      teamB.golsContra += game.placarA
    }

    if (outcome === 'A') {
      teamA.pontos += getSportProfile(game).winPoints
      teamB.pontos += getSportProfile(game).lossPoints
      teamA.vitorias += 1
      teamB.derrotas += 1
    } else if (outcome === 'B') {
      teamB.pontos += getSportProfile(game).winPoints
      teamA.pontos += getSportProfile(game).lossPoints
      teamB.vitorias += 1
      teamA.derrotas += 1
    } else {
      teamA.pontos += getSportProfile(game).drawPoints
      teamB.pontos += getSportProfile(game).drawPoints
      teamA.empates += 1
      teamB.empates += 1
    }

    teamA.saldo = teamA.golsPro - teamA.golsContra
    teamB.saldo = teamB.golsPro - teamB.golsContra
  })

  return [...standings.values()].sort((a, b) => {
    return (
      b.pontos - a.pontos ||
      b.vitorias - a.vitorias ||
      b.saldo - a.saldo ||
      b.golsPro - a.golsPro ||
      a.nome.localeCompare(b.nome, 'pt-BR')
    )
  })
}

export function getPredictionDeadline(game) {
  return automaticPredictionDeadline(game)
}

export function isPredictionDeadlineOpen(game, now = new Date()) {
  const deadline = toDate(getPredictionDeadline(game))

  if (Number.isNaN(deadline.getTime())) {
    return false
  }

  return now.getTime() < deadline.getTime()
}

export function canEditPrediction(game, now = new Date()) {
  return game?.status === GAME_STATUS.OPEN && !game.deletionPending && getMatchState(game) === MATCH_STATE.SCHEDULED && !game.startedAt && getMatchCondition(game) === 'normal' && isPredictionDeadlineOpen(game, now)
}

export function isRankingProfile(profile) {
  return profile?.role === 'user' && profile?.participaRanking === true
}

export function normalizeUserProfile(id, data = {}) {
  const role = normalizeRole(data.role)

  return {
    id,
    uid: data.uid || id,
    nome: data.nome || data.name || data.displayName || data.email || 'Participante',
    email: data.email || '',
    avatarUrl: data.avatarUrl || data.photoURL || data.fotoUrl || '',
    role,
    participaRanking: role === 'master' ? false : data.participaRanking !== false,
    pontos: numberOrZero(data.pontos ?? data.score),
    acertosExatos: numberOrZero(data.acertosExatos ?? data.exactHits),
    acertosResultado: numberOrZero(data.acertosResultado ?? data.resultHits),
    rankingPorEsporte: data.rankingPorEsporte || data.sportsRanking || {},
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  }
}

export function normalizeSport(id, data = {}) {
  return {
    id,
    nome: data.nome || data.name || 'Esporte',
    regulation: data.regulation || {},
    regulationRevision: data.regulationRevision || 0,
    regulationUpdatedAt: data.regulationUpdatedAt || null,
    ...getSportProfile({ ...data, nome: data.nome || data.name }),
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  }
}

export function normalizeTeam(id, data = {}) {
  return {
    id,
    sportId: data.sportId || data.esporteId || '',
    esporteNome: data.esporteNome || data.sportName || data.nomeEsporte || 'Geral',
    nome: data.nome || data.name || data.teamName || 'Time',
    turno: getTeamShift({ ...data, nome: data.nome || data.name || data.teamName }),
    categoria: data.categoria || data.category || '',
    turma: data.turma || '',
    playerCount: numberOrZero(data.playerCount),
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  }
}

export function normalizeGame(id, data = {}) {
  const limitePalpites = predictionDeadlineInput(data)

  return {
    id,
    sportId: data.sportId || data.esporteId || '',
    turno: getGameShift({ ...data, timeA: data.timeA || data.teamA, timeB: data.timeB || data.teamB }),
    esporteNome: data.esporteNome || data.sportName || data.nomeEsporte || 'Geral',
    fase: data.fase || data.phase || 'Fase única',
    rodada: data.rodada || data.round || '',
    timeA: data.timeA || data.teamA || '',
    timeB: data.timeB || data.teamB || '',
    dataHora: data.dataHora || data.dateTime || '',
    limitePalpites,
    placarA: asNumberOrNull(data.placarA ?? data.finalScoreA),
    placarB: asNumberOrNull(data.placarB ?? data.finalScoreB),
    status: normalizeStatus(data.status),
    deletionPending: data.deletionPending || null,
    deletionPreviousStatus: data.deletionPreviousStatus || null,
    ...getSportProfile({ ...data, esporteNome: data.esporteNome || data.sportName || data.nomeEsporte }),
    venue: data.venue || '',
    venueArea: data.venueArea || '',
    preparation: data.preparation || null,
    vestA: data.vestA || '',
    vestB: data.vestB || '',
    durationMinutes: Number(data.durationMinutes) || 30,
    teamIdA: data.teamIdA || '',
    teamIdB: data.teamIdB || '',
    turmaA: data.turmaA || '',
    turmaB: data.turmaB || '',
    setScores: Array.isArray(data.setScores) ? data.setScores : [],
    liveStatus: getMatchState({ status: normalizeStatus(data.status), liveStatus: data.liveStatus }),
    liveScoreA: asNumberOrNull(data.liveScoreA) ?? 0,
    liveScoreB: asNumberOrNull(data.liveScoreB) ?? 0,
    startedAt: data.startedAt || null,
    clock: data.clock || null,
    scoreRevision: Number(data.scoreRevision) || 0,
    currentSet: data.currentSet || null,
    liveEvents: Array.isArray(data.liveEvents) ? data.liveEvents : [],
    scorerStats: Array.isArray(data.scorerStats) ? data.scorerStats : [],
    lastScoreEventId: data.lastScoreEventId || null,
    eventsAdjusted: data.eventsAdjusted === true,
    endedAt: data.endedAt || null,
    tournamentId: data.tournamentId || '',
    tournamentName: data.tournamentName || data.nomeTorneio || '',
    groupName: data.groupName || '',
    stageType: data.stageType || '',
    sourceGameIdA: data.sourceGameIdA || '',
    sourceGameIdB: data.sourceGameIdB || '',
    sourceOutcomeA: data.sourceOutcomeA === 'loser' ? 'loser' : 'winner',
    sourceOutcomeB: data.sourceOutcomeB === 'loser' ? 'loser' : 'winner',
    placement: data.placement === 'third-place' ? 'third-place' : '',
    qualifierGroupA: data.qualifierGroupA || '',
    qualifierGroupB: data.qualifierGroupB || '',
    qualifierSeedA: data.qualifierSeedA || '',
    qualifierSeedB: data.qualifierSeedB || '',
    seedLabelA: data.seedLabelA || '',
    seedLabelB: data.seedLabelB || '',
    nextGameId: data.nextGameId || '',
    nextGameSlot: data.nextGameSlot || '',
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    finalizadoPor: data.finalizadoPor || data.finishedBy || null,
    matchCondition: getMatchCondition(data),
    conditionReason: data.conditionReason || '',
    conditionUpdatedAt: data.conditionUpdatedAt || null,
    conditionUpdatedBy: data.conditionUpdatedBy || null,
    walkoverWinner: data.walkoverWinner || '',
    previousDate: data.previousDate || null,
    tieBreak: data.tieBreak || null,
    requireAttendance: data.requireAttendance === true,
    attendanceSummary: data.attendanceSummary || null,
  }
}

export function normalizePrediction(id, data = {}) {
  return {
    id,
    userId: data.userId || '',
    gameId: data.gameId || '',
    nomeUsuario: data.nomeUsuario || data.userName || data.email || 'Participante',
    palpiteA: asNumberOrNull(data.palpiteA ?? data.guessA),
    palpiteB: asNumberOrNull(data.palpiteB ?? data.guessB),
    pontos: numberOrZero(data.pontos ?? data.points),
    acertoExato: Boolean(data.acertoExato ?? data.exactHit),
    acertoResultado: Boolean(data.acertoResultado ?? data.resultHit),
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  }
}

export function toFriendlyError(error) {
  if (!error?.code) {
    return error?.message || 'Não foi possível concluir a ação.'
  }

  const messages = {
    'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
    'auth/invalid-email': 'Informe um e-mail válido.',
    'auth/invalid-credential': 'E-mail ou senha inválidos.',
    'auth/user-not-found': 'E-mail ou senha inválidos.',
    'auth/wrong-password': 'E-mail ou senha inválidos.',
    'auth/weak-password': 'Use uma senha com pelo menos 6 caracteres.',
    'failed-precondition': 'Crie o índice solicitado pelo Firebase ou ajuste a consulta.',
    'permission-denied': 'Sem permissão para acessar estes dados.',
    unavailable: 'Sem conexão com o Firebase. Tente novamente em instantes.',
  }

  return messages[error.code] || error.message || 'Ocorreu um erro inesperado.'
}

function normalizeGameInput(game) {
  const sportId = String(game.sportId ?? game.esporteId ?? '').trim()
  const esporteNome = String(game.esporteNome ?? game.sportName ?? game.nomeEsporte ?? '').trim()
  const fase = String(game.fase ?? game.phase ?? '').trim()
  const rodada = String(game.rodada ?? game.round ?? '').trim()
  const timeA = String(game.timeA ?? game.teamA ?? '').trim()
  const timeB = String(game.timeB ?? game.teamB ?? '').trim()
  const dataHora = game.dataHora ?? game.dateTime ?? ''
  const suppliedDeadline = game.limitePalpites ?? game.predictionDeadline ?? ''
  const limitePalpites = automaticPredictionDeadline({ dataHora })
  const status = normalizeStatus(game.status)
  const placarA = asNumberOrNull(game.placarA ?? game.finalScoreA)
  const placarB = asNumberOrNull(game.placarB ?? game.finalScoreB)
  const gameDate = eventDate(dataHora)
  const deadlineDate = toDate(limitePalpites)
  const metadata = {
    tournamentId: String(game.tournamentId ?? '').trim(),
    tournamentName: String(game.tournamentName ?? game.nomeTorneio ?? '').trim(),
    groupName: String(game.groupName ?? '').trim(),
    stageType: String(game.stageType ?? '').trim(),
    sourceGameIdA: String(game.sourceGameIdA ?? '').trim(),
    sourceGameIdB: String(game.sourceGameIdB ?? '').trim(),
    sourceOutcomeA: game.sourceOutcomeA === 'loser' ? 'loser' : 'winner',
    sourceOutcomeB: game.sourceOutcomeB === 'loser' ? 'loser' : 'winner',
    placement: game.placement === 'third-place' ? 'third-place' : '',
    seedLabelA: String(game.seedLabelA ?? '').trim(),
    seedLabelB: String(game.seedLabelB ?? '').trim(),
    nextGameId: String(game.nextGameId ?? '').trim(),
    nextGameSlot: String(game.nextGameSlot ?? '').trim(),
  }
  const unscheduled = Boolean(metadata.tournamentId && !dataHora && !suppliedDeadline && status === GAME_STATUS.CLOSED && getMatchState(game) === MATCH_STATE.SCHEDULED && !game.startedAt && placarA === null && placarB === null)

  if (!sportId || !esporteNome) {
    throw new Error('Cadastre e selecione um esporte antes de criar o jogo.')
  }

  if (!fase) {
    throw new Error('Informe a fase do jogo.')
  }

  if (!timeA || !timeB || (!unscheduled && (!dataHora || !limitePalpites))) {
    throw new Error('Preencha os times, a data e o horário do jogo. O prazo dos palpites é automático.')
  }

  if (!unscheduled && Number.isNaN(gameDate.getTime())) {
    throw new Error('Informe uma data válida para o jogo.')
  }

  if (!unscheduled && Number.isNaN(deadlineDate.getTime())) {
    throw new Error('Informe uma data válida para o limite dos palpites.')
  }

  if (deadlineDate.getTime() > gameDate.getTime()) {
    throw new Error('O limite dos palpites não pode ser depois do horário do jogo.')
  }

  if (placarA !== null && placarB !== null) validateSportScores({ ...game, esporteNome }, placarA, placarB, { final: status === GAME_STATUS.FINISHED })

  if (status === GAME_STATUS.FINISHED && (placarA === null || placarB === null) && !(game.id && getMatchCondition(game) === 'walkover')) {
    throw new Error('Informe os dois placares finais para finalizar o jogo.')
  }

  return {
    sportId,
    esporteNome,
    turno: validateGameShift(game),
    fase,
    rodada,
    timeA,
    timeB,
    dataHora,
    limitePalpites: unscheduled ? null : Timestamp.fromDate(deadlineDate),
    placarA,
    placarB,
    status,
    ...getSportProfile({ ...game, esporteNome }),
    ...normalizeMatchDetails(game),
    ...metadata,
  }
}

function normalizeSportInput(sport) {
  const nome = String(sport?.nome ?? sport?.name ?? '').trim()

  if (!nome) {
    throw new Error('Informe o nome do esporte.')
  }

  return { nome, ...getSportProfile({ ...sport, nome }) }
}

function normalizeTeamInput(team) {
  const sportId = String(team?.sportId ?? team?.esporteId ?? '').trim()
  const esporteNome = String(team?.esporteNome ?? team?.sportName ?? '').trim()
  const nome = String(team?.nome ?? team?.name ?? '').trim()
  const categoria = String(team?.categoria ?? team?.category ?? '').trim()

  if (!sportId || !esporteNome) {
    throw new Error('Selecione o esporte antes de cadastrar o time.')
  }

  if (!nome) {
    throw new Error('Informe o nome do time.')
  }

  const turma = String(team?.turma || '').trim().slice(0, 80)
  return { sportId, esporteNome, nome, categoria, turma, turno: validateTeamShift({ ...team, nome, turma }) }
}

export async function createParticipantProfile(user, nome, avatarUrl = '') {
  const firestore = ensureDb()

  await setDoc(
    doc(firestore, 'users', user.uid),
    {
      uid: user.uid,
      nome: nome.trim(),
      email: user.email,
      avatarUrl: String(avatarUrl || '').trim(),
      role: 'user',
      pontos: 0,
      acertosExatos: 0,
      acertosResultado: 0,
      participaRanking: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function createMasterProfile(user, nome = 'Suporte') {
  const firestore = ensureDb()

  await setDoc(
    doc(firestore, 'users', user.uid),
    {
      uid: user.uid,
      nome: nome.trim(),
      email: user.email,
      role: 'master',
      pontos: 0,
      acertosExatos: 0,
      acertosResultado: 0,
      participaRanking: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function getUserProfile(userId) {
  if (!db || !userId) {
    return null
  }

  const snapshot = await getDoc(doc(db, 'users', userId))
  return snapshot.exists() ? normalizeUserProfile(snapshot.id, snapshot.data()) : null
}

export function subscribeUserProfile(userId, onData, onError) {
  if (!db || !userId) {
    onData(null)
    return () => {}
  }

  return onSnapshot(
    doc(db, 'users', userId),
    (snapshot) => {
      onData(snapshot.exists() ? normalizeUserProfile(snapshot.id, snapshot.data()) : null)
    },
    (error) => onError?.(error ? toFriendlyError(error) : ''),
  )
}

export function subscribeGames(onData, onError, onSync) {
  if (!db) {
    onData([])
    return () => {}
  }

  return watchGames(
    collection(db, 'games'),
    (snapshot) => {
      const games = resolveCompetitionShifts(snapshot.docs.map((item) => normalizeGame(item.id, item.data()))).sort(sortByDate)

      onData(games)
    },
    (error) => onError?.(error ? toFriendlyError(error) : ''),
    onSync,
  )
}

export function subscribeSports(onData, onError) {
  if (!db) {
    onData([])
    return () => {}
  }

  return onSnapshot(
    collection(db, 'sports'),
    (snapshot) => {
      onData(snapshot.docs.map((item) => normalizeSport(item.id, item.data())).sort(sortByName))
    },
    (error) => onError?.(error ? toFriendlyError(error) : ''),
  )
}

export function subscribeTeams(onData, onError) {
  if (!db) {
    onData([])
    return () => {}
  }

  return onSnapshot(
    collection(db, 'teams'),
    (snapshot) => {
      onData(snapshot.docs.map((item) => normalizeTeam(item.id, item.data())).sort(sortByName))
    },
    (error) => onError?.(error ? toFriendlyError(error) : ''),
  )
}

export function subscribeUserPredictions(userId, onData, onError, onSync) {
  if (!db || !userId) {
    onData([])
    return () => {}
  }

  return onSnapshot(
    query(collection(db, 'predictions'), where('userId', '==', userId)),
    (snapshot) => {
      onData(snapshot.docs.map((item) => normalizePrediction(item.id, item.data())))
    },
    (error) => onError?.(error ? toFriendlyError(error) : ''),
    onSync,
  )
}

export function subscribeAllPredictions(onData, onError) {
  if (!db) {
    onData([])
    return () => {}
  }

  return onSnapshot(
    collection(db, 'predictions'),
    (snapshot) => {
      onData(snapshot.docs.map((item) => normalizePrediction(item.id, item.data())))
    },
    (error) => onError?.(error ? toFriendlyError(error) : ''),
  )
}

export function subscribeParticipants(onData, onError) {
  if (!db) {
    onData([])
    return () => {}
  }

  return onSnapshot(
    collection(db, 'users'),
    (snapshot) => {
      const users = snapshot.docs
        .map((item) => normalizeUserProfile(item.id, item.data()))
        .filter(isRankingProfile)
        .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))

      onData(users)
    },
    (error) => onError?.(error ? toFriendlyError(error) : ''),
  )
}

export function sortRanking(users) {
  return [...users].sort((a, b) => {
    const pointsDiff = (b.pontos || 0) - (a.pontos || 0)
    const exactDiff = (b.acertosExatos || 0) - (a.acertosExatos || 0)
    const resultDiff = (b.acertosResultado || 0) - (a.acertosResultado || 0)

    return pointsDiff || exactDiff || resultDiff || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
  })
}

export function subscribeRanking(onData, onError) {
  if (!db) {
    onData([])
    return () => {}
  }

  return onSnapshot(
    collection(db, 'users'),
    (snapshot) => {
      const ranking = sortRanking(
        snapshot.docs.map((item) => normalizeUserProfile(item.id, item.data())).filter(isRankingProfile),
      )

      onData(ranking)
    },
    (error) => onError?.(error ? toFriendlyError(error) : ''),
  )
}

async function validateShiftForSavedGames(firestore, games) {
  const candidates = await getDocs(collection(firestore, 'teams'))
  const teams = candidates.docs.map((team) => normalizeTeam(team.id, team.data()))
  const competitions = new Map()
  const prepared = games.map((game) => {
    const turno = validateGameShift(game, teams)
    if (!turno && !game.id) throw new Error('Selecione o turno da partida antes de salvar.')
    if (game.tournamentId && turno) {
      const previous = competitions.get(game.tournamentId)
      if (previous && previous !== turno) throw new Error('Crie torneios separados para manhã e tarde.')
      competitions.set(game.tournamentId, turno)
    }
    return { ...game, turno }
  })
  for (const [id, turno] of competitions) {
    const existing = await getDocs(query(collection(firestore, 'games'), where('tournamentId', '==', id)))
    if (existing.docs.some((doc) => { const current = getGameShift(doc.data(), teams); return current && current !== turno })) throw new Error('Este torneio pertence a outro turno. Crie um torneio separado para manhã ou tarde.')
  }
  return prepared
}

export async function saveGame(game) {
  const firestore = ensureDb()
  const [prepared] = await validateShiftForSavedGames(firestore, [game])
  const payload = normalizeGameInput(prepared)

  if (game.id) {
    const gameRef = doc(firestore, 'games', game.id)
    await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(gameRef)
      if (!snapshot.exists()) throw new Error('Jogo não encontrado.')
      const current = normalizeGame(snapshot.id, snapshot.data())
      if (current.deletionPending) throw new Error('Esta partida está em exclusão. Aguarde a conclusão antes de editar.')
      transaction.update(gameRef, {
        ...payload,
        ...(getMatchState(current) !== MATCH_STATE.SCHEDULED ? getSportProfile(current) : {}),
        status: current.status,
        placarA: current.placarA,
        placarB: current.placarB,
        updatedAt: serverTimestamp(),
      })
    })
  } else {
    const gameRef = doc(collection(firestore, 'games'))

    await setDoc(gameRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  await recalculateScores()
}

export async function redistributeTournamentSchedule({ tournamentId, expectedGames, expectedPlan }) {
  if (!tournamentId || !Array.isArray(expectedGames) || !expectedGames.length || expectedGames.length > 450) throw new Error('Selecione um torneio com até 450 partidas para reorganizar.')
  const firestore = ensureDb()
  const current = await getDocs(query(collection(firestore, 'games'), where('tournamentId', '==', tournamentId)))
  if (current.size !== expectedGames.length || current.docs.some((game) => !expectedGames.some((expected) => expected.id === game.id))) throw new Error('A lista de jogos mudou. Reabra a prévia da reorganização.')
  return runTransaction(firestore, async (transaction) => {
    const snapshots = await Promise.all(current.docs.map((game) => transaction.get(game.ref)))
    const games = resolveCompetitionShifts(snapshots.map((snapshot) => {
      if (!snapshot.exists()) throw new Error('Um jogo foi removido. Reabra a prévia.')
      return normalizeGame(snapshot.id, snapshot.data())
    }))
    games.forEach((game) => {
      if (scheduleFingerprint(game) !== expectedGames.find((expected) => expected.id === game.id)?.fingerprint) throw new Error('Os dados de uma partida mudaram. Reabra a prévia antes de aplicar a nova ordem.')
    })
    const plan = buildScheduleRedistribution(games, new Date())
    if (expectedPlan && expectedPlan !== schedulePlanFingerprint(plan)) throw new Error('Os horários disponíveis mudaram. Reabra a prévia antes de aplicar a nova ordem.')
    for (const scheduled of plan.after) {
      const change = plan.changes.find((item) => item.id === scheduled.id)
      const stored = snapshots.find((item) => item.id === scheduled.id).data()
      const deadline = automaticPredictionDeadline(scheduled)
      if (change || toDate(stored.limitePalpites).getTime() !== deadline.getTime()) {
        transaction.update(doc(firestore, 'games', scheduled.id), { ...(change ? { dataHora: change.dataHora, preparation: null } : {}), limitePalpites: Timestamp.fromDate(deadline), updatedAt: serverTimestamp() })
      }
    }
    return plan.changes.length
  })
}

export async function saveGames(games, { checkSchedule = false, restMinutes = 0 } = {}) {
  const firestore = ensureDb()
  const prepared = await validateShiftForSavedGames(firestore, games)
  if (prepared.some((game) => !game.turno)) throw new Error('Selecione Manhã ou Tarde para gerar as partidas.')
  const normalizedGames = prepared.map((game) => ({
    id: String(game?.id ?? '').trim(),
    payload: normalizeGameInput(game),
  }))

  if (!normalizedGames.length) {
    throw new Error('Gere pelo menos um jogo antes de salvar.')
  }

  if (normalizedGames.length > 450) {
    throw new Error('Gere no maximo 450 jogos por vez para respeitar o limite do Firebase.')
  }

  if (checkSchedule) {
    const [currentGames, currentTeams] = await Promise.all([getDocs(collection(firestore, 'games')), getDocs(collection(firestore, 'teams'))])
    const existing = currentGames.docs.map((item) => normalizeGame(item.id, item.data()))
    if (normalizedGames.some((game) => !game.id || existing.some((item) => item.id === game.id))) throw new Error('A prévia contém uma partida já cadastrada. Gere novamente o chaveamento.')
    const planned = normalizedGames.map((game) => ({ ...game.payload, id: game.id }))
    if (planned.some((game) => game.dataHora) && bracketScheduleConflicts(planned, existing, currentTeams.docs.map((item) => normalizeTeam(item.id, item.data())), restMinutes).length) throw new Error('A programação mudou ou ainda há choque de horários. Confira a prévia atualizada antes de salvar o chaveamento.')
  }

  const batch = writeBatch(firestore)

  normalizedGames.forEach((game) => {
    const gameRef = game.id ? doc(firestore, 'games', game.id) : doc(collection(firestore, 'games'))

    batch.set(gameRef, {
      ...game.payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })

  await batch.commit()
  await recalculateScores()
}

export async function ensureAutomaticPredictionDeadlines() {
  const firestore = ensureDb()
  const needsUpdate = (data) => {
    const deadline = automaticPredictionDeadline(data)
    const stored = data.limitePalpites
    return deadline && !data.deletionPending && getMatchState(data) === MATCH_STATE.SCHEDULED && getMatchCondition(data) === 'normal' && !data.startedAt
      && (!(stored instanceof Date || typeof stored?.toDate === 'function') || toDate(stored).getTime() !== deadline.getTime())
  }
  const snapshots = await getDocs(collection(firestore, 'games'))
  const candidates = snapshots.docs.filter((snapshot) => needsUpdate(snapshot.data()))
  let updated = 0
  for (let index = 0; index < candidates.length; index += 10) {
    const results = await Promise.all(candidates.slice(index, index + 10).map((candidate) => runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(candidate.ref)
      if (!snapshot.exists() || !needsUpdate(snapshot.data())) return false
      transaction.update(candidate.ref, { limitePalpites: Timestamp.fromDate(automaticPredictionDeadline(snapshot.data())), updatedAt: serverTimestamp() })
      return true
    })))
    updated += results.filter(Boolean).length
  }
  return { updated }
}

export async function saveCalendarGame({ gameId, expectedFingerprint, change, acceptedConflicts = '' }) {
  const firestore = ensureDb()
  const [current, roster] = await Promise.all([getDocs(collection(firestore, 'games')), getDocs(collection(firestore, 'teams'))])
  if (!current.docs.some((item) => item.id === gameId)) throw new Error('Esta partida foi removida. Reabra a agenda.')
  const teams = roster.docs.map((item) => normalizeTeam(item.id, item.data()))
  return runTransaction(firestore, async (transaction) => {
    const snapshots = await Promise.all(current.docs.map((item) => transaction.get(item.ref)))
    const games = snapshots.filter((item) => item.exists()).map((item) => normalizeGame(item.id, item.data()))
    const game = games.find((item) => item.id === gameId)
    if (!game || calendarFingerprint(game) !== expectedFingerprint) throw new Error('Esta partida mudou. Feche a edição e abra novamente para conferir a agenda atual.')
    const candidate = calendarCandidate(game, change)
    const conflicts = calendarConflicts(candidate, games, teams)
    if (conflicts.length && calendarConflictSignature(conflicts) !== acceptedConflicts) throw new Error('Há conflitos na agenda atual. Confira os avisos e confirme novamente antes de salvar.')
    transaction.update(doc(firestore, 'games', gameId), {
      dataHora: candidate.dataHora, venue: candidate.venue, venueArea: candidate.venueArea, durationMinutes: candidate.durationMinutes,
      limitePalpites: Timestamp.fromDate(automaticPredictionDeadline(candidate)), preparation: null, updatedAt: serverTimestamp(),
    })
    return { conflicts: conflicts.length }
  })
}

export async function deleteGamesBulk({ expectedGames, includePredictions = false }) {
  const firestore = ensureDb()
  if (!Array.isArray(expectedGames) || !expectedGames.length || new Set(expectedGames.map((game) => game.id)).size !== expectedGames.length) throw new Error('Confira os jogos selecionados antes de excluir.')
  const current = await getDocs(collection(firestore, 'games'))
  const games = current.docs.map((item) => normalizeGame(item.id, item.data()))
  const selected = expectedGames.map((expected) => {
    const game = games.find((item) => item.id === expected.id)
    if (!game || deletionFingerprint(game) !== expected.fingerprint) throw new Error('A seleção mudou. Reabra a exclusão e confira os jogos novamente.')
    return game
  })
  validateDeletionSelection(selected, games)
  const predictions = await getDocs(collection(firestore, 'predictions'))
  const ids = new Set(selected.map((game) => game.id))
  if (!includePredictions && predictions.docs.some((item) => ids.has(item.data().gameId))) throw new Error('A seleção tem palpites. Confirme também a exclusão dos palpites vinculados.')
  const operation = doc(collection(firestore, 'operations'))
  await setDoc(operation, { type: 'bulk-game-deletion', gameIds: [...ids], status: 'running', deletedCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  let deleted = 0
  try {
    // Close betting first so a concurrent prediction cannot become an orphan.
    for (let index = 0; index < selected.length; index += 100) {
      await runTransaction(firestore, async (transaction) => {
        const snapshots = await Promise.all(selected.slice(index, index + 100).map((game) => transaction.get(doc(firestore, 'games', game.id))))
        snapshots.forEach((snapshot) => {
          const expected = expectedGames.find((item) => item.id === snapshot.id)
          if (!snapshot.exists() || deletionFingerprint(normalizeGame(snapshot.id, snapshot.data())) !== expected.fingerprint || getMatchState(snapshot.data()) === MATCH_STATE.LIVE) throw new Error('Uma partida mudou antes da exclusão. Confira a seleção novamente.')
        })
        snapshots.forEach((snapshot) => transaction.update(snapshot.ref, { deletionPending: operation.id, deletionPreviousStatus: snapshot.data().deletionPreviousStatus || normalizeStatus(snapshot.data().status), status: GAME_STATUS.CLOSED, updatedAt: serverTimestamp() }))
      })
    }
    for (let index = 0; index < selected.length; index += 20) {
      const chunk = selected.slice(index, index + 20)
      const nested = await Promise.all(chunk.flatMap((game) => [getDocs(collection(firestore, 'games', game.id, 'events')), getDocs(collection(firestore, 'games', game.id, 'documents')), getDocs(query(collection(firestore, 'predictions'), where('gameId', '==', game.id)))]))
      const children = nested.flatMap((snapshot) => snapshot.docs)
      if (!includePredictions && children.some((item) => item.ref.path?.startsWith('predictions/'))) throw new Error('Surgiram palpites na seleção. Confirme novamente a exclusão com os palpites vinculados.')
      for (let offset = 0; offset < children.length; offset += 400) {
        const batch = writeBatch(firestore)
        children.slice(offset, offset + 400).forEach((item) => batch.delete(item.ref))
        await batch.commit()
      }
      const count = await runTransaction(firestore, async (transaction) => {
        const snapshots = await Promise.all(chunk.map((game) => transaction.get(doc(firestore, 'games', game.id))))
        const remaining = snapshots.filter((item) => item.exists())
        if (remaining.some((item) => item.data().deletionPending !== operation.id)) throw new Error('A exclusão foi retomada em outra sessão. Atualize a lista antes de continuar.')
        remaining.forEach((item) => transaction.delete(item.ref))
        return remaining.length
      })
      deleted += count
      await updateDoc(operation, { deletedCount: deleted, updatedAt: serverTimestamp() })
    }
    await recalculateScores()
    await updateDoc(operation, { status: 'complete', deletedCount: deleted, updatedAt: serverTimestamp() })
    return { deleted }
  } catch (error) {
    // Restore betting state on any remaining records that this operation owns.
    try {
      for (let index = 0; index < selected.length; index += 100) {
        await runTransaction(firestore, async (transaction) => {
          const snapshots = await Promise.all(selected.slice(index, index + 100).map((game) => transaction.get(doc(firestore, 'games', game.id))))
          snapshots.filter((item) => item.exists() && item.data().deletionPending === operation.id).forEach((item) => transaction.update(item.ref, { status: item.data().deletionPreviousStatus || GAME_STATUS.CLOSED, deletionPending: null, deletionPreviousStatus: null, updatedAt: serverTimestamp() }))
        })
      }
      await recalculateScores()
      await updateDoc(operation, { status: 'failed', deletedCount: deleted, updatedAt: serverTimestamp() })
    } catch { /* A subsequent attempt can resume records left pending by a connection failure. */ }
    throw new Error(`${deleted} jogo(s) excluído(s). ${error.message} Os jogos restantes continuam na lista; confira a seleção para tentar novamente.`, { cause: error })
  }
}

export async function saveSport(sport) {
  const firestore = ensureDb()
  const payload = normalizeSportInput(sport)

  if (sport.id) {
    const batch = writeBatch(firestore)
    const relatedGamesSnapshot = await getDocs(query(collection(firestore, 'games'), where('sportId', '==', sport.id)))

    batch.update(doc(firestore, 'sports', sport.id), {
      ...payload,
      updatedAt: serverTimestamp(),
    })

    relatedGamesSnapshot.forEach((gameDoc) => {
      batch.update(gameDoc.ref, {
        esporteNome: payload.nome,
        ...(getMatchState(gameDoc.data()) === MATCH_STATE.SCHEDULED ? getSportProfile(payload) : {}),
        updatedAt: serverTimestamp(),
      })
    })

    await batch.commit()
  } else {
    const sportRef = doc(collection(firestore, 'sports'))
    const batch = writeBatch(firestore)
    batch.set(sportRef, {
      ...payload,
      schoolClassesVersion: SCHOOL_CLASSES_VERSION,
      schoolClassesSeededAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    schoolClassPlan({ id: sportRef.id, ...payload }).forEach((item) => {
      batch.set(doc(firestore, 'teams', item.id), { ...item.data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    })
    await batch.commit()
  }
}

export async function ensureSchoolClassTeams() {
  const firestore = ensureDb()
  return synchronizeSchoolClasses({
    list: async (name) => (await getDocs(collection(firestore, name))).docs.map((item) => ({ ...item.data(), id: item.id })),
    timestamp: serverTimestamp,
    runTransaction: (action) => runTransaction(firestore, (transaction) => action({
      get: async (path) => { const item = await transaction.get(doc(firestore, path)); return item.exists() ? { ...item.data(), id: item.id } : null },
      create: (path, data) => transaction.set(doc(firestore, path), data),
      update: (path, data) => transaction.update(doc(firestore, path), data),
    })),
  })
}

export async function saveSportRegulation(sportId, value, expectedRevision) {
  const regulation = normalizeRegulation(value)
  const firestore = ensureDb()
  const ref = doc(firestore, 'sports', sportId)
  return runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) throw new Error('Modalidade não encontrada.')
    const revision = Number(snapshot.data().regulationRevision) || 0
    if (expectedRevision !== revision) throw new Error('Outro responsável alterou o regulamento. Recarregue os dados salvos antes de publicar.')
    transaction.update(ref, { regulation, regulationRevision: revision + 1, regulationUpdatedAt: serverTimestamp(), updatedAt: serverTimestamp() })
    return revision + 1
  })
}

export async function saveTeam(team) {
  const firestore = ensureDb()
  const payload = normalizeTeamInput(team)

  if (team.id) {
    const previous = await getDoc(doc(firestore, 'teams', team.id))
    const previousName = previous.exists() ? previous.data().nome : ''
    const existing = await getDocs(query(collection(firestore, 'games'), where('sportId', '==', payload.sportId)))
    if (existing.docs.some((item) => { const match = item.data(); const linked = ['A', 'B'].some((side) => match[`teamId${side}`] === team.id || [previousName, payload.nome].includes(match[`time${side}`])); const turno = getGameShift(match); return linked && turno && turno !== payload.turno })) throw new Error('Esta equipe já tem jogos em outro turno. Cadastre uma equipe separada para o novo turno.')
    await updateDoc(doc(firestore, 'teams', team.id), {
      ...payload,
      updatedAt: serverTimestamp(),
    })
  } else {
    const teamRef = doc(collection(firestore, 'teams'))

    await setDoc(teamRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
}

export async function deleteTeam(teamId) {
  const firestore = ensureDb()
  const players = await getDocs(collection(firestore, 'teams', teamId, 'players'))
  for (let offset = 0; offset < players.docs.length; offset += 450) {
    const batch = writeBatch(firestore)
    players.docs.slice(offset, offset + 450).forEach((player) => batch.delete(player.ref))
    await batch.commit()
  }
  await deleteDoc(doc(firestore, 'teams', teamId))
}

export function subscribePlayers(teamId, onData, onError) {
  const firestore = ensureDb()
  return onSnapshot(collection(firestore, 'teams', teamId, 'players'), (snapshot) => {
    onData(snapshot.docs.map((item) => ({ ...item.data(), id: item.id })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
  }, (error) => onError?.(error ? toFriendlyError(error) : ''))
}

function teamDisciplineQuery(firestore, teamId) {
  return query(collection(firestore, 'operations'), where('recordKind', '==', 'discipline'), where('teamId', '==', teamId))
}

export function subscribeTeamDiscipline(teamId, onData, onError) {
  return onSnapshot(teamDisciplineQuery(ensureDb(), teamId), (snapshot) => {
    onData(snapshot.docs.map((item) => ({ ...item.data(), id: item.id })).sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0)))
  }, (error) => onError?.(error ? toFriendlyError(error) : ''))
}

export async function saveDisciplinaryRecord(teamId, value, user) {
  if (!teamId) throw new Error('Selecione uma equipe.')
  const payload = normalizeDisciplineInput(value)
  const firestore = ensureDb()
  const teamRef = doc(firestore, 'teams', teamId)
  const recordRef = doc(collection(firestore, 'operations'))
  await runTransaction(firestore, async (transaction) => {
    const [team, player, match] = await Promise.all([
      transaction.get(teamRef), transaction.get(doc(firestore, 'teams', teamId, 'players', payload.playerId)),
      payload.gameId ? transaction.get(doc(firestore, 'games', payload.gameId)) : null,
    ])
    if (!team.exists() || !player.exists()) throw new Error('A equipe ou o atleta não está mais cadastrado. Atualize a lista.')
    const teamData = team.data()
    const game = match?.exists() ? normalizeGame(match.id, match.data()) : null
    if (payload.gameId && (!game || game.sportId !== teamData.sportId || (game.turno && getTeamShift(teamData) && game.turno !== getTeamShift(teamData)) || !['A', 'B'].some((side) => game[`teamId${side}`] ? game[`teamId${side}`] === teamId : game[`time${side}`] === teamData.nome))) throw new Error('A partida precisa pertencer à equipe e à modalidade selecionadas.')
    if (payload.scope === 'tournament' && !game?.tournamentId) throw new Error('Escolha uma partida vinculada a um torneio.')
    transaction.set(recordRef, { ...payload, recordKind: 'discipline', teamId, playerName: player.data().nome, sportId: teamData.sportId, turno: getTeamShift(teamData), tournamentId: game?.tournamentId || '', tournamentName: game?.tournamentName || '', matchLabel: game ? `${game.timeA} × ${game.timeB} · ${game.fase}` : '', status: 'active', revision: 1, createdAt: serverTimestamp(), createdBy: user?.uid || null })
    transaction.update(teamRef, { disciplineRevision: (Number(teamData.disciplineRevision) || 0) + 1 })
  })
  return recordRef.id
}

export async function resolveDisciplinaryRecord({ teamId, recordId, status, reason, expectedRevision, user }) {
  const note = String(reason || '').trim()
  if (!teamId || !recordId || !['served', 'void'].includes(status) || note.length < 3 || note.length > 1000) throw new Error('Informe a situação e um motivo de 3 a 1.000 caracteres.')
  const firestore = ensureDb()
  const teamRef = doc(firestore, 'teams', teamId), recordRef = doc(firestore, 'operations', recordId)
  await runTransaction(firestore, async (transaction) => {
    const [team, record] = await Promise.all([transaction.get(teamRef), transaction.get(recordRef)])
    if (!team.exists() || !record.exists()) throw new Error('A ocorrência ou a equipe não existe mais.')
    const current = record.data()
    if (current.recordKind !== 'discipline' || current.teamId !== teamId) throw new Error('A ocorrência não pertence à equipe selecionada.')
    if (current.status !== 'active' || current.revision !== expectedRevision) throw new Error('A ocorrência mudou. Confira a lista atualizada.')
    if (status === 'served' && current.type !== 'suspension') throw new Error('Somente uma suspensão pode ser marcada como cumprida.')
    transaction.update(recordRef, { status, revision: current.revision + 1, resolvedReason: note, resolvedAt: serverTimestamp(), resolvedBy: user?.uid || null })
    transaction.update(teamRef, { disciplineRevision: (Number(team.data().disciplineRevision) || 0) + 1 })
  })
}

export async function savePlayer(teamId, player) {
  if (!teamId) throw new Error('Selecione uma equipe para cadastrar jogadores.')
  const firestore = ensureDb()
  const payload = normalizePlayerInput(player)
  const teamRef = doc(firestore, 'teams', teamId)
  const playerRef = player.id
    ? doc(firestore, 'teams', teamId, 'players', player.id)
    : doc(collection(firestore, 'teams', teamId, 'players'))
  await runTransaction(firestore, async (transaction) => {
    const team = await transaction.get(teamRef)
    if (!team.exists()) throw new Error('Esta equipe não existe mais.')
    if (player.id) {
      const current = await transaction.get(playerRef)
      if (!current.exists()) throw new Error('Este jogador não está mais cadastrado na equipe.')
      transaction.update(playerRef, { ...payload, updatedAt: serverTimestamp() })
    } else {
      transaction.set(playerRef, { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      transaction.update(teamRef, { playerCount: numberOrZero(team.data().playerCount) + 1, updatedAt: serverTimestamp() })
    }
  })
}

export async function importPlayers(teamId, candidates) {
  if (!teamId) throw new Error('Selecione uma equipe.')
  if (!Array.isArray(candidates) || !candidates.length || candidates.length > 200) throw new Error('Importe entre 1 e 200 jogadores por vez.')
  const payloads = candidates.map(normalizePlayerInput)
  const firestore = ensureDb()
  const teamRef = doc(firestore, 'teams', teamId)
  const key = (name) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()
  return runTransaction(firestore, async (transaction) => {
    const team = await transaction.get(teamRef)
    if (!team.exists()) throw new Error('Esta equipe não existe mais.')
    const existing = await getDocs(collection(firestore, 'teams', teamId, 'players'))
    const names = new Set(existing.docs.map((player) => key(player.data().nome)))
    let added = 0
    payloads.forEach((player) => {
      if (names.has(key(player.nome))) return
      names.add(key(player.nome))
      transaction.set(doc(collection(firestore, 'teams', teamId, 'players')), { ...player, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      added += 1
    })
    if (added) transaction.update(teamRef, { playerCount: numberOrZero(team.data().playerCount) + added, updatedAt: serverTimestamp() })
    return { added, skipped: payloads.length - added }
  })
}

export function subscribeAnnouncements(onData, onError, includeInactive = false) {
  const firestore = ensureDb()
  const source = includeInactive ? collection(firestore, 'announcements') : query(collection(firestore, 'announcements'), where('active', '==', true))
  return onSnapshot(source, (snapshot) => onData(snapshot.docs.map((item) => ({ ...item.data(), id: item.id })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))), (error) => onError?.(error ? toFriendlyError(error) : ''))
}

export function subscribeBroadcastSettings(onData, onError) {
  return onSnapshot(doc(ensureDb(), 'broadcastSettings', 'tv'), (snapshot) => onData(normalizeBroadcastSettings(snapshot.exists() ? snapshot.data() : {})), (error) => onError?.(error ? toFriendlyError(error) : ''))
}

export async function saveBroadcastSettings(value) {
  if (typeof value.autoCallsEnabled !== 'boolean' || ![5, 10, 15, 20, 30].includes(Number(value.leadMinutes))) throw new Error('Escolha uma antecedência válida para as chamadas automáticas.')
  await setDoc(doc(ensureDb(), 'broadcastSettings', 'tv'), { ...normalizeBroadcastSettings(value), updatedAt: serverTimestamp() })
}

export async function saveAnnouncement({ text, type = 'aviso', minutes = 60 }) {
  const firestore = ensureDb()
  const message = String(text || '').trim()
  if (!message || message.length > 240) throw new Error('Escreva um aviso de até 240 caracteres.')
  if (!['aviso', 'chamada', 'atraso'].includes(type)) throw new Error('Tipo de aviso inválido.')
  const duration = Number(minutes)
  if (!Number.isInteger(duration) || duration < 1 || duration > 1440) throw new Error('Escolha uma validade de 1 a 1440 minutos.')
  await setDoc(doc(collection(firestore, 'announcements')), { text: message, type, active: true, expiresAt: Timestamp.fromDate(new Date(Date.now() + duration * 60000)), createdAt: serverTimestamp() })
}

export async function setAnnouncementActive(id, active) { await updateDoc(doc(ensureDb(), 'announcements', id), { active: Boolean(active) }) }
export async function deleteAnnouncement(id) { await deleteDoc(doc(ensureDb(), 'announcements', id)) }

async function matchProfile(transaction, firestore, game, refresh = false) {
  if (game.scoringMode && !refresh) return getSportProfile(game)
  const sport = game.sportId ? await transaction.get(doc(firestore, 'sports', game.sportId)) : null
  return getSportProfile({ ...game, ...(sport?.exists() ? sport.data() : {}) })
}

async function loadProgressionRefs(firestore, gameId) {
  const source = await getDoc(doc(firestore, 'games', gameId))
  if (!source.exists()) throw new Error('Jogo não encontrado.')
  const game = source.data()
  if (game.deletionPending) throw new Error('Esta partida está em exclusão. Aguarde a conclusão.')
  const results = await Promise.all([
    getDocs(query(collection(firestore, 'games'), where('sourceGameIdA', '==', gameId))),
    getDocs(query(collection(firestore, 'games'), where('sourceGameIdB', '==', gameId))),
    ...(game.stageType === 'group' && game.tournamentId ? [getDocs(query(collection(firestore, 'games'), where('tournamentId', '==', game.tournamentId)))] : []),
  ])
  return [...new Map(results.flatMap((result) => result.docs).filter((item) => item.id !== gameId && (item.data().stageType !== 'group')).map((item) => [item.id, item.ref])).values()]
}

async function readProgressionGames(transaction, refs) {
  const games = (await Promise.all(refs.map((ref) => transaction.get(ref)))).filter((item) => item.exists())
  if (games.some((item) => [MATCH_STATE.LIVE, MATCH_STATE.FINISHED].includes(getMatchState(item.data())))) throw new Error('A próxima fase já começou. Corrija primeiro as partidas seguintes antes de alterar este resultado.')
  return games
}

export async function changeMatchCondition({ gameId, action, reason, winnerSide, placarA, placarB, dataHora, reopenPredictions = false, user }) {
  if (!['postpone', 'cancel', 'walkover', 'reschedule'].includes(action)) throw new Error('Selecione uma situação válida.')
  const message = String(reason || '').trim()
  if (message.length < 3 || message.length > 500) throw new Error('Informe um motivo de 3 a 500 caracteres.')
  const firestore = ensureDb()
  const gameRef = doc(firestore, 'games', gameId)
  const refs = action === 'walkover' ? await loadProgressionRefs(firestore, gameId) : []
  const updated = await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(gameRef)
    if (snapshot.exists() && snapshot.data().deletionPending) throw new Error('Esta partida está em exclusão. Aguarde a conclusão.')
    if (!snapshot.exists()) throw new Error('Jogo não encontrado.')
    const raw = snapshot.data()
    const game = normalizeGame(snapshot.id, raw)
    if (game.status === GAME_STATUS.FINISHED) throw new Error('Reabra o resultado antes de alterar a situação de uma partida finalizada.')
    const fields = { conditionReason: message, conditionUpdatedAt: serverTimestamp(), conditionUpdatedBy: user?.uid || null, preparation: null, updatedAt: serverTimestamp() }
    if (action === 'reschedule') {
      if (!['postponed', 'cancelled'].includes(getMatchCondition(game))) throw new Error('Somente partidas adiadas ou canceladas podem ser reagendadas aqui.')
      const date = eventDate(dataHora)
      const deadline = automaticPredictionDeadline({ dataHora })
      if (!dataHora || !Number.isFinite(date.getTime()) || !deadline) throw new Error('Informe um novo horário válido para o jogo.')
      if (reopenPredictions && game.startedAt) throw new Error('Uma partida que já começou não pode reabrir os palpites.')
      Object.assign(fields, { matchCondition: 'normal', liveStatus: MATCH_STATE.SCHEDULED, status: reopenPredictions ? GAME_STATUS.OPEN : GAME_STATUS.CLOSED, dataHora, limitePalpites: Timestamp.fromDate(deadline), previousDate: game.previousDate || game.dataHora, walkoverWinner: '' })
    } else if (action === 'walkover') {
      if (!['A', 'B'].includes(winnerSide)) throw new Error('Selecione a equipe vencedora do W.O.')
      if (!game.timeA || !game.timeB || game.seedLabelA || game.seedLabelB) throw new Error('Defina os dois participantes antes de registrar W.O.')
      const profile = await matchProfile(transaction, firestore, raw)
      await readProgressionGames(transaction, refs)
      let scores = [null, null]
      if (String(placarA ?? '').trim() || String(placarB ?? '').trim()) {
        scores = validateSportScores(profile, placarA, placarB, { final: true })
        if (scores[0] === scores[1] || (scores[0] > scores[1] ? 'A' : 'B') !== winnerSide) throw new Error('O placar regulamentar deve indicar a vitória da equipe selecionada.')
      }
      Object.assign(fields, profile, { matchCondition: 'walkover', walkoverWinner: winnerSide, status: GAME_STATUS.FINISHED, liveStatus: MATCH_STATE.FINISHED, placarA: scores[0], placarB: scores[1], tieBreak: null, setScores: [], endedAt: serverTimestamp(), finalizadoPor: user?.uid || null })
    } else {
      Object.assign(fields, { matchCondition: action === 'postpone' ? 'postponed' : 'cancelled', status: GAME_STATUS.CLOSED, liveStatus: action === 'postpone' ? MATCH_STATE.POSTPONED : MATCH_STATE.CANCELLED, walkoverWinner: '' })
    }
    if (action !== 'reschedule') fields.clock = stoppedMatchClock(game, new Date())
    transaction.update(gameRef, fields)
    return { ...game, ...fields }
  })
  if (action === 'walkover') await advanceCompletedMatch(firestore, updated)
  await recalculateScores()
}

export async function loadMatchReport(game, teams = []) {
  const firestore = ensureDb()
  const teamFor = (side) => teams.find((team) => team.id === game[`teamId${side}`]) || teams.find((team) => team.sportId === game.sportId && team.nome === game[`time${side}`])
  const roster = async (side) => {
    const team = teamFor(side)
    if (!team) return []
    const result = await getDocs(collection(firestore, 'teams', team.id, 'players'))
    return result.docs.map((item) => ({ ...item.data(), id: item.id })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }
  const [report, attendance, playersA, playersB] = await Promise.all([getDoc(doc(firestore, 'games', game.id, 'documents', 'matchReport')), getDoc(doc(firestore, 'games', game.id, 'documents', 'attendance')), roster('A'), roster('B')])
  return { report: normalizeMatchReportInput(report.exists() ? report.data() : {}), attendance: currentAttendance(game, attendance.exists() ? attendance.data() : null), playersA, playersB }
}

export async function saveMatchAttendance({ gameId, sides, expectedTeamKey, requireAttendance = false, user }) {
  const firestore = ensureDb()
  const gameRef = doc(firestore, 'games', gameId)
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(gameRef)
    if (snapshot.exists() && snapshot.data().deletionPending) throw new Error('Esta partida está em exclusão. Aguarde a conclusão.')
    if (!snapshot.exists()) throw new Error('Jogo não encontrado.')
    const game = normalizeGame(snapshot.id, snapshot.data())
    const priorAttendance = await transaction.get(doc(firestore, 'games', gameId, 'documents', 'attendance'))
    if (expectedTeamKey && expectedTeamKey !== attendanceTeamKey(game)) throw new Error('As equipes desta partida mudaram. Reabra a conferência de presença.')
    if (game.seedLabelA || game.seedLabelB) throw new Error('Defina as equipes antes de conferir a presença.')
    const candidates = await getDocs(query(collection(firestore, 'teams'), where('sportId', '==', game.sportId)))
    const teamFor = (side) => candidates.docs.find((item) => item.id === game[`teamId${side}`]) || candidates.docs.find((item) => item.data().nome === game[`time${side}`])
    const teams = [teamFor('A'), teamFor('B')]
    await Promise.all(teams.filter(Boolean).map((team) => transaction.get(team.ref)))
    const rosters = await Promise.all(teams.map(async (team) => team ? (await getDocs(collection(firestore, 'teams', team.id, 'players'))).docs.map((item) => ({ ...item.data(), id: item.id })) : []))
    const a = normalizeAttendanceSide(sides?.A, rosters[0])
    const b = normalizeAttendanceSide(sides?.B, rosters[1])
    const teamKey = attendanceTeamKey(game)
    transaction.set(doc(firestore, 'games', gameId, 'documents', 'attendance'), { teamKey, A: a, B: b, responsible: priorAttendance.exists() ? priorAttendance.data().responsible || '' : '', checkedAt: serverTimestamp(), checkedBy: user?.uid || null })
    transaction.update(gameRef, { requireAttendance: requireAttendance === true, preparation: null, attendanceSummary: { teamKey, teamA: a.status, teamB: b.status, checkedAt: serverTimestamp() }, updatedAt: serverTimestamp() })
  })
}

export async function saveMatchReport(gameId, value, user) {
  const payload = normalizeMatchReportInput(value)
  const firestore = ensureDb()
  await runTransaction(firestore, async (transaction) => {
    const game = await transaction.get(doc(firestore, 'games', gameId))
    if (!game.exists()) throw new Error('Jogo não encontrado.')
    if (game.data().deletionPending) throw new Error('Esta partida está em exclusão. Aguarde a conclusão.')
    transaction.set(doc(firestore, 'games', gameId, 'documents', 'matchReport'), { ...payload, updatedAt: serverTimestamp(), updatedBy: user?.uid || null })
  })
}

export async function deletePlayer(teamId, playerId) {
  const firestore = ensureDb()
  const teamRef = doc(firestore, 'teams', teamId)
  const playerRef = doc(firestore, 'teams', teamId, 'players', playerId)
  await runTransaction(firestore, async (transaction) => {
    const [team, player] = await Promise.all([transaction.get(teamRef), transaction.get(playerRef)])
    if (!player.exists()) return
    transaction.delete(playerRef)
    if (team.exists()) transaction.update(teamRef, { playerCount: Math.max(0, numberOrZero(team.data().playerCount) - 1), updatedAt: serverTimestamp() })
  })
}

export async function deleteSport(sportId) {
  const firestore = ensureDb()
  const relatedGamesSnapshot = await getDocs(query(collection(firestore, 'games'), where('sportId', '==', sportId)))

  if (!relatedGamesSnapshot.empty) {
    throw new Error('Este esporte tem jogos cadastrados e não pode ser excluído.')
  }

  await deleteDoc(doc(firestore, 'sports', sportId))
}

export async function closeGame(gameId) {
  const firestore = ensureDb()
  const gameRef = doc(firestore, 'games', gameId)
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(gameRef)
    if (!snapshot.exists()) throw new Error('Jogo não encontrado.')
    if (normalizeStatus(snapshot.data().status) === GAME_STATUS.FINISHED) throw new Error('Este jogo já foi finalizado.')
    if (getMatchCondition(snapshot.data()) !== 'normal') throw new Error('Use Situação da partida para reagendar este jogo.')
    transaction.update(gameRef, { status: GAME_STATUS.CLOSED, updatedAt: serverTimestamp() })
  })

  await recalculateScores()
}

export async function reopenGame(gameId) {
  const firestore = ensureDb()
  const gameRef = doc(firestore, 'games', gameId)
  const progressionRefs = await loadProgressionRefs(firestore, gameId)
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(gameRef)
    if (snapshot.exists() && snapshot.data().deletionPending) throw new Error('Esta partida está em exclusão. Aguarde a conclusão.')
    if (!snapshot.exists()) throw new Error('Jogo não encontrado.')
    if (!Number.isFinite(toDate(snapshot.data().dataHora).getTime()) || !Number.isFinite(toDate(getPredictionDeadline(snapshot.data())).getTime())) {
      throw new Error('Defina a data e o horário em Editar jogo antes de abrir os palpites. O prazo será calculado automaticamente.')
    }
    if (getMatchState(snapshot.data()) === MATCH_STATE.LIVE) {
      throw new Error('Encerre a partida ao vivo antes de reabrir os palpites.')
    }
    if (['postponed', 'cancelled'].includes(getMatchCondition(snapshot.data()))) throw new Error('Use Reagendar na situação da partida para definir o novo horário.')
    const dependentGames = await readProgressionGames(transaction, progressionRefs)
    if (normalizeStatus(snapshot.data().status) === GAME_STATUS.FINISHED) dependentGames.forEach((dependent) => {
      const data = dependent.data()
      const fields = {}
      for (const side of ['A', 'B']) {
        if (data[`sourceGameId${side}`] === gameId || (snapshot.data().stageType === 'group' && data[`qualifierGroup${side}`] === snapshot.data().groupName)) {
          fields[`time${side}`] = 'A definir'
          fields[`teamId${side}`] = ''; fields[`turma${side}`] = ''
          fields[`seedLabel${side}`] = data[`qualifierSeed${side}`] || (data[`sourceOutcome${side}`] === 'loser' ? 'Perdedor da semifinal' : 'Vencedor da partida anterior')
        }
      }
      if (Object.keys(fields).length) transaction.update(dependent.ref, { ...fields, updatedAt: serverTimestamp() })
    })
    transaction.update(gameRef, {
      status: GAME_STATUS.OPEN,
      limitePalpites: Timestamp.fromDate(getPredictionDeadline(snapshot.data())),
      liveStatus: MATCH_STATE.SCHEDULED,
      liveScoreA: 0,
      liveScoreB: 0,
      setScores: [],
      startedAt: null,
      clock: null,
      scoreRevision: (Number(snapshot.data().scoreRevision) || 0) + 1,
      currentSet: null, liveEvents: [], scorerStats: [], lastScoreEventId: null,
      eventsAdjusted: false,
      endedAt: null,
      placarA: null,
      placarB: null,
      finalizadoPor: null,
      matchCondition: 'normal', conditionReason: '', walkoverWinner: '',
      preparation: null,
      tieBreak: null,
      updatedAt: serverTimestamp(),
    })
  })

  await recalculateScores()
}

async function readPreparedGame(transaction, firestore, gameId, candidates, submitted = null, requirePrepared = false) {
  const snapshot = await transaction.get(doc(firestore, 'games', gameId))
  if (!snapshot.exists()) throw new Error('Jogo não encontrado.')
  const raw = snapshot.data()
  let game = normalizeGame(snapshot.id, raw)
  if (getMatchState(game) !== MATCH_STATE.SCHEDULED) throw new Error('Este jogo já foi iniciado, adiado, cancelado ou finalizado.')
  if (!game.timeA || !game.timeB || game.seedLabelA || game.seedLabelB) throw new Error('Defina os dois participantes antes de preparar a partida.')
  const saved = await transaction.get(doc(firestore, 'games', gameId, 'documents', 'attendance'))
  const previous = currentAttendance(game, saved.exists() ? saved.data() : null)
  const validSummary = game.attendanceSummary?.teamKey === attendanceTeamKey(game) ? game.attendanceSummary : null
  const teams = candidates.docs.map((item) => normalizeTeam(item.id, item.data()))
  game = { ...game, turno: validateGameShift(game, teams) }
  if (!submitted && ((requirePrepared && !isMatchPrepared(game, teams)) || (game.preparation && game.preparation.key !== preparationKey(game)))) throw new Error('A conferência desta partida mudou. Prepare e salve novamente antes de iniciar.')
  if (submitted && submitted.expectedTeamKey !== attendanceTeamKey(game)) throw new Error('As equipes mudaram. Reabra a preparação da partida.')
  const details = normalizeMatchDetails(submitted ? { ...game, venue: submitted.venue, venueArea: submitted.venueArea, vestA: submitted.vestA, vestB: submitted.vestB, durationMinutes: submitted.durationMinutes ?? game.durationMinutes } : game)
  const teamFor = (side) => candidates.docs.find((item) => item.id === game[`teamId${side}`]) || candidates.docs.find((item) => item.data().sportId === game.sportId && item.data().nome === game[`time${side}`])
  const selectedTeams = [teamFor('A'), teamFor('B')]
  await Promise.all(selectedTeams.filter(Boolean).map((team) => transaction.get(team.ref)))
  const rosters = await Promise.all(selectedTeams.map(async (team) => team ? (await getDocs(collection(firestore, 'teams', team.id, 'players'))).docs.map((item) => ({ ...item.data(), id: item.id })) : []))
  const discipline = Object.fromEntries(await Promise.all(selectedTeams.map(async (team, index) => [index ? 'B' : 'A', team ? (await getDocs(teamDisciplineQuery(firestore, team.id))).docs.map((item) => ({ ...item.data(), id: item.id })) : []])))
  const sides = submitted?.sides || Object.fromEntries(['A', 'B'].map((side) => [side, {
    status: previous?.[side]?.status || validSummary?.[`team${side}`] || 'pending',
    players: Object.fromEntries((previous?.[side]?.players || []).map((player) => [player.id, player.status])),
  }]))
  if (submitted && ['A', 'B'].some((side, index) => Object.keys(sides[side]?.players || {}).length !== rosters[index].length)) throw new Error('O elenco mudou ou ainda falta conferir jogadores. Reabra a preparação e confira a lista.')
  const responsible = String(submitted ? submitted.responsible || '' : previous?.responsible || '').trim()
  if (responsible.length > 100) throw new Error('Use até 100 caracteres no responsável pela partida.')
  const attendance = { teamKey: attendanceTeamKey(game), A: normalizeAttendanceSide(sides.A, rosters[0]), B: normalizeAttendanceSide(sides.B, rosters[1]), responsible,
    checkedAt: submitted ? serverTimestamp() : previous?.checkedAt || serverTimestamp(), checkedBy: submitted?.user?.uid || previous?.checkedBy || null }
  game = { ...game, ...details, requireAttendance: true, attendanceSummary: { teamKey: attendance.teamKey, teamA: attendance.A.status, teamB: attendance.B.status, checkedAt: attendance.checkedAt } }
  const missing = matchStartChecklist(game, { attendance, discipline }).filter((check) => check.id !== 'conflicts' && !check.done)
  if (missing.length) throw new Error(`Antes de iniciar: ${missing.map((check) => check.label).join('; ')}.`)
  const preparation = { key: preparationKey(game), playerCountA: rosters[0].length, playerCountB: rosters[1].length, preparedAt: serverTimestamp(), preparedBy: submitted?.user?.uid || game.preparation?.preparedBy || null }
  return { raw, game: { ...game, preparation }, attendance, fields: { ...details, turno: game.turno, requireAttendance: true, attendanceSummary: game.attendanceSummary, preparation, updatedAt: serverTimestamp() } }
}

export async function saveGamePreparation(gameId, preparation) {
  const firestore = ensureDb()
  const candidates = await getDocs(collection(firestore, 'teams'))
  await runTransaction(firestore, async (transaction) => {
    const item = await readPreparedGame(transaction, firestore, gameId, candidates, preparation)
    transaction.set(doc(firestore, 'games', gameId, 'documents', 'attendance'), item.attendance)
    transaction.update(doc(firestore, 'games', gameId), item.fields)
  })
}

export async function startGame(gameId, preparation = null) {
  return startSelectedGames([gameId], preparation ? { [gameId]: preparation } : {}, false)
}

export async function startPreparedGames(gameIds) {
  return startSelectedGames(gameIds, {}, true)
}

async function startSelectedGames(gameIds, submissions, requirePrepared) {
  if (!Array.isArray(gameIds) || !gameIds.length || gameIds.length > 12 || gameIds.some((id) => typeof id !== 'string' || !id)) throw new Error('Selecione entre 1 e 12 partidas preparadas para iniciar.')
  const idsToStart = [...new Set(gameIds)]
  const firestore = ensureDb()
  const [activeSnapshot, candidates] = await Promise.all([getDocs(query(collection(firestore, 'games'), where('liveStatus', '==', MATCH_STATE.LIVE))), getDocs(collection(firestore, 'teams'))])
  await runTransaction(firestore, async (transaction) => {
    const guardRef = doc(firestore, 'operations', 'liveMatches')
    const guard = await transaction.get(guardRef)
    const ids = [...new Set([...(guard.exists() && Array.isArray(guard.data().gameIds) ? guard.data().gameIds : []), ...activeSnapshot.docs.map((item) => item.id)])].filter((id) => typeof id === 'string' && !idsToStart.includes(id))
    const active = (await Promise.all(ids.map((id) => transaction.get(doc(firestore, 'games', id))))).filter((item) => item.exists() && getMatchState(item.data()) === MATCH_STATE.LIVE).map((item) => normalizeGame(item.id, item.data()))
    const prepared = []
    for (const id of idsToStart) prepared.push(await readPreparedGame(transaction, firestore, id, candidates, submissions[id], requirePrepared))
    const allLive = [...active, ...prepared.map(({ game }) => ({ ...game, status: GAME_STATUS.CLOSED, liveStatus: MATCH_STATE.LIVE }))]
    for (const item of prepared) {
      const blocked = matchStartChecklist(item.game, { games: allLive, attendance: item.attendance }).filter((check) => !check.done)
      if (blocked.length) throw new Error(`${item.game.timeA} × ${item.game.timeB}: ${blocked.map((check) => check.label).join('; ')}. Nenhuma partida foi iniciada.`)
      item.profile = await matchProfile(transaction, firestore, item.raw, true)
    }
    transaction.set(guardRef, { gameIds: [...active.map((item) => item.id), ...idsToStart], updatedAt: serverTimestamp() })
    for (const { game, attendance, fields, profile } of prepared) {
      transaction.set(doc(firestore, 'games', game.id, 'documents', 'attendance'), attendance)
      transaction.update(doc(firestore, 'games', game.id), { ...fields, ...profile, status: GAME_STATUS.CLOSED, liveStatus: MATCH_STATE.LIVE,
        liveScoreA: game.startedAt ? game.liveScoreA : 0, liveScoreB: game.startedAt ? game.liveScoreB : 0,
        setScores: game.startedAt ? game.setScores : [], tieBreak: game.startedAt ? game.tieBreak : null, startedAt: game.startedAt || serverTimestamp(), endedAt: null,
        clock: { elapsedMs: game.startedAt ? matchClockValue(game, new Date()).elapsedMs : 0, runningSince: serverTimestamp(), revision: clockRevision(game) + 1 },
      })
    }
  })
}

export async function controlMatchClock({ gameId, action, expectedRevision }) {
  if (!['pause', 'resume'].includes(action)) throw new Error('Escolha pausar ou retomar o cronômetro.')
  const firestore = ensureDb()
  const ref = doc(firestore, 'games', gameId)
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) throw new Error('Jogo não encontrado.')
    const game = normalizeGame(snapshot.id, snapshot.data())
    if (getMatchState(game) !== MATCH_STATE.LIVE) throw new Error('O cronômetro só pode ser controlado em uma partida ao vivo.')
    if (expectedRevision !== clockRevision(game)) throw new Error('Outro responsável alterou o cronômetro. Confira a atualização e tente novamente.')
    const value = matchClockValue(game, new Date())
    if ((action === 'pause') !== value.running) throw new Error('O estado do cronômetro mudou. Confira a atualização antes de continuar.')
    transaction.update(ref, { clock: { elapsedMs: value.elapsedMs, runningSince: action === 'resume' ? serverTimestamp() : null, revision: clockRevision(game) + 1 }, updatedAt: serverTimestamp() })
  })
}

export async function recordLiveEvent({ gameId, requestId, side, playerId = '', value = 1, kind = 'score', expectedScoreRevision }) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId || '')) throw new Error('Identificador do lance inválido. Tente novamente.')
  if (!['score', 'set'].includes(kind)) throw new Error('Tipo de lance inválido.')
  const firestore = ensureDb()
  const ref = doc(firestore, 'games', gameId)
  const eventRef = doc(firestore, 'games', gameId, 'events', requestId)
  await runTransaction(firestore, async (transaction) => {
    const [snapshot, existing] = await Promise.all([transaction.get(ref), transaction.get(eventRef)])
    if (existing.exists()) return
    if (!snapshot.exists()) throw new Error('Jogo não encontrado.')
    const game = normalizeGame(snapshot.id, snapshot.data())
    if (getMatchState(game) !== MATCH_STATE.LIVE) throw new Error('Registre lances somente enquanto a partida estiver ao vivo.')
    if (scoreRevision(game) !== expectedScoreRevision) throw new Error('O placar mudou em outro dispositivo. Confira o placar atual antes de registrar o lance.')
    let player = null
    if (playerId) {
      const attendance = await transaction.get(doc(firestore, 'games', gameId, 'documents', 'attendance'))
      const checked = currentAttendance(game, attendance.exists() ? attendance.data() : null)
      player = checked?.[side]?.players?.find((item) => item.id === playerId && item.status === 'present')
      if (!player) throw new Error('Selecione um jogador presente desta equipe. Confira a presença antes de continuar.')
    }
    const { before, after, event } = applyLiveEvent(game, { requestId, side, value, kind }, { player, now: new Date() })
    transaction.set(eventRef, { before, event, previousEventId: game.lastScoreEventId || null, undone: false, createdAt: serverTimestamp() })
    transaction.update(ref, { ...after, scoreRevision: scoreRevision(game) + 1, updatedAt: serverTimestamp() })
  })
}

export async function undoLiveEvent({ gameId, eventId, expectedScoreRevision }) {
  const firestore = ensureDb()
  const ref = doc(firestore, 'games', gameId)
  const eventRef = doc(firestore, 'games', gameId, 'events', eventId)
  await runTransaction(firestore, async (transaction) => {
    const [snapshot, event] = await Promise.all([transaction.get(ref), transaction.get(eventRef)])
    if (!snapshot.exists() || !event.exists()) throw new Error('Lance não encontrado.')
    if (event.data().undone) return
    const game = normalizeGame(snapshot.id, snapshot.data())
    if (getMatchState(game) !== MATCH_STATE.LIVE || game.lastScoreEventId !== eventId || scoreRevision(game) !== expectedScoreRevision) throw new Error('O placar mudou. Só é possível desfazer o último lance da partida ao vivo.')
    transaction.update(ref, { ...event.data().before, scoreRevision: scoreRevision(game) + 1, updatedAt: serverTimestamp() })
    transaction.update(eventRef, { undone: true, undoneAt: serverTimestamp() })
  })
}

export async function updateLiveScore({ gameId, placarA, placarB, setScores, tieBreak, currentSet, expectedScoreRevision }) {
  const firestore = ensureDb()
  const gameRef = doc(firestore, 'games', gameId)
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(gameRef)
    if (!snapshot.exists() || getMatchState(snapshot.data()) !== MATCH_STATE.LIVE) {
      throw new Error('Só é possível atualizar o placar de uma partida ao vivo.')
    }
    const game = normalizeGame(snapshot.id, snapshot.data())
    if (expectedScoreRevision != null && expectedScoreRevision !== scoreRevision(game)) throw new Error('O placar mudou. Recarregue os valores antes de salvar a correção.')
    const [liveScoreA, liveScoreB] = validateSportScores(game, placarA, placarB)
    const partials = normalizeSetScores(setScores ?? game.setScores)
    if (partials.length > game.volleyballBestOf) throw new Error('Há mais parciais que o número de sets da partida.')
    const decider = normalizeTieBreak(game, tieBreak === undefined ? game.tieBreak : tieBreak, liveScoreA, liveScoreB)
    const nextSet = currentSet != null && game.scoringMode === 'sets' ? normalizeSetScores([currentSet])[0] : game.currentSet
    const setChanged = JSON.stringify(nextSet) !== JSON.stringify(game.currentSet)
    const changed = setChanged || liveScoreA !== game.liveScoreA || liveScoreB !== game.liveScoreB || JSON.stringify(partials) !== JSON.stringify(game.setScores)
    transaction.update(gameRef, { liveScoreA, liveScoreB, currentSet: nextSet, setScores: partials, tieBreak: decider, ...(changed ? { liveEvents: [], scorerStats: [], eventsAdjusted: true } : {}), scoreRevision: scoreRevision(game) + 1, lastScoreEventId: null, updatedAt: serverTimestamp() })
  })
}

async function advanceGroupQualifiers(firestore, game) {
  if (game?.stageType !== 'group' || !game.tournamentId || !game.groupName) {
    return
  }

  const groupGamesSnapshot = await getDocs(query(collection(firestore, 'games'), where('tournamentId', '==', game.tournamentId)))
  const groupGames = groupGamesSnapshot.docs
    .map((item) => normalizeGame(item.id, item.data()))
    .filter((item) => item.stageType === 'group' && item.groupName === game.groupName)

  if (!groupGames.length || groupGames.some((item) => !getMatchOutcome(item))) {
    return
  }

  const standings = calculateGroupStandings(groupGames)
  const batch = writeBatch(firestore)
  let updates = 0

  await Promise.all(
    standings.map(async (team, index) => {
      const seedLabel = getGroupSeedLabel(index + 1, game.groupName)
      const appearance = groupGames.find((match) => ['A', 'B'].some((side) => match[`time${side}`] === team.nome))
      const side = appearance?.timeA === team.nome ? 'A' : 'B'
      const teamId = appearance?.[`teamId${side}`] || '', turma = appearance?.[`turma${side}`] || ''
      const [slotASnapshot, slotBSnapshot] = await Promise.all([
        getDocs(query(collection(firestore, 'games'), where('seedLabelA', '==', seedLabel))),
        getDocs(query(collection(firestore, 'games'), where('seedLabelB', '==', seedLabel))),
      ])

      slotASnapshot.forEach((nextGameDoc) => {
        const nextGame = normalizeGame(nextGameDoc.id, nextGameDoc.data())

        if (nextGame.tournamentId !== game.tournamentId) {
          return
        }

        batch.update(nextGameDoc.ref, {
          timeA: team.nome,
          teamIdA: teamId, turmaA: turma,
          seedLabelA: '',
          qualifierGroupA: game.groupName, qualifierSeedA: seedLabel,
          updatedAt: serverTimestamp(),
        })
        updates += 1
      })

      slotBSnapshot.forEach((nextGameDoc) => {
        const nextGame = normalizeGame(nextGameDoc.id, nextGameDoc.data())

        if (nextGame.tournamentId !== game.tournamentId) {
          return
        }

        batch.update(nextGameDoc.ref, {
          timeB: team.nome,
          teamIdB: teamId, turmaB: turma,
          seedLabelB: '',
          qualifierGroupB: game.groupName, qualifierSeedB: seedLabel,
          updatedAt: serverTimestamp(),
        })
        updates += 1
      })
    }),
  )

  if (updates > 0) {
    await batch.commit()
  }
}

export async function finalizeGame({ gameId, placarA, placarB, user, setScores, tieBreak, expectedScoreRevision }) {
  const firestore = ensureDb()
  const gameRef = doc(firestore, 'games', gameId)
  const progressionRefs = await loadProgressionRefs(firestore, gameId)
  const { game, finalA, finalB, decider } = await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(gameRef)
    if (!snapshot.exists()) throw new Error('Jogo não encontrado.')
    const current = normalizeGame(snapshot.id, snapshot.data())
    if (getMatchCondition(current) !== 'normal') throw new Error('Use Situação da partida para tratar adiamento, cancelamento ou W.O.')
    if (current.status === GAME_STATUS.OPEN) throw new Error('Inicie a partida ou encerre os palpites antes de finalizar.')
    if (expectedScoreRevision != null && expectedScoreRevision !== scoreRevision(current)) throw new Error('O placar mudou. Confira o placar atual antes de encerrar.')
    if (current.currentSet?.a || current.currentSet?.b) throw new Error('Encerre o set em andamento antes de finalizar a partida.')
    const profile = await matchProfile(transaction, firestore, snapshot.data())
    await readProgressionGames(transaction, progressionRefs)
    const [finalA, finalB] = validateSportScores(profile, placarA, placarB, { final: true })
    const partials = normalizeSetScores(setScores ?? current.setScores)
    validateFinalSets(profile, finalA, finalB, partials)
    const decider = normalizeTieBreak({ ...current, ...profile }, tieBreak === undefined ? current.tieBreak : tieBreak, finalA, finalB, { final: true })
    transaction.update(gameRef, {
      ...profile,
      setScores: partials,
      tieBreak: decider,
      placarA: finalA,
      placarB: finalB,
      liveScoreA: finalA,
      liveScoreB: finalB,
      liveStatus: MATCH_STATE.FINISHED,
      scoreRevision: scoreRevision(current) + 1,
      lastScoreEventId: null,
      endedAt: serverTimestamp(),
      clock: stoppedMatchClock(current, new Date()),
      status: GAME_STATUS.FINISHED,
      finalizadoPor: user?.uid || null,
      updatedAt: serverTimestamp(),
    })
    return { game: current, finalA, finalB, decider }
  })
  await advanceCompletedMatch(firestore, { ...game, placarA: finalA, placarB: finalB, tieBreak: decider, status: GAME_STATUS.FINISHED })
  await recalculateScores()
}

async function advanceCompletedMatch(firestore, game) {
  const gameId = game.id
  if (sourceParticipant(game)) {
    const [slotASnapshot, slotBSnapshot] = await Promise.all([
      getDocs(query(collection(firestore, 'games'), where('sourceGameIdA', '==', gameId))),
      getDocs(query(collection(firestore, 'games'), where('sourceGameIdB', '==', gameId))),
    ])
    const batch = writeBatch(firestore)

    for (const [side, snapshot] of [['A', slotASnapshot], ['B', slotBSnapshot]]) snapshot.forEach((nextGameDoc) => {
      const target = nextGameDoc.data()
      if (target.sportId !== game.sportId || (target.tournamentId || '') !== (game.tournamentId || '') || getGameShift(target) !== getGameShift(game)) return
      const participant = sourceParticipant(game, target[`sourceOutcome${side}`])
      batch.update(nextGameDoc.ref, { [`time${side}`]: participant.name, [`teamId${side}`]: participant.teamId, [`turma${side}`]: participant.turma, [`seedLabel${side}`]: '', preparation: null, updatedAt: serverTimestamp() })
    })

    if (!slotASnapshot.empty || !slotBSnapshot.empty) {
      await batch.commit()
    }
  }

  await advanceGroupQualifiers(firestore, game)
}

export async function createThirdPlaceGame({ semifinalIds, dataHora }) {
  if (!Array.isArray(semifinalIds) || semifinalIds.length !== 2 || new Set(semifinalIds).size !== 2) throw new Error('Selecione duas semifinais do mesmo torneio.')
  const firestore = ensureDb()
  const first = await getDoc(doc(firestore, 'games', semifinalIds[0]))
  if (!first.exists() || !first.data().tournamentId) throw new Error('Torneio não encontrado.')
  const tournament = await getDocs(query(collection(firestore, 'games'), where('tournamentId', '==', first.data().tournamentId)))
  const targetRef = doc(firestore, 'games', `third-${[...semifinalIds].sort().join('-')}`)
  await runTransaction(firestore, async (transaction) => {
    const [target, ...snapshots] = await Promise.all([transaction.get(targetRef), ...tournament.docs.map((item) => transaction.get(item.ref))])
    if (target.exists()) throw new Error('A disputa de terceiro lugar já foi criada.')
    const games = snapshots.filter((item) => item.exists()).map((item) => normalizeGame(item.id, item.data()))
    const semis = thirdPlaceSemifinals(games)
    if (semis.length !== 2 || semis.some((item) => !semifinalIds.includes(item.id))) throw new Error('As semifinais mudaram ou o terceiro lugar já existe. Reabra o torneio.')
    if (!dataHora || eventDate(dataHora).getTime() <= Math.max(...semis.map((item) => eventDate(item.dataHora).getTime()))) throw new Error('Escolha um horário posterior às duas semifinais.')
    const source = semis[0]
    const payload = normalizeGameInput({ sportId: source.sportId, esporteNome: source.esporteNome, turno: getGameShift(source), tournamentId: source.tournamentId, tournamentName: source.tournamentName, ...getSportProfile(source), ...thirdPlaceParticipants(semis), dataHora, status: GAME_STATUS.OPEN })
    transaction.set(targetRef, { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  })
  return targetRef.id
}

export async function deleteGame(gameId) {
  const firestore = ensureDb()
  const predictionsSnapshot = await getDocs(query(collection(firestore, 'predictions'), where('gameId', '==', gameId)))

  if (!predictionsSnapshot.empty) {
    throw new Error('Este jogo já tem palpites e não pode ser excluído.')
  }

  const events = await getDocs(collection(firestore, 'games', gameId, 'events'))
  for (let index = 0; index < events.docs.length; index += 450) {
    const cleanup = writeBatch(firestore)
    events.docs.slice(index, index + 450).forEach((event) => cleanup.delete(event.ref))
    await cleanup.commit()
  }
  const batch = writeBatch(firestore)
  batch.delete(doc(firestore, 'games', gameId, 'documents', 'matchReport'))
  batch.delete(doc(firestore, 'games', gameId, 'documents', 'attendance'))
  batch.delete(doc(firestore, 'games', gameId))
  await batch.commit()
}

export async function savePrediction({ user, profile, game, palpiteA, palpiteB, guessA, guessB }) {
  const firestore = ensureDb()

  if (!user) {
    throw new Error('Entre na sua conta para enviar palpites.')
  }

  if (!isRankingProfile(profile)) {
    throw new Error('Usuário master não registra palpites.')
  }

  if (!game?.id) throw new Error('Selecione uma partida para enviar o palpite.')
  const gameRef = doc(firestore, 'games', game.id)
  const predictionRef = doc(firestore, 'predictions', `${user.uid}_${game.id}`)
  await runTransaction(firestore, async (transaction) => {
    const currentGame = await transaction.get(gameRef)
    if (!currentGame.exists()) throw new Error('Jogo não encontrado.')
    const latest = normalizeGame(currentGame.id, currentGame.data())
    if (!isPredictionDeadlineOpen(latest)) throw new Error('O prazo para palpites encerra 5 minutos antes do jogo e já terminou.')
    if (!canEditPrediction(latest)) throw new Error('Este jogo não está aberto para edição de palpites.')
    const [parsedA, parsedB] = validateSportScores(latest, palpiteA ?? guessA, palpiteB ?? guessB, { final: true })
    const currentSnapshot = await transaction.get(predictionRef)
    const createdAt = currentSnapshot.exists() ? currentSnapshot.data().createdAt : serverTimestamp()
    transaction.set(predictionRef, {
      userId: user.uid,
      gameId: game.id,
      nomeUsuario: profile?.nome || user.displayName || user.email,
      palpiteA: parsedA,
      palpiteB: parsedB,
      pontos: 0,
      acertoExato: false,
      acertoResultado: false,
      createdAt,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  })
}

export async function recalculateScores() {
  const firestore = ensureDb()
  const [usersSnapshot, gamesSnapshot, predictionsSnapshot] = await Promise.all([
    getDocs(collection(firestore, 'users')),
    getDocs(collection(firestore, 'games')),
    getDocs(collection(firestore, 'predictions')),
  ])

  const users = usersSnapshot.docs.map((item) => normalizeUserProfile(item.id, item.data()))
  const games = gamesSnapshot.docs.map((item) => normalizeGame(item.id, item.data()))
  const predictions = predictionsSnapshot.docs.map((item) => normalizePrediction(item.id, item.data()))
  const participants = users.filter(isRankingProfile)
  const participantsIds = new Set(participants.map((user) => user.id))
  const finishedGames = new Map(
    games.filter((game) => game.status === GAME_STATUS.FINISHED && hasFinalScore(game) && !isPredictionVoided(game)).map((game) => [game.id, game]),
  )
  const stats = new Map(
    participants.map((user) => [
      user.id,
      {
        pontos: 0,
        acertosExatos: 0,
        acertosResultado: 0,
        rankingPorEsporte: {},
      },
    ]),
  )
  const batch = writeBatch(firestore)

  predictions.forEach((prediction) => {
    const game = finishedGames.get(prediction.gameId)
    const canScore = game && participantsIds.has(prediction.userId)
    const result = canScore
      ? calcularPontuacao(prediction.palpiteA, prediction.palpiteB, game.placarA, game.placarB)
      : { pontos: 0, acertoExato: false, acertoResultado: false }

    if (canScore) {
      const userStats = stats.get(prediction.userId)
      const sportKey = getSportRankingKey(game)
      const sportStats = userStats.rankingPorEsporte[sportKey] || {
        sportId: game.sportId || sportKey,
        esporteNome: game.esporteNome || 'Geral',
        pontos: 0,
        acertosExatos: 0,
        acertosResultado: 0,
      }

      userStats.pontos += result.pontos
      userStats.acertosExatos += result.acertoExato ? 1 : 0
      userStats.acertosResultado += result.acertoResultado ? 1 : 0
      sportStats.pontos += result.pontos
      sportStats.acertosExatos += result.acertoExato ? 1 : 0
      sportStats.acertosResultado += result.acertoResultado ? 1 : 0
      userStats.rankingPorEsporte[sportKey] = sportStats
    }

    batch.update(doc(firestore, 'predictions', prediction.id), {
      pontos: result.pontos,
      acertoExato: result.acertoExato,
      acertoResultado: result.acertoResultado,
      updatedAt: serverTimestamp(),
    })
  })

  stats.forEach((userStats, userId) => {
    batch.update(doc(firestore, 'users', userId), {
      ...userStats,
      participaRanking: true,
      role: 'user',
      updatedAt: serverTimestamp(),
      scoreUpdatedAt: serverTimestamp(),
    })
  })

  await batch.commit()
}

export const subscribeUserGuesses = subscribeUserPredictions
export const subscribeAllGuesses = subscribeAllPredictions
export const saveGuess = savePrediction
