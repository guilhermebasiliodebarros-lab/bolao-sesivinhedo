import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import {
  canEditPrediction,
  GAME_STATUS,
  subscribeGames,
  subscribeRanking,
  subscribeUserPredictions,
} from '../services/bolaoService.js'
import { formatDateTime, formatPoints } from '../utils/format.js'
import { getGameStageLabel } from '../utils/game.js'
import EmptyState from './EmptyState.jsx'
import GameCard from './GameCard.jsx'
import LoadingState from './LoadingState.jsx'

export default function Dashboard({ onNavigate }) {
  const { user, profile, profileLoading, isParticipant } = useAuth()
  const [games, setGames] = useState([])
  const [predictions, setPredictions] = useState([])
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      return () => {}
    }

    const unsubscribeGames = subscribeGames(
      (items) => {
        setGames(items)
        setLoading(false)
      },
      setError,
    )
    const unsubscribePredictions = subscribeUserPredictions(user.uid, setPredictions, setError)
    const unsubscribeRanking = subscribeRanking(setRanking, setError)

    return () => {
      unsubscribeGames()
      unsubscribePredictions()
      unsubscribeRanking()
    }
  }, [user])

  const predictionsByGame = useMemo(() => {
    return new Map(predictions.map((prediction) => [prediction.gameId, prediction]))
  }, [predictions])

  const openGamesAll = games.filter((game) => canEditPrediction(game))
  const openGames = openGamesAll.slice(0, 4)
  const gamesById = useMemo(() => new Map(games.map((game) => [game.id, game])), [games])
  const scoredHistory = predictions
    .filter((prediction) => gamesById.get(prediction.gameId)?.status === GAME_STATUS.FINISHED)
    .sort((a, b) => {
      const firstGame = gamesById.get(a.gameId)
      const secondGame = gamesById.get(b.gameId)
      const firstDate = new Date(firstGame?.dataHora || 0).getTime()
      const secondDate = new Date(secondGame?.dataHora || 0).getTime()

      return secondDate - firstDate
    })
  const pendingOpenGames = openGamesAll.filter((game) => !predictionsByGame.has(game.id))
  const allOpenGamesGuessed = openGamesAll.length > 0 && pendingOpenGames.length === 0
  const nextGameToGuess = pendingOpenGames[0] || openGamesAll[0] || null
  const latestScore = scoredHistory[0] || null
  const latestScoreGame = latestScore ? gamesById.get(latestScore.gameId) : null
  const participantPosition = ranking.findIndex((item) => item.id === user?.uid) + 1

  if (!user) {
    return null
  }

  if (loading || profileLoading) {
    return <LoadingState label="Carregando seu painel..." />
  }

  if (!isParticipant) {
    return (
      <section className="page-shell">
        <EmptyState
          title="Perfil de participante não encontrado"
          description="Esta área é exclusiva para contas com role user e participaRanking true."
        />
      </section>
    )
  }

  return (
    <section className="page-shell">
      <div className="page-heading">
        <span className="eyebrow">Painel do participante</span>
        <h1>Olá, {profile?.nome || user.displayName || 'participante'}</h1>
        <p>Acompanhe seus palpites, pontuação e próximos jogos disponíveis.</p>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className={pendingOpenGames.length ? 'participant-home-callout' : 'participant-home-callout is-complete'}>
        <div>
          <span className="eyebrow">Sua rodada</span>
          <h2>
            {pendingOpenGames.length
              ? `Faltam ${pendingOpenGames.length} palpite${pendingOpenGames.length === 1 ? '' : 's'}`
              : 'Tudo em dia por aqui'}
          </h2>
          <p>
            {pendingOpenGames.length
              ? 'Complete seus palpites abertos para não perder pontos quando os jogos fecharem.'
              : 'Você já enviou todos os palpites disponíveis no momento.'}
          </p>
        </div>
        <button
          className={pendingOpenGames.length ? 'btn btn-primary' : 'btn btn-outline'}
          type="button"
          onClick={() => onNavigate(pendingOpenGames.length ? 'jogos' : 'palpites')}
        >
          {pendingOpenGames.length ? 'Palpitar agora' : 'Ver palpites'}
        </button>
      </section>

      <div className="stats-grid">
        <article className="stat-card">
          <span>Pontuação atual</span>
          <strong>{formatPoints(profile?.pontos)}</strong>
        </article>
        <article className="stat-card">
          <span>Posição</span>
          <strong>{participantPosition || '-'}</strong>
        </article>
        <article className="stat-card">
          <span>Acertos exatos</span>
          <strong>{profile?.acertosExatos || 0}</strong>
        </article>
        <article className="stat-card">
          <span>Acertos resultado</span>
          <strong>{profile?.acertosResultado || 0}</strong>
        </article>
        <article className="stat-card">
          <span>Faltam palpitar</span>
          <strong>{pendingOpenGames.length}</strong>
        </article>
        <article className="stat-card">
          <span>Jogos abertos</span>
          <strong>{openGamesAll.length}</strong>
        </article>
      </div>

      <section className="dashboard-spotlight">
        <article>
          <span className="eyebrow">{allOpenGamesGuessed ? 'Tudo em dia' : 'Próximo foco'}</span>
          {allOpenGamesGuessed ? (
            <>
              <strong>Você já palpitou todos os jogos abertos</strong>
              <small>Quando novos jogos forem liberados, eles entram aqui automaticamente.</small>
              <button className="btn btn-outline btn-small" type="button" onClick={() => onNavigate('palpites')}>
                Ver palpites
              </button>
            </>
          ) : nextGameToGuess ? (
            <>
              <strong>
                {nextGameToGuess.timeA} x {nextGameToGuess.timeB}
              </strong>
              <small>
                {nextGameToGuess.esporteNome} | {formatDateTime(nextGameToGuess.dataHora)}
              </small>
              <button className="btn btn-primary btn-small" type="button" onClick={() => onNavigate('jogos')}>
                Palpitar
              </button>
            </>
          ) : (
            <>
              <strong>Nenhum jogo aberto agora</strong>
              <small>Assim que a organização liberar novos jogos, eles aparecem aqui.</small>
            </>
          )}
        </article>
        <article>
          <span className="eyebrow">Último ganho</span>
          {latestScore ? (
            <>
              <strong>{formatPoints(latestScore.pontos)} ponto(s)</strong>
              <small>
                {latestScoreGame
                  ? `${latestScoreGame.esporteNome} | ${latestScoreGame.timeA} x ${latestScoreGame.timeB}`
                  : 'Jogo finalizado'}
              </small>
            </>
          ) : (
            <>
              <strong>Aguardando resultados</strong>
              <small>Quando um placar for finalizado, seu ganho aparece aqui.</small>
            </>
          )}
        </article>
      </section>

      <div className="split-layout">
        <section>
          <div className="section-heading">
            <h2>Próximos jogos</h2>
            <button className="link-button" type="button" onClick={() => onNavigate('jogos')}>
              Ver todos
            </button>
          </div>

          <div className="card-list">
            {openGames.length ? (
              openGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  existingPrediction={predictionsByGame.get(game.id)}
                  compact
                  onNavigate={onNavigate}
                />
              ))
            ) : (
              <EmptyState
                title="Nenhum jogo aberto agora"
                description="Assim que a organização liberar novos jogos, eles aparecem aqui."
                action={
                  <button className="btn btn-outline" type="button" onClick={() => onNavigate('classificacao')}>
                    Ver classificação
                  </button>
                }
              />
            )}
          </div>
        </section>

        <section>
          <div className="section-heading">
            <h2>Palpites enviados</h2>
            <button className="link-button" type="button" onClick={() => onNavigate('palpites')}>
              Detalhes
            </button>
          </div>

          <div className="mini-list">
            {predictions.length ? (
              predictions.slice(0, 6).map((prediction) => {
                const game = gamesById.get(prediction.gameId)

                return (
                  <article className="mini-item" key={prediction.id}>
                    <span>
                      {game
                        ? `${game.esporteNome} | ${getGameStageLabel(game)} | ${game.timeA} x ${game.timeB}`
                        : 'Jogo removido'}
                    </span>
                    <strong>
                      {prediction.palpiteA} x {prediction.palpiteB}
                    </strong>
                  </article>
                )
              })
            ) : (
              <EmptyState
                title="Você ainda não palpitou"
                description="Entre nos jogos abertos para enviar seu primeiro placar."
                action={
                  <button className="btn btn-primary" type="button" onClick={() => onNavigate('jogos')}>
                    Palpitar agora
                  </button>
                }
              />
            )}
          </div>

          <div className="section-heading dashboard-history-title">
            <h2>Histórico de pontuação</h2>
          </div>
          <div className="mini-list">
            {scoredHistory.length ? (
              scoredHistory.slice(0, 6).map((prediction) => {
                const game = gamesById.get(prediction.gameId)

                return (
                  <article className="mini-item" key={`score-${prediction.id}`}>
                    <span>
                      {game
                        ? `${game.esporteNome} | ${getGameStageLabel(game)} | ${game.timeA} x ${game.timeB}`
                        : 'Jogo removido'}
                    </span>
                    <strong>{formatPoints(prediction.pontos)} ponto(s)</strong>
                  </article>
                )
              })
            ) : (
              <EmptyState
                title="Sem pontos finalizados"
                description="Quando um jogo for finalizado pelo master, seus pontos aparecem aqui."
              />
            )}
          </div>
        </section>
      </div>
    </section>
  )
}
