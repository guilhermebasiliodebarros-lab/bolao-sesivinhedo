import { useId, useRef, useState } from 'react'
import useModalDialog from '../hooks/useModalDialog.js'
import { createThirdPlaceGame } from '../services/bolaoService.js'
import { thirdPlaceSemifinals } from '../utils/thirdPlace.js'

export default function ThirdPlaceDialog({ tournament, onClose, onSaved }) {
  const ref = useRef(null), title = useId()
  const [date, setDate] = useState('')
  const [deadline, setDeadline] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const semis = thirdPlaceSemifinals(tournament.games)
  useModalDialog(ref)
  return <dialog ref={ref} className="match-management-dialog" aria-labelledby={title} onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="match-management-heading"><div><span className="eyebrow">{tournament.esporteNome} · {tournament.nome}</span><h2 id={title}>Adicionar disputa de terceiro lugar</h2></div><button type="button" className="btn btn-outline btn-small" disabled={busy} onClick={onClose}>Fechar</button></div>
    <p>O confronto receberá os perdedores das duas semifinais. Se os resultados já estiverem definidos, as equipes serão preenchidas ao criar a partida.</p>
    {!semis.length ? <p role="alert" className="alert alert-error">As semifinais mudaram ou a disputa já foi criada. Feche e confira o torneio.</p> : null}
    <form onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError('')
      try { await createThirdPlaceGame({ semifinalIds: semis.map((game) => game.id), dataHora: date, limitePalpites: deadline }); onSaved('Disputa de terceiro lugar criada com sucesso.') }
      catch (failure) { setError(failure.message) } finally { setBusy(false) }
    }}>
      <fieldset disabled={busy || !semis.length}><legend>Programação da disputa</legend><label>Horário do terceiro lugar<input type="datetime-local" required value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Encerramento dos palpites<input type="datetime-local" required value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label></fieldset>
      <p className="form-hint">Escolha um horário posterior às duas semifinais. Local, coletes e presença serão conferidos na preparação da partida.</p>
      {error ? <p className="alert alert-error" role="alert">{error}</p> : null}
      <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={busy || !semis.length}>{busy ? 'Criando…' : 'Criar disputa'}</button><button type="button" className="btn btn-outline" disabled={busy} onClick={onClose}>Cancelar</button></div>
    </form>
  </dialog>
}
