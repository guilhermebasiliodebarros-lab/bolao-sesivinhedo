import { useEffect, useId, useRef, useState } from 'react'
import { loadMatchReport, saveGamePreparation, startGame, subscribeTeamDiscipline } from '../services/bolaoService.js'
import { disciplineForGame, DISCIPLINE_TYPES, suspendedPlayers } from '../utils/discipline.js'
import { attendanceTeamKey, ATTENDANCE_LABELS } from '../utils/attendance.js'
import { matchStartChecklist, usesMatchVests } from '../utils/matchStart.js'
import { VEST_COLORS } from '../utils/sportRules.js'
import { formatDateTime } from '../utils/format.js'
import useModalDialog from '../hooks/useModalDialog.js'

export default function MatchStartDialog({ game, games, teams, user, onClose, onStarted }) {
  const ref = useRef(null)
  const titleId = useId()
  const [source] = useState(() => ({ game, teams }))
  const [rosterLoading, setLoading] = useState(true)
  const [disciplineLoading, setDisciplineLoading] = useState(true)
  const [discipline, setDiscipline] = useState({ A: [], B: [] })
  const loading = rosterLoading || disciplineLoading
  const [loadErrors, setLoadErrors] = useState({})
  const loadError = Object.values(loadErrors).find(Boolean) || ''
  const loadFailed = Boolean(loadError)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [details, setDetails] = useState({ venue: game.venue || '', venueArea: game.venueArea || (game.preparation ? '' : usesMatchVests(game) ? game.esporteNome : ''), vestA: game.vestA || '', vestB: game.vestB || '', durationMinutes: game.durationMinutes || 30 })
  const [responsible, setResponsible] = useState('')
  const [rosters, setRosters] = useState({ A: [], B: [] })
  const [sides, setSides] = useState({ A: { status: 'pending', players: {} }, B: { status: 'pending', players: {} } })
  useModalDialog(ref)
  useEffect(() => {
    const ready = new Set()
    const subscriptions = ['A', 'B'].map((side) => {
      const team = source.teams.find((item) => item.id === source.game[`teamId${side}`]) || source.teams.find((item) => item.sportId === source.game.sportId && item.nome === source.game[`time${side}`])
      const receive = (records) => { setDiscipline((value) => ({ ...value, [side]: records })); ready.add(side); if (ready.size === 2) setDisciplineLoading(false) }
      if (!team) { receive([]); return () => {} }
      return subscribeTeamDiscipline(team.id, receive, (error) => { setLoadErrors((current) => ({ ...current, [side]: error })); setDisciplineLoading(false) })
    })
    return () => subscriptions.forEach((stop) => stop())
  }, [source])
  useEffect(() => {
    let active = true
    loadMatchReport(source.game, source.teams).then((result) => {
      if (!active) return
      setRosters({ A: result.playersA, B: result.playersB })
      setResponsible(result.attendance?.responsible || result.report?.referee || '')
      setSides(Object.fromEntries(['A', 'B'].map((side) => [side, { status: result.attendance?.[side]?.status || 'pending', players: Object.fromEntries((result.attendance?.[side]?.players || []).filter((player) => (side === 'A' ? result.playersA : result.playersB).some((current) => current.id === player.id)).map((player) => [player.id, player.status])) }])))
      setLoading(false)
    }).catch((error) => { if (active) { setLoadErrors((current) => ({ ...current, roster: error.message })); setLoading(false) } })
    return () => { active = false }
  }, [source])
  const teamKey = attendanceTeamKey(source.game)
  const attendance = Object.fromEntries(['A', 'B'].map((side) => [side, { status: sides[side].status, players: rosters[side].map((player) => ({ ...player, status: sides[side].players[player.id] || 'pending' })) }]))
  const draftGame = { ...game, ...details, attendanceSummary: { teamKey, teamA: sides.A.status, teamB: sides.B.status } }
  const checks = matchStartChecklist(draftGame, { games, teams, attendance, discipline })
  const missing = checks.filter((check) => !check.done)
  const preparationMissing = missing.filter((check) => check.id !== 'conflicts')
  const changeSide = (side, value) => setSides((current) => ({ ...current, [side]: { ...current[side], ...value } }))
  const commit = async (startNow) => {
    if ((startNow ? missing : preparationMissing).length) return
    setBusy(true); setMessage('')
    const value = { ...details, responsible, sides, expectedTeamKey: teamKey, user }
    try {
      if (startNow) { await startGame(game.id, value); onStarted('Partida iniciada. Presença e coletes conferidos, palpites bloqueados e TV atualizada.') }
      else { await saveGamePreparation(game.id, value); onStarted('Conferência salva. Partida pronta para iniciar quando o responsável autorizar.') }
    } catch (error) { setMessage(error.message) } finally { setBusy(false) }
  }
  return <dialog ref={ref} className="match-management-dialog match-start-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="match-management-heading"><div><span className="eyebrow">Preparação da partida · {game.esporteNome}</span><h2 id={titleId}>{game.timeA} × {game.timeB}</h2><p>{formatDateTime(game.dataHora)} · {game.fase}</p></div><button className="btn btn-outline btn-small" disabled={busy} onClick={onClose}>Fechar</button></div>
    <p className="preparation-explanation">Confira e salve antes do jogo. A partida só entra ao vivo quando você clicar em Iniciar agora, individualmente ou junto com outras partidas preparadas.</p>
    <form onSubmit={(event) => { event.preventDefault(); commit(false) }}>
      <div className="start-checklist" aria-label="Conferência para iniciar"><strong>{checks.length - missing.length} de {checks.length} verificações prontas</strong><ul>{checks.map((check) => <li key={check.id} className={check.done ? 'is-ready' : 'is-missing'}><span aria-hidden="true">{check.done ? '✓' : '○'}</span>{check.label}</li>)}</ul></div>
      {checks.find((check) => check.id === 'conflicts')?.conflicts?.map(({ game: other, reasons }) => <div className="schedule-warning" key={other.id}>{reasons.join(' · ')}: {other.timeA} × {other.timeB}{other.venue ? ` em ${other.venue}` : ''}. Você pode salvar a conferência agora e iniciar após liberar a área.</div>)}
      {loading ? <p role="status">Carregando a presença e os jogadores…</p> : null}
      {['A', 'B'].some((side) => disciplineForGame(discipline[side], game).length) ? <aside className="schedule-warning" aria-label="Ocorrências disciplinares da partida"><strong>Conferência disciplinar</strong>{['A', 'B'].flatMap((side) => disciplineForGame(discipline[side], game).map((record) => <p key={`${side}-${record.id}`}>{game[`time${side}`]} · {record.playerName}: {DISCIPLINE_TYPES[record.type]} · {record.reason}</p>))}<small>Suspensões ativas impedem a escalação como presente. Marque o atleta como ausente ou regularize a decisão na Central disciplinar.</small></aside> : null}
      <fieldset disabled={loading || loadFailed || busy}><legend>1. Equipes e jogadores</legend>
        {['A', 'B'].map((side) => <section className="attendance-team" key={side}><div className="section-heading"><h3>{game[`time${side}`]}</h3>{rosters[side].length ? <button className="btn btn-outline btn-small" type="button" onClick={() => changeSide(side, { status: 'present', players: Object.fromEntries(rosters[side].map((player) => [player.id, suspendedPlayers(discipline[side], game).has(player.id) ? 'absent' : 'present'])) })}>{suspendedPlayers(discipline[side], game).size ? 'Conferir disponíveis' : 'Todos presentes'} · equipe {side}</button> : null}</div>
          <label className="match-checkbox"><input type="checkbox" checked={sides[side].status === 'present'} onChange={(event) => changeSide(side, { status: event.target.checked ? 'present' : 'pending' })} />Equipe {side} presente</label>
          {rosters[side].length ? rosters[side].map((player) => <label className="attendance-player" key={player.id}><span>{player.nome}{player.capitao ? ' · Capitão' : ''}{suspendedPlayers(discipline[side], game).has(player.id) ? ' · Suspensão ativa' : ''}</span><select aria-label={`Presença de ${player.nome} · equipe ${side}`} value={sides[side].players[player.id] || 'pending'} onChange={(event) => changeSide(side, { players: { ...sides[side].players, [player.id]: event.target.value } })}>{Object.entries(ATTENDANCE_LABELS).map(([value, label]) => <option key={value} value={value} disabled={value === 'present' && suspendedPlayers(discipline[side], game).has(player.id)}>{label}</option>)}</select></label>) : <small>Sem elenco cadastrado. Confirme a presença da equipe para continuar.</small>}
        </section>)}
      </fieldset>
      <fieldset disabled={loading || loadFailed || busy}><legend>2. Local, área e coletes</legend><div className="form-grid"><label>Local da partida<input type="text" maxLength="80" required value={details.venue} placeholder="Ex.: Quadra principal ou Sala de xadrez" onChange={(event) => setDetails((current) => ({ ...current, venue: event.target.value }))} /></label><label>Área ou mesa<input type="text" maxLength="80" value={details.venueArea} placeholder="Ex.: Basquete, Vôlei ou Mesa 1" onChange={(event) => setDetails((current) => ({ ...current, venueArea: event.target.value }))} /></label></div><small>Na mesma quadra, use áreas diferentes para basquete e vôlei. Sem área, o jogo ocupa o local inteiro.</small>
        {usesMatchVests(game) ? <div className="form-grid">{['A', 'B'].map((side) => <label key={side}>Colete · {game[`time${side}`]}<select required value={details[`vest${side}`]} onChange={(event) => setDetails((current) => ({ ...current, [`vest${side}`]: event.target.value }))}><option value="">Selecione a cor</option>{VEST_COLORS.map((color) => <option key={color}>{color}</option>)}</select></label>)}</div> : <p>Esta modalidade não exige coletes.</p>}
      </fieldset>
      <fieldset disabled={loading || loadFailed || busy}><legend>3. Duração e responsável</legend><label>Duração prevista (minutos)<input type="number" min="1" max="480" step="1" required value={details.durationMinutes} onChange={(event) => setDetails((current) => ({ ...current, durationMinutes: event.target.value }))} /></label><small>Usada para avisar quando for necessário conferir o andamento ou o resultado. Não encerra o jogo automaticamente.</small><label>Responsável pela partida (opcional)<input type="text" maxLength="100" value={responsible} placeholder="Ex.: professor responsável pelo xadrez" onChange={(event) => setResponsible(event.target.value)} /></label><small>Esta informação fica disponível apenas para a organização.</small></fieldset>
      {loadError || message ? <div className="alert alert-error" role="alert">{loadError || message}</div> : null}
      <footer className="start-dialog-footer"><p>{preparationMissing.length ? `Falta concluir ${preparationMissing.length} verificação(ões) da conferência.` : 'Conferência pronta. Salvar mantém o jogo agendado; iniciar bloqueia os palpites e transmite ao vivo.'}</p><div className="form-actions"><button className="btn btn-primary" type="submit" disabled={loading || loadFailed || busy || Boolean(preparationMissing.length)}>{busy ? 'Salvando…' : 'Salvar conferência'}</button><button className="btn btn-outline" type="button" disabled={loading || loadFailed || busy || Boolean(missing.length)} onClick={(event) => { if (event.currentTarget.form.reportValidity()) commit(true) }}>Salvar e iniciar agora</button></div></footer>
    </form>
  </dialog>
}
