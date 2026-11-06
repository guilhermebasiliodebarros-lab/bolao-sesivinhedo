import { normalizePlayerInput } from './player.js'

export const nameKey = (name) => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()

export function parseRosterText(text, existing = []) {
  const seen = new Set(existing.map((player) => nameKey(player.nome)))
  let columns = null
  const rows = []
  String(text || '').split(/\r?\n/).forEach((raw, index) => {
    const line = raw.replace(/^\s*(?:[•●▪*-]|\d{1,4}\s*[.)\-:])\s*/, '').trim()
    if (!line || /^\d+$/.test(line)) return
    const cells = line.split(/[\t;|]/).map((cell) => cell.trim())
    const keys = cells.map(nameKey)
    const nameColumn = keys.findIndex((cell) => ['nome', 'nome completo', 'nome do jogador', 'jogador', 'aluno'].includes(cell))
    if (nameColumn >= 0) { columns = { name: nameColumn, position: keys.findIndex((cell) => ['posicao', 'funcao'].includes(cell)), captain: keys.findIndex((cell) => ['capitao', 'capita'].includes(cell)) }; return }
    if (/^(lista|relacao|equipe|turma|jogadores|alunos)\b/.test(nameKey(line)) && cells.length === 1) return
    const offset = !columns && /^\d+$/.test(cells[0]) && cells.length > 1 ? 1 : 0
    const nome = cells[columns?.name ?? offset] || ''
    const posicao = cells[columns ? columns.position : offset + 1] || ''
    const capitao = ['sim', 's', 'capitao', 'capita', 'c', 'yes'].includes(nameKey(cells[columns ? columns.captain : offset + 2]))
    let issue = ''
    try { normalizePlayerInput({ nome, posicao, capitao }); if (!/\p{L}/u.test(nome)) issue = 'Confira o nome.' } catch (error) { issue = error.message }
    if (seen.has(nameKey(nome))) issue = 'Nome já cadastrado ou repetido na lista.'
    seen.add(nameKey(nome))
    rows.push({ id: `line-${index}`, nome, posicao, capitao, selected: !issue, issue })
  })
  return rows
}
