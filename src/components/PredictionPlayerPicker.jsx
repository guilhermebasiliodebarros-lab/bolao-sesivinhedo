import { useEffect, useId, useState } from 'react'
import { subscribePredictionRoster } from '../services/bolaoService.js'
import { predictionPlayerKey, topScorerWinners, usesTopScorer } from '../utils/predictionPlayers.js'
import './PredictionPlayerPicker.css'

export default function PredictionPlayerPicker({ game, value = '', selectedName = '', onChange, disabled = false }) {
  const id = useId()
  const gameKey = JSON.stringify({ id: game.id, sportId: game.sportId, esporteNome: game.esporteNome, timeA: game.timeA, timeB: game.timeB, teamIdA: game.teamIdA, teamIdB: game.teamIdB, turno: game.turno, seedLabelA: game.seedLabelA, seedLabelB: game.seedLabelB })
  const [feed, setFeed] = useState({ key: '', groups: [], error: '' })
  useEffect(() => {
    const target = JSON.parse(gameKey)
    if (!usesTopScorer(target)) return
    return subscribePredictionRoster(target, (groups) => setFeed({ key: gameKey, groups, error: '' }), (error) => setFeed((current) => ({ ...current, key: gameKey, error })))
  }, [gameKey])
  if (!usesTopScorer(game)) return null
  const groups = feed.key === gameKey ? feed.groups : []
  const loading = feed.key !== gameKey || groups.some((group) => group.loading)
  const players = groups.flatMap((group) => group.players.map((player) => ({ ...player, key: predictionPlayerKey(group.teamId, player.id) })))
  const unavailable = value && !loading && !players.some((player) => player.key === value)
  const emptyTeams = groups.filter((group) => !group.loading && !group.players.length).map((group) => group.teamName)
  return <div className="prediction-player-picker">
    <label htmlFor={id}>Aluno que mais pontuará <span>· +1 ponto, opcional</span></label>
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled || loading || Boolean(feed.error) || (!players.length && !value)} aria-describedby={`${id}-help`}>
      <option value="">{loading ? 'Carregando os jogadores…' : players.length ? 'Escolher um aluno das duas salas' : 'Aguardando cadastro dos jogadores'}</option>
      {unavailable ? <option value={value} disabled>{selectedName || 'Aluno selecionado'} · indisponível</option> : null}
      {groups.filter((group) => group.players.length).map((group) => <optgroup key={group.teamId} label={group.teamName}>{group.players.map((player) => <option key={player.id} value={predictionPlayerKey(group.teamId, player.id)}>{player.nome}</option>)}</optgroup>)}
    </select>
    <small id={`${id}-help`}>{loading ? 'Consultando os elencos cadastrados para esta partida.' : players.length ? 'O ponto do aluno vale mesmo se você errar a sala vencedora. Pode escolher qualquer uma das salas; em caso de empate na maior pontuação, qualquer aluno empatado vale o bônus.' : 'A organização ainda não cadastrou jogadores para estas equipes. Você pode enviar o placar e voltar para escolher um aluno até o fechamento dos palpites.'}</small>
    {players.length && emptyTeams.length ? <small>Elenco de {emptyTeams.join(' e ')} ainda aguardando cadastro.</small> : null}
    {value ? <button type="button" className="link-button" disabled={disabled} onClick={() => onChange('')}>Retirar escolha do aluno</button> : null}
    {unavailable ? <p role="status">O aluno escolhido não está mais neste elenco. Selecione outro nome ou retire a escolha.</p> : null}
    {feed.error ? <p role="status">Não foi possível atualizar os jogadores: {feed.error}</p> : null}
  </div>
}

export function PredictionPlayerSummary({ game, prediction }) {
  if (!usesTopScorer(game) || !prediction) return null
  if (!prediction.topScorerName) return <p className="prediction-player-summary"><small>Nenhum aluno escolhido para o bônus.</small></p>
  const finished = ['finalizado', 'finished'].includes(game.status)
  return <div className="prediction-player-summary"><span>Aluno escolhido</span><strong>{prediction.topScorerName}</strong><small>{game[`time${prediction.topScorerSide}`] || 'Equipe da partida'}</small>{finished && !['cancelled', 'walkover', 'postponed'].includes(game.matchCondition) && !topScorerWinners(game).length ? <small>Bônus aguardando pontos por aluno conferidos pela organização.</small> : null}</div>
}
