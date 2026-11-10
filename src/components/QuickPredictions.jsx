import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import { canEditPrediction, getPredictionDeadline, savePrediction, subscribeGames, subscribeUserPredictions } from '../services/bolaoService.js'
import usePredictionClock from '../hooks/usePredictionClock.js'
import usePredictionDraft from '../hooks/usePredictionDraft.js'
import { formatDateTime, formatTimeRemaining } from '../utils/format.js'
import { formatSportScore, getSportProfile, scoreLabel, validateSportScores } from '../utils/sportRules.js'
import { getGameShift } from '../utils/schoolShifts.js'
import { getSportIcon, getUniqueGameSports } from '../utils/game.js'
import { orderQuickGames, quickScoreOptions, validQuickScore } from '../utils/quickPredictions.js'

function QuickPredictionCard({ game, prediction, now, connected, onSaved }) {
  const { user, profile } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const editable = canEditPrediction(game, now)
  const draft = usePredictionDraft({ userId: user.uid, game, prediction, editable })
  const [editing, setEditing] = useState(() => !prediction || draft.hasDraft)
  const a = draft.value?.palpiteA ?? prediction?.palpiteA ?? ''
  const b = draft.value?.palpiteB ?? prediction?.palpiteB ?? ''
  const options = quickScoreOptions(game)
  const chess = getSportProfile(game).scoringMode === 'chess'
  const deadline = getPredictionDeadline(game)
  const adjust = (field, amount) => {
    const current = Number(field === 'palpiteA' ? a : b) || 0
    draft.update(field, String(Math.max(0, Math.min(10000, current + amount))))
  }
  const submit = async (event) => {
    event.preventDefault()
    if (lock.current) return
    setError('')
    if (!connected || navigator.onLine === false) { setError('Aguarde a conexão voltar. Seu rascunho ainda não foi enviado.'); return }
    if (!canEditPrediction(game, new Date())) { setError('O prazo deste jogo encerrou. O palpite não foi enviado.'); return }
    try {
      validateSportScores(game, a, b, { final: true })
      lock.current = true
      setSaving(true)
      await savePrediction({ user, profile, game, palpiteA: a, palpiteB: b })
      draft.clear()
      setEditing(false)
      onSaved(game, a, b)
    } catch (requestError) { setError(requestError.message) }
    finally { lock.current = false; setSaving(false) }
  }
  return <article className="quick-prediction-card" aria-label={`${game.timeA} contra ${game.timeB}`} aria-busy={saving}>
    <div className="quick-match-meta"><span>{getSportIcon(game.esporteNome)} {game.esporteNome}</span><span>{getGameShift(game) === 'tarde' ? 'Tarde' : getGameShift(game) === 'manha' ? 'Manhã' : ''}</span></div>
    <p className="quick-match-when">Jogo: {formatDateTime(game.dataHora)}</p>
    <h2>{game.timeA}<span aria-hidden="true"> × </span>{game.timeB}</h2>
    {editable ? <div className="quick-deadline"><strong>{formatTimeRemaining(deadline, now)}</strong><span>Palpites até {formatDateTime(deadline)}</span></div> : <p className="quick-closed">Este jogo não aceita mais alterações de palpite.</p>}
    {prediction ? <div className="quick-sent-score"><span>Seu palpite enviado</span><strong>{formatSportScore(prediction.palpiteA)} × {formatSportScore(prediction.palpiteB)}</strong>{editable && !editing ? <button type="button" className="btn btn-outline" onClick={() => setEditing(true)}>Editar palpite</button> : null}</div> : null}
    {editable && editing ? <form onSubmit={submit}>
      <p className="quick-score-help">{options.length ? chess ? 'Toque no resultado do xadrez.' : 'Toque no placar final em sets.' : `Qual será o placar final? (${scoreLabel(game).toLocaleLowerCase('pt-BR')})`}</p>
      {options.length ? <div className="quick-score-options">{options.map((option) => <button key={`${option.a}:${option.b}`} className="quick-score-option" type="button" disabled={saving} aria-pressed={String(a) === String(option.a) && String(b) === String(option.b)} onClick={() => draft.updateValues({ palpiteA: option.a, palpiteB: option.b })}><strong>{formatSportScore(option.a)} × {formatSportScore(option.b)}</strong><span>{option.a === option.b ? 'Empate' : `${option.a > option.b ? game.timeA : game.timeB} vence`}</span></button>)}</div> : <div className="quick-score-fields">{[['palpiteA', game.timeA, a], ['palpiteB', game.timeB, b]].map(([field, name, value]) => <div className="quick-score-field" key={field}><label htmlFor={`quick-${game.id}-${field}`}>{name}</label><div><button type="button" disabled={saving || (value !== '' && Number(value) <= 0)} aria-label={`Diminuir placar de ${name}`} onClick={() => adjust(field, -1)}>−</button><input id={`quick-${game.id}-${field}`} type="number" inputMode="numeric" enterKeyHint={field === 'palpiteA' ? 'next' : 'done'} min="0" max="10000" step="1" required placeholder="–" value={value} disabled={saving} onFocus={(event) => event.target.select()} onChange={(event) => draft.update(field, event.target.value)} /><button type="button" disabled={saving || Number(value) >= 10000} aria-label={`Aumentar placar de ${name}`} onClick={() => adjust(field, 1)}>+</button></div></div>)}</div>}
      {draft.hasDraft ? <p className="quick-draft" role="status">Rascunho · ainda não enviado. Confirme no botão abaixo.</p> : null}
      {draft.error ? <p className="quick-form-error" role="status">{draft.error}</p> : null}
      <button className="btn btn-primary quick-submit" type="submit" disabled={saving || !connected || !validQuickScore(game, a, b)}>{saving ? 'Enviando…' : prediction ? 'Atualizar palpite' : 'Enviar palpite'}</button>
      {!connected ? <p className="quick-form-error" role="status">Aguardando conexão. Você pode preencher o rascunho; o envio será liberado quando os dados forem sincronizados.</p> : null}
      {draft.hasDraft ? <button className="quick-discard" type="button" disabled={saving} onClick={() => draft.clear()}>Limpar rascunho</button> : null}
    </form> : null}
    {error ? <p className="quick-form-error" role="alert">{error}</p> : null}
  </article>
}

