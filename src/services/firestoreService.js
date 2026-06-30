import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase.js'
import { asNumberOrNull, toDate, toDateTimeLocalValue } from '../utils/format.js'
import { calcularPontuacao, hasFinalScore } from '../utils/scoring.js'

export const GAME_STATUS = {
  OPEN: 'aberto',
  CLOSED: 'encerrado',
  FINISHED: 'finalizado',
}

export const STATUS_LABELS = {
  [GAME_STATUS.OPEN]: 'Aberto para palpites',
  [GAME_STATUS.CLOSED]: 'Encerrado',
  [GAME_STATUS.FINISHED]: 'Finalizado',
}

const LEGACY_STATUS = {
  open: GAME_STATUS.OPEN,
  closed: GAME_STATUS.CLOSED,
  finished: GAME_STATUS.FINISHED,
}

function ensureDb() {
  if (!db) {
    throw new Error('Configure o Firebase para usar autenticacao e Firestore.')
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

export function getPredictionDeadline(game) {
  return game?.limitePalpites || game?.predictionDeadline || game?.dataHora || game?.dateTime || null
}

export function isPredictionDeadlineOpen(game, now = new Date()) {
  const deadline = toDate(getPredictionDeadline(game))

  if (Number.isNaN(deadline.getTime())) {
    return true
  }

  return now.getTime() <= deadline.getTime()
}

export function canEditPrediction(game, now = new Date()) {
  return game?.status === GAME_STATUS.OPEN && isPredictionDeadlineOpen(game, now)
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
    role,
    participaRanking: role === 'master' ? false : data.participaRanking !== false,
    pontos: numberOrZero(data.pontos ?? data.score),
    acertosExatos: numberOrZero(data.acertosExatos ?? data.exactHits),
    acertosResultado: numberOrZero(data.acertosResultado ?? data.resultHits),
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  }
}

export function normalizeGame(id, data = {}) {
  const limitePalpites = data.limitePalpites || data.predictionDeadline || data.dataHora || data.dateTime || ''

  return {
    id,
    timeA: data.timeA || data.teamA || '',
    timeB: data.timeB || data.teamB || '',
    dataHora: data.dataHora || data.dateTime || '',
    limitePalpites: toDateTimeLocalValue(limitePalpites) || limitePalpites,
    placarA: asNumberOrNull(data.placarA ?? data.finalScoreA),
    placarB: asNumberOrNull(data.placarB ?? data.finalScoreB),
    status: normalizeStatus(data.status),
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    finalizadoPor: data.finalizadoPor || data.finishedBy || null,
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
    return error?.message || 'Nao foi possivel concluir a acao.'
  }

  const messages = {
    'auth/email-already-in-use': 'Este e-mail ja esta cadastrado.',
    'auth/invalid-email': 'Informe um e-mail valido.',
    'auth/invalid-credential': 'E-mail ou senha invalidos.',
    'auth/user-not-found': 'E-mail ou senha invalidos.',
    'auth/wrong-password': 'E-mail ou senha invalidos.',
    'auth/weak-password': 'Use uma senha com pelo menos 6 caracteres.',
    'failed-precondition': 'Crie o indice solicitado pelo Firebase ou ajuste a consulta.',
    'permission-denied': 'Sem permissao para acessar estes dados.',
    unavailable: 'Sem conexao com o Firebase. Tente novamente em instantes.',
  }

  return messages[error.code] || error.message || 'Ocorreu um erro inesperado.'
}

function validateScore(value, label) {
  const parsed = asNumberOrNull(value)

  if (parsed === null) {
    throw new Error(`Informe ${label}.`)
  }

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} deve ser um numero inteiro maior ou igual a zero.`)
  }

  return parsed
}

function normalizeGameInput(game) {
  const timeA = String(game.timeA ?? game.teamA ?? '').trim()
  const timeB = String(game.timeB ?? game.teamB ?? '').trim()
  const dataHora = game.dataHora ?? game.dateTime ?? ''
  const limitePalpites = game.limitePalpites ?? game.predictionDeadline ?? dataHora
  const status = normalizeStatus(game.status)
  const placarA = asNumberOrNull(game.placarA ?? game.finalScoreA)
  const placarB = asNumberOrNull(game.placarB ?? game.finalScoreB)
  const gameDate = toDate(dataHora)
  const deadlineDate = toDate(limitePalpites)

  if (!timeA || !timeB || !dataHora || !limitePalpites) {
    throw new Error('Preencha os times, a data do jogo e o limite dos palpites.')
  }

  if (Number.isNaN(gameDate.getTime())) {
    throw new Error('Informe uma data valida para o jogo.')
  }

  if (Number.isNaN(deadlineDate.getTime())) {
    throw new Error('Informe uma data valida para o limite dos palpites.')
  }

  if (deadlineDate.getTime() > gameDate.getTime()) {
    throw new Error('O limite dos palpites nao pode ser depois do horario do jogo.')
  }

  if (placarA !== null && (!Number.isInteger(placarA) || placarA < 0)) {
    throw new Error('O placar do Time A deve ser inteiro e maior ou igual a zero.')
  }

  if (placarB !== null && (!Number.isInteger(placarB) || placarB < 0)) {
    throw new Error('O placar do Time B deve ser inteiro e maior ou igual a zero.')
  }

  if (status === GAME_STATUS.FINISHED && (placarA === null || placarB === null)) {
    throw new Error('Informe os dois placares finais para finalizar o jogo.')
  }

  return {
    timeA,
    timeB,
    dataHora,
    limitePalpites: Timestamp.fromDate(deadlineDate),
    placarA,
    placarB,
    status,
  }
}

export async function createParticipantProfile(user, nome) {
  const firestore = ensureDb()

  await setDoc(
    doc(firestore, 'users', user.uid),
    {
      uid: user.uid,
      nome: nome.trim(),
      email: user.email,
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
    (error) => onError?.(toFriendlyError(error)),
  )
}

export function subscribeGames(onData, onError) {
  if (!db) {
    onData([])
    return () => {}
  }

  return onSnapshot(
    collection(db, 'games'),
    (snapshot) => {
      const games = snapshot.docs.map((item) => normalizeGame(item.id, item.data())).sort(sortByDate)

      onData(games)
    },
    (error) => onError?.(toFriendlyError(error)),
  )
}

export function subscribeUserPredictions(userId, onData, onError) {
  if (!db || !userId) {
    onData([])
    return () => {}
  }

  return onSnapshot(
    query(collection(db, 'predictions'), where('userId', '==', userId)),
    (snapshot) => {
      onData(snapshot.docs.map((item) => normalizePrediction(item.id, item.data())))
    },
    (error) => onError?.(toFriendlyError(error)),
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
    (error) => onError?.(toFriendlyError(error)),
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
    (error) => onError?.(toFriendlyError(error)),
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
    (error) => onError?.(toFriendlyError(error)),
  )
}

export async function saveGame(game) {
  const firestore = ensureDb()
  const payload = normalizeGameInput(game)

  if (game.id) {
    await updateDoc(doc(firestore, 'games', game.id), {
      ...payload,
      updatedAt: serverTimestamp(),
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

export async function closeGame(gameId) {
  const firestore = ensureDb()

  await updateDoc(doc(firestore, 'games', gameId), {
    status: GAME_STATUS.CLOSED,
    updatedAt: serverTimestamp(),
  })

  await recalculateScores()
}

export async function reopenGame(gameId) {
  const firestore = ensureDb()

  await updateDoc(doc(firestore, 'games', gameId), {
    status: GAME_STATUS.OPEN,
    placarA: null,
    placarB: null,
    finalizadoPor: null,
    updatedAt: serverTimestamp(),
  })

  await recalculateScores()
}

export async function finalizeGame({ gameId, placarA, placarB, user }) {
  const firestore = ensureDb()
  const finalA = validateScore(placarA, 'o placar final do Time A')
  const finalB = validateScore(placarB, 'o placar final do Time B')

  await updateDoc(doc(firestore, 'games', gameId), {
    placarA: finalA,
    placarB: finalB,
    status: GAME_STATUS.FINISHED,
    finalizadoPor: user?.uid || null,
    updatedAt: serverTimestamp(),
  })

  await recalculateScores()
}

export async function deleteGame(gameId) {
  const firestore = ensureDb()
  const predictionsSnapshot = await getDocs(query(collection(firestore, 'predictions'), where('gameId', '==', gameId)))

  if (!predictionsSnapshot.empty) {
    throw new Error('Este jogo ja tem palpites e nao pode ser excluido.')
  }

  await deleteDoc(doc(firestore, 'games', gameId))
}

export async function savePrediction({ user, profile, game, palpiteA, palpiteB, guessA, guessB }) {
  const firestore = ensureDb()
  const parsedA = validateScore(palpiteA ?? guessA, 'o palpite do Time A')
  const parsedB = validateScore(palpiteB ?? guessB, 'o palpite do Time B')

  if (!user) {
    throw new Error('Entre na sua conta para enviar palpites.')
  }

  if (!isRankingProfile(profile)) {
    throw new Error('Usuario master nao registra palpites.')
  }

  if (game.status !== GAME_STATUS.OPEN) {
    throw new Error('Este jogo nao esta aberto para edicao de palpites.')
  }

  if (!isPredictionDeadlineOpen(game)) {
    throw new Error('O prazo para palpites deste jogo ja encerrou.')
  }

  const predictionRef = doc(firestore, 'predictions', `${user.uid}_${game.id}`)
  const currentSnapshot = await getDoc(predictionRef)
  const createdAt = currentSnapshot.exists() ? currentSnapshot.data().createdAt : serverTimestamp()

  await setDoc(
    predictionRef,
    {
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
    },
    { merge: true },
  )
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
    games.filter((game) => game.status === GAME_STATUS.FINISHED && hasFinalScore(game)).map((game) => [game.id, game]),
  )
  const stats = new Map(
    participants.map((user) => [
      user.id,
      {
        pontos: 0,
        acertosExatos: 0,
        acertosResultado: 0,
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
      userStats.pontos += result.pontos
      userStats.acertosExatos += result.acertoExato ? 1 : 0
      userStats.acertosResultado += result.acertoResultado ? 1 : 0
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
