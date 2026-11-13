import { useEffect, useMemo, useState } from 'react'
import { subscribeGames, subscribeSports, subscribeTeams } from '../services/bolaoService.js'
import { buildInterclassStandings } from '../utils/interclassStandings.js'
import { bracketParticipant, bracketPath, buildBracket, canSimulateGame, indicatedQualifiers, listCompetitions, qualificationAtCut, simulateStandings, simulationFingerprint, standingsGames } from '../utils/tournamentExplorer.js'
import { getMatchLabel, getMatchOutcome, getMatchScore, getMatchState, MATCH_STATE } from '../utils/match.js'
import { formatSportScore, getSportProfile } from '../utils/sportRules.js'
import { formatDateTime } from '../utils/format.js'
import { shiftLabel } from '../utils/schoolShifts.js'
import { tieBreakSummary } from '../utils/tieBreak.js'
import { StandingsTable } from './InterclassTable.jsx'
import LoadingState from './LoadingState.jsx'
import { scorePresentation } from '../utils/scorePresentation.js'
import './TournamentExplorer.css'

const number = (value) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)

function BracketBoard({ games }) {
  const graph = useMemo(() => buildBracket(games), [games])
  const [selected, setSelected] = useState('')
  const path = bracketPath(graph, selected)
  if (!graph.nodes.length) return <div className="tournament-empty"><strong>O mata-mata ainda não foi publicado.</strong><p>As fases aparecerão aqui quando a organização cadastrar as partidas e seus vínculos.</p></div>
  return <section className="public-bracket" aria-label="Caminho até a final">
    <div className="section-heading"><div><span className="eyebrow">Caminho até a final</span><h2>O próximo confronto começa aqui.</h2><p>Toque em uma partida para destacar seu caminho. Os resultados são os publicados pela organização.</p></div>{path.size ? <button className="btn btn-outline btn-small" type="button" onClick={() => setSelected('')}>Mostrar todo o chaveamento</button> : null}</div>
    {graph.champion ? <div className="bracket-champion"><span aria-hidden="true">★</span><div><small>Campeão do torneio</small><strong>{graph.champion}</strong></div></div> : null}
    {graph.cycle || graph.missingLinks ? <p className="alert" role="status">Há vínculos incompletos neste torneio. O desenho mostra apenas as conexões válidas entre as partidas publicadas.</p> : null}
    <p className="tournament-scroll-hint">No celular, deslize o chaveamento para os lados. Você também pode usar as setas do teclado nesta área.</p>
    <div className="bracket-viewport" tabIndex={0} role="region" aria-label="Chaveamento visual com rolagem horizontal">
      <div className="bracket-track" style={{ width: graph.width, height: graph.height }}>
        <svg className="bracket-connectors" width={graph.width} height={graph.height} aria-hidden="true">{graph.edges.map((edge) => {
          const source = graph.byId.get(edge.source); const target = graph.byId.get(edge.target)
          const startX = source.x + 260; const startY = source.y + 103; const endY = target.y + (edge.side === 'A' ? 83 : 123)
          return <path key={`${edge.target}:${edge.side}`} className={`${target.game[`sourceOutcome${edge.side}`] === 'loser' ? 'is-loser' : ''} ${path.size && path.has(edge.source) && path.has(edge.target) ? 'is-highlighted' : path.size ? 'is-muted' : ''}`} d={`M ${startX} ${startY} H ${startX + 35} V ${endY} H ${target.x}`} />
        })}</svg>
        {graph.rounds.map((round) => <h3 className="bracket-round-label" key={round.rank} style={{ left: round.x }}>{round.label}</h3>)}
        {graph.nodes.map((node) => {
          const game = node.game; const outcome = getMatchOutcome(game); const state = getMatchState(game)
          const showScore = [MATCH_STATE.LIVE, MATCH_STATE.FINISHED].includes(state)
          const presentation = scorePresentation(game)
          const score = presentation.values || getMatchScore(game)
          return <button type="button" key={node.id} className={`bracket-match ${selected === node.id ? 'is-selected' : ''} ${path.size && !path.has(node.id) ? 'is-muted' : ''}`} style={{ left: node.x, top: node.y }} onClick={() => setSelected((current) => current === node.id ? '' : node.id)} aria-pressed={selected === node.id} aria-label={`${game.rodada || game.fase}: ${bracketParticipant(node, 'A', graph)} contra ${bracketParticipant(node, 'B', graph)}. ${getMatchLabel(game)}`}>
            <span className="bracket-match-heading"><strong>{game.rodada || game.fase}</strong><small className={state === MATCH_STATE.LIVE ? 'is-live' : ''}>{getMatchLabel(game)}</small></span>
            {['A', 'B'].map((side, index) => <span key={side} className={`bracket-team ${outcome === side ? 'is-winner' : ''}`}><span title={bracketParticipant(node, side, graph)}>{bracketParticipant(node, side, graph)}</span><strong>{showScore ? formatSportScore(score[index]) : '–'}</strong></span>)}
            <span className="bracket-match-footer">{presentation.caption || tieBreakSummary(game) || (outcome === 'draw' ? 'Empate · vencedor ainda não definido' : game.dataHora ? formatDateTime(game.dataHora) : 'Horário a definir')}</span>
          </button>
        })}
      </div>
    </div>
    {graph.nodes.some((node) => node.game.placement === 'third-place') ? <p className="form-hint">As linhas tracejadas levam os perdedores das semifinais à disputa de terceiro lugar.</p> : null}
    {!graph.edges.length && graph.nodes.length > 1 ? <p className="form-hint">Estas partidas ainda não têm vínculos de avanço cadastrados. Nenhuma conexão foi presumida pelo horário ou pelo nome das equipes.</p> : null}
  </section>
}

