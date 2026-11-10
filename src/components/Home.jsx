import { useEffect, useMemo, useState } from 'react'
import usePredictionClock from '../hooks/usePredictionClock.js'
import heroImage from '../assets/bolao-hero.png'
import { COPY } from '../content/copy.js'
import { useAuth } from '../context/useAuth.js'
import { canEditPrediction, subscribeGames, subscribeRanking, subscribeUserPredictions } from '../services/bolaoService.js'
import { formatDateTime } from '../utils/format.js'
import { getGameStageLabel, getSportIcon } from '../utils/game.js'
import PendingGuessBanner from './PendingGuessBanner.jsx'

export default function Home({ onNavigate }) {
  const { user, isParticipant } = useAuth()
  const [games, setGames] = useState([])
  const now = usePredictionClock(games)
  const [ranking, setRanking] = useState([])
  const [predictions, setPredictions] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    return subscribeGames((items) => { setGames(items); setError('') }, setError)
  }, [])

  useEffect(() => {
    if (!user) {
      return () => {}
    }

    return subscribeRanking(setRanking, setError)
  }, [user])

  useEffect(() => {
    if (!user || !isParticipant) {
      return () => {}
    }

    return subscribeUserPredictions(user.uid, setPredictions, setError)
  }, [isParticipant, user])

  const openGames = useMemo(() => games.filter((game) => canEditPrediction(game, now)), [games, now])
  const activeRanking = user ? ranking : []
  const predictionsByGame = useMemo(() => new Map((user && isParticipant ? predictions : []).map((prediction) => [prediction.gameId, prediction])), [user, isParticipant, predictions])
  const pendingGuessCount = isParticipant ? openGames.filter((game) => !predictionsByGame.has(game.id)).length : Number.NaN
  const nextGames = openGames.slice(0, 3)
  const topRanking = activeRanking.slice(0, 3)

  return (
    <section className="home-page">
      {error ? <div className="alert alert-error home-data-notice" role="alert"><p>{error}</p><button type="button" className="btn btn-outline btn-small" onClick={() => window.location.reload()}>Tentar novamente</button></div> : null}
      <div className="hero-section" style={{ '--hero-image': `url(${heroImage})` }}>
        <div className="hero-copy">
          <span className="eyebrow">{COPY.home.eyebrow}</span>
          <h1>{COPY.brand.name}</h1>
          <p>{COPY.home.intro}</p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-large" type="button" onClick={() => onNavigate('login')}>
              {COPY.actions.entrar}
            </button>
            <button className="btn btn-light btn-large" type="button" onClick={() => onNavigate('cadastro')}>
              {COPY.actions.cadastrar}
            </button>
            <button className="btn btn-outline-light btn-large" type="button" onClick={() => onNavigate('classificacao')}>
              {COPY.actions.verClassificacao}
            </button>
          </div>
        </div>
        <div className="hero-signal" aria-label="Resumo do sistema">
          {COPY.home.heroSignal.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>

      <section className="live-command-strip" aria-label="Destaques do bolão">
        <article>
          <span className="live-dot" aria-hidden="true" />
          <small>Agora no bolão</small>
          <strong>Palpites abertos com prazo visível</strong>
        </article>
        <article>
          <span className="live-dot live-dot-cyan" aria-hidden="true" />
          <small>Ranking</small>
          <strong>Classificação recalculada ao finalizar placares</strong>
        </article>
        <article>
          <span className="live-dot live-dot-dark" aria-hidden="true" />
          <small>Master</small>
          <strong>Chaveamentos e jogos em lote no mesmo painel</strong>
        </article>
      </section>

      <PendingGuessBanner count={pendingGuessCount} onNavigate={onNavigate} />

      <section className="home-event-panel" aria-label="Resumo do bolão">
        <article className="home-next-games">
          <span className="eyebrow">Próximos jogos</span>
          {nextGames.length ? (
            nextGames.map((game) => (
              <button type="button" key={game.id} onClick={() => onNavigate(user ? 'jogos' : 'login')}>
                <span aria-hidden="true">{getSportIcon(game.esporteNome)}</span>
                <strong>{game.timeA} x {game.timeB}</strong>
                <small>
                  {getGameStageLabel(game)} | {formatDateTime(game.dataHora)}
                </small>
              </button>
            ))
          ) : (
            <p>Nenhum jogo aberto no momento.</p>
          )}
        </article>
        <article className="home-ranking-preview">
          <span className="eyebrow">Top 3</span>
          {topRanking.length ? (
            topRanking.map((participant, index) => (
              <span key={participant.id}>
                <strong>
                  {index + 1}º {participant.nome || participant.email}
                </strong>
                <small>{participant.pontos || 0} pts</small>
              </span>
            ))
          ) : (
            <p>{user ? 'Ranking ainda sem participantes.' : 'Entre para ver o ranking dos participantes.'}</p>
          )}
        </article>
        <article className="home-metric-card">
          <span>Participantes</span>
          <strong>{user ? activeRanking.length : '-'}</strong>
          <small>{user ? 'No ranking atual' : 'Disponível após login'}</small>
        </article>
        <article className="home-metric-card">
          <span>Palpites abertos</span>
          <strong>{openGames.length}</strong>
          <small>Jogos disponíveis agora</small>
        </article>
      </section>

      <div className="home-grid">
        {COPY.home.cards.map((card) => (
          <article className="info-card" key={card.number}>
            <span className="card-number">{card.number}</span>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
          </article>
        ))}
      </div>

      <section className="sports-showcase" aria-label={COPY.home.sports.label}>
        <div>
          <span className="eyebrow">{COPY.home.sports.eyebrow}</span>
          <h2>{COPY.home.sports.title}</h2>
        </div>
        <div className="sport-tile-grid">
          <article className="sport-tile sport-tile-field">
            <span>{COPY.home.sports.items[0]}</span>
          </article>
          <article className="sport-tile sport-tile-court">
            <span>{COPY.home.sports.items[1]}</span>
          </article>
          <article className="sport-tile sport-tile-net">
            <span>{COPY.home.sports.items[2]}</span>
          </article>
          <article className="sport-tile sport-tile-handball">
            <span>{COPY.home.sports.items[3]}</span>
          </article>
        </div>
      </section>

      <section className="feature-band">
        <div>
          <span className="eyebrow">{COPY.home.feature.eyebrow}</span>
          <h2>{COPY.home.feature.title}</h2>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => onNavigate('jogos')}>
          {COPY.actions.verJogos}
        </button>
      </section>
    </section>
  )
}
