import { useEffect, useMemo, useState } from 'react'
import { buildPendingMatches, PENDING_CATEGORIES } from '../utils/pendingMatches.js'
import { schoolDay, nextSchoolDay } from '../utils/tvSchedule.js'
import { formatDateTime } from '../utils/format.js'
import { gameMatchesSearch, matchesSport } from '../utils/game.js'
import MatchDetails from './MatchDetails.jsx'
import EmptyState from './EmptyState.jsx'

const PAGE_SIZE = 12
const ACTION_LABELS = { prepare: 'Preparar partida', start: 'Iniciar agora', score: 'Conferir placar', reschedule: 'Reagendar partida' }

export default function PendingCenter({ games, teams, sports, saving, onPrepare, onStart, onManage, onLive }) {
  const [now, setNow] = useState(() => new Date())
  const [sport, setSport] = useState('')
  const [category, setCategory] = useState('')
  const [day, setDay] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(timer)
  }, [])
  const pending = useMemo(() => buildPendingMatches(games, teams, now), [games, teams, now])
  const today = schoolDay(now)
  const tomorrow = nextSchoolDay(today)
  const scoped = pending.filter(({ game }) => matchesSport(game, sport) && gameMatchesSearch({ ...game, rodada: [game.rodada, game.tournamentName].filter(Boolean).join(' ') }, search.trim())
    && (!day || (day === 'today' ? schoolDay(game.dataHora) === today : day === 'tomorrow' ? schoolDay(game.dataHora) === tomorrow : !schoolDay(game.dataHora))))
  const filtered = scoped.filter((item) => !category || item.category === category)
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages - 1)
  const change = (setter, value) => { setter(value); setPage(0) }
  const act = ({ game, action }) => {
    if (action === 'prepare') onPrepare(game)
    if (action === 'start') onStart(game)
    if (action === 'score') onManage(game, 'score')
    if (action === 'reschedule') onManage(game, 'condition')
  }
  return <section className="pending-center" aria-label="Central de pendências">
    <div className="section-heading"><div><span className="eyebrow">Organização do Interclasse</span><h2>Central de pendências</h2><p>Confira o que falta e resolva cada partida por aqui. Atualização automática a cada 30 segundos.</p></div><button className="btn btn-outline btn-small" type="button" onClick={onLive}>Iniciar partidas juntas / Ao vivo</button></div>
    <div className="pending-filters">
      <label>Modalidade<select value={sport} onChange={(event) => change(setSport, event.target.value)}><option value="">Todas as modalidades</option>{sports.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
      <label>Programação<select value={day} onChange={(event) => change(setDay, event.target.value)}><option value="">Todos os dias</option><option value="today">Hoje</option><option value="tomorrow">Amanhã</option><option value="undated">Sem data definida</option></select></label>
      <label>Buscar partida<input type="search" value={search} placeholder="Equipe, grupo ou torneio" onChange={(event) => change(setSearch, event.target.value)} /></label>
    </div>
    <div className="pending-counters" aria-label="Filtrar pendências">
      {[{ id: '', label: 'Todas as pendências' }, ...PENDING_CATEGORIES].map((item) => <button key={item.id} type="button" className={`pending-counter${category === item.id ? ' is-active' : ''}`} aria-pressed={category === item.id} onClick={() => change(setCategory, item.id)}><strong>{item.id ? scoped.filter((entry) => entry.category === item.id).length : scoped.length}</strong><span>{item.label}</span></button>)}
    </div>
    <p className="pending-help">Um jogo aparece uma vez, pela pendência mais urgente. Duração excedida é um aviso para conferir; o placar e o encerramento dependem do responsável. Jogos ao vivo dentro da duração prevista ficam em Ao vivo / TV.</p>
    <p className="pending-total" role="status">{filtered.length} partida(s) nesta seleção{filtered.length > PAGE_SIZE ? ` · página ${currentPage + 1} de ${pages}` : ''}</p>
    <div className="pending-match-list">{filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((item) => <article className={`pending-game pending-${item.category}`} key={item.game.id}>
      <div className="pending-game-content"><span className="pending-status">{PENDING_CATEGORIES.find((kind) => kind.id === item.category).label}</span><h3>{item.game.timeA || 'A definir'} × {item.game.timeB || 'A definir'}</h3><p>{item.game.esporteNome} · {item.game.fase}{item.game.tournamentName ? ` · ${item.game.tournamentName}` : ''}</p><p>{formatDateTime(item.game.dataHora)}</p><MatchDetails game={item.game} compact /><ul>{item.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul></div>
      {item.action !== 'none' ? <div className="pending-game-actions"><button className="btn btn-primary btn-small" type="button" disabled={saving} onClick={() => act(item)}>{ACTION_LABELS[item.action]}</button>{item.category === 'late' ? <button className="btn btn-outline btn-small" type="button" disabled={saving} onClick={() => onManage(item.game, 'condition')}>Ajustar situação / horário</button> : null}</div> : null}
    </article>)}</div>
    {!filtered.length ? <EmptyState title={pending.length ? 'Nenhuma pendência nesta seleção' : 'Tudo conferido por aqui'} description={pending.length ? 'Escolha outra modalidade, programação ou situação para consultar os jogos.' : 'Quando houver partidas a preparar, atrasos ou resultados a conferir, elas aparecerão aqui.'} /> : null}
    {pages > 1 ? <nav className="pending-pagination" aria-label="Páginas de pendências"><button className="btn btn-outline btn-small" type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>{currentPage + 1} de {pages}</span><button className="btn btn-outline btn-small" type="button" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>Próxima</button></nav> : null}
  </section>
}
