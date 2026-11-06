import { useEffect, useRef, useState } from 'react'
import { getMatchScore, getMatchState, MATCH_STATE } from '../utils/match.js'
import { currentSetScore } from '../utils/liveEvents.js'
import { formatSportScore, getSportProfile, scoreLabel } from '../utils/sportRules.js'
import MatchBadge from './MatchBadge.jsx'
import MatchDetails from './MatchDetails.jsx'
import MatchScoreForm from './MatchScoreForm.jsx'

export default function RefereePanel({ game, teams, user, onSaved }) {
  const [online, setOnline] = useState(navigator.onLine)
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement))
  const [message, setMessage] = useState('')
  const ownsFullscreen = useRef(false)
  const live = getMatchState(game) === MATCH_STATE.LIVE
  const sets = getSportProfile(game).scoringMode === 'sets'
  const set = currentSetScore(game)
  const score = getMatchScore(game)
  const setEnded = sets && Math.max(...score.map(Number)) >= Math.ceil(getSportProfile(game).volleyballBestOf / 2)
  const displayed = sets && live && !setEnded ? [set.a, set.b] : score

  useEffect(() => {
    let active = true
    let wakeLock
    const network = () => setOnline(navigator.onLine)
    const screen = () => { setFullscreen(Boolean(document.fullscreenElement)); if (!document.fullscreenElement) ownsFullscreen.current = false }
    const awake = async () => {
      if (!navigator.wakeLock || document.visibilityState !== 'visible' || (wakeLock && !wakeLock.released)) return
      try {
        const next = await navigator.wakeLock.request('screen')
        if (!active) await next.release()
        else wakeLock = next
      } catch { /* Device may deny keeping the screen awake. */ }
    }
    window.addEventListener('online', network); window.addEventListener('offline', network)
    document.addEventListener('fullscreenchange', screen); document.addEventListener('visibilitychange', awake)
    awake()
    return () => {
      active = false
      window.removeEventListener('online', network); window.removeEventListener('offline', network)
      document.removeEventListener('fullscreenchange', screen); document.removeEventListener('visibilitychange', awake)
      wakeLock?.release().catch(() => {})
      if (ownsFullscreen.current && document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  return <section className="referee-panel" aria-label="Modo árbitro">
    <div className="referee-toolbar"><MatchBadge game={game} /><span>{online ? 'Conectado · atualização ao vivo' : 'Sem conexão'}</span><button type="button" className="btn btn-outline" onClick={async () => {
      setMessage('')
      try {
        if (document.fullscreenElement) await document.exitFullscreen()
        else if (document.documentElement.requestFullscreen) { await document.documentElement.requestFullscreen(); ownsFullscreen.current = true }
        else setMessage('Use a tela cheia do navegador para ampliar a exibição.')
      } catch { setMessage('Use a opção de tela cheia do navegador para ampliar a exibição.') }
    }}>{fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}</button></div>
    {!online ? <p className="alert alert-error" role="alert">Sem conexão. Os lançamentos estão bloqueados até a internet voltar. Confira o placar atualizado antes de continuar.</p> : null}
    {message ? <p role="status">{message}</p> : null}
    <div className="referee-scoreboard" aria-label={`Placar: ${game.timeA} ${displayed[0]} a ${displayed[1]} ${game.timeB}`}>
      <div><span>{game.timeA}</span><strong>{formatSportScore(displayed[0])}</strong></div><span aria-hidden="true">×</span><div><span>{game.timeB}</span><strong>{formatSportScore(displayed[1])}</strong></div>
    </div>
    <p className="referee-score-caption">{sets ? live && !setEnded ? `${set.number}º set · pontos · sets ${score.join(' × ')}` : `Sets ${score.join(' × ')}` : scoreLabel(game)}</p>
    {sets && game.setScores?.length ? <p className="referee-partials">Parciais: {game.setScores.map((partial, index) => `${index + 1}º: ${partial.a} × ${partial.b}`).join(' · ')}</p> : null}
    <MatchDetails game={game} />
    {live ? <fieldset className="referee-controls" disabled={!online}><legend className="sr-only">Controles da arbitragem</legend><MatchScoreForm game={game} teams={teams} user={user} onSaved={onSaved} referee /></fieldset> : <p className="schedule-warning" role="status">Esta partida não está mais ao vivo. Os lançamentos foram encerrados. Volte à administração para consultar a situação.</p>}
  </section>
}
