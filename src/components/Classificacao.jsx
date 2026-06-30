import { useEffect, useMemo, useState } from 'react'
import { sortRanking, subscribeRanking, subscribeSports } from '../services/bolaoService.js'
import EmptyState from './EmptyState.jsx'
import LoadingState from './LoadingState.jsx'
import RankingTable from './RankingTable.jsx'

const GENERAL_RANKING = 'geral'

export default function Classificacao({ onNavigate }) {
  const [ranking, setRanking] = useState([])
  const [sports, setSports] = useState([])
  const [activeRanking, setActiveRanking] = useState(GENERAL_RANKING)
  const [loadingState, setLoadingState] = useState({ ranking: true, sports: true })
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubscribeRanking = subscribeRanking(
      (items) => {
        setRanking(items)
        setLoadingState((current) => ({ ...current, ranking: false }))
      },
      setError,
    )
    const unsubscribeSports = subscribeSports(
      (items) => {
        setSports(items)
        setLoadingState((current) => ({ ...current, sports: false }))
      },
      setError,
    )

    return () => {
      unsubscribeRanking()
      unsubscribeSports()
    }
  }, [])

  const visibleRanking = useMemo(() => {
    if (activeRanking === GENERAL_RANKING) {
      return ranking
    }

    return sortRanking(
      ranking.map((participant) => {
        const sportStats = participant.rankingPorEsporte?.[activeRanking] || {}

        return {
          ...participant,
          pontos: sportStats.pontos || 0,
          acertosExatos: sportStats.acertosExatos || 0,
          acertosResultado: sportStats.acertosResultado || 0,
        }
      }),
    )
  }, [activeRanking, ranking])
  const selectedSport = sports.find((sport) => sport.id === activeRanking)
  const rankingTitle = activeRanking === GENERAL_RANKING ? 'Ranking geral' : `Ranking: ${selectedSport?.nome || 'Esporte'}`
  const hasRankingData = visibleRanking.some(
    (participant) =>
      (participant.pontos || 0) > 0 ||
      (participant.acertosExatos || 0) > 0 ||
      (participant.acertosResultado || 0) > 0,
  )
  const loading = Object.values(loadingState).some(Boolean)

  if (loading) {
    return <LoadingState label="Atualizando classificacao..." />
  }

  return (
    <section className="page-shell">
      <div className="page-heading with-actions">
        <div>
          <span className="eyebrow">{rankingTitle}</span>
          <h1>Classificacao</h1>
          <p>Ordenada por maior pontuacao, com desempate por acertos exatos e acertos de resultado.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => onNavigate('jogos')}>
          Ver jogos
        </button>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="ranking-tabs segmented-control" aria-label="Tipo de ranking">
        <button
          className={activeRanking === GENERAL_RANKING ? 'is-active' : ''}
          type="button"
          aria-pressed={activeRanking === GENERAL_RANKING}
          onClick={() => setActiveRanking(GENERAL_RANKING)}
        >
          Geral
        </button>
        {sports.map((sport) => (
          <button
            className={activeRanking === sport.id ? 'is-active' : ''}
            key={sport.id}
            type="button"
            aria-pressed={activeRanking === sport.id}
            onClick={() => setActiveRanking(sport.id)}
          >
            {sport.nome}
          </button>
        ))}
      </div>

      {ranking.length ? (
        <>
          {activeRanking !== GENERAL_RANKING && !hasRankingData ? (
            <div className="alert alert-error">Este esporte ainda nao tem jogos finalizados com pontuacao.</div>
          ) : null}
          <RankingTable ranking={visibleRanking} />
        </>
      ) : (
        <EmptyState
          title="Ranking ainda vazio"
          description="Os participantes aparecem aqui depois do cadastro."
          action={
            <button className="btn btn-primary" type="button" onClick={() => onNavigate('cadastro')}>
              Cadastrar participante
            </button>
          }
        />
      )}
    </section>
  )
}
