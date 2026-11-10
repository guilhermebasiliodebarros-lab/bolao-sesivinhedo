import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import { canEditPrediction, sortRanking, subscribeGames, subscribeRanking, subscribeSports, subscribeUserPredictions } from '../services/bolaoService.js'
import EmptyState from './EmptyState.jsx'
import LoadingState from './LoadingState.jsx'
import PendingGuessBanner from './PendingGuessBanner.jsx'
import RankingTable from './RankingTable.jsx'

const GENERAL_RANKING = 'geral'

export default function Classificacao({ onNavigate }) {
  const { user, isParticipant } = useAuth()
  const [ranking, setRanking] = useState([])
  const [sports, setSports] = useState([])
  const [games, setGames] = useState([])
  const [predictionFeed, setPredictionFeed] = useState({ userId: '', items: [] })
  const predictions = useMemo(() => user?.uid === predictionFeed.userId && isParticipant ? predictionFeed.items : [], [user?.uid, predictionFeed, isParticipant])
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
    const unsubscribeGames = subscribeGames(setGames, setError)

    return () => {
      unsubscribeRanking()
      unsubscribeSports()
      unsubscribeGames()
    }
  }, [])

  useEffect(() => {
    if (!user || !isParticipant) {
      return () => {}
    }

    return subscribeUserPredictions(user.uid, (items) => setPredictionFeed({ userId: user.uid, items }), setError)
  }, [isParticipant, user])

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
  const leader = visibleRanking[0] || null
  const runnerUp = visibleRanking[1] || null
  const leaderGap = leader && runnerUp ? Math.max((leader.pontos || 0) - (runnerUp.pontos || 0), 0) : 0
  const predictionsByGame = useMemo(() => new Map(predictions.map((prediction) => [prediction.gameId, prediction])), [predictions])
  const pendingGuessCount = isParticipant ? games.filter((game) => canEditPrediction(game) && !predictionsByGame.has(game.id)).length : Number.NaN
  const loading = Object.values(loadingState).some(Boolean)

  if (loading) {
    return <LoadingState label="Atualizando classificação..." error={error} />
  }

  return (
    <section className="page-shell">
      <div className="page-heading with-actions">
        <div>
          <span className="eyebrow">{rankingTitle}</span>
          <h1>Classificação</h1>
          <p>Ordenada por maior pontuação, com desempate por acertos exatos e acertos de resultado.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => onNavigate('jogos')}>
          Ver jogos
        </button>
      </div>

      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}

      <PendingGuessBanner count={pendingGuessCount} onNavigate={onNavigate} />

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

      <section className="ranking-insight-panel" aria-label="Resumo da classificação">
        <article>
          <span className="eyebrow">Liderança</span>
          <strong>{leader?.nome || 'Aguardando participantes'}</strong>
          <small>{leader ? `${leader.pontos || 0} ponto(s)` : 'O ranking aparece assim que houver cadastro.'}</small>
        </article>
        <article>
          <span className="eyebrow">Disputa</span>
          <strong>{runnerUp ? `${leaderGap} ponto(s)` : '-'}</strong>
          <small>{runnerUp ? `Diferença para ${runnerUp.nome}` : 'Sem segundo colocado ainda.'}</small>
        </article>
        <article>
          <span className="eyebrow">Base ativa</span>
          <strong>{visibleRanking.length}</strong>
          <small>Participante(s) neste ranking</small>
        </article>
        <article>
          <span className="eyebrow">Modalidades</span>
          <strong>{sports.length}</strong>
          <small>Esporte(s) com aba própria</small>
        </article>
      </section>

      {ranking.length ? (
        <>
          {activeRanking !== GENERAL_RANKING && !hasRankingData ? (
            <div className="alert alert-error">Este esporte ainda não tem jogos finalizados com pontuação.</div>
          ) : null}
          <RankingTable ranking={visibleRanking} />
        </>
      ) : (
        <EmptyState
          title="Ranking ainda vazio"
          description="Os participantes aparecem aqui depois do cadastro."
          action={
            <button className="btn btn-primary" type="button" onClick={() => onNavigate(user ? 'jogos' : 'cadastro')}>
              {user ? 'Ver jogos' : 'Cadastrar participante'}
            </button>
          }
        />
      )}
    </section>
  )
}
