import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import {
  closeGame,
  deleteGame,
  deleteSport,
  deleteTeam,
  finalizeGame,
  GAME_STATUS,
  isPredictionDeadlineOpen,
  calculateGroupStandings,
  recalculateScores,
  reopenGame,
  saveGame,
  saveGames,
  saveSport,
  saveTeam,
  startGame,
  updateLiveScore,
  STATUS_LABELS,
  subscribeAllPredictions,
  subscribeGames,
  subscribeParticipants,
  subscribeSports,
  subscribeTeams,
} from '../services/bolaoService.js'
import { formatDateTime, formatPoints, toDateTimeLocalValue } from '../utils/format.js'
import { gameMatchesSearch, getGameStageLabel, getSportVisualClass, getUniqueGamePhases } from '../utils/game.js'
import EmptyState from './EmptyState.jsx'
import LoadingState from './LoadingState.jsx'
import LiveControlPanel from './LiveControlPanel.jsx'
import MatchBadge from './MatchBadge.jsx'
import { getMatchState, MATCH_STATE } from '../utils/match.js'

const blankGame = {
  sportId: '',
  esporteNome: '',
  fase: 'Fase de grupos',
  rodada: '',
  timeA: '',
  timeB: '',
  dataHora: '',
  limitePalpites: '',
  placarA: '',
  placarB: '',
  status: GAME_STATUS.OPEN,
}

const blankSport = {
  id: '',
  nome: '',
}

const blankTeam = {
  id: '',
  sportId: '',
  esporteNome: '',
  nome: '',
  categoria: '',
}

const blankBracketForm = {
  tournamentName: '',
  formato: 'grupos-mata-mata',
  fase: 'Chaveamento',
  rodadaPrefixo: 'Jogo',
  dataInicial: '',
  intervaloMinutos: 30,
  limiteHorasAntes: 1,
  grupos: 2,
  timesPorGrupo: 3,
  classificadosPorGrupo: 2,
  mataMataInicial: 'Semifinal',
}

const ALL_GAMES_FILTER = 'todos'
const ALL_PHASES_FILTER = 'todas'
const EXPIRED_GAMES_FILTER = 'prazo-vencido'

const PHASE_OPTIONS = ['Fase de grupos', 'Eliminatórias', 'Quartas de final', 'Semifinal', 'Final']

const BRACKET_FORMATS = [
  { value: 'grupos-mata-mata', label: 'Grupos + mata-mata' },
  { value: 'sorteio', label: 'Sorteio simples' },
  { value: 'todos-contra-todos', label: 'Todos contra todos' },
]

const KNOCKOUT_STARTS = [
  { value: 'Final', label: 'Final direta', slots: 2 },
  { value: 'Semifinal', label: 'Semifinal + final', slots: 4 },
  { value: 'Quartas de final', label: 'Quartas + semi + final', slots: 8 },
]

const GAME_FILTERS = [
  { value: ALL_GAMES_FILTER, label: 'Todos' },
  { value: 'ao-vivo', label: 'Ao vivo' },
  { value: GAME_STATUS.OPEN, label: 'Abertos' },
  { value: EXPIRED_GAMES_FILTER, label: 'Prazo vencido' },
  { value: GAME_STATUS.CLOSED, label: 'Encerrados' },
  { value: GAME_STATUS.FINISHED, label: 'Finalizados' },
]

const ADMIN_TABS = [
  { id: 'esportes', label: 'Esportes' },
  { id: 'times', label: 'Times' },
  { id: 'jogos', label: 'Jogos' },
  { id: 'ao-vivo', label: 'Ao vivo / TV' },
  { id: 'participantes', label: 'Participantes' },
  { id: 'palpites', label: 'Palpites' },
]

const GAME_TOOL_TABS = [
  { id: 'bracket', label: 'Gerador de chaveamento' },
  { id: 'manual', label: 'Criar jogo manual' },
]

function createSeededRandom(seed) {
  let value = seed % 2147483647

  if (value <= 0) {
    value += 2147483646
  }

  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

function shuffleItems(items, seed) {
  const draft = [...items]
  const random = createSeededRandom(seed || Date.now())

  for (let index = draft.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1))
    const current = draft[index]

    draft[index] = draft[randomIndex]
    draft[randomIndex] = current
  }

  return draft
}

function buildMatchups(teams, formato) {
  if (formato === 'todos-contra-todos') {
    const matchups = []

    teams.forEach((teamA, teamIndex) => {
      teams.slice(teamIndex + 1).forEach((teamB) => {
        matchups.push({ timeA: teamA, timeB: teamB })
      })
    })

    return { matchups, byes: [] }
  }

  return teams.reduce(
    (bracket, team, index) => {
      if (index % 2 !== 0) {
        return bracket
      }

      const opponent = teams[index + 1]

      if (opponent) {
        bracket.matchups.push({ timeA: team, timeB: opponent })
      } else {
        bracket.byes.push(team)
      }

      return bracket
    },
    { matchups: [], byes: [] },
  )
}

function createLocalId(prefix = 'game') {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getGroupLabel(index) {
  return `Grupo ${String.fromCharCode(65 + index)}`
}

function getPreviewTeamName(team) {
  return typeof team === 'string' ? team : team?.nome || 'Time'
}

function getKnockoutSlots(roundName) {
  return KNOCKOUT_STARTS.find((item) => item.value === roundName)?.slots || 4
}

function getNextKnockoutRound(roundName) {
  if (roundName === 'Quartas de final') {
    return 'Semifinal'
  }

  if (roundName === 'Semifinal') {
    return 'Final'
  }

  return ''
}

function createGameDraft({ id, fase, rodada, timeA, timeB, dateIndex, bracketForm, extra = {} }) {
  const interval = Math.max(0, Number(bracketForm.intervaloMinutos) || 0)
  const deadlineOffset = Math.max(0, Number(bracketForm.limiteHorasAntes) || 0) * 60
  const dataHora = addMinutesToDateTimeLocal(bracketForm.dataInicial, interval * dateIndex)

  return {
    id: id || createLocalId('game'),
    fase,
    rodada,
    timeA: getPreviewTeamName(timeA),
    timeB: getPreviewTeamName(timeB),
    dataHora,
    limitePalpites: addMinutesToDateTimeLocal(dataHora, -deadlineOffset),
    ...extra,
  }
}

function pairSeeds(labels, roundName) {
  if (roundName === 'Semifinal' && labels.length === 4) {
    return [
      [labels[0], labels[3]],
      [labels[2], labels[1]],
    ]
  }

  const pairs = []

  for (let index = 0; index < labels.length / 2; index += 1) {
    pairs.push([labels[index], labels[labels.length - 1 - index]])
  }

  return pairs
}

function createKnockoutTree(seedLabels, roundName, bracketForm, startIndex) {
  const slots = getKnockoutSlots(roundName)
  const seeds = [...seedLabels].slice(0, slots)

  while (seeds.length < slots) {
    seeds.push(`Classificado ${seeds.length + 1}`)
  }

  const rounds = []
  let currentRoundName = roundName
  let currentSources = pairSeeds(seeds, currentRoundName).map(([timeA, timeB], index) => ({
    id: createLocalId('game'),
    rodada: `${currentRoundName} ${index + 1}`,
    timeA,
    timeB,
    seedLabelA: timeA,
    seedLabelB: timeB,
  }))
  let dateIndex = startIndex

  while (currentSources.length) {
    const roundGames = currentSources.map((source, index) =>
      createGameDraft({
        id: source.id,
        fase: currentRoundName,
        rodada: currentSources.length === 1 ? 'Final' : source.rodada,
        timeA: source.timeA,
        timeB: source.timeB,
        dateIndex: dateIndex + index,
        bracketForm,
        extra: {
          stageType: 'knockout',
          sourceGameIdA: source.sourceGameIdA || '',
          sourceGameIdB: source.sourceGameIdB || '',
          seedLabelA: source.seedLabelA || '',
          seedLabelB: source.seedLabelB || '',
        },
      }),
    )

    rounds.push(roundGames)
    dateIndex += roundGames.length

    const nextRoundName = getNextKnockoutRound(currentRoundName)

    if (!nextRoundName) {
      break
    }

    currentSources = []

    for (let index = 0; index < roundGames.length; index += 2) {
      const gameA = roundGames[index]
      const gameB = roundGames[index + 1]

      if (!gameB) {
        continue
      }

      currentSources.push({
        id: createLocalId('game'),
        rodada: `${nextRoundName} ${currentSources.length + 1}`,
        timeA: `Vencedor ${gameA.rodada}`,
        timeB: `Vencedor ${gameB.rodada}`,
        sourceGameIdA: gameA.id,
        sourceGameIdB: gameB.id,
      })
    }

    currentRoundName = nextRoundName
  }

  return rounds.flat()
}

function buildTournamentPlan(teams, bracketForm) {
  if (bracketForm.formato !== 'grupos-mata-mata') {
    const bracket = buildMatchups(teams, bracketForm.formato)
    const games = bracket.matchups.map((matchup, index) =>
      createGameDraft({
        fase: bracketForm.fase,
        rodada: `${bracketForm.rodadaPrefixo || 'Jogo'} ${index + 1}`,
        timeA: matchup.timeA,
        timeB: matchup.timeB,
        dateIndex: index,
        bracketForm,
        extra: { stageType: bracketForm.formato === 'todos-contra-todos' ? 'league' : 'knockout' },
      }),
    )

    return {
      mode: bracketForm.formato,
      groups: [],
      games,
      byes: bracket.byes.map(getPreviewTeamName),
    }
  }

  const groupCount = Math.max(1, Number(bracketForm.grupos) || 1)
  const teamsPerGroup = Math.max(2, Number(bracketForm.timesPorGrupo) || 2)
  const qualifiersPerGroup = Math.max(1, Number(bracketForm.classificadosPorGrupo) || 1)
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    name: getGroupLabel(index),
    teams: teams.slice(index * teamsPerGroup, index * teamsPerGroup + teamsPerGroup),
  })).filter((group) => group.teams.length)
  const games = []

  groups.forEach((group) => {
    group.teams.forEach((teamA, teamIndex) => {
      group.teams.slice(teamIndex + 1).forEach((teamB) => {
        games.push(
          createGameDraft({
            fase: 'Fase de grupos',
            rodada: group.name,
            timeA: teamA,
            timeB: teamB,
            dateIndex: games.length,
            bracketForm,
            extra: {
              stageType: 'group',
              groupName: group.name,
            },
          }),
        )
      })
    })
  })

  const seedLabels = groups.flatMap((group) =>
    Array.from({ length: Math.min(qualifiersPerGroup, group.teams.length) }, (_, index) => `${index + 1}o ${group.name}`),
  )
  const knockoutGames = createKnockoutTree(seedLabels, bracketForm.mataMataInicial, bracketForm, games.length)

  return {
    mode: bracketForm.formato,
    groups,
    games: [...games, ...knockoutGames],
    byes: teams.slice(groupCount * teamsPerGroup).map(getPreviewTeamName),
  }
}

