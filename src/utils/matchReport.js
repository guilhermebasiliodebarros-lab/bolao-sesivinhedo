export function normalizeMatchReportInput(value = {}) {
  const field = (key, max) => {
    const text = String(value[key] || '').trim()
    if (text.length > max) throw new Error(key === 'notes' ? 'Use até 4.000 caracteres nas observações.' : 'Use até 100 caracteres nos nomes dos responsáveis.')
    return text
  }
  return { referee: field('referee', 100), responsibleA: field('responsibleA', 100), responsibleB: field('responsibleB', 100), notes: field('notes', 4000) }
}
