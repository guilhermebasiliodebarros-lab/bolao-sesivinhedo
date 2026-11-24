import { normalizePlayerInput } from './player.js'

export const nameKey = (name) => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()

export function parseRosterText(text, existing = []) {
  const seen = new Set(existing.map((player) => nameKey(player.nome)))
  let columns = null
  let position = 'Titular'
  const rows = []
  String(text || '').split(/\r?\n/).forEach((raw, index) => {
    const line = raw.replace(/^\s*(?:[•●▪*-]|\d{1,4}\s*[.)\-:])\s*/, '').trim()
    if (!line || /^\d+$/.test(line)) return
    const cells = line.split(/[\t;|]/).map((cell) => cell.trim())
    const keys = cells.map(nameKey)
    const nameColumn = keys.findIndex((cell) => ['nome', 'nome completo', 'nome do jogador', 'jogador', 'aluno'].includes(cell))
    if (nameColumn >= 0) { columns = { name: nameColumn, position: keys.findIndex((cell) => ['posicao', 'funcao', 'escalacao', 'situacao', 'titular/reserva'].includes(cell)), captain: keys.findIndex((cell) => ['capitao', 'capita'].includes(cell)) }; return }
    if (/^(lista|relacao|equipe|turma|jogadores|alunos)\b/.test(nameKey(line)) && cells.length === 1) return
    const heading = !columns && line.match(/^(titular(?:es)?|reservas?)(?:\s*(?:\d+\s*)?[-:]\s*(.*)|\s*)$/i)
    const content = heading ? (heading[2] || '').trim() : line
    if (heading) position = /^reserva/i.test(heading[1]) ? 'Reserva' : 'Titular'
    if (!content) return
    const entries = columns || /[\t|]/.test(content) ? [content] : content.split(',')
    entries.forEach((entry, entryIndex) => {
      const values = entry.trim().split(/[\t;|]/).map((cell) => cell.trim())
      const offset = !columns && /^\d+$/.test(values[0]) && values.length > 1 ? 1 : 0
      const named = (values[columns?.name ?? offset] || '').split(':').map((part) => part.trim())
      const nome = named[0].trim().replace(/\s+/g, ' ')
      if (!nome) return
      const role = nameKey([...named.slice(1), columns ? values[columns.position] : values.slice(offset + 1).join(' ')].join(' '))
      const posicao = /\breservas?\b/.test(role) ? 'Reserva' : /\btitular(?:es)?\b/.test(role) ? 'Titular' : position
      const capitao = ['sim', 's', 'capitao', 'capita', 'c', 'yes'].includes(nameKey(values[columns ? columns.captain : offset + 2]))
      let issue = ''
      try { normalizePlayerInput({ nome, posicao, capitao }); if (!/\p{L}/u.test(nome)) issue = 'Confira o nome.' } catch (error) { issue = error.message }
      if (seen.has(nameKey(nome))) issue = 'Nome já cadastrado ou repetido na lista.'
      seen.add(nameKey(nome))
      rows.push({ id: `line-${index}-${entryIndex}`, nome, posicao, capitao, selected: !issue, issue })
    })
  })
  return rows
}
