import { useId, useRef, useState } from 'react'
import useModalDialog from '../hooks/useModalDialog.js'
import { redistributeTournamentSchedule } from '../services/bolaoService.js'
import { buildScheduleRedistribution, scheduleFingerprint, schedulePlanFingerprint } from '../utils/tournamentSchedule.js'
import { formatDateTime } from '../utils/format.js'

export default function TournamentScheduleDialog({ tournament, onClose, onSaved }) {
  const ref = useRef(null)
  const title = useId()
  const [source] = useState(() => ({ games: tournament.games, now: new Date() }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const plan = buildScheduleRedistribution(source.games, source.now)
  const stale = source.games.length !== tournament.games.length || source.games.some((game) => !tournament.games.some((current) => current.id === game.id && scheduleFingerprint(current) === scheduleFingerprint(game)))
  useModalDialog(ref)
  return <dialog ref={ref} className="match-management-dialog tournament-schedule-dialog" aria-labelledby={title} onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="match-management-heading"><div><span className="eyebrow">{tournament.esporteNome} · {tournament.nome}</span><h2 id={title}>Reorganizar ordem dos jogos</h2><p>Distribua os confrontos por rodadas, usando os horários disponíveis da fase de grupos ou todos contra todos.</p></div><button type="button" className="btn btn-outline btn-small" disabled={busy} onClick={onClose}>Fechar</button></div>
    <p>São reorganizados jogos agendados que ainda não começaram, no mesmo dia e local. Os confrontos continuam ligados às mesmas equipes e palpites. O prazo de cada jogo acompanha a mudança de horário.</p>
    <div className="schedule-rest-summary"><div><span>Jogos seguidos com a mesma equipe</span><strong>{plan.beforeSummary.consecutive} → {plan.afterSummary.consecutive}</strong></div><div><span>Menor intervalo entre jogos de uma equipe</span><strong>{plan.afterSummary.minimumGap == null ? 'Sem repetição' : `${plan.afterSummary.minimumGap} outra(s) partida(s)`}</strong></div></div>
    {plan.afterSummary.consecutive ? <p className="schedule-warning">Com as equipes e horários disponíveis, ainda há jogos seguidos para uma equipe. Confira a prévia e reserve um intervalo adicional se necessário.</p> : null}
    {stale ? <p className="alert alert-error" role="alert">As partidas foram alteradas. Feche e reabra a prévia antes de aplicar.</p> : null}
    {plan.after.length ? <div className="table-scroll"><table className="schedule-preview-table"><caption>Prévia · {plan.after.length} partida(s), {plan.changes.length} horário(s) alterado(s)</caption><thead><tr><th>Ordem</th><th>Confronto</th><th>Grupo</th><th>Horário atual</th><th>Novo horário</th></tr></thead><tbody>{plan.after.map((game, index) => <tr key={game.id} data-game-id={game.id}><td>{index + 1}</td><td>{game.timeA} × {game.timeB}</td><td>{game.groupName || game.fase}</td><td>{formatDateTime(source.games.find((item) => item.id === game.id)?.dataHora)}</td><td>{formatDateTime(game.dataHora)}</td></tr>)}</tbody></table></div> : <p>Nenhuma partida disponível para reorganizar nesta seleção.</p>}
    <p className="form-hint">O início e o encerramento das partidas continuam manuais. Jogos que mudarem de horário precisarão de uma nova conferência antes de iniciar.</p>
    {error ? <p className="alert alert-error" role="alert">{error}</p> : null}
    <div className="form-actions"><button type="button" className="btn btn-primary" disabled={busy || stale || !plan.changes.length} onClick={async () => {
      setBusy(true); setError('')
      try { const changed = await redistributeTournamentSchedule({ tournamentId: tournament.id, expectedPlan: schedulePlanFingerprint(plan), expectedGames: source.games.map((game) => ({ id: game.id, fingerprint: scheduleFingerprint(game) })) }); onSaved(`${changed} horário(s) reorganizado(s) com sucesso. Calendário e TV atualizados.`) }
      catch (failure) { setError(failure.message) } finally { setBusy(false) }
    }}>{busy ? 'Aplicando…' : 'Aplicar nova ordem'}</button><button type="button" className="btn btn-outline" disabled={busy} onClick={onClose}>Voltar</button></div>
  </dialog>
}