export default function QuickPredictions() {
  const { user } = useAuth()
  const [games, setGames] = useState([])
  const [predictions, setPredictions] = useState([])
  const [loaded, setLoaded] = useState({ games: false, predictions: false })
  const [synced, setSynced] = useState({ games: false, predictions: false })
  const [feedErrors, setFeedErrors] = useState({})
  const [tab, setTab] = useState('pending')
  const [sport, setSport] = useState('')
  const [shift, setShift] = useState('')
  const [selected, setSelected] = useState('')
  const [notice, setNotice] = useState('')
  const now = usePredictionClock(games)
  useEffect(() => {
    const receive = (field, setter) => (items) => { setter(items); setLoaded((current) => ({ ...current, [field]: true })) }
    const failed = (field) => (message) => setFeedErrors((current) => ({ ...current, [field]: message }))
    const sync = (field) => (connected) => setSynced((current) => ({ ...current, [field]: connected }))
    const stopGames = subscribeGames(receive('games', setGames), failed('games'), sync('games'))
    const stopPredictions = subscribeUserPredictions(user.uid, receive('predictions', setPredictions), failed('predictions'), sync('predictions'))
    return () => { stopGames(); stopPredictions() }
  }, [user.uid])
  const byGame = useMemo(() => new Map(predictions.map((item) => [item.gameId, item])), [predictions])
  const scope = games.filter((game) => (!sport || game.sportId === sport || game.esporteNome === sport) && (!shift || getGameShift(game) === shift))
  const open = scope.filter((game) => canEditPrediction(game, now))
  const pending = open.filter((game) => !byGame.has(game.id))
  const sent = scope.filter((game) => byGame.has(game.id))
  const shown = orderQuickGames(tab === 'pending' ? pending : sent)
  const current = shown.find((game) => game.id === selected) || shown[0]
  const index = current ? shown.findIndex((game) => game.id === current.id) : 0
  const loading = !loaded.games || !loaded.predictions
  const error = Object.values(feedErrors).find(Boolean)
  const saved = (game, a, b) => {
    setNotice(`${game.timeA} ${formatSportScore(Number(a))} × ${formatSportScore(Number(b))} ${game.timeB} · palpite confirmado!`)
    setSelected(shown[(index + 1) % shown.length]?.id || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  return <section className="quick-predictions" aria-label="Palpite rápido">
    <div className="quick-intro"><h1>Faça seu palpite</h1><p>Palpites até 5 minutos antes de cada jogo.</p></div>
    {notice ? <div className="quick-confirmation" role="status">✓ {notice}</div> : null}
    <div className="quick-tabs" aria-label="Situação dos palpites"><button type="button" aria-pressed={tab === 'pending'} onClick={() => { setTab('pending'); setSelected('') }}>Faltam <strong>{pending.length}</strong></button><button type="button" aria-pressed={tab === 'sent'} onClick={() => { setTab('sent'); setSelected('') }}>Enviados <strong>{sent.length}</strong></button></div>
    <details className="quick-filters"><summary>Escolher jogo ou filtrar</summary><div><label>Esporte<select value={sport} onChange={(event) => { setSport(event.target.value); setSelected('') }}><option value="">Todos os esportes</option>{getUniqueGameSports(games).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><label>Turno<select value={shift} onChange={(event) => { setShift(event.target.value); setSelected('') }}><option value="">Manhã e tarde</option><option value="manha">Manhã</option><option value="tarde">Tarde</option></select></label>{shown.length > 1 && !loading ? <label className="quick-game-picker">Escolher jogo<select value={current.id} onChange={(event) => setSelected(event.target.value)}>{shown.map((game) => <option key={game.id} value={game.id}>{game.esporteNome} · {game.timeA} × {game.timeB}</option>)}</select></label> : null}</div></details>
    {error ? <p className="quick-form-error" role="alert">{error} A conexão será recuperada automaticamente.</p> : null}
    {loading ? <p className="quick-loading" role="status">Carregando seus jogos e palpites…</p> : current ? <>
      <QuickPredictionCard key={`${user.uid}:${current.id}`} game={current} prediction={byGame.get(current.id)} now={now} connected={synced.games && synced.predictions} onSaved={saved} />
      {shown.length > 1 ? <nav className="quick-game-navigation" aria-label="Navegar pelos jogos"><button className="btn btn-outline" type="button" disabled={index === 0} onClick={() => setSelected(shown[index - 1].id)}>Anterior</button><span>{index + 1} de {shown.length}</span><button className="btn btn-outline" type="button" disabled={index === shown.length - 1} onClick={() => setSelected(shown[index + 1].id)}>Próximo</button></nav> : null}
    </> : <div className="quick-empty"><span aria-hidden="true">✓</span><h2>{tab === 'sent' ? 'Nenhum palpite enviado neste filtro' : open.length ? 'Tudo em dia!' : 'Nenhum jogo aberto neste filtro'}</h2><p>{tab === 'sent' ? 'Abra a aba Faltam para escolher um jogo.' : open.length ? 'Seus palpites foram enviados. Novos jogos aparecerão aqui automaticamente.' : 'Aguarde os próximos jogos ou confira os outros esportes e turnos.'}</p>{tab === 'pending' && sent.length ? <button className="btn btn-outline" type="button" onClick={() => setTab('sent')}>Conferir meus palpites</button> : null}</div>}
    <p className="quick-footnote">Somente o botão Enviar ou Atualizar confirma o palpite. Rascunhos ficam neste navegador.</p>
  </section>
}
