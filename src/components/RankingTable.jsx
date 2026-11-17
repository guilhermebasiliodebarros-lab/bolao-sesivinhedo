import { useEffect, useRef, useState } from 'react'
import { formatPoints } from '../utils/format.js'
import { findRankingEntries } from '../utils/rankingPresentation.js'

const PODIUM_MEDALS = ['🥇', '🥈', '🥉']

function getAvatarLabel(participant) {
  return String(participant.nome || participant.email || 'P').trim().charAt(0).toLocaleUpperCase('pt-BR') || 'P'
}

function ParticipantAvatar({ participant, podium = false }) {
  const className = podium ? 'participant-avatar podium-avatar' : 'participant-avatar'

  if (participant.avatarUrl) {
    return <img className={className} src={participant.avatarUrl} alt="" loading="lazy" />
  }

  return (
    <span className={className} aria-hidden="true">
      {getAvatarLabel(participant)}
    </span>
  )
}

export default function RankingTable({ ranking, currentUserId }) {
  const [movingIds, setMovingIds] = useState(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const previousPositionsRef = useRef(new Map())
  const ownRowRef = useRef(null)
  const topThree = ranking.slice(0, 3)
  const visibleEntries = findRankingEntries(ranking, searchTerm)
  const ownPosition = ranking.findIndex((participant) => participant.id === currentUserId) + 1
  const ownEntry = ownPosition ? ranking[ownPosition - 1] : null
  const gapToLeader = ownEntry ? Math.max(0, Number(ranking[0]?.pontos || 0) - Number(ownEntry.pontos || 0)) : 0

  const showMyPosition = () => {
    setSearchTerm('')
    window.requestAnimationFrame(() => {
      ownRowRef.current?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' })
      ownRowRef.current?.focus({ preventScroll: true })
    })
  }

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
      return 'Último listado'
    }

    const gap = current - next
    return gap > 0 ? `${formatPoints(gap)} pts à frente` : 'Empatado'
  }

  return (
    <div className="ranking-wrap">
      {ownEntry ? <section className="ranking-personal-summary" aria-label="Sua posição neste ranking"><div><span className="eyebrow">Sua participação</span><strong>Você está em {ownPosition}º lugar</strong><p>{ownPosition === 1 ? 'Você ocupa a primeira posição. Continue acompanhando seus palpites.' : gapToLeader > 0 ? `${formatPoints(gapToLeader)} pontos separam você da liderança.` : 'Você tem a mesma pontuação da liderança. Os critérios de desempate definem a posição.'}</p></div><span className="ranking-personal-points">{formatPoints(ownEntry.pontos)}<small>pontos</small></span><button type="button" className="btn btn-outline btn-small" onClick={showMyPosition}>Ver minha posição</button></section> : null}
      {topThree.length ? (
        <div className="podium" aria-label="Pódio dos três primeiros colocados">
          {topThree.map((participant, index) => (
            <article
              className={
                movingIds.has(participant.id)
                  ? `podium-card podium-${index + 1} is-ranking-moving`
                  : `podium-card podium-${index + 1}`
              }
              key={participant.id}
            >
              {index === 0 ? <div className="leader-ribbon">Líder atual</div> : null}
              <span className="medal-badge">
                <span aria-hidden="true">{PODIUM_MEDALS[index]}</span>
                {index + 1}º lugar
              </span>
              <ParticipantAvatar participant={participant} podium />
              <strong>{participant.nome || participant.email}</strong>
              <small>{formatPoints(participant.pontos)} pts</small>
              <em>{getGapToNext(index)}</em>
            </article>
          ))}
        </div>
      ) : null}

      <div className="ranking-search-toolbar">
        <label>Buscar participante<input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Digite o nome…" /></label>
        <p role="status" aria-live="polite">{visibleEntries.length} de {ranking.length} participante(s){searchTerm ? <button type="button" className="link-button" onClick={() => setSearchTerm('')}>Limpar busca</button> : null}</p>
      </div>
      <div className="ranking-table" role="table" aria-label="Classificação dos participantes">
        <div className="ranking-head" role="row">
          <span role="columnheader">Posição</span>
          <span role="columnheader">Nome</span>
          <span role="columnheader">Pontos</span>
          <span role="columnheader">Exatos</span>
          <span role="columnheader">Resultado</span>
        </div>

        {visibleEntries.map(({ participant, position }) => (
          <div
            className={[
              'ranking-row',
              position <= 3 ? 'is-top-ranked' : '',
              participant.id === currentUserId ? 'is-current-participant' : '',
              movingIds.has(participant.id) ? 'is-ranking-moving' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            key={participant.id}
            ref={participant.id === currentUserId ? ownRowRef : undefined}
            tabIndex={participant.id === currentUserId ? -1 : undefined}
            role="row"
          >
            <strong role="cell" className="ranking-position">{position}º</strong>
            <span className="ranking-person" role="cell">
              <ParticipantAvatar participant={participant} />
              <span>{participant.nome || participant.email}{participant.id === currentUserId ? <small className="ranking-you-label">Você</small> : null}</span>
            </span>
            <span className="ranking-value ranking-points" role="cell"><small>Pontos</small>{formatPoints(participant.pontos)}</span>
            <span className="ranking-value ranking-exact" role="cell"><small>Exatos</small>{participant.acertosExatos || 0}</span>
            <span className="ranking-value ranking-outcome" role="cell"><small>Resultado</small>{participant.acertosResultado || 0}</span>
          </div>
        ))}
      </div>
      {!visibleEntries.length ? <div className="empty-state"><h3>Participante não encontrado</h3><p>Confira o nome ou limpe a busca para ver a classificação completa.</p><button type="button" className="btn btn-outline btn-small" onClick={() => setSearchTerm('')}>Ver todos os participantes</button></div> : null}
      <p className="ranking-order-note">A busca mantém as posições oficiais. Desempate: pontuação, acertos exatos e acertos de resultado.</p>
    </div>
  )
}
