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
