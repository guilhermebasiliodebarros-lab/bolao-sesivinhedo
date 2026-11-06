export function normalizePlayerInput(player) {
  const nome = String(player?.nome || '').trim().replace(/\s+/g, ' ')
  const posicao = String(player?.posicao || '').trim()
  if (nome.length < 2 || nome.length > 100) throw new Error('Informe o nome do jogador com 2 a 100 caracteres.')
  if (posicao.length > 60) throw new Error('A posição deve ter até 60 caracteres.')
  return { nome, posicao, capitao: Boolean(player?.capitao) }
}
