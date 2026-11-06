import { useEffect, useMemo, useState } from 'react'
import { subscribeGames } from '../services/bolaoService.js'
import { buildAthleteStatistics, buildStatisticsTeamAliases, hasIndividualScoring, statisticsSportKey, statisticsTeamKey, statisticsTournamentKey } from '../utils/athleteStatistics.js'
import EmptyState from './EmptyState.jsx'
import LoadingState from './LoadingState.jsx'

const number = (value) => new Intl.NumberFormat('pt-BR').format(value)
const PAGE_SIZE = 15

function AthleteTable({ table }) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(table.rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages - 1)
  return <article className="athlete-statistics-card" aria-label={`Estatísticas de ${table.sportName}`}>
    <div className="section-heading"><div><span className="eyebrow">{table.scoringMode === 'goals' ? 'Artilharia' : 'Pontuação individual'}</span><h3>{table.sportName}</h3>{table.scoringMode === 'sets' ? <p>Pontos atribuídos aos atletas em todos os sets registrados.</p> : null}</div><span className="athlete-statistics-total">{number(table.recordedTotal)} {table.unit.toLocaleLowerCase('pt-BR')} com autor · {table.athletes} atleta(s)</span></div>
    {table.adjustedGames ? <p className="schedule-warning">{table.adjustedGames} partida(s) receberam correção manual. Nessas partidas, contam apenas as autorias registradas após o ajuste.</p> : null}
    {table.rows.length ? <><div className="table-scroll"><table className="athlete-statistics-table"><caption>{table.rows.length} atleta(s) nesta seleção · posições iguais indicam empate</caption><thead><tr><th scope="col">Posição</th><th scope="col">Atleta</th><th scope="col">Equipe</th><th scope="col">{table.unit}</th><th scope="col">Jogos com registro</th></tr></thead><tbody>{table.rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((row) => <tr key={row.id} className={row.rank === 1 ? 'is-leading' : undefined}><td>{row.rank}º</td><th scope="row">{row.name}{row.liveTotal > 0 ? <small className="athlete-live-label">Inclui {number(row.liveTotal)} ao vivo</small> : null}</th><td>{row.teamName}</td><td><strong>{number(row.total)}</strong></td><td>{row.games}</td></tr>)}</tbody></table></div>{pages > 1 ? <nav className="athlete-statistics-pagination" aria-label={`Páginas de atletas de ${table.sportName}`}><button className="btn btn-outline btn-small" type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>{currentPage + 1} de {pages}</span><button className="btn btn-outline btn-small" type="button" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>Próxima</button></nav> : null}</> : <p>Nenhum atleta com lance atribuído nesta seleção.</p>}
  </article>
}

export function AthleteStatisticsPanel({ games }) {
  const [sport, setSport] = useState('')
  const [tournament, setTournament] = useState('')
  const [team, setTeam] = useState('')
  const [finishedOnly, setFinishedOnly] = useState(false)
  const [search, setSearch] = useState('')
  const teamAliases = useMemo(() => buildStatisticsTeamAliases(games), [games])
  const scoringGames = games.filter(hasIndividualScoring)
  const sports = [...new Map(scoringGames.map((game) => [statisticsSportKey(game), { id: statisticsSportKey(game), name: game.esporteNome }])).values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const sportGames = scoringGames.filter((game) => !sport || statisticsSportKey(game) === sport)
  const tournaments = [...new Map(sportGames.map((game) => [statisticsTournamentKey(game), { id: statisticsTournamentKey(game), name: `${game.esporteNome} · ${game.tournamentName || 'Sem torneio definido'}` }])).values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const teamGames = sportGames.filter((game) => !tournament || statisticsTournamentKey(game) === tournament)
  const teams = [...new Map(teamGames.flatMap((game) => ['A', 'B'].filter((side) => game[`time${side}`] && !game[`seedLabel${side}`]).map((side) => [statisticsTeamKey(game, side, teamAliases), { id: statisticsTeamKey(game, side, teamAliases), name: `${game.esporteNome} · ${game[`time${side}`]}` }]))).values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const tables = useMemo(() => buildAthleteStatistics(games, { sport, tournament, team, finishedOnly, search: search.trim() }), [games, sport, tournament, team, finishedOnly, search])
  const filters = JSON.stringify([sport, tournament, team, finishedOnly, search.trim()])
  return <section className="athlete-statistics-panel" aria-label="Estatísticas individuais"><div className="section-heading"><div><span className="eyebrow">Atletas do Interclasse</span><h2>Artilharia e pontos por atleta</h2><p>Estatísticas dos gols e pontos registrados com autor. Cada modalidade tem sua própria lista.</p></div><span className="athlete-statistics-sync">Atualização em tempo real</span></div>
    <div className="athlete-statistics-filters"><label>Modalidade<select value={sport} onChange={(event) => { setSport(event.target.value); setTournament(''); setTeam('') }}><option value="">Todas as modalidades</option>{sports.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Torneio<select value={tournament} onChange={(event) => { setTournament(event.target.value); setTeam('') }}><option value="">Todos os torneios</option>{tournaments.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Equipe<select value={team} onChange={(event) => setTeam(event.target.value)}><option value="">Todas as equipes</option>{teams.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Buscar atleta ou equipe<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Primeiro nome ou equipe" /></label></div>
    <label className="match-checkbox"><input type="checkbox" checked={finishedOnly} onChange={(event) => setFinishedOnly(event.target.checked)} />Considerar somente partidas finalizadas</label>
    <p className="athlete-statistics-note">{finishedOnly ? 'Exibindo apenas partidas finalizadas.' : 'Inclui partidas ao vivo; os totais podem mudar durante os jogos.'} Pontos sem autor, W.O., jogos cancelados ou adiados ficam fora. “Jogos com registro” conta as partidas em que o atleta recebeu ao menos um gol ou ponto atribuído; não representa todas as suas participações.</p>
    {tables.map((table) => <AthleteTable key={`${table.id}-${filters}`} table={table} />)}
    {!tables.length ? <EmptyState title="Aguardando lances individuais" description="Os atletas aparecerão quando a organização registrar gols ou pontos por jogador nas partidas desta seleção." /> : null}
  </section>
}

export default function AthleteStatistics() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => subscribeGames((items) => { setGames(items); setLoading(false); setError('') }, (message) => { setError(message); setLoading(false) }), [])
  return <section className="page-shell athlete-statistics-page"><div className="page-heading"><span className="eyebrow">Interclasse SESI Vinhedo</span><h1>Estatísticas individuais</h1><p>Acompanhe a artilharia e os pontos por atleta de cada modalidade.</p></div>{error ? <div className="alert alert-error">{error}</div> : null}{loading ? <LoadingState label="Carregando estatísticas…" /> : <AthleteStatisticsPanel games={games} />}</section>
}
