import { useRef, useState } from 'react'
import { requestFinalReport } from '../services/serverService.js'
import { buildFinalReport } from '../utils/finalReport.js'
import { formatNoticeDate } from '../utils/scheduleNotices.js'
import { shiftLabel } from '../utils/schoolShifts.js'
import { formatPoints } from '../utils/format.js'
import './FinalReportPanel.css'

export default function FinalReportPanel({ games, sports }) {
  const [filters, setFilters] = useState({ sportId: '', shift: '', tournamentId: '' })
  const [prepared, setPrepared] = useState(null), [busy, setBusy] = useState(''), [error, setError] = useState('')
  const lock = useRef(false)
  const competitions = [...new Map(games.filter((game) => (!filters.sportId || game.sportId === filters.sportId) && (!filters.shift || game.turno === filters.shift) && game.tournamentId).map((game) => [game.tournamentId, game.tournamentName || 'Torneio sem nome'])).entries()]
  const currentKey = JSON.stringify(filters)
  const report = prepared?.key === currentKey ? prepared.report : null
  const prepare = async () => {
    if (lock.current) return
    lock.current = true; setBusy('prepare'); setError('')
    try {
      const data = await requestFinalReport(filters)
      const labels = { sport: sports.find((sport) => sport.id === filters.sportId)?.nome || '', shift: filters.shift ? shiftLabel(filters.shift) : '', tournament: competitions.find(([id]) => id === filters.tournamentId)?.[1] || '' }
      setPrepared({ key: currentKey, report: buildFinalReport(data, labels) })
    } catch (requestError) { setError(requestError.message) }
    finally { lock.current = false; setBusy('') }
  }
  const download = async () => {
    if (!report || lock.current) return
    lock.current = true; setBusy('download'); setError('')
    try { const { createFinalReportPDF } = await import('../services/finalReportPdf.js'); const result = await createFinalReportPDF(report); result.pdf.save(result.filename) }
    catch (requestError) { setError(requestError.message) }
    finally { lock.current = false; setBusy('') }
  }
  return <section className="final-report-panel" aria-label="Relatório final do evento"><div className="section-heading"><div><span className="eyebrow">Encerramento e prestação de contas</span><h2>Relatório final do evento</h2><p>Reúna resultados, campeões, classificação dos professores, tabelas das equipes e artilharia em um PDF.</p></div></div>
    <div className="report-filters"><label>Modalidade<select value={filters.sportId} disabled={Boolean(busy)} onChange={(event) => setFilters({ ...filters, sportId: event.target.value, tournamentId: '' })}><option value="">Todas as modalidades</option>{sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.nome}</option>)}</select></label><label>Turno<select value={filters.shift} disabled={Boolean(busy)} onChange={(event) => setFilters({ ...filters, shift: event.target.value, tournamentId: '' })}><option value="">Todos os turnos</option><option value="manha">Manhã</option><option value="tarde">Tarde</option></select></label><label>Torneio<select value={filters.tournamentId} disabled={Boolean(busy)} onChange={(event) => setFilters({ ...filters, tournamentId: event.target.value })}><option value="">Todos os torneios</option>{competitions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label></div>
    <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={prepare}>{busy === 'prepare' ? 'Conferindo os registros no servidor…' : 'Conferir relatório'}</button>
    {error ? <p role="alert" className="alert alert-error">{error}</p> : null}
    {report ? <div className="final-report-preview"><div className="report-status"><strong>{report.status === 'parcial' ? 'Relatório parcial' : 'Relatório final da seleção'}</strong><span>Preparado em {formatNoticeDate(report.generatedAt)}</span></div>{report.pending ? <p className="report-pending-note">Há {report.pending} partida(s) pendente(s). O documento identifica essa situação e apresenta apenas os resultados oficiais concluídos.</p> : null}
      <div className="report-summary">{[[report.total, 'Partidas'], [report.played, 'Resultados concluídos'], [report.pending, 'Pendentes'], [report.ranking.length, 'Professores']].map(([number, label]) => <div key={label}><strong>{number}</strong><span>{label}</span></div>)}</div>
      <h3>Campeões e definições</h3><div className="report-champions">{report.champions.map((row, index) => <article key={index}><span>{row.sport} · {row.shift} · {row.tournament}</span><strong>{row.champion || row.situation}</strong></article>)}</div>
      <details><summary>Conferir a classificação dos professores</summary><div className="report-ranking-preview">{report.ranking.map(({ participant, position }) => <p key={participant.id}><span>{position}º · {participant.nome}</span><strong>{formatPoints(participant.pontos)} pts</strong></p>)}</div></details>
      <p className="report-completeness">O PDF inclui todos os registros da seleção, as posições compartilhadas nos empates e os primeiros nomes dos atletas. Contas, e-mails e observações privadas das súmulas ficam fora do relatório.</p>
      <div className="form-actions"><button type="button" className="btn btn-primary" disabled={Boolean(busy) || !report.total} onClick={download}>{busy === 'download' ? 'Gerando PDF…' : 'Baixar PDF completo'}</button><button type="button" className="btn btn-outline" disabled={Boolean(busy)} onClick={prepare}>Atualizar conferência</button></div>
    </div> : null}
  </section>
}
