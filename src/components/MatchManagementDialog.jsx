import { useEffect, useId, useRef, useState } from 'react'
import { changeMatchCondition, loadMatchReport, saveMatchReport } from '../services/bolaoService.js'
import { getMatchCondition, getMatchState, MATCH_STATE } from '../utils/match.js'
import { formatDateTime } from '../utils/format.js'
import MatchBadge from './MatchBadge.jsx'
import MatchNotice from './MatchNotice.jsx'
import SportScoreInputs from './SportScoreInputs.jsx'
import { findScheduleConflicts } from '../utils/scheduleConflicts.js'
import MatchAttendanceForm from './MatchAttendanceForm.jsx'
import { attendanceTeamKey } from '../utils/attendance.js'
import MatchScoreForm from './MatchScoreForm.jsx'
import RefereePanel from './RefereePanel.jsx'

function MatchReportForm({ game, teams, user }) {
  const [source] = useState(() => ({ game, teams }))
  const [report, setReport] = useState({ referee: '', responsibleA: '', responsibleB: '', notes: '' })
  const [players, setPlayers] = useState({ playersA: [], playersB: [] })
  const [attendance, setAttendance] = useState(null)
  const [includePlayers, setIncludePlayers] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  useEffect(() => {
    let active = true
    loadMatchReport(source.game, source.teams).then((result) => {
      if (!active) return
      setReport(result.report); setPlayers({ playersA: result.playersA, playersB: result.playersB }); setAttendance(result.attendance); setLoading(false)
    }).catch((error) => { if (active) { setMessage(error.message); setFailed(true); setLoadFailed(true); setLoading(false) } })
    return () => { active = false }
  }, [source])
  const act = async (action, success) => {
    setBusy(true); setMessage(''); setFailed(false)
    try { await action(); setMessage(success) } catch (error) { setFailed(true); setMessage(error.message) } finally { setBusy(false) }
  }
  const update = (field, value) => setReport((current) => ({ ...current, [field]: value }))
  return <form className="match-report-form" onSubmit={(event) => { event.preventDefault(); act(() => saveMatchReport(game.id, report, user), 'Súmula salva com sucesso.') }}>
    <p>Os nomes e as observações desta súmula ficam disponíveis apenas para a organização. O PDF usa os dados deste formulário; salve para manter o registro no sistema.</p>
    {loading ? <p role="status">Carregando súmula e elencos…</p> : null}
    <fieldset disabled={busy || loading || loadFailed}><legend>Responsáveis e observações</legend>
      <label>Árbitro / professor responsável<input type="text" maxLength="100" value={report.referee} onChange={(event) => update('referee', event.target.value)} /></label>
      <div className="form-grid">{['A', 'B'].map((side) => <label key={side}>Responsável · {game[`time${side}`]}<input type="text" maxLength="100" value={report[`responsible${side}`]} onChange={(event) => update(`responsible${side}`, event.target.value)} /></label>)}</div>
      <label>Observações da partida<textarea rows="6" maxLength="4000" value={report.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Ocorrências, decisões da arbitragem e observações para a organização." /></label>
      <label className="match-checkbox"><input type="checkbox" checked={includePlayers} onChange={(event) => setIncludePlayers(event.target.checked)} />Incluir jogadores no PDF</label>
      <small>Elencos cadastrados: {game.timeA}, {players.playersA.length} jogador(es); {game.timeB}, {players.playersB.length} jogador(es). O PDF inclui espaços para presença e assinaturas.</small>
      <div className="form-actions"><button className="btn btn-primary" type="submit">{busy ? 'Aguarde…' : 'Salvar súmula'}</button><button className="btn btn-outline" type="button" onClick={() => act(async () => {
        const { createMatchReportPDF } = await import('../services/matchReportPdf.js')
        const result = await createMatchReportPDF({ game, report, ...players, attendance, includePlayers })
        result.pdf.save(result.filename)
      }, 'PDF gerado com sucesso. Confira os downloads do navegador.')}>Baixar PDF</button></div>
    </fieldset>
    {message ? <div className={failed ? 'alert alert-error' : 'alert alert-success'} role={failed ? 'alert' : 'status'}>{message}</div> : null}
  </form>
}

function MatchConditionForm({ game, games, teams, user, onSaved }) {
  const condition = getMatchCondition(game)
  const [action, setAction] = useState(['postponed', 'cancelled'].includes(condition) ? 'reschedule' : 'postpone')
  const [reason, setReason] = useState('')
  const [winner, setWinner] = useState('')
  const [score, setScore] = useState({ placarA: '', placarB: '' })
  const [useScore, setUseScore] = useState(false)
  const [date, setDate] = useState('')
  const [deadline, setDeadline] = useState('')
  const [reopen, setReopen] = useState(false)
  const [review, setReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const finished = getMatchState(game) === MATCH_STATE.FINISHED
  const conflicts = action === 'reschedule' && date ? findScheduleConflicts({ ...game, dataHora: date }, games, teams) : []
  const labels = { postpone: 'Adiar partida', cancel: 'Cancelar partida', walkover: 'Registrar W.O.', reschedule: 'Reagendar partida' }
  const summary = action === 'walkover' ? `${game[`time${winner}`] || 'Selecione a equipe'} vence por W.O. Os palpites serão anulados, e o resultado atualizará a classificação e o chaveamento.`
    : action === 'postpone' ? 'A partida sai dos jogos ao vivo e dos próximos jogos. Os palpites ficam bloqueados até a organização reagendar.'
      : action === 'cancel' ? 'A partida será identificada como cancelada, sem pontuar na classificação. Os palpites ficam anulados e o jogo sai da agenda de próximos jogos.'
        : `Novo horário: ${formatDateTime(date)}. ${reopen ? 'Os palpites serão reabertos até o prazo informado.' : 'Os palpites continuarão bloqueados.'}${game.startedAt ? ' Ao retomar, o placar parcial será preservado.' : ''}`
  if (finished) return <div className="alert">Esta partida já tem resultado final. Para corrigir a situação, reabra o resultado pela lista de jogos. A correção fica bloqueada se a próxima fase já começou.</div>
  return <form className="match-condition-form" onSubmit={async (event) => {
    event.preventDefault()
    if (!review) { setReview(true); return }
    setBusy(true); setMessage('')
    try {
      await changeMatchCondition({ gameId: game.id, action, reason, winnerSide: winner, placarA: useScore ? score.placarA : undefined, placarB: useScore ? score.placarB : undefined, dataHora: date, limitePalpites: deadline || date, reopenPredictions: reopen, user })
      onSaved('Situação da partida atualizada com sucesso.')
    } catch (error) { setMessage(error.message); setReview(false) } finally { setBusy(false) }
  }}>
    <fieldset disabled={busy || review}><legend>Situação da partida</legend>
      <label>Ação<select value={action} onChange={(event) => { setAction(event.target.value); setMessage('') }}><option value="postpone">Adiar partida</option><option value="cancel">Cancelar partida</option><option value="walkover">Registrar W.O.</option>{['postponed', 'cancelled'].includes(condition) ? <option value="reschedule">Reagendar / retomar</option> : null}</select></label>
      {action === 'walkover' ? <><label>Equipe vencedora do W.O.<select required value={winner} onChange={(event) => setWinner(event.target.value)}><option value="">Selecione a vencedora</option><option value="A">{game.timeA}</option><option value="B">{game.timeB}</option></select></label><label className="match-checkbox"><input type="checkbox" checked={useScore} onChange={(event) => setUseScore(event.target.checked)} />Informar placar regulamentar do W.O.</label><p>Sem placar regulamentar, a vencedora recebe os pontos por vitória e o saldo não muda. Os palpites do W.O. ficam anulados.</p>{useScore ? <SportScoreInputs game={game} partials={false} value={score} onChange={(field, value) => setScore((current) => ({ ...current, [field]: value }))} /> : null}</> : null}
      {action === 'reschedule' ? <><div className="form-grid"><label>Novo dia e horário<input type="datetime-local" required value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Novo prazo de palpites<input type="datetime-local" required={reopen} value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label></div>{!game.startedAt ? <label className="match-checkbox"><input type="checkbox" checked={reopen} onChange={(event) => setReopen(event.target.checked)} />Reabrir os palpites</label> : <p>Esta partida já começou. Os palpites continuarão bloqueados e o placar parcial será preservado.</p>}</> : null}
      <label>Motivo público<textarea minLength="3" maxLength="500" required rows="3" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: chuva na quadra, ausência da equipe, mudança na programação." /></label><small>Este motivo aparece no calendário e na TV. Use as observações da súmula para informações restritas à organização.</small>
      {conflicts.length ? <div className="schedule-warning" role="status"><strong>Atenção: {conflicts.length} conflito(s) no novo horário</strong>{conflicts.slice(0, 5).map(({ game: other, reasons }) => <p key={other.id}>{reasons.join(' e ')}: {other.timeA} × {other.timeB} · {formatDateTime(other.dataHora)}</p>)}</div> : null}
    </fieldset>
    <div className="match-action-review"><strong>{labels[action]}</strong><p>{summary}</p>{review ? <p>Motivo: {reason}</p> : null}</div>
    {message ? <div className="alert alert-error" role="alert">{message}</div> : null}
    <div className="form-actions">{review ? <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setReview(false)}>Voltar e revisar</button> : null}<button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Salvando…' : review ? `Confirmar: ${labels[action]}` : 'Revisar alteração'}</button></div>
  </form>
}

export default function MatchManagementDialog({ game, games, teams, user, initialTab = 'condition', onClose, onSaved }) {
  const ref = useRef(null)
  const titleId = useId()
  const [tab, setTab] = useState(initialTab)
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close() }, [])
  const referee = tab === 'referee'
  return <dialog ref={ref} className={`match-management-dialog${referee ? ' referee-dialog' : ''}`} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="match-management-heading"><div><span className="eyebrow">{referee ? 'Modo árbitro · ' : ''}{game.esporteNome} · {game.tournamentName || game.fase}</span><h2 id={titleId}>{game.timeA} × {game.timeB}</h2>{!referee ? <><p>{formatDateTime(game.dataHora)}{game.venue ? ` · ${game.venue}` : ''}</p><MatchBadge game={game} /></> : null}</div><button className="btn btn-outline btn-small" type="button" onClick={onClose}>{referee ? 'Sair do modo árbitro' : 'Fechar'}</button></div>
    <MatchNotice game={game} />
    {!referee ? <nav className="segmented-control" aria-label="Gerenciar partida"><button type="button" className={tab === 'score' ? 'is-active' : ''} onClick={() => setTab('score')}>Placar</button>{getMatchState(game) === MATCH_STATE.LIVE ? <button type="button" onClick={() => setTab('referee')}>Modo árbitro</button> : null}<button type="button" className={tab === 'condition' ? 'is-active' : ''} onClick={() => setTab('condition')}>Situação da partida</button><button type="button" className={tab === 'attendance' ? 'is-active' : ''} onClick={() => setTab('attendance')}>Presença</button><button type="button" className={tab === 'report' ? 'is-active' : ''} onClick={() => setTab('report')}>Súmula / PDF</button></nav> : null}
    {referee ? <RefereePanel game={game} teams={teams} user={user} onSaved={onSaved} /> : tab === 'score' ? <MatchScoreForm game={game} teams={teams} user={user} onSaved={onSaved} /> : tab === 'condition' ? <MatchConditionForm game={game} games={games} teams={teams} user={user} onSaved={onSaved} /> : tab === 'attendance' ? <MatchAttendanceForm key={attendanceTeamKey(game)} game={game} teams={teams} user={user} /> : <MatchReportForm key={attendanceTeamKey(game)} game={game} teams={teams} user={user} />}
  </dialog>
}
