export function normalizeFilterText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}

export function getGameStageLabel(game) {
  return [game?.fase, game?.rodada].filter(Boolean).join(' - ') || 'Fase unica'
}

export function gameMatchesSearch(game, searchTerm) {
  const normalizedTerm = normalizeFilterText(searchTerm)

  if (!normalizedTerm) {
    return true
  }

  return [game.timeA, game.timeB, game.esporteNome, game.fase, game.rodada]
    .map(normalizeFilterText)
    .some((value) => value.includes(normalizedTerm))
}

export function getUniqueGamePhases(games) {
  return [...new Set(games.map((game) => game.fase).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export function getUniqueGameSports(games) {
  const sports = new Map()

  games.forEach((game) => {
    const id = game.sportId || game.esporteNome

    if (id) {
      sports.set(id, {
        id,
        nome: game.esporteNome || 'Geral',
      })
    }
  })

  return [...sports.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function getSportVisualClass(sportName) {
  const normalized = normalizeFilterText(sportName)

  if (normalized.includes('fut') || normalized.includes('soccer')) {
    return 'sport-visual-field'
  }

  if (normalized.includes('basquete') || normalized.includes('basket')) {
    return 'sport-visual-court'
  }

  if (normalized.includes('volei') || normalized.includes('volley')) {
    return 'sport-visual-net'
  }

  if (normalized.includes('hand')) {
    return 'sport-visual-handball'
  }

  if (normalized.includes('tenis') || normalized.includes('ping') || normalized.includes('mesa')) {
    return 'sport-visual-table'
  }

  if (normalized.includes('queimada') || normalized.includes('dodge')) {
    return 'sport-visual-dodgeball'
  }

  return 'sport-visual-generic'
}
