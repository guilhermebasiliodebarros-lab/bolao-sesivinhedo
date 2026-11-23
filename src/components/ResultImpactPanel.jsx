import { useEffect, useMemo, useState } from 'react'
import { subscribeAllPredictions, subscribeGames, subscribeParticipants, subscribeTeams } from '../services/bolaoService.js'
import { buildResultImpact } from '../utils/resultImpact.js'
import { formatPoints } from '../utils/format.js'
import './ResultImpactPanel.css'

export default function ResultImpactPanel({ game, candidate, onReady }) {
  const [data, setData] = useState({ games: [], users: [], predictions: [], teams: [] })
  const [loaded, setLoaded] = useState({ games: false, users: false, predictions: false, teams: false })
  const [error, setError] = useState('')
  useEffect(() => {
    const receive = (key) => (items) => { setData((value) => ({ ...value, [key]: items })); setLoaded((value) => ({ ...value, [key]: true })) }
    const subscriptions = [subscribeGames(receive('games'), setError), subscribeParticipants(receive('users'), setError), subscribeAllPredictions(receive('predictions'), setError), subscribeTeams(receive('teams'), setError)]
    return () => subscriptions.forEach((stop) => stop())
  }, [])
  const allLoaded = Object.values(loaded).every(Boolean)
  const result = useMemo(() => {
    if (!allLoaded) return null
    try { return { impact: buildResultImpact(data, game.id, candidate) } }
    catch (requestError) { return { error: requestError.message } }
  }, [allLoaded, data, game.id, candidate])
  const ready = Boolean(result?.impact && !result.impact.blocked && !error)
  useEffect(() => { onReady?.(ready) }, [ready, onReady])
  if (error || result?.error) return <p className="alert alert-error" role="alert">Não foi possível conferir a prévia. {error || result?.error}</p>
  if (!allLoaded) return <p className="impact-loading" role="status">Conferindo o impacto no ranking e no campeonato…</p>
  const impact = result.impact
  return <section className="result-impact" aria-label="Prévia do impacto do resultado"><h3>O que muda com este resultado</h3><div className="impact-summary"><span><strong>{impact.ranking.length}</strong> participantes com mudança</span><span><strong>{impact.standings.length}</strong> equipes com alteração na tabela</span><span><strong>{impact.nextMatches.length}</strong> vagas do chaveamento alteradas</span></div>
    <p>Resultado: <strong>{impact.beforeWinner}</strong> → <strong>{impact.afterWinner}</strong></p>
    {impact.blocked ? <p className="alert alert-error" role="alert">A próxima fase já começou. Confira as partidas seguintes antes de corrigir este resultado.</p> : null}
    {impact.ranking.length ? <details open><summary>Classificação dos professores</summary><div className="impact-table-scroll"><table><thead><tr><th>Participante</th><th>Pontos</th><th>Posição</th></tr></thead><tbody>{impact.ranking.map((row) => <tr key={row.id}><th scope="row">{row.nome}</th><td>{formatPoints(row.beforePoints)} → <strong>{formatPoints(row.afterPoints)}</strong></td><td>{row.beforePosition}º → <strong>{row.afterPosition}º</strong></td></tr>)}</tbody></table></div></details> : <p>Nenhuma mudança nos pontos ou posições dos professores.</p>}
    {impact.standings.length ? <details><summary>Classificação das equipes</summary><div className="impact-table-scroll"><table><thead><tr><th>Equipe / grupo</th><th>Pontos</th><th>Posição</th></tr></thead><tbody>{impact.standings.map((row) => <tr key={`${row.group}:${row.team}`}><th scope="row">{row.team}<small>{row.group}</small></th><td>{row.beforePoints} → {row.afterPoints}</td><td>{row.beforePosition}º → {row.afterPosition}º</td></tr>)}</tbody></table></div></details> : null}
    {impact.nextMatches.length ? <details open><summary>Equipes que avançam no chaveamento</summary>{impact.nextMatches.map((row) => <p key={`${row.id}:${row.side}`}><strong>{row.match}</strong><br />{row.reason}: {row.before || 'A definir'} → <strong>{row.after}</strong></p>)}</details> : null}
    <small className="impact-footnote">Prévia atualizada com os resultados e palpites disponíveis. A gravação publica o resultado; a pontuação oficial é apurada no servidor.</small>
  </section>
}
