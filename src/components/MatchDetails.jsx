const colors = { Vermelho: '#d92a35', Azul: '#2874df', Amarelo: '#f4d13e', Verde: '#37a76b', Laranja: '#ed8a31', Rosa: '#eb8fc4', Branco: '#fff', Preto: '#171e28', Roxo: '#9264cc' }

import { matchVenueLabel } from '../utils/matchVenue.js'

export default function MatchDetails({ game, compact = false }) {
  if (!game.venue && !game.vestA && !game.vestB) return null
  return <div className={compact ? 'match-details is-compact' : 'match-details'}>{game.venue ? <strong className="match-venue">📍 {matchVenueLabel(game)}</strong> : null}{['A', 'B'].map((side) => game[`vest${side}`] ? <span className="match-vest" key={side}><i aria-hidden="true" style={{ background: colors[game[`vest${side}`]] || '#8a98ac' }} />{compact ? side : game[`time${side}`]}: colete {game[`vest${side}`].toLocaleLowerCase('pt-BR')}</span> : null)}</div>
}
