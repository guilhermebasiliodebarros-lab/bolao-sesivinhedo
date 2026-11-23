import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import { loadSearchPlayers, subscribeGames, subscribeSports, subscribeTeams } from '../services/bolaoService.js'
import useModalDialog from '../hooks/useModalDialog.js'
import { buildGlobalSearchIndex, searchGlobalIndex } from '../utils/globalSearch.js'
import { formatNoticeDate } from '../utils/scheduleNotices.js'
import './GlobalSearch.css'
const EMPTY_PLAYERS = []

export default function GlobalSearch({ onClose, onSelect }) {
  const { isMaster, isViewer } = useAuth()
  const [games, setGames] = useState([]), [teams, setTeams] = useState([]), [sports, setSports] = useState([])
  const [playerFeed, setPlayerFeed] = useState({ key: '', data: [] }), [query, setQuery] = useState(''), [active, setActive] = useState(0)
  const [ready, setReady] = useState(false), [error, setError] = useState('')
  const ref = useRef(null), inputRef = useRef(null), listRef = useRef(null)
  useModalDialog(ref)
  useEffect(() => {
    const a = subscribeGames((items) => { setGames(items); setReady(true) }, setError)
    const b = subscribeTeams(setTeams, setError), c = subscribeSports(setSports, setError)
    return () => { a(); b(); c() }
  }, [])
  const teamKey = teams.map((team) => `${team.id}:${team.playerCount}`).sort().join('|')
  const players = isMaster && playerFeed.key === teamKey ? playerFeed.data : EMPTY_PLAYERS
  const playersLoading = isMaster && Boolean(teamKey) && playerFeed.key !== teamKey
  useEffect(() => {
    if (!isMaster || !teamKey) return
    let current = true
    const ids = teamKey.split('|').map((item) => item.slice(0, item.lastIndexOf(':')))
    loadSearchPlayers(ids).then((items) => { if (current) setPlayerFeed({ key: teamKey, data: items }) }).catch((requestError) => { if (current) { setError(requestError.message); setPlayerFeed({ key: teamKey, data: [] }) } })
    return () => { current = false }
  }, [isMaster, teamKey])
  const index = useMemo(() => buildGlobalSearchIndex({ games, teams: teams.map((team) => ({ ...team, esporteNome: sports.find((sport) => sport.id === team.sportId)?.nome || team.esporteNome })), players, isMaster, isViewer }), [games, teams, sports, players, isMaster, isViewer])
  const results = searchGlobalIndex(index, query)
  const selected = Math.min(active, Math.max(0, results.length - 1))
  const select = (entry) => { onSelect(entry); onClose() }
  return <dialog ref={ref} className="global-search-dialog" aria-labelledby="global-search-title" onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === ref.current) { const bounds = ref.current.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose() } }}>
    <div className="global-search-header"><div><span className="eyebrow">Encontre no Interclasse</span><h2 id="global-search-title">Busca geral</h2></div><button type="button" className="btn btn-outline btn-small" aria-label="Fechar busca" onClick={onClose}>×</button></div>
    <label className="global-search-input">{isMaster || isViewer ? 'Jogo, equipe ou atleta' : 'Jogo ou equipe'}<input autoFocus ref={inputRef} role="combobox" aria-autocomplete="list" aria-expanded={results.length > 0} aria-controls="global-search-results" aria-activedescendant={results.length ? `search-result-${selected}` : undefined} type="search" value={query} placeholder="Ex.: 9º A, futebol, Quadra 2…" onChange={(event) => { setQuery(event.target.value); setActive(0) }} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return }
      if (['ArrowDown', 'ArrowUp'].includes(event.key) && results.length) { event.preventDefault(); const next = (selected + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length; setActive(next); listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' }) }
      if (event.key === 'Enter' && results[selected]) { event.preventDefault(); select(results[selected]) }
    }} /></label>
    <p className="global-search-help" role="status">{!ready ? 'Carregando os jogos…' : query.trim() ? `${results.length} resultado(s)` : 'Jogos ao vivo e próximos confrontos'}{playersLoading ? ' · Carregando elencos…' : ''}</p>
    {error ? <p className="global-search-error" role="status">Alguns dados ainda não puderam ser carregados. {error}</p> : null}
    <ul id="global-search-results" ref={listRef} className="global-search-results" role="listbox" aria-label="Resultados da busca">{results.map((entry, position) => <li key={entry.key}><button id={`search-result-${position}`} type="button" role="option" aria-selected={position === selected} tabIndex={position === selected ? 0 : -1} onFocus={() => setActive(position)} onClick={() => select(entry)}><span className="global-search-kind">{{ game: 'Jogo', team: 'Equipe', player: 'Atleta' }[entry.kind]}</span><span><strong>{entry.label}</strong><small>{entry.detail}{entry.date ? ` · ${formatNoticeDate(entry.date)}` : ''}</small></span><span aria-hidden="true">↗</span></button></li>)}</ul>
    {ready && !results.length ? <div className="global-search-empty"><strong>Nenhum resultado encontrado</strong><p>Tente o nome de uma turma, modalidade ou local.</p></div> : null}
    <p className="global-search-footer">Use ↑ ↓ para escolher e Enter para abrir. A busca respeita seu perfil de acesso.</p>
  </dialog>
}
