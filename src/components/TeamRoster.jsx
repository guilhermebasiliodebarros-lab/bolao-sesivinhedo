import { useEffect, useRef, useState } from 'react'
import { savePlayer, subscribePlayers } from '../services/bolaoService.js'
import LoadingState from './LoadingState.jsx'
import RosterImporter from './RosterImporter.jsx'

const emptyPlayer = { nome: '', posicao: '', capitao: false }

function RosterEditor({ team, onRemove, saving: parentSaving }) {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState(emptyPlayer)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const nameRef = useRef(null)
  const disabled = saving || parentSaving

  useEffect(() => subscribePlayers(team.id, (items) => { setPlayers(items); setLoading(false) }, (error) => {
    setMessage(error); setFailed(true); setLoading(false)
  }), [team.id])

  const edit = (player) => {
    setDraft({ id: player.id, nome: player.nome, posicao: player.posicao || '', capitao: Boolean(player.capitao) })
    setMessage('')
    nameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    nameRef.current?.focus({ preventScroll: true })
  }
  const submit = async (event) => {
    event.preventDefault()
    setSaving(true); setFailed(false); setMessage('')
    try {
      await savePlayer(team.id, draft)
      setDraft(emptyPlayer)
      setMessage('Jogador salvo na equipe com sucesso.')
      nameRef.current?.focus()
    } catch (error) { setFailed(true); setMessage(error.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="roster-editor">
      <div className="section-heading"><div><span className="eyebrow">{team.esporteNome} · {team.categoria || 'Equipe'}</span><h2>{team.nome}</h2></div><span>{players.length} jogador(es)</span></div>
      <form className="roster-form" onSubmit={submit}>
        <h3>{draft.id ? 'Editar jogador' : 'Cadastrar jogador'}</h3>
        <div className="roster-fields">
          <label>Nome do jogador<input ref={nameRef} type="text" required minLength="2" maxLength="100" autoComplete="off" value={draft.nome} disabled={disabled} onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value }))} placeholder="Nome completo" /></label>
          <label>Posição<input type="text" maxLength="60" value={draft.posicao} disabled={disabled} onChange={(event) => setDraft((current) => ({ ...current, posicao: event.target.value }))} placeholder="Ex.: goleiro, levantador" /></label>
        </div>
        <div className="form-actions"><label className="roster-captain"><input type="checkbox" checked={draft.capitao} disabled={disabled} onChange={(event) => setDraft((current) => ({ ...current, capitao: event.target.checked }))} />Capitão da equipe</label><button className="btn btn-primary" type="submit" disabled={disabled}>{saving ? 'Salvando…' : draft.id ? 'Salvar jogador' : 'Cadastrar jogador'}</button>{draft.id ? <button className="btn btn-outline" type="button" disabled={disabled} onClick={() => { setDraft(emptyPlayer); setMessage('') }}>Cancelar edição</button> : null}</div>
        <p className="roster-note">A posição é opcional. Os dados dos jogadores ficam disponíveis para a organização.</p>
      </form>
      {message ? <div className={failed ? 'alert alert-error' : 'alert alert-success'} role={failed ? 'alert' : 'status'}>{message}</div> : null}
      <RosterImporter team={team} players={players} disabled={disabled || loading} />
      {loading ? <LoadingState label="Carregando jogadores…" /> : players.length ? <div className="roster-list" aria-label={`Jogadores de ${team.nome}`}>{players.map((player) => (
        <article className="roster-player" key={player.id}>
          <div className="roster-player-details"><strong>{player.nome}{player.capitao ? <span className="roster-captain-badge">Capitão</span> : null}</strong><small>{player.posicao || 'Posição não informada'}</small></div>
          <div className="form-actions"><button className="btn btn-outline btn-small" type="button" disabled={disabled} onClick={() => edit(player)}>Editar</button><button className="btn btn-ghost btn-small" type="button" disabled={disabled} onClick={() => onRemove(team, player)}>Remover</button></div>
        </article>
      ))}</div> : <div className="live-control-empty"><strong>Esta equipe ainda não tem jogadores.</strong><p>Use o formulário acima para cadastrar o primeiro.</p></div>}
    </div>
  )
}

export default function TeamRoster({ teams, teamId, onTeamChange, onRemove, saving }) {
  const team = teams.find((item) => item.id === teamId)
  return (
    <section className="team-roster" aria-label="Cadastro de jogadores">
      <div className="section-heading"><div><span className="eyebrow">Equipes e atletas</span><h2>Jogadores das equipes</h2><p>Selecione uma equipe para cadastrar e organizar seus jogadores.</p></div></div>
      <label className="roster-team-select">Equipe<select value={team?.id || ''} onChange={(event) => onTeamChange(event.target.value)} disabled={saving}><option value="">Selecione uma equipe</option>{[...teams].sort((a, b) => `${a.esporteNome} ${a.nome}`.localeCompare(`${b.esporteNome} ${b.nome}`, 'pt-BR')).map((item) => <option value={item.id} key={item.id}>{item.esporteNome} · {item.nome}{item.categoria ? ` · ${item.categoria}` : ''}</option>)}</select></label>
      {team ? <RosterEditor key={team.id} team={team} onRemove={onRemove} saving={saving} /> : <div className="live-control-empty"><strong>{teams.length ? 'Escolha uma equipe para começar.' : 'Cadastre uma equipe na aba Times primeiro.'}</strong></div>}
    </section>
  )
}
