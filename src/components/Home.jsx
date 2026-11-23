import { useEffect, useMemo, useState } from 'react'
import usePredictionClock from '../hooks/usePredictionClock.js'
import heroImage from '../assets/bolao-hero.webp'
import { COPY } from '../content/copy.js'
import { canEditPrediction, subscribeGames } from '../services/bolaoService.js'
import { getGameStageLabel, getSportIcon } from '../utils/game.js'
import { eventOverview, formatCalendarDay, formatCalendarTime } from '../utils/calendarExplorer.js'
import { schoolDay } from '../utils/tvSchedule.js'
import { matchVenueLabel } from '../utils/matchVenue.js'
import MatchScore from './MatchScore.jsx'

const shortcuts = [
  {
    view: 'calendario', icon: '↗', title: 'Programação',
    description: 'Encontre sua turma, o horário e a quadra.',
  },
  { view: 'chaveamento', icon: '⚑', title: 'Chaveamento', description: 'Veja o caminho das equipes até a final.' },
  { view: 'estatisticas', icon: '★', title: 'Destaques', description: 'Acompanhe as estatísticas dos atletas.' },
  { view: 'regulamentos', icon: '≡', title: 'Regulamentos', description: 'Consulte as regras de cada modalidade.' },
]

export default function Home({ onNavigate }) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const now = usePredictionClock(games)

  useEffect(() => subscribeGames((items) => { setGames(items); setLoading(false); setError('') }, setError), [])

  const overview = useMemo(() => eventOverview(games, now), [games, now])
  const openCount = games.filter((game) => canEditPrediction(game, now)).length
  const spotlight = overview.live[0] || overview.upcoming[0]
  const isLive = overview.live.length > 0
  const spotlightView = isLive ? 'tv' : 'calendario'

  return (
    <section className="home-page event-home">
      {error ? <div className="alert alert-error home-data-notice" role="alert"><p>{error}</p><button type="button" className="btn btn-outline btn-small" onClick={() => window.location.reload()}>Tentar novamente</button></div> : null}
      <div className="hero-section event-hero" style={{ '--hero-image': `url(${heroImage})` }}>
        <div className="hero-copy">
          <span className="eyebrow">Na quadra. Na torcida. Em cada palpite.</span>
          <h1>O Interclasse<br />acontece aqui<span>.</span></h1>
          <p>Horários, placares e o caminho até a final. Acompanhe sua turma e viva cada jogo do SESI Vinhedo.</p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-large" type="button" onClick={() => onNavigate('calendario')}>Explorar os jogos <span aria-hidden="true">↗</span></button>
            <button className="btn btn-outline-light btn-large" type="button" onClick={() => onNavigate('login')}>Entrar para palpitar</button>
          </div>
          <p className="hero-registration">Primeira vez por aqui? <button type="button" onClick={() => onNavigate('cadastro')}>Crie sua conta</button></p>
        </div>
        <aside className="event-spotlight" aria-label={isLive ? 'Partida em destaque ao vivo' : 'Próxima partida'}>
          <div className="event-spotlight-heading"><span className={isLive ? 'event-indicator is-live' : 'event-indicator'}><i aria-hidden="true" />{isLive ? 'Acontecendo agora' : 'A seguir no Interclasse'}</span><span aria-hidden="true">↗</span></div>
          {loading ? <p role="status">Buscando a programação…</p> : spotlight ? <>
            <span className="event-spotlight-sport">{getSportIcon(spotlight.esporteNome)} {spotlight.esporteNome} · {getGameStageLabel(spotlight)}</span>
            <div className="event-spotlight-teams"><strong>{spotlight.timeA || 'A definir'}</strong><span>{isLive ? <MatchScore game={spotlight} /> : '×'}</span><strong>{spotlight.timeB || 'A definir'}</strong></div>
            <p className="event-spotlight-date">{formatCalendarDay(schoolDay(spotlight.dataHora), { month: 'short' })} · {formatCalendarTime(spotlight.dataHora)}</p>
            <p className="event-spotlight-venue">{matchVenueLabel(spotlight) || 'Local a definir'}</p>
            <button className="event-spotlight-link" type="button" onClick={() => onNavigate(spotlightView)}>{isLive ? 'Acompanhar ao vivo' : 'Ver programação completa'} <span aria-hidden="true">→</span></button>
          </> : <>
            <strong className="event-spotlight-empty">A próxima disputa está a caminho.</strong>
            <p>Consulte os resultados e acompanhe a programação divulgada pela organização.</p>
            <button className="event-spotlight-link" type="button" onClick={() => onNavigate('calendario')}>Abrir calendário <span aria-hidden="true">→</span></button>
          </>}
        </aside>
        <div className="event-hero-caption"><span>INTERCLASSE SESI VINHEDO</span><span>Esporte que conecta a escola.</span></div>
      </div>

      <section className="event-metrics" aria-label="Resumo do evento">
        {[
          { label: 'Jogos hoje', value: overview.today, detail: 'Na programação do dia' },
          { label: 'Ao vivo', value: overview.live.length, detail: 'Partidas em andamento' },
          { label: 'Resultados', value: overview.finished, detail: 'Partidas concluídas' },
          { label: 'Palpites abertos', value: openCount, detail: 'Para entrar na disputa' },
        ].map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{loading || error ? '—' : metric.value}</strong><small>{metric.detail}</small></article>)}
      </section>

      <section className="event-explore" aria-labelledby="event-explore-title">
        <div className="section-heading"><div><span className="eyebrow">Do primeiro jogo à final</span><h2 id="event-explore-title">Escolha como acompanhar</h2></div><span>Informações abertas para a torcida</span></div>
        <div className="event-shortcuts">{shortcuts.map((item) => <button type="button" key={item.view} onClick={() => onNavigate(item.view)}><span className="event-shortcut-icon" aria-hidden="true">{item.icon}</span><strong>{item.title}</strong><p>{item.description}</p><span className="event-shortcut-arrow" aria-hidden="true">↗</span></button>)}</div>
      </section>

      <section className="event-predictions" aria-labelledby="event-predictions-title">
        <div><span className="eyebrow">Seu palpite também entra em jogo</span><h2 id="event-predictions-title">Uma disputa a mais para acompanhar.</h2><p>Registre seus palpites até cinco minutos antes de cada partida e acompanhe sua pontuação no ranking.</p><button type="button" className="btn btn-primary" onClick={() => onNavigate('login')}>Participar do bolão <span aria-hidden="true">→</span></button></div>
        <div className="event-prediction-steps">{COPY.home.cards.map((card) => <article key={card.number}><span>{card.number}</span><div><h3>{card.title}</h3><p>{card.description}</p></div></article>)}</div>
      </section>
    </section>
  )
}
