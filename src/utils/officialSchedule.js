import { OFFICIAL_SCHEDULE_2026 } from '../data/officialSchedule2026.js'
import { SCHOOL_CLASSES, schoolClassCode } from './schoolClasses.js'
import { getGameShift, getTeamShift } from './schoolShifts.js'
import { getSportProfile } from './sportRules.js'
import { getMatchState, MATCH_STATE } from './match.js'
import { automaticPredictionDeadline } from './predictionDeadline.js'
import { eventDate } from './tvSchedule.js'
import { buildScheduleChange } from './scheduleNotices.js'

const key = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const classInfo = (value) => SCHOOL_CLASSES.find((item) => item.code === schoolClassCode(value))
const pair = (a, b) => [schoolClassCode(a), schoolClassCode(b)].sort().join('_')
const seedKey = (value) => key(value).replace(/[^a-z0-9]/g, '')
const at = (date, time) => {
  if (!/^2026-(11|12)-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Data ou horário oficial inválido.')
  return new Date(`${date}T${time}:00-03:00`)
}
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' && !(value instanceof Date) ? Object.fromEntries(Object.keys(value).sort().map((name) => [name, canonical(value[name])])) : value
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
const sameField = (field, a, b) => ['dataHora', 'limitePalpites', 'dataHoraFim'].includes(field) ? eventDate(a).getTime() === eventDate(b).getTime() : same(a, b)
const one = (items, label) => {
  if (items.length > 1) throw new Error(`Mais de um cadastro corresponde a ${label}. Confira antes de importar.`)
  return items[0]
}

export function officialScheduleRows(manifest = OFFICIAL_SCHEDULE_2026) {
  return manifest.days.flatMap(({ date, shift, source, page, games }) => games.map(([number, start, end, area, sport, phase, a = '', b = '', notes = '']) => {
    const begins = at(date, start), ends = at(date, end)
    const groups = manifest.groups[shift]?.[sport]
    if (!manifest.sports[sport] || !groups || !['A', 'B', 'S1', 'S2', 'F'].includes(phase) || !['', 'I', 'A', 'B'].includes(area) || ends <= begins) {
      throw new Error('Linha inválida na programação oficial.')
    }
    const group = ['A', 'B'].includes(phase)
    const semifinal = phase.startsWith('S')
    if (group && [a, b].some((name) => !groups[phase]?.includes(name) || classInfo(name)?.turno !== shift)) throw new Error(`Equipe fora do grupo oficial: ${date}, jogo ${number}.`)
    if (semifinal && (a === b || !['A', 'B'].includes(a) || !['A', 'B'].includes(b))) throw new Error(`Grupos inválidos para a semifinal: ${date}, jogo ${number}.`)
    const matchKey = `${shift}-${sport}-${group ? `grupo-${phase.toLowerCase()}-${pair(a, b)}` : phase.toLowerCase()}`
    return { date, shift, source, page, number, start, end, area, sport, phase, a, b, notes, begins, ends, durationMinutes: (ends - begins) / 60000, group, semifinal, key: matchKey }
  }))
}

export function validateOfficialSchedule(manifest = OFFICIAL_SCHEDULE_2026) {
  const rows = officialScheduleRows(manifest)
  if (new Set(rows.map((row) => row.key)).size !== rows.length) throw new Error('A agenda contém partidas duplicadas.')
  for (const [shift, competitions] of Object.entries(manifest.groups)) for (const [sport, groups] of Object.entries(competitions)) {
    const matches = rows.filter((row) => row.shift === shift && row.sport === sport)
    for (const [group, members] of Object.entries(groups)) {
      const expected = members.flatMap((a, index) => members.slice(index + 1).map((b) => pair(a, b))).sort()
      const found = matches.filter((row) => row.phase === group).map((row) => pair(row.a, row.b)).sort()
      if (!same(expected, found)) throw new Error(`Confrontos incompletos ou duplicados: ${shift}, ${sport}, Grupo ${group}.`)
    }
    for (const phase of ['S1', 'S2', 'F']) if (matches.filter((row) => row.phase === phase).length !== 1) throw new Error('Semifinais e final precisam estar definidas uma vez por torneio.')
    const semifinals = matches.filter((row) => row.semifinal)
    if (semifinals[0].a === semifinals[1].a) throw new Error(`Chaveamento repetido nas semifinais: ${shift}, ${sport}.`)
    for (const semi of semifinals) if (matches.some((row) => row.group && row.ends > semi.begins)) throw new Error('Semifinal anterior ao término da fase de grupos.')
    const final = matches.find((row) => row.phase === 'F')
    if (semifinals.some((row) => row.ends > final.begins)) throw new Error('Final anterior ao término de uma semifinal.')
  }
  for (const [index, first] of rows.entries()) for (const second of rows.slice(index + 1)) {
    if (first.shift !== second.shift || first.date !== second.date || first.begins >= second.ends || second.begins >= first.ends) continue
    const onCourt = first.area && second.area
    if (onCourt && (first.area === 'I' || second.area === 'I' || first.area === second.area)) {
      throw new Error(`Sobreposição de quadra: ${first.date}, jogos ${first.number} e ${second.number}.`)
    }
    if (!onCourt && first.sport === second.sport) throw new Error(`Jogos simultâneos da mesma modalidade sem quadra definida: ${first.sport}, ${first.date}.`)
    if (onCourt && first.group && second.group && [first.a, first.b].some((name) => [second.a, second.b].includes(name))) throw new Error('Uma turma tem dois jogos definidos no mesmo horário na quadra.')
  }
  return rows
}

export function buildOfficialSchedulePlan({ sports, teams, games, predictions = [] }, { predictionPolicy = 'preserve', manifest = OFFICIAL_SCHEDULE_2026 } = {}) {
  if (!['preserve', 'open-defined'].includes(predictionPolicy)) throw new Error('Política de palpites inválida.')
  const rows = validateOfficialSchedule(manifest)
  const selectedSports = new Map(Object.entries(manifest.sports).map(([code, definition]) => {
    const sport = one(sports.filter((item) => definition.aliases.includes(key(item.nome || item.name))), definition.name)
    if (!sport) throw new Error(`Cadastre ${definition.name} antes de aplicar a agenda.`)
    return [code, sport]
  }))
  const tournaments = new Map()
  for (const [shift, competitions] of Object.entries(manifest.groups)) for (const code of Object.keys(competitions)) {
    const sport = selectedSports.get(code)
    const ids = [...new Set(games.filter((game) => game.sportId === sport.id && getGameShift(game) === shift).map((game) => game.tournamentId).filter(Boolean))]
    tournaments.set(`${shift}-${sport.id}`, one(ids, `torneio de ${manifest.sports[code].name} / ${shift}`) || `${sport.id}-${shift}-oficial-2026`)
  }
  const selected = new Set(), entries = []
  for (const row of rows) {
    const sport = selectedSports.get(row.sport)
    const candidates = games.filter((game) => game.sportId === sport.id && getGameShift(game) === row.shift)
    let current = one(candidates.filter((game) => game.officialSchedule?.key === row.key), row.key)
    if (!current) current = one(candidates.filter((game) => {
      if (row.group) return game.stageType === 'group' && key(game.groupName) === `grupo ${row.phase.toLowerCase()}` && pair(game.timeA, game.timeB) === pair(row.a, row.b)
      if (row.phase === 'F') return key(game.fase) === 'final' && game.placement !== 'third-place'
      const seeds = [`1o Grupo ${row.a}`, `2o Grupo ${row.b}`]
      return /semi/.test(key(game.fase)) && same([seedKey(game.qualifierSeedA || game.seedLabelA || game.timeA), seedKey(game.qualifierSeedB || game.seedLabelB || game.timeB)].sort(), seeds.map(seedKey).sort())
    }), row.key)
    if (current && (getMatchState(current) !== MATCH_STATE.SCHEDULED || current.startedAt || current.deletionPending || current.placarA != null || current.placarB != null || Number(current.liveScoreA || 0) || Number(current.liveScoreB || 0) || current.liveEvents?.length || current.scorerStats?.length)) throw new Error(`A partida ${current.id} tem início, resultado ou lances e precisa de revisão manual.`)
    if (current && selected.has(current.id)) throw new Error('Uma partida antiga foi associada a dois jogos oficiais.')
    if (current && predictions.some((pick) => pick.gameId === current.id) && row.group && (schoolClassCode(current.timeA) !== schoolClassCode(row.a) || schoolClassCode(current.timeB) !== schoolClassCode(row.b))) throw new Error('Uma inversão de equipes afetaria palpites existentes. Confira essa partida separadamente.')
    const id = current?.id || `oficial-2026-${row.key}`
    if (!current && games.some((game) => game.id === id)) throw new Error(`O identificador ${id} já está em uso.`)
    if (current) selected.add(id)
    entries.push({ row, current, id, sport })
  }
  const unmatched = games.filter((game) => tournaments.has(`${getGameShift(game)}-${game.sportId}`) && !selected.has(game.id))
  if (unmatched.length) throw new Error(`Há ${unmatched.length} partida(s) das modalidades selecionadas sem correspondência no mural. Nenhuma exclusão será automática.`)
  const idFor = (row, phase) => entries.find((entry) => entry.row.shift === row.shift && entry.row.sport === row.sport && entry.row.phase === phase).id
  const changes = [], officialGames = [], notices = []
  for (const { row, current, id, sport } of entries) {
    const profile = getSportProfile({ ...sport, nome: manifest.sports[row.sport].name })
    const teamFor = (name) => {
      const team = one(teams.filter((team) => team.sportId === sport.id && getTeamShift(team) === row.shift && (schoolClassCode(team.turma) || schoolClassCode(team.nome)) === schoolClassCode(name)), `${name} / ${sport.id}`)
      if (!team) throw new Error(`Equipe não encontrada: ${name}, ${manifest.sports[row.sport].name}.`)
      return team
    }
    const timeA = row.group ? classInfo(row.a).nome : row.semifinal ? `1o Grupo ${row.a}` : 'Vencedor Semifinal 1'
    const timeB = row.group ? classInfo(row.b).nome : row.semifinal ? `2o Grupo ${row.b}` : 'Vencedor Semifinal 2'
    const halfCourt = ['A', 'B'].includes(row.area) ? `Meia Quadra ${row.area}` : ''
    const data = {
      sportId: sport.id, esporteNome: manifest.sports[row.sport].name, turno: row.shift,
      tournamentId: tournaments.get(`${row.shift}-${sport.id}`), tournamentName: 'Interclasse 2026',
      fase: row.group ? 'Fase de grupos' : row.phase === 'F' ? 'Final' : 'Semifinal',
      rodada: row.group ? `Jogo ${row.number} · ${row.date}` : row.phase === 'F' ? 'Final' : `Semifinal ${row.phase.slice(1)}`,
      stageType: row.group ? 'group' : 'knockout', groupName: row.group ? `Grupo ${row.phase}` : '',
      timeA, timeB,
      teamIdA: row.group ? teamFor(row.a).id : '', teamIdB: row.group ? teamFor(row.b).id : '',
      turmaA: row.group ? classInfo(row.a).nome : '', turmaB: row.group ? classInfo(row.b).nome : '',
      sourceGameIdA: row.phase === 'F' ? idFor(row, 'S1') : '', sourceGameIdB: row.phase === 'F' ? idFor(row, 'S2') : '',
      sourceOutcomeA: 'winner', sourceOutcomeB: 'winner',
      seedLabelA: row.group ? '' : timeA, seedLabelB: row.group ? '' : timeB,
      qualifierGroupA: row.semifinal ? `Grupo ${row.a}` : '', qualifierGroupB: row.semifinal ? `Grupo ${row.b}` : '',
      qualifierSeedA: row.semifinal ? timeA : '', qualifierSeedB: row.semifinal ? timeB : '',
      nextGameId: row.semifinal ? idFor(row, 'F') : '', nextGameSlot: row.semifinal ? row.phase === 'S1' ? 'A' : 'B' : '', placement: '',
      dataHora: row.begins, dataHoraFim: row.ends, limitePalpites: automaticPredictionDeadline({ dataHora: row.begins }), durationMinutes: row.durationMinutes,
      venue: row.area ? 'Quadra' : current?.venue || '', venueArea: row.area ? halfCourt : current?.venueArea || '',
      status: predictionPolicy === 'open-defined' ? row.group ? 'aberto' : 'encerrado' : current?.status || 'encerrado',
      liveStatus: 'scheduled', matchCondition: 'normal', placarA: null, placarB: null, preparation: null,
      ...profile,
      officialSchedule: { version: manifest.version, key: row.key, source: row.source, page: row.page, row: row.number, date: row.date, start: row.start, end: row.end, court: row.area === 'I' ? 'Quadra Inteira' : halfCourt, notes: row.notes },
    }
    const fields = current ? Object.fromEntries(Object.entries(data).filter(([field, value]) => !sameField(field, current[field], value))) : { ...data, liveScoreA: 0, liveScoreB: 0, setScores: [], currentSet: { a: 0, b: 0 }, liveEvents: [], scorerStats: [], scoreRevision: 0, vestA: '', vestB: '' }
    if (Object.keys(fields).length) {
      if (current) fields.scoreRevision = (Number(current.scoreRevision) || 0) + 1
      changes.push({ collection: 'games', id, type: current ? 'update' : 'create', fields })
      const notice = buildScheduleChange(current || { id }, { ...current, ...data, id })
      if (notice) notices.push(notice)
    }
    officialGames.push({ ...current, ...data, id, scoreRevision: fields.scoreRevision ?? current?.scoreRevision ?? 0 })
  }
  for (const [code, sport] of selectedSports) {
    const name = manifest.sports[code].name
    if (sport.nome !== name) changes.push({ collection: 'sports', id: sport.id, type: 'update', fields: { nome: name } })
    for (const team of teams.filter((item) => item.sportId === sport.id && item.esporteNome !== name)) changes.push({ collection: 'teams', id: team.id, type: 'update', fields: { esporteNome: name } })
  }
  return {
    version: manifest.version, predictionPolicy, changes, notices, officialGames,
    summary: { total: rows.length, morning: rows.filter((row) => row.shift === 'manha').length, afternoon: rows.filter((row) => row.shift === 'tarde').length, updateGames: changes.filter((item) => item.collection === 'games' && item.type === 'update').length, createGames: changes.filter((item) => item.collection === 'games' && item.type === 'create').length, sports: changes.filter((item) => item.collection === 'sports').length, teams: changes.filter((item) => item.collection === 'teams').length, untouchedGames: games.length - selected.size },
    organization: { blocks: manifest.days.flatMap((day) => day.blocks.map(([start, end, label]) => ({ date: day.date, shift: day.shift, start, end, label }))), breaks: manifest.breaks },
  }
}
