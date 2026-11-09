import { normalizeFilterText } from './game.js'

export const SCHOOL_CLASSES_VERSION = 1
export const SCHOOL_CLASSES = Object.freeze([6, 7, 8, 9, 1, 2, 3].flatMap((year) => ['A', 'B'].map((letter) => Object.freeze({
  code: `${year}-${letter.toLowerCase()}`,
  nome: `${year}º ${letter}`,
  turma: `${year}º ${letter}`,
  categoria: year >= 6 ? 'Fundamental II' : 'Ensino Médio',
  turno: [6, 7, 8].includes(year) ? 'tarde' : 'manha',
}))))

export function schoolClassCode(value) {
  const text = normalizeFilterText(value).trim()
  const match = text.match(/^(?:turma\s*)?([1236789])(?:[º°ªo])?\s*(?:(?:ano|serie)\s*)?([ab])(?:\b|$)/)
  return match ? `${match[1]}-${match[2]}` : ''
}

export const schoolClassTeamId = (sportId, code) => `school_${encodeURIComponent(sportId)}_${code}`

export function schoolClassPlan(sport, teams = []) {
  if (!sport?.id || !String(sport.nome || sport.name || '').trim()) throw new Error('Modalidade inválida para cadastrar as turmas.')
  const sportName = sport.nome || sport.name
  const existing = teams.filter((team) => (team.sportId || team.esporteId) === sport.id)
  return SCHOOL_CLASSES.map(({ code, ...schoolClass }) => {
    const team = existing.find((item) => (schoolClassCode(item.turma) || schoolClassCode(item.nome || item.name || item.teamName)) === code)
    if (!team) return { type: 'create', id: schoolClassTeamId(sport.id, code), data: { ...schoolClass, sportId: sport.id, esporteNome: sportName, playerCount: 0 } }
    const data = {}
    if (team.turno !== schoolClass.turno) data.turno = schoolClass.turno
    if (!String(team.turma || '').trim()) data.turma = schoolClass.turma
    if (!String(team.categoria || team.category || '').trim()) data.categoria = schoolClass.categoria
    return { type: Object.keys(data).length ? 'update' : 'keep', id: team.id, data }
  })
}

// One atomic operation per sport. Stable IDs and a version marker make retries safe.
export async function synchronizeSchoolClasses(store) {
  const [sports, initialTeams] = await Promise.all([store.list('sports'), store.list('teams')])
  const result = { sports: 0, created: 0, updated: 0 }
  for (const sport of sports) {
    const initial = initialTeams.filter((team) => (team.sportId || team.esporteId) === sport.id)
    const paths = [...new Set([...SCHOOL_CLASSES.map((item) => schoolClassTeamId(sport.id, item.code)), ...initial.map((team) => team.id)])]
    const outcome = await store.runTransaction(async (transaction) => {
      const currentSport = await transaction.get(`sports/${sport.id}`)
      if (!currentSport || Number(currentSport.schoolClassesVersion) >= SCHOOL_CLASSES_VERSION) return { sports: 0, created: 0, updated: 0 }
      const currentTeams = (await Promise.all(paths.map((id) => transaction.get(`teams/${id}`)))).filter(Boolean)
      const plan = schoolClassPlan(currentSport, currentTeams)
      const counts = { sports: 1, created: 0, updated: 0 }
      for (const item of plan) {
        const path = `teams/${item.id}`
        if (item.type === 'create') {
          if (currentTeams.some((team) => team.id === item.id)) throw new Error('Um cadastro de turma foi alterado. Atualize a página e tente novamente.')
          transaction.create(path, { ...item.data, createdAt: store.timestamp(), updatedAt: store.timestamp() })
          counts.created++
        } else if (item.type === 'update') {
          transaction.update(path, { ...item.data, updatedAt: store.timestamp() })
          counts.updated++
        }
      }
      transaction.update(`sports/${sport.id}`, { schoolClassesVersion: SCHOOL_CLASSES_VERSION, schoolClassesSeededAt: store.timestamp() })
      return counts
    })
    for (const key of Object.keys(result)) result[key] += outcome[key]
  }
  return result
}