function addMinutesToDateTimeLocal(value, minutes) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  date.setMinutes(date.getMinutes() + Number(minutes || 0))
  return toDateTimeLocalValue(date)
}

function getTournamentName(game) {
  return game?.tournamentName || game?.nomeTorneio || game?.fase || 'Torneio'
}

function groupGamesByTournament(games) {
  const grouped = new Map()

  games
    .filter((game) => game.tournamentId)
    .forEach((game) => {
      const current = grouped.get(game.tournamentId) || {
        id: game.tournamentId,
        nome: getTournamentName(game),
        esporteNome: game.esporteNome,
        games: [],
      }

      current.games.push(game)
      grouped.set(game.tournamentId, current)
    })

  return [...grouped.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

function getTournamentGroups(games) {
  const groups = new Map()

  games
    .filter((game) => game.stageType === 'group' && game.groupName)
    .forEach((game) => {
      const current = groups.get(game.groupName) || []

      current.push(game)
      groups.set(game.groupName, current)
    })

  return [...groups.entries()].map(([name, groupGames]) => ({
    name,
    games: groupGames,
    standings: calculateGroupStandings(groupGames),
  }))
}

function getTournamentKnockoutGames(games) {
  return games.filter((game) => game.stageType === 'knockout' || ['Quartas de final', 'Semifinal', 'Final'].includes(game.fase))
}

export default function AdminPanel({ onNavigate }) {
  const { user, isMaster } = useAuth()
  const [games, setGames] = useState([])
  const [sports, setSports] = useState([])
  const [teams, setTeams] = useState([])
  const [participants, setParticipants] = useState([])
  const [predictions, setPredictions] = useState([])
  const [form, setForm] = useState(blankGame)
  const [sportForm, setSportForm] = useState(blankSport)
  const [teamForm, setTeamForm] = useState(blankTeam)
  const [bracketForm, setBracketForm] = useState(blankBracketForm)
  const [bracketGenerated, setBracketGenerated] = useState(false)
  const [bracketTeamOrderIds, setBracketTeamOrderIds] = useState([])
  const [bracketSpinning, setBracketSpinning] = useState(false)
  const [finalScores, setFinalScores] = useState({})
  const [gameFilter, setGameFilter] = useState(ALL_GAMES_FILTER)
  const [selectedSportId, setSelectedSportId] = useState('')
  const [activeAdminTab, setActiveAdminTab] = useState('esportes')
  const [activeGameTool, setActiveGameTool] = useState('bracket')
  const [phaseFilter, setPhaseFilter] = useState(ALL_PHASES_FILTER)
  const [gameSearch, setGameSearch] = useState('')
  const [loadingState, setLoadingState] = useState({
    games: true,
    sports: true,
    teams: true,
    participants: true,
    predictions: true,
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [bracketMessage, setBracketMessage] = useState('')
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [editFocusRequest, setEditFocusRequest] = useState(null)
  const bracketBuilderRef = useRef(null)
  const gameFormRef = useRef(null)
  const sportFormRef = useRef(null)
  const teamFormRef = useRef(null)

  useEffect(() => {
    if (!editFocusRequest) return

    const frame = window.requestAnimationFrame(() => {
      const editor = {
        game: gameFormRef,
        sport: sportFormRef,
        team: teamFormRef,
      }[editFocusRequest.section]?.current

      editor?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      editor?.querySelector('input, select')?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [editFocusRequest])

  useEffect(() => {
    const unsubscribeGames = subscribeGames(
      (items) => {
        setGames(items)
        setLoadingState((current) => ({ ...current, games: false }))
      },
      setMessage,
    )
    const unsubscribeSports = subscribeSports(
      (items) => {
        setSports(items)
        setLoadingState((current) => ({ ...current, sports: false }))
      },
      setMessage,
    )
    const unsubscribeTeams = subscribeTeams(
      (items) => {
        setTeams(items)
        setLoadingState((current) => ({ ...current, teams: false }))
      },
      setMessage,
    )
    const unsubscribeParticipants = subscribeParticipants(
      (items) => {
        setParticipants(items)
        setLoadingState((current) => ({ ...current, participants: false }))
      },
      setMessage,
    )
    const unsubscribePredictions = subscribeAllPredictions(
      (items) => {
        setPredictions(items)
        setLoadingState((current) => ({ ...current, predictions: false }))
      },
      setMessage,
    )

    return () => {
      unsubscribeGames()
      unsubscribeSports()
      unsubscribeTeams()
      unsubscribeParticipants()
      unsubscribePredictions()
    }
  }, [])

  const loading = Object.values(loadingState).some(Boolean)
  const predictionsByGame = useMemo(() => {
    const grouped = new Map()

    predictions.forEach((prediction) => {
      const current = grouped.get(prediction.gameId) || []
      grouped.set(prediction.gameId, [...current, prediction])
    })

    return grouped
  }, [predictions])
  const participantIds = useMemo(() => new Set(participants.map((participant) => participant.id)), [participants])
  const sportNameById = useMemo(() => new Map(sports.map((sport) => [sport.id, sport.nome])), [sports])
  const selectedSport = useMemo(
    () => sports.find((sport) => sport.id === selectedSportId) || null,
    [selectedSportId, sports],
  )
  const selectedSportGames = useMemo(() => {
    if (!selectedSportId) {
      return []
    }

    return games.filter((game) => game.sportId === selectedSportId || game.esporteNome === selectedSport?.nome)
  }, [games, selectedSport?.nome, selectedSportId])
  const selectedSportTeams = useMemo(() => {
    if (!selectedSportId) {
      return []
    }

    return teams.filter((team) => team.sportId === selectedSportId || team.esporteNome === selectedSport?.nome)
  }, [selectedSport?.nome, selectedSportId, teams])
  const orderedBracketTeams = useMemo(() => {
    if (!bracketGenerated || !bracketTeamOrderIds.length) {
      return selectedSportTeams
    }

    const teamById = new Map(selectedSportTeams.map((team) => [team.id, team]))
    const ordered = bracketTeamOrderIds.map((teamId) => teamById.get(teamId)).filter(Boolean)
    const missingTeams = selectedSportTeams.filter((team) => !bracketTeamOrderIds.includes(team.id))

    return [...ordered, ...missingTeams]
  }, [bracketGenerated, bracketTeamOrderIds, selectedSportTeams])
  const tournamentPlan = useMemo(
    () =>
      bracketGenerated
        ? buildTournamentPlan(orderedBracketTeams, bracketForm)
        : { mode: bracketForm.formato, groups: [], games: [], byes: [] },
    [bracketForm, bracketGenerated, orderedBracketTeams],
  )
  const bracketPreviewGames = tournamentPlan.games
  const selectedSportTournaments = useMemo(() => groupGamesByTournament(selectedSportGames), [selectedSportGames])
  const predictionTabGames = selectedSport ? selectedSportGames : games
  const gameCountBySport = useMemo(() => {
    return games.reduce((counts, game) => {
      if (!game.sportId) {
        return counts
      }

      counts.set(game.sportId, (counts.get(game.sportId) || 0) + 1)
      return counts
    }, new Map())
  }, [games])
  const availablePhases = useMemo(() => {
    return [...new Set([...PHASE_OPTIONS, ...getUniqueGamePhases(selectedSportId ? selectedSportGames : games)])]
  }, [games, selectedSportGames, selectedSportId])
  const allExpiredOpenGames = useMemo(
    () => games.filter((game) => game.status === GAME_STATUS.OPEN && !isPredictionDeadlineOpen(game)),
    [games],
  )
  const expiredOpenGames = useMemo(
    () => selectedSportGames.filter((game) => game.status === GAME_STATUS.OPEN && !isPredictionDeadlineOpen(game)),
    [selectedSportGames],
  )
  const filteredGames = useMemo(() => {
    let statusFilteredGames = selectedSportGames

    if (gameFilter === 'ao-vivo') {
      statusFilteredGames = selectedSportGames.filter((game) => getMatchState(game) === MATCH_STATE.LIVE)
    } else if (gameFilter === EXPIRED_GAMES_FILTER) {
      statusFilteredGames = expiredOpenGames
    } else if (gameFilter !== ALL_GAMES_FILTER) {
      statusFilteredGames = selectedSportGames.filter((game) => game.status === gameFilter)
    }

    return statusFilteredGames.filter((game) => {
      const matchesPhase = phaseFilter === ALL_PHASES_FILTER || game.fase === phaseFilter

      return matchesPhase && gameMatchesSearch(game, gameSearch)
    })
  }, [expiredOpenGames, gameFilter, gameSearch, phaseFilter, selectedSportGames])
  const gameFilterCounts = useMemo(
    () => ({
      [ALL_GAMES_FILTER]: selectedSportGames.length,
      'ao-vivo': selectedSportGames.filter((game) => getMatchState(game) === MATCH_STATE.LIVE).length,
      [GAME_STATUS.OPEN]: selectedSportGames.filter((game) => game.status === GAME_STATUS.OPEN).length,
      [EXPIRED_GAMES_FILTER]: expiredOpenGames.length,
      [GAME_STATUS.CLOSED]: selectedSportGames.filter((game) => game.status === GAME_STATUS.CLOSED).length,
      [GAME_STATUS.FINISHED]: selectedSportGames.filter((game) => game.status === GAME_STATUS.FINISHED).length,
    }),
    [expiredOpenGames.length, selectedSportGames],
  )
  const getPendingParticipants = (gamePredictions) => {
    const usersWithPrediction = new Set(
      gamePredictions
        .map((prediction) => prediction.userId)
        .filter((userId) => participantIds.has(userId)),
    )

    return participants.filter((participant) => !usersWithPrediction.has(participant.id))
  }
  const getPendingPredictionCount = (gamePredictions) => {
    return getPendingParticipants(gamePredictions).length
  }
  const stats = useMemo(() => {
    return {
      participantes: participants.length,
      esportes: sports.length,
      times: teams.length,
      jogos: games.length,
      palpites: predictions.length,
      abertos: games.filter((game) => game.status === GAME_STATUS.OPEN).length,
      encerrados: games.filter((game) => game.status === GAME_STATUS.CLOSED).length,
      finalizados: games.filter((game) => game.status === GAME_STATUS.FINISHED).length,
      prazoVencido: allExpiredOpenGames.length,
    }
  }, [allExpiredOpenGames.length, games, participants, predictions, sports.length, teams.length])

  if (!isMaster) {
    return (
      <section className="page-shell">
        <EmptyState
          title="Área restrita"
          description="Apenas usuários master podem cadastrar jogos, finalizar placares e recalcular o ranking."
          action={
            <button className="btn btn-primary" type="button" onClick={() => onNavigate('dashboard')}>
              Voltar ao painel
            </button>
          }
        />
      </section>
    )
  }

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const updateSportField = (sportId) => {
    setSelectedSportId(sportId)
    setForm((current) => ({
      ...current,
      sportId,
      esporteNome: sportNameById.get(sportId) || '',
    }))
  }

  const selectSport = (sport, openTeams = true) => {
    setSelectedSportId(sport.id)
    if (openTeams) setActiveAdminTab('times')
    setGameFilter(ALL_GAMES_FILTER)
    setPhaseFilter(ALL_PHASES_FILTER)
    setGameSearch('')
    setBracketGenerated(false)
    setBracketTeamOrderIds([])
    setTeamForm({
      ...blankTeam,
      sportId: sport.id,
      esporteNome: sport.nome,
    })
    setForm({
      ...blankGame,
      sportId: sport.id,
      esporteNome: sport.nome,
    })
    setMessage('')
  }

  const updateFinalScore = (gameId, field, value) => {
    setFinalScores((current) => ({
      ...current,
      [gameId]: {
        ...current[gameId],
        [field]: value,
      },
    }))
  }

  const editGame = (game) => {
    const sportId = game.sportId || sports.find((sport) => sport.nome === game.esporteNome)?.id || ''

    setSelectedSportId(sportId)
    setActiveAdminTab('jogos')
    setActiveGameTool('manual')
    setForm({
      ...game,
      id: game.id,
      sportId,
      esporteNome: game.esporteNome || sportNameById.get(sportId) || '',
      fase: game.fase || 'Fase única',
      rodada: game.rodada || '',
      timeA: game.timeA || '',
      timeB: game.timeB || '',
      dataHora: toDateTimeLocalValue(game.dataHora),
      limitePalpites: toDateTimeLocalValue(game.limitePalpites || game.dataHora),
      placarA: game.placarA ?? '',
      placarB: game.placarB ?? '',
      status: game.status || GAME_STATUS.OPEN,
    })
    setMessage('')
    setEditFocusRequest({ section: 'game' })
  }

  const resetForm = () => {
    setForm(
      selectedSport
        ? {
            ...blankGame,
            sportId: selectedSport.id,
            esporteNome: selectedSport.nome,
          }
        : blankGame,
    )
    setMessage('')
  }

  const editSport = (sport) => {
    setActiveAdminTab('esportes')
    setSportForm({
      id: sport.id,
      nome: sport.nome,
    })
    setMessage('')
    setEditFocusRequest({ section: 'sport' })
  }

  const resetSportForm = () => {
    setSportForm(blankSport)
    setMessage('')
  }

  const updateTeamSportField = (sportId) => {
    const esporteNome = sportNameById.get(sportId) || ''

    setSelectedSportId(sportId)
    setBracketGenerated(false)
    setBracketTeamOrderIds([])
    setTeamForm((current) => ({
      ...current,
      sportId,
      esporteNome,
    }))
  }

  const editTeam = (team) => {
    setActiveAdminTab('times')
    setSelectedSportId(team.sportId || '')
    setTeamForm({
      id: team.id,
      sportId: team.sportId || '',
      esporteNome: team.esporteNome || sportNameById.get(team.sportId) || '',
      nome: team.nome,
      categoria: team.categoria || '',
    })
    setMessage('')
    setEditFocusRequest({ section: 'team' })
  }

  const resetTeamForm = () => {
    setTeamForm(
      selectedSport
        ? {
            ...blankTeam,
            sportId: selectedSport.id,
            esporteNome: selectedSport.nome,
          }
        : blankTeam,
    )
    setMessage('')
  }

  const updateBracketField = (field, value) => {
    setBracketForm((current) => ({ ...current, [field]: value }))
    setBracketMessage('')
  }

  const showBracketMessage = (nextMessage) => {
    setMessage(nextMessage)
    setBracketMessage(nextMessage)
    window.setTimeout(() => {
      bracketBuilderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  const shiftBracketSchedule = (minutes) => {
    if (!bracketForm.dataInicial) {
      showBracketMessage('Informe o horário do primeiro jogo antes de ajustar a agenda.')
      return
    }

    setBracketForm((current) => ({
      ...current,
      dataInicial: addMinutesToDateTimeLocal(current.dataInicial, minutes),
    }))
    setBracketMessage('')
  }

  const setBracketStartTime = (time) => {
    if (!time) {
      return
    }

    const baseDate = bracketForm.dataInicial ? new Date(bracketForm.dataInicial) : new Date()

    if (Number.isNaN(baseDate.getTime())) {
      showBracketMessage('Informe uma data inicial válida antes de alterar o horário.')
      return
    }

    const [hours, minutes] = time.split(':').map(Number)

    baseDate.setHours(hours || 0, minutes || 0, 0, 0)
    setBracketForm((current) => ({ ...current, dataInicial: toDateTimeLocalValue(baseDate) }))
    setBracketMessage('')
  }

  const clearBracketPreview = () => {
    setBracketGenerated(false)
    setBracketTeamOrderIds([])
    setBracketMessage('')
    setMessage('')
  }

  const handleShuffleBracket = () => {
    setBracketTeamOrderIds(shuffleItems(selectedSportTeams, Date.now()).map((team) => team.id))
    setBracketGenerated(true)
    setBracketSpinning(true)
    window.setTimeout(() => setBracketSpinning(false), 650)
    setMessage('')
    setBracketMessage('')
  }

  const swapBracketTeam = (currentTeamId, nextTeamId) => {
    if (currentTeamId === nextTeamId) {
      return
    }

    setBracketTeamOrderIds((current) => {
      const order = current.length ? [...current] : selectedSportTeams.map((team) => team.id)
      const currentIndex = order.indexOf(currentTeamId)
      const nextIndex = order.indexOf(nextTeamId)

      if (currentIndex < 0 || nextIndex < 0) {
        return order
      }

      order[currentIndex] = nextTeamId
      order[nextIndex] = currentTeamId
      return order
    })
    setMessage('')
    setBracketMessage('')
  }

  const runAdminAction = async (action, successMessage) => {
    setMessage('')

    try {
      setSaving(true)
      await action()
      setMessage(successMessage)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  const confirmAdminAction = ({ title, description, confirmLabel, action, successMessage }) => {
    setConfirmDialog({
      title,
      description,
      confirmLabel,
      onConfirm: () => runAdminAction(action, successMessage),
    })
  }

  const closeConfirmDialog = () => {
    if (!saving) {
      setConfirmDialog(null)
    }
  }

  const handleConfirmDialog = async () => {
    const action = confirmDialog?.onConfirm

    setConfirmDialog(null)

    if (action) {
      await action()
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (form.timeA && form.timeB && form.timeA === form.timeB) {
      setMessage('Selecione times diferentes para criar o jogo.')
      return
    }

    await runAdminAction(async () => {
      const esporteNome = sportNameById.get(form.sportId) || form.esporteNome
      const gamePayload = form.id
        ? { ...form, esporteNome }
        : {
            sportId: form.sportId,
            esporteNome,
            fase: form.fase,
            rodada: form.rodada,
            timeA: form.timeA,
            timeB: form.timeB,
            dataHora: form.dataHora,
            limitePalpites: form.limitePalpites,
            status: GAME_STATUS.OPEN,
          }

      await saveGame(gamePayload)
      resetForm()
    }, 'Jogo salvo e classificação recalculada.')
  }

  const handleGenerateBracket = async () => {
    if (!selectedSport) {
      showBracketMessage('Selecione um esporte antes de salvar o chaveamento.')
      return
    }

    if (selectedSportTeams.length < 2) {
      showBracketMessage('Cadastre pelo menos dois times para salvar o chaveamento.')
      return
    }

    if (!bracketForm.dataInicial) {
      showBracketMessage('Informe a data inicial dos jogos do chaveamento.')
      return
    }

    if (!bracketForm.tournamentName.trim()) {
      showBracketMessage('Informe o nome do torneio antes de salvar o chaveamento.')
      return
    }

    if (
      selectedSportTournaments.some(
        (tournament) => tournament.nome.trim().toLocaleLowerCase('pt-BR') === bracketForm.tournamentName.trim().toLocaleLowerCase('pt-BR'),
      )
    ) {
      showBracketMessage('Já existe um torneio com esse nome neste esporte.')
      return
    }

    if (!bracketPreviewGames.length) {
      showBracketMessage('Não há confrontos para salvar com os times selecionados.')
      return
    }

    setMessage('')
    setBracketMessage('')

    try {
      setSaving(true)
      const tournamentId = `${selectedSport.id}-${Date.now()}`

      await saveGames(
        bracketPreviewGames.map((game) => ({
          id: game.id,
          sportId: selectedSport.id,
          esporteNome: selectedSport.nome,
          fase: game.fase || bracketForm.fase,
          rodada: game.rodada,
          timeA: game.timeA,
          timeB: game.timeB,
          dataHora: game.dataHora,
          limitePalpites: game.limitePalpites,
          status: GAME_STATUS.OPEN,
          tournamentId,
          tournamentName: bracketForm.tournamentName.trim(),
          groupName: game.groupName,
          stageType: game.stageType,
          sourceGameIdA: game.sourceGameIdA,
          sourceGameIdB: game.sourceGameIdB,
          seedLabelA: game.seedLabelA,
          seedLabelB: game.seedLabelB,
        })),
      )
      setBracketGenerated(false)
      setBracketTeamOrderIds([])
      setBracketForm((current) => ({ ...current, tournamentName: '' }))
      showBracketMessage(`${bracketPreviewGames.length} jogo(s) gerado(s) pelo chaveamento.`)
    } catch (error) {
      showBracketMessage(error.message || 'Não foi possível salvar o chaveamento.')
    } finally {
      setSaving(false)
    }
  }

  const handleSportSubmit = async (event) => {
    event.preventDefault()

    await runAdminAction(async () => {
      await saveSport(sportForm)
      setSportForm(blankSport)
    }, 'Esporte salvo com sucesso.')
  }

  const handleTeamSubmit = async (event) => {
    event.preventDefault()

    await runAdminAction(async () => {
      const esporteNome = sportNameById.get(teamForm.sportId) || teamForm.esporteNome

      await saveTeam({ ...teamForm, esporteNome })
      setTeamForm(
        teamForm.sportId
          ? {
              ...blankTeam,
              sportId: teamForm.sportId,
              esporteNome,
            }
          : blankTeam,
      )
    }, 'Time salvo com sucesso.')
  }

  const handleDeleteSport = (sport) => {
    confirmAdminAction({
      title: 'Excluir esporte',
      description: `Excluir ${sport.nome}? Esta ação só é permitida quando não existem jogos cadastrados nesse esporte.`,
      confirmLabel: 'Excluir esporte',
      action: async () => {
        await deleteSport(sport.id)

        if (selectedSportId === sport.id) {
          setSelectedSportId('')
          setForm(blankGame)
        }
      },
      successMessage: 'Esporte excluído com sucesso.',
    })
  }

  const handleDeleteTeam = (team) => {
    confirmAdminAction({
      title: 'Excluir time',
      description: `Excluir ${team.nome}? Jogos já criados com esse nome continuam cadastrados.`,
      confirmLabel: 'Excluir time',
      action: () => deleteTeam(team.id),
      successMessage: 'Time excluído com sucesso.',
    })
  }

  const handleFinalize = async (game, scores) => {
    const draft = scores || finalScores[game.id] || {}
    const live = getMatchState(game) === MATCH_STATE.LIVE
    const finalA = draft.placarA ?? (live ? game.liveScoreA : game.placarA) ?? ''
    const finalB = draft.placarB ?? (live ? game.liveScoreB : game.placarB) ?? ''

    if (finalA === '' || finalB === '') {
      setMessage('Informe os dois placares antes de finalizar o jogo.')
      return
    }

    confirmAdminAction({
      title: live ? 'Encerrar partida' : 'Finalizar jogo',
      description: `Confirmar ${game.timeA} ${finalA} x ${finalB} ${game.timeB}? A pontuação será recalculada para todos os participantes.`,
      confirmLabel: live ? 'Encerrar e publicar resultado' : 'Finalizar jogo',
      action: () =>
        finalizeGame({
          gameId: game.id,
          placarA: finalA,
          placarB: finalB,
          user,
        }),
      successMessage: 'Jogo finalizado e pontuação recalculada.',
    })
  }

  const handleCloseExpiredGames = () => {
    if (!expiredOpenGames.length) {
      setMessage('Não há jogos abertos com prazo vencido.')
      return
    }

    confirmAdminAction({
      title: 'Encerrar jogos vencidos',
      description: `Encerrar ${expiredOpenGames.length} jogo(s) aberto(s) cujo prazo de palpite já passou? Participantes não poderão mais editar esses palpites.`,
      confirmLabel: 'Encerrar vencidos',
      action: () => Promise.all(expiredOpenGames.map((game) => closeGame(game.id))),
      successMessage: `${expiredOpenGames.length} jogo(s) encerrado(s) com sucesso.`,
    })
  }

  if (loading) {
    return <LoadingState label="Carregando área administrativa..." />
  }

  const isSuccessMessage = ['salvo', 'sucesso', 'recalculada', 'finalizado', 'encerrado', 'reaberto', 'excluído'].some(
    (term) => message.toLowerCase().includes(term),
  )

  return (
    <section className="page-shell admin-page">
      <div className="page-heading with-actions">
        <div>
          <span className="eyebrow">Administração</span>
          <h1>Painel master</h1>
          <p>Crie jogos, encerre palpites, lance placares finais e acompanhe todos os dados do bolão.</p>
        </div>
        <div className="form-actions"><button className="btn btn-outline" type="button" onClick={() => onNavigate('tv')}>Abrir modo TV</button><span className="master-badge">Logado como usuário master</span></div>
      </div>

      {message ? (
        <div className={isSuccessMessage ? 'alert alert-success' : 'alert alert-error'}>
          {message}
        </div>
      ) : null}

      <div className="stats-grid">
        <article className="stat-card">
          <span>Participantes</span>
          <strong>{stats.participantes}</strong>
        </article>
        <article className="stat-card">
          <span>Esportes</span>
          <strong>{stats.esportes}</strong>
        </article>
        <article className="stat-card">
          <span>Times</span>
          <strong>{stats.times}</strong>
        </article>
        <article className="stat-card">
          <span>Jogos</span>
          <strong>{stats.jogos}</strong>
        </article>
        <article className="stat-card">
          <span>Palpites</span>
          <strong>{stats.palpites}</strong>
        </article>
        <article className="stat-card">
          <span>Abertos</span>
          <strong>{stats.abertos}</strong>
        </article>
        <article className="stat-card">
          <span>Encerrados</span>
          <strong>{stats.encerrados}</strong>
        </article>
        <article className="stat-card">
          <span>Finalizados</span>
          <strong>{stats.finalizados}</strong>
        </article>
        <article className="stat-card">
          <span>Prazo vencido</span>
          <strong>{stats.prazoVencido}</strong>
        </article>
      </div>

      <div className="admin-workspace">
      <aside className="admin-navigation">
        <div className="admin-navigation-heading">
          <span className="eyebrow">Administração</span>
          <h2>Gerenciar bolão</h2>
        </div>
      <nav className="admin-section-links" aria-label="Seções do painel master">
        {ADMIN_TABS.map((tab) => {
          const tabCount = {
            esportes: sports.length,
            times: selectedSport ? selectedSportTeams.length : teams.length,
            jogos: selectedSport ? selectedSportGames.length : games.length,
            'ao-vivo': games.filter((game) => getMatchState(game) === MATCH_STATE.LIVE).length,
            participantes: participants.length,
            palpites: predictions.length,
          }[tab.id]

          return (
            <button
              className={activeAdminTab === tab.id ? 'admin-section-link is-active' : 'admin-section-link'}
              type="button"
              key={tab.id}
              aria-pressed={activeAdminTab === tab.id}
              onClick={() => setActiveAdminTab(tab.id)}
            >
              <span>{tab.label}</span>
              <span className="admin-section-count">{tabCount}</span>
              <span className="navigation-chevron" aria-hidden="true">›</span>
            </button>
          )
        })}
      </nav>
      {selectedSport ? <p className="admin-navigation-context">Esporte selecionado<strong>{selectedSport.nome}</strong></p> : null}
      </aside>
      <div className="admin-workspace-content">

      {['times', 'jogos', 'palpites'].includes(activeAdminTab) && sports.length ? (
        <div className="admin-sport-switcher">
          <label>Esporte para gerenciar
            <select value={selectedSportId} onChange={(event) => { const sport = sports.find((item) => item.id === event.target.value); if (sport) selectSport(sport, false) }}>
              <option value="" disabled>Escolha um esporte</option>
              {sports.map((sport) => <option value={sport.id} key={sport.id}>{sport.nome} · {gameCountBySport.get(sport.id) || 0} jogo(s)</option>)}
            </select>
          </label>
          <p>Cada esporte tem sua própria lista de times, torneios e jogos.</p>
        </div>
      ) : null}

      {activeAdminTab === 'ao-vivo' ? <LiveControlPanel games={games} sports={sports} onFinish={handleFinalize} onNavigate={onNavigate} saving={saving} /> : null}

      {activeAdminTab === 'esportes' ? (
      <form className="admin-form admin-sport-form" ref={sportFormRef} onSubmit={handleSportSubmit}>
        <div className="section-heading">
          <h2>{sportForm.id ? 'Editar esporte' : 'Esportes'}</h2>
          <button className="btn btn-outline btn-small" type="button" onClick={resetSportForm}>
            Novo esporte
          </button>
        </div>

        <div className="sport-create-row">
          <label>
            Nome do esporte ou prova
            <input
              type="text"
              value={sportForm.nome}
              onChange={(event) => setSportForm((current) => ({ ...current, nome: event.target.value }))}
              placeholder="Ex.: Basquete, Torta na cara"
              required
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : sportForm.id ? 'Salvar esporte' : 'Cadastrar esporte'}
          </button>
        </div>

        {sports.length ? (
          <div className="sport-chip-list" aria-label="Esportes cadastrados">
            {sports.map((sport) => {
              const sportGameCount = gameCountBySport.get(sport.id) || 0

              return (
                <span
                  className={
                    selectedSportId === sport.id
                      ? 'sport-chip sport-chip-editable is-selected'
                      : 'sport-chip sport-chip-editable'
                  }
                  key={sport.id}
                >
                  <button className="sport-select-button" type="button" onClick={() => selectSport(sport)}>
                    <span className={`sport-chip-icon ${getSportVisualClass(sport.nome)}`} aria-hidden="true" />
                    <span>{sport.nome}</span>
                    <small>{sportGameCount} jogo(s)</small>
                  </button>
                  <button className="chip-action" type="button" onClick={() => editSport(sport)}>
                    Editar
                  </button>
                  <button
                    className="chip-action"
                    type="button"
                    disabled={saving || sportGameCount > 0}
                    onClick={() => handleDeleteSport(sport)}
                  >
                    Excluir
                  </button>
                </span>
              )
            })}
          </div>
        ) : null}
      </form>
      ) : null}

      {activeAdminTab === 'times' ? (
        <section className="admin-tab-panel">
          <form className="admin-form admin-team-form" ref={teamFormRef} onSubmit={handleTeamSubmit}>
            <div className="section-heading">
              <div>
                <h2>{teamForm.id ? 'Editar time' : 'Times por esporte'}</h2>
                <p>Cadastre os times uma vez e depois selecione Time A e Time B ao criar cada jogo.</p>
              </div>
              <button className="btn btn-outline btn-small" type="button" onClick={resetTeamForm}>
                Novo time
              </button>
            </div>

            <div className="team-create-row">
              <label>
                Esporte
                <select value={teamForm.sportId} onChange={(event) => updateTeamSportField(event.target.value)} required>
                  <option value="">Selecione</option>
                  {sports.map((sport) => (
                    <option value={sport.id} key={sport.id}>
                      {sport.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nome do time
                <input
                  type="text"
                  value={teamForm.nome}
                  onChange={(event) => setTeamForm((current) => ({ ...current, nome: event.target.value }))}
                  placeholder="Ex.: 9o A, SESI Vermelho"
                  required
                />
              </label>
              <label>
                Categoria/turma
                <input
                  type="text"
                  value={teamForm.categoria}
                  onChange={(event) => setTeamForm((current) => ({ ...current, categoria: event.target.value }))}
                  placeholder="Ex.: 9o ano, Ensino Medio"
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Salvando...' : teamForm.id ? 'Salvar time' : 'Cadastrar time'}
              </button>
            </div>
          </form>

          {selectedSport ? (
            <div className="selected-sport-bar">
              <div>
                <span className="eyebrow">Times de {selectedSport.nome}</span>
                <strong>{selectedSportTeams.length} time(s) cadastrados</strong>
              </div>
              <button className="btn btn-primary btn-small" type="button" onClick={() => setActiveAdminTab('jogos')}>
                Criar jogos
              </button>
            </div>
          ) : null}

          {sports.length ? (
            <div className="team-group-list">
              {(selectedSport ? [selectedSport] : sports).map((sport) => {
                const sportTeams = teams.filter((team) => team.sportId === sport.id || team.esporteNome === sport.nome)

                return (
                  <section className="team-group" key={`teams-${sport.id}`}>
                    <div className="section-heading">
                      <h2>{sport.nome}</h2>
                      <span>{sportTeams.length} time(s)</span>
                    </div>
                    {sportTeams.length ? (
                      <div className="team-chip-list">
                        {sportTeams.map((team) => (
                          <span className="team-chip" key={team.id}>
                            <span className={`sport-chip-icon ${getSportVisualClass(team.esporteNome)}`} aria-hidden="true" />
                            <strong>{team.nome}</strong>
                            {team.categoria ? <small>{team.categoria}</small> : null}
                            <button className="chip-action" type="button" onClick={() => editTeam(team)}>
                              Editar
                            </button>
                            <button
                              className="chip-action"
                              type="button"
                              disabled={saving}
                              onClick={() => handleDeleteTeam(team)}
                            >
                              Excluir
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <EmptyState title="Sem times" description="Cadastre os times deste esporte para montar jogos mais rápido." />
                    )}
                  </section>
                )
              })}
            </div>
          ) : (
            <EmptyState title="Cadastre um esporte primeiro" description="Os times precisam estar vinculados a um esporte." />
          )}
        </section>
      ) : null}

      {activeAdminTab === 'jogos' ? (
        selectedSport ? (
          <>
          <div className="selected-sport-bar">
            <div>
              <span className="eyebrow">Esporte selecionado</span>
              <strong>{selectedSport.nome}</strong>
            </div>
            <button
              className="btn btn-outline btn-small"
              type="button"
              onClick={() => {
                resetForm()
                setActiveGameTool('manual')
              }}
            >
              Novo jogo em {selectedSport.nome}
            </button>
          </div>

          <div className="segmented-control admin-game-tool-tabs" aria-label="Modo de criação de jogos">
            {GAME_TOOL_TABS.map((tab) => (
              <button
                className={activeGameTool === tab.id ? 'is-active' : ''}
                type="button"
                key={tab.id}
                onClick={() => setActiveGameTool(tab.id)}
              >
                {tab.id === 'manual' && form.id ? 'Editar jogo' : tab.label}
              </button>
            ))}
          </div>

      {selectedSportTournaments.length ? (
        <section className="tournament-library">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Torneios criados</span>
              <h2>{selectedSportTournaments.length} torneio(s) de {selectedSport.nome}</h2>
            </div>
            <button className="btn btn-outline btn-small" type="button" onClick={() => onNavigate('calendario')}>
              Ver calendário público
            </button>
          </div>

          <div className="tournament-library-grid">
            {selectedSportTournaments.map((tournament) => {
              const groups = getTournamentGroups(tournament.games)
              const knockoutGames = getTournamentKnockoutGames(tournament.games)

              return (
                <article className="tournament-summary-card" key={tournament.id}>
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">{tournament.esporteNome}</span>
                      <h2>{tournament.nome}</h2>
                    </div>
                    <span>{tournament.games.length} jogo(s)</span>
                  </div>

                  {groups.length ? (
                    <div className="standings-grid">
                      {groups.map((group) => (
                        <div className="standings-table" key={`${tournament.id}-${group.name}`}>
                          <strong>{group.name}</strong>
                          <div className="standings-row standings-head">
                            <span>Time</span>
                            <span>Pts</span>
                            <span>SG</span>
                            <span>GP</span>
                          </div>
                          {group.standings.map((team) => (
                            <div className="standings-row" key={`${group.name}-${team.nome}`}>
                              <span>{team.nome}</span>
                              <span>{team.pontos}</span>
                              <span>{team.saldo}</span>
                              <span>{team.golsPro}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {knockoutGames.length ? (
                    <div className="mini-bracket">
                      {knockoutGames.map((game) => (
                        <span key={game.id}>
                          <strong>{game.fase}</strong>
                          {game.timeA} x {game.timeB}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        </section>
      ) : null}

      {activeGameTool === 'bracket' ? (
      <section className={`bracket-builder ${bracketSpinning ? 'is-spinning' : ''}`} ref={bracketBuilderRef}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">Gerador de chaveamento</span>
            <h2>Sortear confrontos</h2>
            <p>Use os times cadastrados, embaralhe como em sorteio e salve todos os jogos de uma vez.</p>
          </div>
          <span>{bracketPreviewGames.length} jogo(s) na prévia</span>
        </div>

        {bracketMessage ? (
          <div className={isSuccessMessage ? 'alert alert-success' : 'alert alert-error'}>{bracketMessage}</div>
        ) : null}

        <div className="bracket-controls">
          <label>
            Nome do torneio
            <input
              type="text"
              value={bracketForm.tournamentName}
              onChange={(event) => updateBracketField('tournamentName', event.target.value)}
              placeholder="Ex.: Interclasses 2026"
            />
          </label>
          <label>
            Formato
            <select value={bracketForm.formato} onChange={(event) => updateBracketField('formato', event.target.value)}>
              {BRACKET_FORMATS.map((format) => (
                <option value={format.value} key={format.value}>
                  {format.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fase padrão
            <input
              type="text"
              value={bracketForm.fase}
              onChange={(event) => updateBracketField('fase', event.target.value)}
              placeholder="Ex.: Chaveamento"
            />
          </label>
          <label>
            Nome da rodada
            <input
              type="text"
              value={bracketForm.rodadaPrefixo}
              onChange={(event) => updateBracketField('rodadaPrefixo', event.target.value)}
              placeholder="Ex.: Jogo"
            />
          </label>
          <label>
            Primeiro jogo
            <input
              type="datetime-local"
              value={bracketForm.dataInicial}
              onChange={(event) => updateBracketField('dataInicial', event.target.value)}
            />
          </label>
          <label>
            Intervalo entre jogos
            <input
              type="number"
              min="0"
              step="5"
              value={bracketForm.intervaloMinutos}
              onChange={(event) => updateBracketField('intervaloMinutos', event.target.value)}
            />
          </label>
          <label>
            Palpites fecham antes (h)
            <input
              type="number"
              min="0"
              step="0.5"
              value={bracketForm.limiteHorasAntes}
              onChange={(event) => updateBracketField('limiteHorasAntes', event.target.value)}
            />
          </label>
          {bracketForm.formato === 'grupos-mata-mata' ? (
            <>
              <label>
                Grupos
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={bracketForm.grupos}
                  onChange={(event) => updateBracketField('grupos', event.target.value)}
                />
              </label>
              <label>
                Times por grupo
                <input
                  type="number"
                  min="2"
                  step="1"
                  value={bracketForm.timesPorGrupo}
                  onChange={(event) => updateBracketField('timesPorGrupo', event.target.value)}
                />
              </label>
              <label>
                Classificam por grupo
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={bracketForm.classificadosPorGrupo}
                  onChange={(event) => updateBracketField('classificadosPorGrupo', event.target.value)}
                />
              </label>
              <label>
                Mata-mata começa em
                <select
                  value={bracketForm.mataMataInicial}
                  onChange={(event) => updateBracketField('mataMataInicial', event.target.value)}
                >
                  {KNOCKOUT_STARTS.map((round) => (
                    <option value={round.value} key={round.value}>
                      {round.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
        </div>

        <div className="bracket-bulk-actions" aria-label="Ajustes em lote da agenda">
          <span>Ajustar datas em lote</span>
          <button className="btn btn-outline btn-small" type="button" onClick={() => shiftBracketSchedule(-10)}>
            -10 min em todos
          </button>
          <button className="btn btn-outline btn-small" type="button" onClick={() => shiftBracketSchedule(10)}>
            +10 min em todos
          </button>
          <label>
            Começar às
            <input type="time" onChange={(event) => setBracketStartTime(event.target.value)} />
          </label>
        </div>

        {selectedSportTeams.length >= 2 && bracketGenerated ? (
          <>
            {tournamentPlan.groups.length ? (
              <div className="tournament-groups-preview">
                {tournamentPlan.groups.map((group) => (
                  <article className="tournament-group-card" key={group.name}>
                    <span>{group.name}</span>
                    {group.teams.map((team) => (
                      <label className="group-team-editor" key={team.id}>
                        <small>Time</small>
                        <select value={team.id} onChange={(event) => swapBracketTeam(team.id, event.target.value)}>
                          {selectedSportTeams.map((option) => (
                            <option value={option.id} key={option.id}>
                              {option.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </article>
                ))}
              </div>
            ) : null}

            <div className="bracket-wheel" aria-hidden="true">
              {selectedSportTeams.map((team) => (
                <span key={`wheel-${team.id}`}>{team.nome}</span>
              ))}
            </div>

            <div className="bracket-preview">
              {bracketPreviewGames.map((game, index) => (
                <article className={`bracket-match ${game.stageType === 'group' ? 'is-group' : ''}`} key={`${game.id}-${index}`}>
                  <span>{game.rodada}</span>
                  <strong>
                    {game.timeA} x {game.timeB}
                  </strong>
                  <small>
                    {game.fase} | {game.dataHora ? formatDateTime(game.dataHora) : 'Defina a data inicial'}
                  </small>
                </article>
              ))}
              {tournamentPlan.byes.map((team) => (
                <article className="bracket-match is-bye" key={`bye-${team}`}>
                  <span>Sem adversário</span>
                  <strong>{team}</strong>
                  <small>Ficou fora da configuração atual de grupos/confrontos.</small>
                </article>
              ))}
            </div>
          </>
        ) : selectedSportTeams.length >= 2 ? (
          <EmptyState
            title="Chaveamento em branco"
            description="Clique em Sortear grupos/confrontos para montar a prévia antes de salvar os jogos."
          />
        ) : (
          <EmptyState
            title="Cadastre mais times"
            description="O gerador precisa de pelo menos dois times no esporte selecionado."
          />
        )}

        <div className="form-actions bracket-action-bar">
          <button
            className="btn btn-outline"
            type="button"
            disabled={saving || selectedSportTeams.length < 2}
            onClick={handleShuffleBracket}
          >
            {bracketGenerated ? 'Sortear de novo' : 'Sortear grupos/confrontos'}
          </button>
          <button
            className="btn btn-outline"
            type="button"
            disabled={saving || !bracketGenerated}
            onClick={clearBracketPreview}
          >
            Limpar
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={saving || selectedSportTeams.length < 2 || !bracketGenerated}
            onClick={handleGenerateBracket}
          >
            {saving ? 'Gerando...' : 'Salvar chaveamento'}
          </button>
        </div>
      </section>
      ) : null}

      {activeGameTool === 'manual' ? (
      <form className="admin-form" ref={gameFormRef} onSubmit={handleSubmit}>
        <div className="section-heading">
          <h2>{form.id ? 'Editar jogo' : 'Criar novo jogo'}</h2>
          <button className="btn btn-outline btn-small" type="button" onClick={resetForm}>
            {form.id ? 'Cancelar edição' : 'Novo jogo'}
          </button>
        </div>

        <div className="form-grid">
          <label>
            Esporte
            <select
              value={form.sportId}
              onChange={(event) => updateSportField(event.target.value)}
              required
            >
              <option value="">Selecione</option>
              {sports.map((sport) => (
                <option value={sport.id} key={sport.id}>
                  {sport.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fase
            <input
              type="text"
              list="phase-options"
              value={form.fase}
              onChange={(event) => updateField('fase', event.target.value)}
              placeholder="Ex.: Eliminatórias"
              required
            />
          </label>
          <label>
            Rodada ou etapa
            <input
              type="text"
              value={form.rodada}
              onChange={(event) => updateField('rodada', event.target.value)}
              placeholder="Ex.: Rodada 1, Semifinal, Final"
            />
          </label>
          <label>
            Time A
            {selectedSportTeams.length ? (
              <select value={form.timeA} onChange={(event) => updateField('timeA', event.target.value)} required>
                <option value="">Selecione</option>
                {form.timeA && !selectedSportTeams.some((team) => team.nome === form.timeA) ? (
                  <option value={form.timeA}>{form.timeA}</option>
                ) : null}
                {selectedSportTeams.map((team) => (
                  <option value={team.nome} key={team.id}>
                    {team.nome}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={form.timeA}
                onChange={(event) => updateField('timeA', event.target.value)}
                placeholder="Ex.: SESI Vermelho"
                required
              />
            )}
          </label>
          <label>
            Time B
            {selectedSportTeams.length ? (
              <select value={form.timeB} onChange={(event) => updateField('timeB', event.target.value)} required>
                <option value="">Selecione</option>
                {form.timeB && !selectedSportTeams.some((team) => team.nome === form.timeB) ? (
                  <option value={form.timeB}>{form.timeB}</option>
                ) : null}
                {selectedSportTeams.map((team) => (
                  <option value={team.nome} key={team.id}>
                    {team.nome}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={form.timeB}
                onChange={(event) => updateField('timeB', event.target.value)}
                placeholder="Ex.: SESI Branco"
                required
              />
            )}
          </label>
          <label>
            Data e horário
            <input
              type="datetime-local"
              value={form.dataHora}
              onChange={(event) => updateField('dataHora', event.target.value)}
              required
            />
          </label>
          <label>
            Palpites até
            <input
              type="datetime-local"
              value={form.limitePalpites}
              onChange={(event) => updateField('limitePalpites', event.target.value)}
              required
            />
          </label>
        </div>
        {!selectedSportTeams.length ? (
          <div className="form-hint">
            Cadastre times na aba Times para escolher Time A e Time B por lista, sem digitar tudo de novo.
          </div>
        ) : null}
        <datalist id="phase-options">
          {availablePhases.map((phase) => (
            <option value={phase} key={phase} />
          ))}
        </datalist>

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : form.id ? 'Salvar alterações' : 'Cadastrar jogo'}
          </button>
          <button
            className="btn btn-danger expired-action-button"
            type="button"
            disabled={saving || !expiredOpenGames.length}
            onClick={handleCloseExpiredGames}
          >
            Encerrar todos vencidos ({expiredOpenGames.length})
          </button>
          <button
            className="btn btn-outline"
            type="button"
            disabled={saving}
            onClick={() => runAdminAction(recalculateScores, 'Pontuação recalculada com sucesso.')}
          >
            Recalcular pontuação
          </button>
        </div>
      </form>
      ) : null}

      <div className="admin-layout">
        <section className="admin-list">
          <div className="section-heading">
            <h2>Jogos de {selectedSport.nome}</h2>
            <span>
              {filteredGames.length} de {selectedSportGames.length} jogo(s)
            </span>
          </div>

          <div className="admin-filter-panel">
            <label>
              Buscar
              <input
                type="search"
                value={gameSearch}
                onChange={(event) => setGameSearch(event.target.value)}
                placeholder="Time ou fase..."
              />
            </label>
            <label>
              Fase
              <select value={phaseFilter} onChange={(event) => setPhaseFilter(event.target.value)}>
                <option value={ALL_PHASES_FILTER}>Todas</option>
                {availablePhases.map((phase) => (
                  <option value={phase} key={phase}>
                    {phase}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-filter-bar" aria-label="Filtrar jogos por situação">
            <div className="segmented-control admin-segmented">
              {GAME_FILTERS.map((filter) => (
                <button
                  className={gameFilter === filter.value ? 'is-active' : ''}
                  key={filter.value}
                  type="button"
                  aria-pressed={gameFilter === filter.value}
                  onClick={() => setGameFilter(filter.value)}
                >
                  {filter.label} ({gameFilterCounts[filter.value]})
                </button>
              ))}
            </div>
          </div>

          {selectedSportGames.length ? (
            <div className="admin-game-list">
              {filteredGames.length ? (
                filteredGames.map((game) => {
                const gamePredictions = predictionsByGame.get(game.id) || []
                const pendingPredictions = getPendingPredictionCount(gamePredictions)
                const draft = finalScores[game.id] || {}
                const deadlineExpired = game.status === GAME_STATUS.OPEN && !isPredictionDeadlineOpen(game)
                const canSetFinalScore = game.status !== GAME_STATUS.OPEN
                const matchState = getMatchState(game)
                const isLive = matchState === MATCH_STATE.LIVE

                return (
                  <article
                    className={[
                      'admin-game-row',
                      'admin-game-row-detailed',
                      `game-status-${game.status}`,
                      deadlineExpired ? 'is-deadline-expired' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    key={game.id}
                  >
                    <div>
                      <strong>
                        {game.timeA} x {game.timeB}
                      </strong>
                      <span>{game.esporteNome}</span>
                      <span>{getGameStageLabel(game)}</span>
                      <span>{formatDateTime(game.dataHora)}</span>
                      <span>Palpites até {formatDateTime(game.limitePalpites)}</span>
                      <MatchBadge game={game} />
                      <span className={`status-badge status-${game.status}`}>{STATUS_LABELS[game.status]}</span>
                      {deadlineExpired ? <span className="status-badge status-expired">Prazo vencido</span> : null}
                    </div>
                    {canSetFinalScore ? (
                      <div className="final-score-form">
                        <label>
                          Placar A
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft.placarA ?? (isLive ? game.liveScoreA : game.placarA) ?? ''}
                            onChange={(event) => updateFinalScore(game.id, 'placarA', event.target.value)}
                          />
                        </label>
                        <label>
                          Placar B
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft.placarB ?? (isLive ? game.liveScoreB : game.placarB) ?? ''}
                            onChange={(event) => updateFinalScore(game.id, 'placarB', event.target.value)}
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="initial-score">
                        <span>Placar inicial</span>
                        <strong>0 x 0</strong>
                      </div>
                    )}
                    <div className="admin-actions">
                      <button className="btn btn-outline btn-small" type="button" onClick={() => editGame(game)}>
                        Editar
                      </button>
                      {matchState === MATCH_STATE.SCHEDULED ? <button className="btn btn-primary btn-small" type="button" disabled={saving || Boolean(game.seedLabelA || game.seedLabelB)} onClick={() => runAdminAction(() => startGame(game.id), 'Partida iniciada ao vivo. Palpites bloqueados.')}>Iniciar jogo</button> : null}
                      {isLive ? <button className="btn btn-outline btn-small" type="button" disabled={saving} onClick={() => runAdminAction(() => updateLiveScore({ gameId: game.id, placarA: draft.placarA ?? game.liveScoreA, placarB: draft.placarB ?? game.liveScoreB }), 'Placar ao vivo atualizado com sucesso.')}>Atualizar placar</button> : null}
                      {game.status === GAME_STATUS.OPEN ? (
                        <button
                          className="btn btn-outline btn-small"
                          type="button"
                          disabled={saving}
                          onClick={() => runAdminAction(() => closeGame(game.id), 'Jogo encerrado para palpites.')}
                        >
                          Fechar palpites
                        </button>
                      ) : !isLive ? (
                        <button
                          className="btn btn-outline btn-small"
                          type="button"
                          disabled={saving}
                          onClick={() => runAdminAction(() => reopenGame(game.id), 'Jogo reaberto para palpites.')}
                        >
                          Reabrir palpites
                        </button>
                      ) : null}
                      {canSetFinalScore ? (
                        <button
                          className="btn btn-primary btn-small"
                          type="button"
                          disabled={saving}
                          onClick={() => handleFinalize(game)}
                        >
                          {isLive ? 'Encerrar partida' : 'Finalizar'}
                        </button>
                      ) : null}
                      <button
                        className="btn btn-ghost btn-small"
                        type="button"
                        disabled={saving || gamePredictions.length > 0 || isLive}
                        title={isLive ? 'Encerre a partida antes de excluir.' : undefined}
                        onClick={() => runAdminAction(() => deleteGame(game.id), 'Jogo excluído com sucesso.')}
                      >
                        Excluir
                      </button>
                    </div>
                    <div className="prediction-counts">
                      <span>{gamePredictions.length} palpite(s)</span>
                      <strong>{pendingPredictions} pendente(s)</strong>
                    </div>
                  </article>
                )
              })
              ) : (
                <EmptyState title="Nenhum jogo neste filtro" description="Troque o filtro para ver outros jogos." />
              )}
            </div>
          ) : (
            <EmptyState
              title="Nenhum jogo neste esporte"
              description="Use o formulário acima para criar o primeiro jogo deste esporte."
            />
          )}
        </section>

      </div>
          </>
        ) : (
          <EmptyState
            title="Escolha um esporte"
            description="Volte para a aba Esportes e clique em um esporte cadastrado para criar jogos, finalizar placares e acompanhar palpites daquele esporte."
            action={
              <button className="btn btn-primary" type="button" onClick={() => setActiveAdminTab('esportes')}>
                Ver esportes
              </button>
            }
          />
        )
      ) : (
        null
      )}

      {activeAdminTab === 'participantes' ? (
        <section className="admin-tab-panel">
          <div className="section-heading">
            <h2>Participantes</h2>
            <span>{participants.length} participante(s)</span>
          </div>
          <div className="mini-list admin-participant-grid">
            {participants.length ? (
              participants.map((participant) => (
                <article className="mini-item" key={participant.id}>
                  <span>{participant.nome}</span>
                  <strong>{formatPoints(participant.pontos)} pts</strong>
                </article>
              ))
            ) : (
              <EmptyState title="Sem participantes" description="Usuários cadastrados aparecem aqui." />
            )}
          </div>
        </section>
      ) : null}

      {activeAdminTab === 'palpites' ? (
        <section className="admin-tab-panel">
          <div className="section-heading">
            <div>
              <h2>Palpites por jogo</h2>
              <p>{selectedSport ? `Filtrando por ${selectedSport.nome}.` : 'Mostrando todos os esportes.'}</p>
            </div>
            <span>{predictionTabGames.length} jogo(s)</span>
          </div>
          <div className="prediction-admin-list">
            {predictionTabGames.length ? (
              predictionTabGames.map((game) => {
                const gamePredictions = predictionsByGame.get(game.id) || []
                const pendingParticipants = getPendingParticipants(gamePredictions)
                const pendingPredictions = pendingParticipants.length

                return (
                  <article className="admin-prediction-group" key={`predictions-${game.id}`}>
                    <strong>
                      {game.timeA} x {game.timeB}
                    </strong>
                    <small>
                      {game.esporteNome} | {getGameStageLabel(game)}
                    </small>
                    <small>
                      {gamePredictions.length} enviado(s) | {pendingPredictions} pendente(s)
                    </small>
                    {pendingParticipants.length ? (
                      <div className="pending-list" aria-label="Participantes pendentes">
                        {pendingParticipants.slice(0, 8).map((participant) => (
                          <span key={participant.id}>{participant.nome}</span>
                        ))}
                        {pendingParticipants.length > 8 ? (
                          <span>+{pendingParticipants.length - 8} participante(s)</span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="pending-list is-complete">
                        <span>Todos os participantes enviaram palpite.</span>
                      </div>
                    )}
                    {gamePredictions.length ? (
                      gamePredictions.map((prediction) => (
                        <span key={prediction.id}>
                          {prediction.nomeUsuario}: {prediction.palpiteA} x {prediction.palpiteB} (
                          {formatPoints(prediction.pontos)} pts)
                        </span>
                      ))
                    ) : (
                      <span>Nenhum palpite enviado.</span>
                    )}
                  </article>
                )
              })
            ) : (
              <EmptyState title="Sem jogos" description="Cadastre jogos para acompanhar palpites." />
            )}
          </div>
        </section>
      ) : null}

      </div>
      </div>

      {confirmDialog ? (
        <div className="modal-backdrop" role="presentation" onClick={closeConfirmDialog}>
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirm-modal-mark" aria-hidden="true" />
            <div className="confirm-modal-content">
              <span className="eyebrow">Confirmação</span>
              <h2 id="confirm-modal-title">{confirmDialog.title}</h2>
              <p>{confirmDialog.description}</p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" type="button" disabled={saving} onClick={closeConfirmDialog}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="button" disabled={saving} onClick={handleConfirmDialog}>
                {saving ? 'Processando...' : confirmDialog.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}
