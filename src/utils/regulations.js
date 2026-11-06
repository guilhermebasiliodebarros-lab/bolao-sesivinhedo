export const REGULATION_SECTIONS = [
  { id: 'participation', label: 'Participação e organização' },
  { id: 'classification', label: 'Classificação e vagas' },
  { id: 'tieBreak', label: 'Desempate' },
  { id: 'walkover', label: 'W.O. e ausências' },
  { id: 'notes', label: 'Outras orientações' },
]

export function normalizeRegulation(value = {}) {
  return Object.fromEntries(REGULATION_SECTIONS.map(({ id }) => {
    const text = String(value[id] || '').trim()
    if (text.length > 3000) throw new Error('Use até 3.000 caracteres em cada seção do regulamento.')
    return [id, text]
  }))
}
