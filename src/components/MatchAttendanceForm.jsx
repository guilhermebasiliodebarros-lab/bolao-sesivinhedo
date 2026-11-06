import { useEffect, useState } from 'react'
import { loadMatchReport, saveMatchAttendance } from '../services/bolaoService.js'
import { attendanceTeamKey, ATTENDANCE_LABELS } from '../utils/attendance.js'

const options = Object.entries(ATTENDANCE_LABELS)
export default function MatchAttendanceForm({ game, teams, user }) {
  const [source] = useState(() => ({ game, teams }))
  const [sides, setSides] = useState({ A: { status: 'pending', players: {} }, B: { status: 'pending', players: {} } })
  const [rosters, setRosters] = useState({ A: [], B: [] })
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    loadMatchReport(source.game, source.teams).then((result) => {
      if (!active) return
      setRosters({ A: result.playersA, B: result.playersB })
      setSides(Object.fromEntries(['A', 'B'].map((side) => [side, { status: result.attendance?.[side]?.status || 'pending', players: Object.fromEntries((result.attendance?.[side]?.players || []).filter((player) => (side === 'A' ? result.playersA : result.playersB).some((current) => current.id === player.id)).map((player) => [player.id, player.status])) }])))
      setLoading(false)
    }).catch((error) => { if (active) { setNotice(error.message); setFailed(true); setLoadFailed(true); setLoading(false) } })
    return () => { active = false }
  }, [source])
  const update = (side, fields) => setSides((current) => ({ ...current, [side]: { ...current[side], ...fields } }))
  return <form className="match-attendance-form" onSubmit={async (event) => {
    event.preventDefault(); setSaving(true); setNotice(''); setFailed(false)
    try { await saveMatchAttendance({ gameId: game.id, sides, expectedTeamKey: attendanceTeamKey(source.game), requireAttendance: true, user }); setNotice('Presença salva com sucesso. A súmula em PDF usará esta conferência.') }
    catch (error) { setFailed(true); setNotice(error.message) } finally { setSaving(false) }
  }}>
    <p>Confirme as equipes e marque os jogadores presentes ou ausentes nesta partida. Os nomes e a presença individual ficam disponíveis apenas para a organização.</p>
    {loading ? <p role="status">Carregando elencos e presença…</p> : null}
    <fieldset disabled={loading || loadFailed || saving}><legend>Conferência da partida</legend>
      <p>A presença das duas equipes e a conferência dos jogadores são verificadas na preparação antes de iniciar.</p>
      {['A', 'B'].map((side) => <section className="attendance-team" key={side} aria-label={`Presença de ${game[`time${side}`]}`}><div className="section-heading"><h3>{game[`time${side}`]}</h3><span>{rosters[side].filter((player) => sides[side].players[player.id] === 'present').length}/{rosters[side].length} presente(s)</span></div>
        <label>Presença da equipe {side}<select value={sides[side].status} onChange={(event) => update(side, { status: event.target.value, ...(event.target.value === 'absent' ? { players: Object.fromEntries(rosters[side].map((player) => [player.id, 'absent'])) } : {}) })}>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {rosters[side].length ? <><div className="form-actions"><button type="button" className="btn btn-outline btn-small" onClick={() => update(side, { players: Object.fromEntries(rosters[side].map((player) => [player.id, 'present'])) })}>Marcar todos presentes · {game[`time${side}`]}</button></div>{rosters[side].map((player) => <label className="attendance-player" key={player.id}><span>{player.nome}{player.capitao ? ' · Capitão' : ''}</span><select aria-label={`Presença de ${player.nome} · equipe ${side}`} value={sides[side].players[player.id] || 'pending'} onChange={(event) => update(side, { players: { ...sides[side].players, [player.id]: event.target.value } })}>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>)}</> : <p>Equipe sem jogadores cadastrados. Você pode confirmar a equipe e cadastrar o elenco na aba Jogadores.</p>}
      </section>)}
      <button className="btn btn-primary" type="submit">{saving ? 'Salvando…' : 'Salvar presença'}</button>
    </fieldset>
    {notice ? <div className={failed ? 'alert alert-error' : 'alert alert-success'} role={failed ? 'alert' : 'status'}>{notice}</div> : null}
  </form>
}