function TournamentOverview({ competition, teams, sports }) {
  const groups = buildInterclassStandings(standingsGames(competition.games), teams, sports)
  return <>
    {groups.length ? <section className="tournament-group-stage" aria-label="Grupos do torneio"><div className="section-heading"><div><span className="eyebrow">Resultados oficiais</span><h2>Fase de grupos</h2><p>Acompanhe a classificação antes do mata-mata.</p></div></div><div className="tournament-groups">{groups.map((table) => <article key={table.id}><h3>{table.groupName}</h3><StandingsTable table={table} /></article>)}</div></section> : null}
    <BracketBoard games={competition.games} />
  </>
}

function SimulationScore({ game, draft, issue, onChange, onClear }) {
  const editable = canSimulateGame(game)
  const profile = getSportProfile(game)
  const current = getMatchScore(game)
  const officialScore = [MATCH_STATE.LIVE, MATCH_STATE.FINISHED].includes(getMatchState(game))
  const complete = draft && String(draft.a ?? '').trim() && String(draft.b ?? '').trim() && !issue
  return <article className={`simulation-match ${draft ? 'has-draft' : ''}`}>
    <div className="simulation-match-heading"><strong>{game.groupName || 'Classificação geral'}</strong><span>{getMatchLabel(game)}{complete ? ' · cenário preenchido' : ''}</span></div>
    <div className="simulation-score-row"><span title={game.timeA}>{game.timeA}</span><label><span className="sr-only">Placar simulado de {game.timeA} contra {game.timeB}</span><input type="number" inputMode="decimal" min="0" max={profile.scoringMode === 'chess' ? 1 : profile.scoringMode === 'sets' ? Math.ceil(profile.volleyballBestOf / 2) : 10000} step={profile.scoringMode === 'chess' ? '0.5' : '1'} value={editable ? draft?.a ?? '' : officialScore && Number.isFinite(current[0]) ? current[0] : ''} placeholder="–" disabled={!editable} onChange={(event) => onChange('a', event.target.value)} /></label><span aria-hidden="true">×</span><label><span className="sr-only">Placar simulado de {game.timeB} contra {game.timeA}</span><input type="number" inputMode="decimal" min="0" max={profile.scoringMode === 'chess' ? 1 : profile.scoringMode === 'sets' ? Math.ceil(profile.volleyballBestOf / 2) : 10000} step={profile.scoringMode === 'chess' ? '0.5' : '1'} value={editable ? draft?.b ?? '' : officialScore && Number.isFinite(current[1]) ? current[1] : ''} placeholder="–" disabled={!editable} onChange={(event) => onChange('b', event.target.value)} /></label><span title={game.timeB}>{game.timeB}</span></div>
    {editable ? <small>{profile.scoringMode === 'sets' ? `Sets ganhos · melhor de ${profile.volleyballBestOf}` : profile.scoringMode === 'chess' ? 'Xadrez · 1 × 0, ½ × ½ ou 0 × 1' : profile.scoringMode === 'goals' ? 'Gols na simulação' : 'Pontos na simulação'}</small> : <small>Este resultado ou situação oficial é preservado.</small>}
    {issue ? <p className="simulation-field-error" role="status">{issue}</p> : null}
    {draft ? <button className="simulation-clear-game" type="button" onClick={onClear}>Limpar este cenário</button> : null}
  </article>
}

