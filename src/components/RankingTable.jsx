import { formatPoints } from '../utils/format.js'

export default function RankingTable({ ranking }) {
  const topThree = ranking.slice(0, 3)

  return (
    <div className="ranking-wrap">
      {topThree.length ? (
        <div className="podium" aria-label="Podio dos tres primeiros colocados">
          {topThree.map((participant, index) => (
            <article className={`podium-card podium-${index + 1}`} key={participant.id}>
              <span>{index + 1}o lugar</span>
              <strong>{participant.nome || participant.email}</strong>
              <small>{formatPoints(participant.pontos)} pts</small>
            </article>
          ))}
        </div>
      ) : null}

      <div className="ranking-table">
        <div className="ranking-head">
          <span>Posicao</span>
          <span>Nome</span>
          <span>Pontos</span>
          <span>Exatos</span>
          <span>Resultado</span>
        </div>

        {ranking.map((participant, index) => (
          <div className="ranking-row" key={participant.id}>
            <strong>{index + 1}o</strong>
            <span>{participant.nome || participant.email}</span>
            <span>{formatPoints(participant.pontos)}</span>
            <span>{participant.acertosExatos || 0}</span>
            <span>{participant.acertosResultado || 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
