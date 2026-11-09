import { useEffect, useState } from 'react'
import { resolveDisciplinaryRecord, saveDisciplinaryRecord, subscribePlayers, subscribeTeamDiscipline } from '../services/bolaoService.js'
import { DISCIPLINE_STATUSES, DISCIPLINE_TYPES, suspendedPlayers } from '../utils/discipline.js'
import { getMatchState, MATCH_STATE } from '../utils/match.js'
import { formatDateTime } from '../utils/format.js'
import { eventDate } from '../utils/tvSchedule.js'
import './DisciplinePanel.css'

const empty = { playerId: '', type: 'warning', gameId: '', reason: '', scope: 'modality' }

function TeamDiscipline({ team, games, user }) {
  const [records, setRecords] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState({ records: true, players: true })
  const [failed, setFailed] = useState(false)
  const [actionFailed, setActionFailed] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState(empty)
  const [filter, setFilter] = useState('all')
  const [resolution, setResolution] = useState(null)
  const [page, setPage] = useState(0)
  useEffect(() => {
    const error = (value) => { setFailed(true); setMessage(value) }
    const stopRecords = subscribeTeamDiscipline(team.id, (items) => { setRecords(items); setLoading((value) => ({ ...value, records: false })) }, error)
    const stopPlayers = subscribePlayers(team.id, (items) => { setPlayers(items); setLoading((value) => ({ ...value, players: false })) }, error)
    return () => { stopRecords(); stopPlayers() }
  }, [team.id])
  const teamGames = games.filter((game) => game.sportId === team.sportId && ['A', 'B'].some((side) => game[`teamId${side}`] ? game[`teamId${side}`] === team.id : game[`time${side}`] === team.nome)).sort((a, b) => eventDate(a.dataHora) - eventDate(b.dataHora))
  const next = teamGames.filter((game) => getMatchState(game) === MATCH_STATE.SCHEDULED).slice(0, 3)
  const filtered = records.filter((record) => filter === 'all' || (filter === 'suspension' ? record.type === 'suspension' && record.status === 'active' : record.status !== 'active'))
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 10) - 1))
  const disabled = busy || failed || Object.values(loading).some(Boolean)
  return <div className="discipline-team">
    <div className="section-heading"><h3>{team.nome} · {team.esporteNome}</h3><span>{records.filter((record) => record.type === 'suspension' && record.status === 'active').length} suspensão(ões) ativa(s)</span></div>
    <p className="form-hint">Cartões e advertências são registros. A organização define as suspensões conforme o regulamento; não há suspensão automática por quantidade de cartões. Uma suspensão permanece ativa até ser marcada como cumprida ou anulada.</p>
    {next.some((game) => suspendedPlayers(records, game).size) ? <div className="schedule-warning"><strong>Conferir antes dos próximos jogos</strong>{next.filter((game) => suspendedPlayers(records, game).size).map((game) => <p key={game.id}>{game.timeA} × {game.timeB} · {formatDateTime(game.dataHora)}: {suspendedPlayers(records, game).size} atleta(s) com suspensão ativa.</p>)}</div> : null}
    {message ? <p className={`alert ${failed || actionFailed ? 'alert-error' : 'alert-success'}`} role={failed || actionFailed ? 'alert' : 'status'}>{message}</p> : null}
    {Object.values(loading).some(Boolean) && !failed ? <p role="status">Carregando ocorrências e elenco…</p> : null}
    <form className="discipline-form" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setMessage(''); setActionFailed(false)
      try { await saveDisciplinaryRecord(team.id, draft, user); setDraft(empty); setFailed(false); setMessage('Ocorrência registrada com sucesso.') }
      catch (error) { setActionFailed(true); setMessage(error.message) } finally { setBusy(false) }
    }}>
      <fieldset disabled={disabled}><legend>Registrar ocorrência</legend><div className="form-grid">
        <label>Atleta<select required value={draft.playerId} onChange={(event) => setDraft((value) => ({ ...value, playerId: event.target.value }))}><option value="">Selecione um atleta</option>{players.map((player) => <option key={player.id} value={player.id}>{player.nome}</option>)}</select></label>
        <label>Tipo de ocorrência<select value={draft.type} onChange={(event) => setDraft((value) => ({ ...value, type: event.target.value, scope: 'modality' }))}>{Object.entries(DISCIPLINE_TYPES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Partida da ocorrência (opcional)<select value={draft.gameId} onChange={(event) => setDraft((value) => ({ ...value, gameId: event.target.value, scope: 'modality' }))}><option value="">Sem partida vinculada</option>{teamGames.map((game) => <option key={game.id} value={game.id}>{game.tournamentName || 'Sem torneio'} · {game.timeA} × {game.timeB} · {game.fase} · {formatDateTime(game.dataHora)}</option>)}</select></label>
        {draft.type === 'suspension' ? <label>Abrangência da suspensão<select value={draft.scope} onChange={(event) => setDraft((value) => ({ ...value, scope: event.target.value }))}><option value="modality">Todas as partidas desta modalidade</option><option value="tournament" disabled={!teamGames.find((game) => game.id === draft.gameId)?.tournamentId}>Somente o torneio da partida selecionada</option></select></label> : null}
      </div><label>Motivo e orientação da organização<textarea required minLength={3} maxLength={1000} rows={3} value={draft.reason} onChange={(event) => setDraft((value) => ({ ...value, reason: event.target.value }))} /></label>
        {draft.type === 'suspension' ? <p className="schedule-warning">Ao registrar, o atleta ficará impedido de ser escalado como presente nas partidas abrangidas até a organização encerrar esta suspensão.</p> : null}
        <button type="submit" className="btn btn-primary" disabled={!players.length}>{busy ? 'Registrando…' : 'Registrar ocorrência'}</button>
      </fieldset>
      {!players.length && !loading.players ? <p className="form-hint">Cadastre os jogadores da equipe na aba Jogadores para registrar ocorrências.</p> : null}
    </form>
    <div className="section-heading"><h3>Histórico da equipe</h3><label>Filtrar ocorrências<select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(0) }}><option value="all">Todas</option><option value="suspension">Suspensões ativas</option><option value="resolved">Cumpridas e anuladas</option></select></label></div>
    <div className="discipline-records">{filtered.slice(currentPage * 10, currentPage * 10 + 10).map((record) => <article key={record.id} className={`discipline-record is-${record.type}`}>
      <div className="section-heading"><div><span className="eyebrow">{DISCIPLINE_TYPES[record.type]}</span><h4>{record.playerName}</h4></div><strong>{record.status === 'active' && record.type === 'suspension' ? 'Suspensão ativa' : DISCIPLINE_STATUSES[record.status]}</strong></div>
      <p className="discipline-reason">{record.reason}</p><small>{formatDateTime(record.createdAt)}{record.matchLabel ? ` · ${record.matchLabel}` : ''}</small>
      {record.type === 'suspension' ? <p className="form-hint">Abrangência: {record.scope === 'tournament' ? record.tournamentName || 'Torneio vinculado' : 'Todas as partidas desta modalidade'}.</p> : null}
      {record.status !== 'active' ? <p className="discipline-reason">{formatDateTime(record.resolvedAt)} · {record.resolvedReason}</p> : <div className="form-actions">{record.type === 'suspension' ? <button type="button" className="btn btn-outline btn-small" disabled={disabled} onClick={() => setResolution({ id: record.id, status: 'served', reason: '', revision: record.revision })}>Marcar como cumprida</button> : null}<button type="button" className="btn btn-outline btn-small" disabled={disabled} onClick={() => setResolution({ id: record.id, status: 'void', reason: '', revision: record.revision })}>Anular registro</button></div>}
      {resolution?.id === record.id && record.status === 'active' ? <form onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setMessage(''); setActionFailed(false)
        try { await resolveDisciplinaryRecord({ teamId: team.id, recordId: record.id, status: resolution.status, reason: resolution.reason, expectedRevision: resolution.revision, user }); setResolution(null); setMessage('Situação atualizada com sucesso.') }
        catch (error) { setActionFailed(true); setMessage(error.message) } finally { setBusy(false) }
      }}><label>Motivo da {resolution.status === 'served' ? 'conclusão' : 'anulação'}<textarea required minLength={3} maxLength={1000} disabled={busy} value={resolution.reason} onChange={(event) => setResolution((value) => ({ ...value, reason: event.target.value }))} /></label><div className="form-actions"><button type="submit" className="btn btn-primary btn-small" disabled={disabled}>Confirmar {resolution.status === 'served' ? 'cumprimento' : 'anulação'}</button><button type="button" className="btn btn-outline btn-small" disabled={busy} onClick={() => setResolution(null)}>Cancelar</button></div></form> : null}
    </article>)}</div>
    {!filtered.length && !loading.records ? <p>Nenhuma ocorrência neste filtro.</p> : null}
    {filtered.length > 10 ? <div className="form-actions"><button type="button" className="btn btn-outline btn-small" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>Página {currentPage + 1} de {Math.ceil(filtered.length / 10)}</span><button type="button" className="btn btn-outline btn-small" disabled={(currentPage + 1) * 10 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Próxima</button></div> : null}
  </div>
}

export default function DisciplinePanel({ teams, games, user }) {
  const [teamId, setTeamId] = useState('')
  const team = teams.find((item) => item.id === teamId)
  return <section className="discipline-panel"><div className="section-heading"><div><span className="eyebrow">Organização · Acesso restrito</span><h2>Central disciplinar</h2><p>Registre advertências, cartões e suspensões, preservando o histórico das decisões.</p></div></div>
    <label>Equipe da ocorrência<select value={team?.id || ''} onChange={(event) => setTeamId(event.target.value)}><option value="">Selecione a modalidade e a turma</option>{[...teams].sort((a, b) => `${a.esporteNome} ${a.nome}`.localeCompare(`${b.esporteNome} ${b.nome}`, 'pt-BR')).map((item) => <option key={item.id} value={item.id}>{item.esporteNome} · {item.nome}</option>)}</select></label>
    {team ? <TeamDiscipline key={team.id} team={team} games={games} user={user} /> : <p>Escolha uma equipe para consultar ou registrar ocorrências.</p>}
  </section>
}