function StandingsSimulator({ competition, teams, sports }) {
  const [drafts, setDrafts] = useState({})
  const [cuts, setCuts] = useState({})
  const [focus, setFocus] = useState('')
  const result = useMemo(() => simulateStandings(competition.games, drafts, teams, sports), [competition.games, drafts, teams, sports])
  const matches = standingsGames(competition.games)
  const update = (game, field, value) => setDrafts((current) => {
    const fingerprint = simulationFingerprint(game)
    const previous = current[game.id]?.fingerprint === fingerprint ? current[game.id] : { a: '', b: '', fingerprint }
    return { ...current, [game.id]: { ...previous, [field]: value } }
  })
  const clearGame = (id) => setDrafts((current) => { const next = { ...current }; delete next[id]; return next })
  const cutFor = (table) => Math.min(table.rows.length, cuts[table.id] || indicatedQualifiers(competition.games, table.groupName) || 2)
  const highlighted = result.tables.flatMap((table) => table.rows.map((row, index) => ({ table, row, index, key: JSON.stringify([table.id, row.id]) }))).find((item) => item.key === focus)
  if (!matches.length) return <div className="tournament-empty"><strong>Este torneio não tem uma classificação de grupos para simular.</strong><p>Selecione um torneio com fase de grupos ou todos contra todos. O mata-mata pode ser acompanhado na aba Chaveamento.</p></div>
  return <section className="standings-simulator" aria-label="Simulador de classificação">
    <div className="simulation-banner"><span aria-hidden="true">◇</span><div><strong>O que acontece se…?</strong><p>Preencha placares hipotéticos e veja as posições mudarem. Os cenários ficam apenas nesta tela e não alteram os resultados oficiais.</p></div><button className="btn btn-outline btn-small" type="button" disabled={!Object.keys(drafts).length && !Object.keys(cuts).length && !focus} onClick={() => { setDrafts({}); setCuts({}); setFocus('') }}>Limpar simulação</button></div>
    <div className="simulation-summary" role="status" aria-live="polite"><span><strong>{result.applied.size}</strong> resultado(s) simulado(s)</span><span><strong>{result.remaining}</strong> partida(s) ainda sem resultado neste cenário</span></div>
    <label className="simulation-focus-label">Destacar uma equipe<select value={highlighted ? focus : ''} onChange={(event) => setFocus(event.target.value)}><option value="">Acompanhar todas</option>{result.tables.flatMap((table) => table.rows.map((row) => <option key={JSON.stringify([table.id, row.id])} value={JSON.stringify([table.id, row.id])}>{row.nome} · {table.groupName}</option>))}</select></label>
    {highlighted ? <p className="simulation-focus-summary" role="status"><strong>{highlighted.row.nome}</strong> fica em <strong>{highlighted.index + 1}º</strong> no {highlighted.table.groupName}, com {number(highlighted.row.pontos)} ponto(s). {qualificationAtCut(highlighted.table, cutFor(highlighted.table))[highlighted.index] === 'tie' ? 'Há empate no corte de classificação; confira o regulamento.' : highlighted.index < cutFor(highlighted.table) ? 'Está na faixa escolhida para este cenário.' : 'Está fora da faixa escolhida para este cenário.'} {result.remainingByTable[highlighted.table.id] ? 'As partidas restantes deste grupo ainda podem mudar essa posição.' : ''}</p> : null}
    <div className="simulation-layout"><section className="simulation-fixtures" aria-label="Placares hipotéticos"><div className="section-heading"><div><span className="eyebrow">Experimente os resultados</span><h2>Se esse jogo terminar assim…</h2></div></div>{matches.map((game) => <SimulationScore key={game.id} game={game} draft={drafts[game.id]} issue={result.issues[game.id]} onChange={(field, value) => update(game, field, value)} onClear={() => clearGame(game.id)} />)}</section>
      <section className="simulation-tables" aria-label="Classificação simulada"><div className="section-heading"><div><span className="eyebrow">Projeção do cenário</span><h2>…a tabela fica assim.</h2></div></div>{result.tables.map((table) => {
        const cut = cutFor(table); const statuses = qualificationAtCut(table, cut)
        return <article className="simulation-table-card" key={table.id}><div className="simulation-table-heading"><h3>{table.groupName}</h3><label>Equipes na faixa<select aria-label={`Equipes na faixa do ${table.groupName}`} value={cut} onChange={(event) => setCuts((current) => ({ ...current, [table.id]: Number(event.target.value) }))}>{table.rows.map((_row, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label></div><div className="interclass-table-wrap"><table className="interclass-table simulation-table" aria-label={`Classificação simulada · ${table.groupName}`}><thead><tr><th>Pos.</th><th>Equipe</th><th>Pts</th><th>J</th><th>Saldo</th><th>Variação</th></tr></thead><tbody>{table.rows.map((row, index) => <tr key={row.id} className={`${statuses[index] === 'inside' ? 'simulation-inside' : statuses[index] === 'tie' ? 'simulation-tie' : ''} ${JSON.stringify([table.id, row.id]) === focus ? 'is-focused' : ''}`}><td>{index + 1}º</td><th scope="row">{row.nome}<small>{statuses[index] === 'tie' ? 'Empate no corte' : statuses[index] === 'inside' ? 'Na faixa simulada' : 'Fora da faixa'}</small></th><td><strong>{number(row.pontos)}</strong></td><td>{row.jogos}</td><td>{number(row.saldo)}</td><td><span className={row.movement > 0 ? 'simulation-up' : row.movement < 0 ? 'simulation-down' : ''}>{row.movement > 0 ? `↑ ${row.movement}` : row.movement < 0 ? `↓ ${Math.abs(row.movement)}` : '—'}</span></td></tr>)}</tbody></table></div><p className="standings-rule-note">Vitória {number(table.winPoints)} · Empate {number(table.drawPoints)} · Derrota {number(table.lossPoints)}. Desempate: vitórias, saldo e pontos a favor.</p><p className="form-hint">A faixa pode ser ajustada para explorar cenários. Não confirma classificação oficial. Empates no corte dependem do regulamento.</p></article>
      })}</section></div>
  </section>
}

export default function TournamentExplorer({ mode = 'bracket', onNavigate }) {
  const [data, setData] = useState({ games: [], sports: [], teams: [] })
  const [loading, setLoading] = useState({ games: true, sports: true, teams: true })
  const [error, setError] = useState('')
  const [synced, setSynced] = useState(false)
  const [sport, setSport] = useState('')
  const [turno, setTurno] = useState('')
  const [selected, setSelected] = useState('')
  useEffect(() => {
    const receive = (key) => (items) => { setData((current) => ({ ...current, [key]: items })); setLoading((current) => ({ ...current, [key]: false })) }
    const failed = (key) => (message) => { setError(message); setLoading((current) => ({ ...current, [key]: false })) }
    const unsubscribers = [subscribeGames(receive('games'), failed('games'), setSynced), subscribeSports(receive('sports'), failed('sports')), subscribeTeams(receive('teams'), failed('teams'))]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [])
  const competitions = useMemo(() => listCompetitions(data.games), [data.games])
  const available = competitions.filter((item) => (!sport || item.sportId === sport) && (!turno || item.turno === turno))
  const current = available.find((item) => item.id === selected) || available[0]
  const modalities = [...new Map([...data.sports.map((item) => [item.id, item.nome]), ...competitions.map((item) => [item.sportId, item.sportName])]).entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  const busy = Object.values(loading).some(Boolean)
  return <section className="page-shell tournament-explorer"><header className="tournament-page-heading"><div><span className="eyebrow">Interclasse SESI Vinhedo · Acesso público</span><h1>{mode === 'simulator' ? 'Simulador de classificação' : 'Chaveamento dos torneios'}</h1><p>{mode === 'simulator' ? 'Teste possibilidades, acompanhe sua turma e descubra como cada resultado muda a disputa.' : 'Dos grupos à decisão: acompanhe os confrontos e o caminho das equipes até a final.'}</p></div><span className={`tournament-sync ${synced ? 'is-synced' : ''}`}>{synced ? 'Dados atualizados em tempo real' : 'Aguardando sincronização · dados em cache'}</span></header>
    <div className="segmented-control tournament-mode-tabs" role="group" aria-label="Explorar torneio"><button type="button" className={mode === 'bracket' ? 'is-active' : ''} aria-pressed={mode === 'bracket'} onClick={() => onNavigate('chaveamento')}>Chaveamento</button><button type="button" className={mode === 'simulator' ? 'is-active' : ''} aria-pressed={mode === 'simulator'} onClick={() => onNavigate('simulador')}>Simular classificação</button></div>
    {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
    <div className="tournament-filter-panel"><label>Modalidade<select aria-label="Modalidade" value={sport} onChange={(event) => { setSport(event.target.value); setSelected('') }}><option value="">Todas as modalidades</option>{modalities.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>Turno<select aria-label="Turno" value={turno} onChange={(event) => { setTurno(event.target.value); setSelected('') }}><option value="">Manhã e tarde</option><option value="manha">Manhã</option><option value="tarde">Tarde</option></select></label><label>Torneio<select aria-label="Torneio" value={current?.id || ''} disabled={!available.length} onChange={(event) => setSelected(event.target.value)}>{available.length ? available.map((item) => <option key={item.id} value={item.id}>{item.sportName} · {shiftLabel(item.turno)} · {item.name}</option>) : <option value="">Nenhum torneio neste filtro</option>}</select></label></div>
    {busy ? <LoadingState label="Carregando torneios…" /> : current ? <><div className="tournament-current"><span>{current.sportName} · {shiftLabel(current.turno)}</span><strong>{current.name}</strong><small>{current.games.length} partida(s) publicadas</small></div>{mode === 'bracket' ? <TournamentOverview key={current.id} competition={current} teams={data.teams} sports={data.sports} /> : <StandingsSimulator key={current.id} competition={current} teams={data.teams} sports={data.sports} />}</> : <div className="tournament-empty"><strong>Nenhum torneio publicado neste filtro.</strong><p>As modalidades e equipes já cadastradas aparecerão aqui quando a organização publicar as partidas.</p></div>}
  </section>
}
