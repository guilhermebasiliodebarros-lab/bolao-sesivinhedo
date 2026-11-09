const FORMATS = ['grupos-mata-mata', 'sorteio', 'todos-contra-todos']

export function validateDraw(teams, config) {
  if (teams.length < 2) return 'Cadastre pelo menos duas turmas para iniciar o sorteio.'
  if (teams.some((team) => !team.id || !team.nome) || new Set(teams.map((team) => team.id)).size !== teams.length) return 'Confira o cadastro das turmas antes de sortear.'
  if (!FORMATS.includes(config.formato)) return 'Escolha um formato de torneio válido.'
  if (config.formato === 'grupos-mata-mata') {
    const groups = Number(config.grupos), size = Number(config.timesPorGrupo)
    if (!Number.isSafeInteger(groups) || groups < 1 || !Number.isSafeInteger(size) || size < 2) return 'Informe uma quantidade inteira de grupos e pelo menos duas turmas por grupo.'
    if (groups * size !== teams.length) return `A configuração precisa acomodar todas as ${teams.length} turmas. Ajuste os grupos e as turmas por grupo antes de sortear.`
  }
  return ''
}

// Rejection sampling avoids favouring an index when the range does not divide 2^32.
function secureIndex(size) {
  const ceiling = 0x100000000 - (0x100000000 % size)
  const buffer = new Uint32Array(1)
  do { globalThis.crypto.getRandomValues(buffer) } while (buffer[0] >= ceiling)
  return buffer[0] % size
}

export function drawTeamOrder(teams, config, pickIndex = secureIndex) {
  const error = validateDraw(teams, config)
  if (error) throw new Error(error)
  const ordered = teams.map((team) => ({ ...team }))
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    const picked = pickIndex(index + 1)
    if (!Number.isInteger(picked) || picked < 0 || picked > index) throw new Error('Não foi possível gerar o sorteio. Tente novamente.')
    ;[ordered[index], ordered[picked]] = [ordered[picked], ordered[index]]
  }
  return ordered
}

export function drawFingerprint(teams, config) {
  return JSON.stringify([
    config.formato,
    config.formato === 'grupos-mata-mata' ? [Number(config.grupos), Number(config.timesPorGrupo)] : null,
    teams.map((team) => [team.id, team.nome, team.sportId || '', team.turno || '', team.turma || '']).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  ])
}

export function drawSections(teams, config) {
  if (config.formato === 'grupos-mata-mata') {
    return Array.from({ length: Number(config.grupos) }, (_, index) => ({
      label: `Grupo ${String.fromCharCode(65 + index)}`,
      slots: teams.slice(index * Number(config.timesPorGrupo), (index + 1) * Number(config.timesPorGrupo)).map((team, offset) => ({ team, index: index * Number(config.timesPorGrupo) + offset })),
    }))
  }
  if (config.formato === 'todos-contra-todos') return [{ label: 'Grupo único · todos contra todos', slots: teams.map((team, index) => ({ team, index })) }]
  return Array.from({ length: Math.ceil(teams.length / 2) }, (_, index) => ({
    label: index * 2 + 1 < teams.length ? `Confronto ${index + 1}` : 'Sem adversário nesta rodada',
    slots: teams.slice(index * 2, index * 2 + 2).map((team, offset) => ({ team, index: index * 2 + offset })),
  }))
}

// Presentation order alternates groups; the original array still defines the draw.
export function drawRevealOrder(teams, config) {
  const sections = drawSections(teams, config)
  const entry = (section, slot) => ({ ...slot, destination: section.label })
  if (config.formato !== 'grupos-mata-mata') return sections.flatMap((section) => section.slots.map((slot) => entry(section, slot)))
  const order = []
  for (let row = 0; row < Math.max(...sections.map((section) => section.slots.length)); row += 1) {
    sections.forEach((section) => { if (section.slots[row]) order.push(entry(section, section.slots[row])) })
  }
  return order
}

export function createDrawPresentation(total) {
  return { total, count: 0, active: 0, phase: 'idle', automatic: false, replay: false, celebrated: false, cycle: 0 }
}

export function drawPresentationReducer(state, action) {
  const busy = !['idle', 'settled'].includes(state.phase)
  const begin = (replay = false) => ({ ...state, phase: 'mixing', active: replay ? state.count - 1 : state.count, replay, cycle: state.cycle + 1 })
  if (action.cycle != null && action.cycle !== state.cycle) return state
  switch (action.type) {
    case 'automatic': return state.count < state.total ? { ...(busy ? state : begin()), automatic: true } : state
    case 'pause': return { ...state, automatic: false }
    case 'next': return !busy && state.count < state.total ? begin() : state
    case 'repeat': return !busy && state.count > 0 ? { ...begin(true), automatic: false } : state
    case 'show': return state.phase === 'mixing' ? { ...state, phase: 'ejecting' } : state
    case 'ready': return state.phase === 'ejecting' ? { ...state, phase: 'ready' } : state
    case 'open': return state.phase === 'ready' ? { ...state, phase: 'opening' } : state
    case 'reveal': return state.phase === 'opening' ? { ...state, phase: 'revealing' } : state
    case 'fly': return state.phase === 'revealing' ? { ...state, phase: 'flying' } : state
    case 'land': return state.phase === 'flying' ? { ...state, phase: 'landing', count: state.replay ? state.count : Math.min(state.count + 1, state.total) } : state
    case 'settle': return state.phase === 'landing' ? { ...state, phase: 'settled', celebrated: state.celebrated || state.count === state.total } : state
    case 'advance': return !busy && state.automatic && state.count < state.total ? begin() : state
    case 'skip': return { ...state, count: state.total, active: state.total - 1, phase: 'settled', automatic: false, replay: false, celebrated: true, cycle: state.cycle + 1 }
    default: return state
  }
}
