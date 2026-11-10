import { useId, useMemo, useRef, useState } from 'react'
import useModalDialog from '../hooks/useModalDialog.js'
import { saveCalendarGame } from '../services/bolaoService.js'
import { calendarCandidate, calendarColumns, calendarConflictSignature, calendarConflicts, calendarFingerprint, calendarSlotGames, calendarSlots, canScheduleGame } from '../utils/visualSchedule.js'
import { eventDate, schoolDay, SCHOOL_TIMEZONE } from '../utils/tvSchedule.js'
import { formatDateTime } from '../utils/format.js'
import { predictionDeadlineInput } from '../utils/predictionDeadline.js'
import { getGameShift, shiftLabel } from '../utils/schoolShifts.js'
import './VisualSchedule.css'

const localInput = (value) => {
  const date = eventDate(value)
  if (!Number.isFinite(date.getTime())) return ''
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}
const clock = (value) => localInput(value).slice(11)

function ScheduleEditor({ source, initial, games, teams, venues, onClose, onSaved }) {
  const ref = useRef(null), title = useId(), venueList = useId()
  const [form, setForm] = useState(initial)
  const [accepted, setAccepted] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useModalDialog(ref)
  const current = games.find((game) => game.id === source.id)
  const stale = !current || calendarFingerprint(current) !== calendarFingerprint(source)
  let candidate, inputError = ''
  try { candidate = calendarCandidate(source, form) } catch (failure) { inputError = failure.message }
  const conflicts = candidate ? calendarConflicts(candidate, games, teams) : []
  const signature = calendarConflictSignature(conflicts)
  const update = (name, value) => { setForm((previous) => ({ ...previous, [name]: value })); setAccepted(''); setError('') }
  return <dialog ref={ref} className="match-management-dialog visual-schedule-editor" aria-labelledby={title} onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="match-management-heading"><div><span className="eyebrow">{source.esporteNome} · {shiftLabel(getGameShift(source))}</span><h2 id={title}>Agendar partida</h2><p>{source.timeA} × {source.timeB}</p></div><button type="button" className="btn btn-outline btn-small" disabled={busy} onClick={onClose}>Fechar</button></div>
    <form onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError('')
      try { await saveCalendarGame({ gameId: source.id, expectedFingerprint: calendarFingerprint(source), change: form, acceptedConflicts: accepted }); onSaved('Agenda salva. Calendário e TV atualizados; os palpites fecham 5 minutos antes do jogo.') }
      catch (failure) { setError(failure.message) } finally { setBusy(false) }
    }}>
      <fieldset disabled={busy}><legend>Dia, horário e local</legend><div className="form-grid">
        <label>Dia e horário da partida<input type="datetime-local" required value={form.dataHora} onChange={(event) => update('dataHora', event.target.value)} /></label>
        <label>Duração prevista (min)<input type="number" min="1" max="480" step="1" required value={form.durationMinutes} onChange={(event) => update('durationMinutes', event.target.value)} /></label>
        <label>Quadra / local<input maxLength="80" list={venueList} value={form.venue} onChange={(event) => update('venue', event.target.value)} placeholder="Local a definir" /></label>
        <label>Área (opcional)<input maxLength="80" value={form.venueArea} onChange={(event) => update('venueArea', event.target.value)} placeholder="Ex.: Mesa 1 ou Vôlei" /></label>
        <label>Palpites até (automático)<input type="datetime-local" readOnly value={predictionDeadlineInput(form)} /></label>
      </div><datalist id={venueList}>{venues.filter(Boolean).map((venue) => <option key={venue} value={venue} />)}</datalist></fieldset>
      <p className="form-hint">A agenda considera conflitos em todas as modalidades e turnos. Mudar horário, local ou duração exige uma nova conferência da partida. A situação dos palpites é preservada.</p>
      {conflicts.length ? <div className="schedule-warning" role="status"><strong>{conflicts.length} conflito(s) nesta posição</strong>{conflicts.map(({ game, reasons }) => <p key={game.id}>{reasons.join(' e ')}: {game.timeA} × {game.timeB} · {game.esporteNome || 'Fase anterior'} · {formatDateTime(game.dataHora)}</p>)}<label className="match-checkbox"><input type="checkbox" checked={accepted === signature} disabled={busy} onChange={(event) => setAccepted(event.target.checked ? signature : '')} />Conferi estes conflitos e quero salvar mesmo assim.</label></div> : null}
      {stale ? <p className="alert alert-error" role="alert">Esta partida mudou ou foi removida. Feche e abra novamente para conferir os dados atuais.</p> : null}
      {inputError || error ? <p className="alert alert-error" role="alert">{error || inputError}</p> : null}
      <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={busy || stale || Boolean(inputError) || (conflicts.length > 0 && accepted !== signature)}>{busy ? 'Salvando…' : 'Salvar na agenda'}</button><button type="button" className="btn btn-outline" disabled={busy} onClick={onClose}>Cancelar</button></div>
    </form>
  </dialog>
}

