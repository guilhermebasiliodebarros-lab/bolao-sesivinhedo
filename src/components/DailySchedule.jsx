import { useState } from 'react'
import { dailySchedule, scheduleRow, SCHEDULE_COLUMNS } from '../utils/dailySchedule.js'
import { schoolDay } from '../utils/tvSchedule.js'
import EmptyState from './EmptyState.jsx'

export default function DailySchedule({ games, sports }) {
  const [day, setDay] = useState(() => schoolDay(new Date()))
  const [sport, setSport] = useState('')
  const [venue, setVenue] = useState('')
  const [includeCancelled, setIncludeCancelled] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const selected = dailySchedule(games, { day, sport, venue, includeCancelled })
  const venues = [...new Set(games.map((game) => game.venue).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const dates = [...new Set(games.map((game) => schoolDay(game.dataHora)).filter(Boolean))].sort()
  return <section className="daily-schedule" aria-label="Programação diária em PDF"><div className="section-heading"><div><span className="eyebrow">Organização do Interclasse</span><h2>Programação diária em PDF</h2><p>Imprima horários, modalidades, confrontos, locais, coletes e situação de cada jogo. O PDF acompanha os filtros abaixo.</p></div></div>
    <form onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setMessage(''); setFailed(false)
      try {
        const { createDailySchedulePDF } = await import('../services/dailySchedulePdf.js')
        const { pdf, filename } = await createDailySchedulePDF({ games, day, sport, venue, includeCancelled, sportName: sports.find((item) => item.id === sport)?.nome })
        pdf.save(filename); setMessage('PDF gerado. Confira os downloads do navegador.')
      } catch (error) { setMessage(error.message); setFailed(true) } finally { setBusy(false) }
    }}><fieldset disabled={busy}><legend>Selecionar programação</legend><div className="form-grid"><label>Dia da programação<input type="date" required value={day} onChange={(event) => setDay(event.target.value)} /></label><label>Modalidade<select value={sport} onChange={(event) => setSport(event.target.value)}><option value="">Todas as modalidades</option>{sports.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><label>Local<select value={venue} onChange={(event) => setVenue(event.target.value)}><option value="">Todos os locais</option>{venues.map((item) => <option key={item}>{item}</option>)}</select></label><label>Dias com jogos<select value={dates.includes(day) ? day : ''} onChange={(event) => { if (event.target.value) setDay(event.target.value) }}><option value="">Escolha um dia da agenda</option>{dates.map((item) => <option key={item} value={item}>{item.split('-').reverse().join('/')}</option>)}</select></label></div><label className="match-checkbox"><input type="checkbox" checked={includeCancelled} onChange={(event) => setIncludeCancelled(event.target.checked)} />Incluir jogos cancelados, identificados como cancelados</label><button className="btn btn-primary" type="submit" disabled={!selected.length}>{busy ? 'Gerando PDF…' : 'Baixar programação em PDF'}</button></fieldset></form>
    {message ? <div className={failed ? 'alert alert-error' : 'alert alert-success'} role={failed ? 'alert' : 'status'}>{message}</div> : null}
    <p role="status">{selected.length} partida(s) na programação selecionada. Local e coletes ainda não preparados aparecem como “A definir”.</p>
    {selected.length ? <div className="table-scroll"><table className="schedule-preview-table"><caption>Prévia da programação</caption><thead><tr>{SCHEDULE_COLUMNS.map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{selected.map((game) => <tr key={game.id}>{scheduleRow(game).map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table></div> : <EmptyState title="Nenhum jogo nesta seleção" description="Escolha um dos dias com jogos ou ajuste os filtros de modalidade e local." />}
  </section>
}
