import { shiftLabel } from '../utils/schoolShifts.js'
import { useMemo, useState } from 'react'
import { buildInterclassStandings } from '../utils/interclassStandings.js'

const number = (value) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)

export function StandingsTable({ table }) {
  return <div className="interclass-table-wrap"><table className="interclass-table" aria-label={`${table.sportName} · ${table.tournamentName} · ${table.groupName}`}><thead><tr><th>Pos.</th><th>Equipe</th><th>Pts</th><th>J</th><th>V</th><th>E</th><th>D</th><th>Saldo</th></tr></thead><tbody>{table.rows.map((row, index) => <tr key={row.id}><td>{index + 1}º</td><th scope="row">{row.nome}</th><td><strong>{number(row.pontos)}</strong></td><td>{row.jogos}</td><td>{row.vitorias}</td><td>{row.empates}</td><td>{row.derrotas}</td><td>{number(row.saldo)}</td></tr>)}</tbody></table><p className="standings-rule-note">Vitória: {number(table.winPoints)} · Empate: {number(table.drawPoints)} · Derrota: {number(table.lossPoints)} · Desempate: vitórias, saldo e pontos a favor.</p></div>
}

export default function InterclassStandingsPanel({ games, teams, sports }) {
  const [sport, setSport] = useState('')
  const [competition, setCompetition] = useState('')
  const tables = useMemo(() => buildInterclassStandings(games, teams, sports), [games, teams, sports])
  const modalities = [...new Map(tables.map((table) => [table.sportId, { id: table.sportId, nome: table.sportName }])).values()]
  const available = tables.filter((table) => !sport || table.sportId === sport)
  const competitions = [...new Map(available.map((table) => [table.competitionId, { id: table.competitionId, nome: table.tournamentName, sportName: table.sportName }])).values()]
  const visible = available.filter((table) => !competition || table.competitionId === competition)

  return <section className="interclass-standings-panel" aria-label="Classificação por grupo">
    <div className="section-heading"><div><span className="eyebrow">Fase de grupos</span><h2>Classificação por grupo</h2><p>Cada grupo tem sua própria pontuação e posição dentro do torneio. Apenas os resultados finais da fase de grupos contam.</p></div></div>
    <div className="form-grid">
      <label>Filtrar modalidade<select value={sport} onChange={(event) => { setSport(event.target.value); setCompetition('') }}><option value="">Todos os esportes</option>{modalities.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label>
      <label>Filtrar torneio<select value={competition} onChange={(event) => setCompetition(event.target.value)}><option value="">Todos os torneios</option>{competitions.map((item) => <option value={item.id} key={item.id}>{item.sportName} · {item.nome}</option>)}</select></label>
    </div>
    {visible.map((table) => <article key={table.id}><span className="eyebrow">{table.sportName}{table.turno ? ` · ${shiftLabel(table.turno)}` : ''} · {table.tournamentName}</span><h3>{table.groupName}</h3><StandingsTable table={table} /></article>)}
    {!visible.length ? <div className="live-control-empty"><strong>Nenhum grupo cadastrado neste filtro.</strong><p>Os grupos aparecem quando suas partidas são criadas no gerador de chaveamento.</p></div> : null}
    <p className="form-hint">Equipes com jogos agendados aparecem com zero partidas disputadas. Os resultados do mata-mata ficam separados desta classificação.</p>
  </section>
}