export default function VisualSchedule({ games, teams, sports, turno }) {
  const [day, setDay] = useState(() => schoolDay(new Date()))
  const [sportId, setSportId] = useState('')
  const [start, setStart] = useState('07:00'), [finish, setFinish] = useState('18:00'), [step, setStep] = useState(30)
  const [extraVenues, setExtraVenues] = useState([]), [newVenue, setNewVenue] = useState('')
  const [draggedId, setDraggedId] = useState(''), [editing, setEditing] = useState(null), [message, setMessage] = useState('')
  const filtered = useMemo(() => games.filter((game) => getGameShift(game) === turno && (!sportId || game.sportId === sportId)), [games, turno, sportId])
  const slots = calendarSlots(start, finish, step)
  const venues = calendarColumns(filtered, extraVenues)
  const undated = filtered.filter((game) => !Number.isFinite(eventDate(game.dataHora).getTime()))
  const dayGames = filtered.filter((game) => schoolDay(game.dataHora) === day)
  const dates = [...new Set(filtered.map((game) => schoolDay(game.dataHora)).filter(Boolean))].sort()
  const outside = dayGames.filter((game) => !slots.some((time) => calendarSlotGames([game], day, time, step, game.venue).length))
  const edit = (game, time, venue = game.venue || '') => {
    if (!canScheduleGame(game)) return
    setMessage('')
    setEditing({ game, initial: { dataHora: time ? `${day}T${time}` : localInput(game.dataHora) || `${day}T${start}`, venue, venueArea: venue === (game.venue || '') ? game.venueArea || '' : '', durationMinutes: game.durationMinutes || 30 } })
  }
  const card = (game) => {
    const editable = canScheduleGame(game)
    const conflicts = game.dataHora ? calendarConflicts(game, games, teams) : []
    return <article key={game.id} className={`visual-game-card${conflicts.length ? ' has-conflict' : ''}${editable ? '' : ' is-locked'}`} draggable={editable} data-calendar-game={game.id} onDragStart={(event) => { if (!editable) return; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-interclasse-game', game.id); event.dataTransfer.setData('text/plain', game.id); setDraggedId(game.id) }} onDragEnd={() => setDraggedId('')}>
      <small>{game.esporteNome} · {clock(game.dataHora) || 'Sem horário'}{game.dataHora ? ` · ${game.durationMinutes || 30} min` : ''}</small><strong>{game.timeA} × {game.timeB}</strong><span>{game.tournamentName || game.fase}{game.venueArea ? ` · ${game.venueArea}` : ''}</span>
      {conflicts.length ? <span className="visual-conflict-label">{conflicts.length} conflito(s)</span> : null}
      {editable ? <button className="btn btn-outline btn-small" type="button" onClick={() => edit(game)}>{game.dataHora ? 'Editar agenda' : 'Agendar'}</button> : <small>{game.deletionPending ? 'Em exclusão' : 'Partida indisponível para mover'}</small>}
    </article>
  }
  const changeDay = (offset) => { if (day) setDay(schoolDay(new Date(eventDate(`${day}T12:00`).getTime() + offset * 86400000))) }
  return <section className="visual-schedule" aria-label="Agenda visual dos jogos">
    <div className="section-heading"><div><span className="eyebrow">Organização do interclasse · {shiftLabel(turno)}</span><h2>Agenda visual dos jogos</h2><p>Arraste uma partida até o dia, horário e quadra desejados. Confira a prévia antes de salvar. No celular, use Agendar ou Editar agenda.</p></div></div>
    {message ? <p className="alert alert-success" role="status">{message}</p> : null}
    <div className="form-grid visual-schedule-filters"><label>Dia da agenda<input type="date" value={day} required onChange={(event) => setDay(event.target.value)} /></label><label>Modalidade na agenda<select value={sportId} onChange={(event) => setSportId(event.target.value)}><option value="">Todas as modalidades</option>{sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.nome}</option>)}</select></label><label>Dias com partidas<select value={dates.includes(day) ? day : ''} onChange={(event) => { if (event.target.value) setDay(event.target.value) }}><option value="">Escolher um dia</option>{dates.map((date) => <option key={date} value={date}>{date.split('-').reverse().join('/')}</option>)}</select></label><label>Exibir a partir de<input type="time" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Exibir até<input type="time" value={finish} onChange={(event) => setFinish(event.target.value)} /></label><label>Intervalo da grade<select value={step} onChange={(event) => setStep(Number(event.target.value))}>{[15, 30, 60].map((value) => <option key={value} value={value}>{value} minutos</option>)}</select></label></div>
    <div className="visual-board-actions"><div className="form-actions"><button type="button" className="btn btn-outline btn-small" onClick={() => changeDay(-1)} disabled={!day}>Dia anterior</button><button type="button" className="btn btn-outline btn-small" onClick={() => changeDay(1)} disabled={!day}>Próximo dia</button><span>{dayGames.length} partida(s) neste dia</span></div><form onSubmit={(event) => { event.preventDefault(); if (newVenue.trim()) { setExtraVenues((values) => [...values, newVenue.trim()]); setNewVenue('') } }}><label>Nova quadra/local<input maxLength="80" value={newVenue} onChange={(event) => setNewVenue(event.target.value)} placeholder="Ex.: Quadra principal" /></label><button type="submit" className="btn btn-outline btn-small" disabled={!newVenue.trim()}>Adicionar local</button></form></div>
    <p className="form-hint">Locais adicionados viram colunas e ficam salvos quando você agenda uma partida neles. Avisos consideram a duração completa e a mesma turma em esportes diferentes, mesmo fora dos filtros exibidos.</p>
    <div className="visual-schedule-workspace"><aside className="visual-undated"><h3>Sem data definida ({undated.length})</h3><p>Arraste para a grade ou clique em Agendar.</p><div>{undated.length ? undated.map(card) : <p>Nenhuma partida sem data nesta seleção.</p>}</div></aside><div className="visual-board-scroll">
      {slots.length && day ? <table className="visual-schedule-table"><caption>Agenda de {day.split('-').reverse().join('/')} · {shiftLabel(turno)}</caption><thead><tr><th scope="col">Horário</th>{venues.map((venue) => <th key={venue} scope="col">{venue || 'Local a definir'}</th>)}</tr></thead><tbody>{slots.map((time) => <tr key={time}><th scope="row">{time}</th>{venues.map((venue) => <td key={venue} className={draggedId ? 'is-drop-target' : ''} data-calendar-slot={`${time}|${venue}`} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData('application/x-interclasse-game') || event.dataTransfer.getData('text/plain') || draggedId; const game = filtered.find((item) => item.id === id); setDraggedId(''); if (game) edit(game, time, venue) }}>{calendarSlotGames(dayGames, day, time, step, venue).map(card)}<span className="visual-drop-hint">Solte aqui</span></td>)}</tr>)}</tbody></table> : <p className="alert" role="status">Escolha um dia e uma faixa de horários válida para exibir a grade.</p>}
    </div></div>
    {outside.length ? <section className="visual-outside"><h3>Partidas fora da faixa de horários exibida ({outside.length})</h3><div>{outside.map(card)}</div></section> : null}
    {editing ? <ScheduleEditor source={editing.game} initial={editing.initial} games={games} teams={teams} venues={venues} onClose={() => setEditing(null)} onSaved={(notice) => { setEditing(null); setMessage(notice) }} /> : null}
  </section>
}
