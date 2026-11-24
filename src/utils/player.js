export const PLAYER_POSITIONS = Object.freeze(['Titular', 'Reserva'])

export function playerPosition(value) {
  const text = String(value || '').trim().toLocaleLowerCase('pt-BR')
  if (!text || /^titular(?:es)?$/.test(text)) return 'Titular'
  if (/^reservas?$/.test(text)) return 'Reserva'
  return ''
}

export function normalizePlayerInput(player) {
  const nome = String(player?.nome || '').trim().replace(/\s+/g, ' ')
  const posicao = playerPosition(player?.posicao)
  if (nome.length < 2 || nome.length > 100) throw new Error('Informe o nome do jogador com 2 a 100 caracteres.')
  if (!posicao) throw new Error('Escolha Titular ou Reserva para o jogador.')
  return { nome, posicao, capitao: Boolean(player?.capitao) }
}
