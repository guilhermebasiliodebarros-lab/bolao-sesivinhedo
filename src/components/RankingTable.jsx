import { useEffect, useRef, useState } from 'react'
import { formatPoints } from '../utils/format.js'

export default function RankingTable({ ranking }) {
  const [movingIds, setMovingIds] = useState(new Set())
  const previousPositionsRef = useRef(new Map())
  const topThree = ranking.slice(0, 3)
  const medals = ['1o', '2o', '3o']

  useEffect(() => {
    const previousPositions = previousPositionsRef.current
    const changedIds = new Set()

    ranking.forEach((participant, index) => {
      const previousIndex = previousPositions.get(participant.id)

      if (previousIndex !== undefined && previousIndex !== index) {
        changedIds.add(participant.id)
      }
    })

    previousPositionsRef.current = new Map(ranking.map((participant, index) => [participant.id, index]))

    if (!changedIds.size) {
      return undefined
    }

    setMovingIds(changedIds)
    const timeout = window.setTimeout(() => setMovingIds(new Set()), 900)

    return () => window.clearTimeout(timeout)
  }, [ranking])

  const getGapToNext = (index) => {
    const current = Number(ranking[index]?.pontos || 0)
    const next = Number(ranking[index + 1]?.pontos || 0)

    if (!ranking[index + 1]) {
      return 'Ultimo listado'
    }

    const gap = current - next
    return gap > 0 ? `${formatPoints(gap)} pts a frente` : 'Empatado'
  }

  return (
    <div className="ranking-wrap">
      {topThree.length ? (
        <div className="podium" aria-label="Podio dos tres primeiros colocados">
          {topThree.map((participant, index) => (
            <article
              className={
                movingIds.has(participant.id)
                  ? `podium-card podium-${index + 1} is-ranking-moving`
                  : `podium-card podium-${index + 1}`
              }
              key={participant.id}
            >
              <span>{medals[index]} lugar</span>
              <strong>{participant.nome || participant.email}</strong>
              <small>{formatPoints(participant.pontos)} pts</small>
              <em>{getGapToNext(index)}</em>
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
          <div
            className={[
              'ranking-row',
              index < 3 ? 'is-top-ranked' : '',
              movingIds.has(participant.id) ? 'is-ranking-moving' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            key={participant.id}
          >
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
