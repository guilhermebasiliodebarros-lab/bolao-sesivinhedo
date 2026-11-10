import { useId, useRef, useState } from 'react'
import useModalDialog from '../hooks/useModalDialog.js'
import { deleteGamesBulk } from '../services/bolaoService.js'
import { deletionFingerprint, deletionSelection, validateDeletionSelection } from '../utils/bulkGameDeletion.js'
import { formatDateTime } from '../utils/format.js'
import { shiftLabel } from '../utils/schoolShifts.js'
import './VisualSchedule.css'

export default function BulkGameDeletionDialog({ games, predictions, sports, initialSportId, initialShift, onClose, onDeleted }) {
  const ref = useRef(null), title = useId()
  const [scope, setScope] = useState({ sportId: initialSportId || '', turno: initialShift || '', tournamentId: '' })
  const [acknowledged, setAcknowledged] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [review, setReview] = useState(null)
  useModalDialog(ref)
  const selection = deletionSelection(games, scope)
  const selectedIds = new Set(selection.map((game) => game.id))
  const linked = predictions.filter((prediction) => selectedIds.has(prediction.gameId))
  const signature = JSON.stringify([scope, selection.map((game) => [game.id, deletionFingerprint(game)]).sort(), linked.map((item) => item.id).sort()])
  const tournaments = [...new Map(deletionSelection(games, { ...scope, tournamentId: '' }).filter((game) => game.tournamentId).map((game) => [game.tournamentId, game.tournamentName || game.fase])).entries()]
  let blocked = ''
  try { validateDeletionSelection(selection, games) } catch (failure) { blocked = failure.message }
  const shown = review?.selection || selection, shownPredictions = review?.predictionCount ?? linked.length
  const update = (name, value) => { setScope((current) => ({ ...current, [name]: value, ...(name !== 'tournamentId' ? { tournamentId: '' } : {}) })); setAcknowledged(''); setError('') }
  return <dialog ref={ref} className="match-management-dialog" aria-labelledby={title} onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="match-management-heading"><div><span className="eyebrow">Painel master</span><h2 id={title}>Excluir jogos em lote</h2><p>Escolha quais jogos de teste quer remover. Para apagar todos do sistema, selecione todas as modalidades e todos os turnos.</p></div><button className="btn btn-outline btn-small" type="button" disabled={busy} onClick={onClose}>Fechar</button></div>
    <fieldset disabled={busy}><legend>Jogos que serão excluídos</legend><div className="form-grid bulk-delete-filters"><label>Modalidade a excluir<select value={scope.sportId} onChange={(event) => update('sportId', event.target.value)}><option value="">Todas as modalidades</option>{sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.nome}</option>)}</select></label><label>Turno a excluir<select value={scope.turno} onChange={(event) => update('turno', event.target.value)}><option value="">Todos os turnos</option><option value="manha">Manhã</option><option value="tarde">Tarde</option></select></label><label>Torneio a excluir<select value={scope.tournamentId} onChange={(event) => update('tournamentId', event.target.value)}><option value="">Todos os torneios da seleção</option>{tournaments.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label></div></fieldset>
    <div className="bulk-delete-summary" role="status"><strong>{shown.length} jogo(s) e {shownPredictions} palpite(s) serão excluídos.</strong><p>Também serão removidos os resultados, as súmulas, as presenças e os lances desses jogos. O ranking será recalculado. Esta ação não tem desfazer.</p><p>{scope.sportId ? sports.find((sport) => sport.id === scope.sportId)?.nome : 'Todas as modalidades'} · {scope.turno ? shiftLabel(scope.turno) : 'Todos os turnos'}</p></div>
    <div className="bulk-delete-preview" aria-label="Prévia dos jogos a excluir">{shown.map((game) => <p key={game.id}><strong>{game.timeA} × {game.timeB}</strong><br />{game.esporteNome} · {shiftLabel(game.turno)} · {game.tournamentName || game.fase} · {formatDateTime(game.dataHora)}</p>)}</div>
    {blocked && !busy ? <p className="alert alert-error" role="alert">{blocked}</p> : null}
    <label className="match-checkbox"><input type="checkbox" disabled={busy || Boolean(blocked)} checked={acknowledged === signature} onChange={(event) => setAcknowledged(event.target.checked ? signature : '')} />Conferi a seleção e confirmo a exclusão destes jogos e de todos os registros vinculados.</label>
    {error ? <p className="alert alert-error" role="alert">{error}</p> : null}
    {busy ? <p role="status">Excluindo os jogos e registros vinculados. Aguarde a conclusão.</p> : null}
    <div className="form-actions"><button type="button" className="btn btn-danger" disabled={busy || Boolean(blocked) || acknowledged !== signature} onClick={async () => {
      setReview({ selection, predictionCount: linked.length }); setBusy(true); setError('')
      try { const result = await deleteGamesBulk({ expectedGames: selection.map((game) => ({ id: game.id, fingerprint: deletionFingerprint(game) })), includePredictions: true }); onDeleted(`${result.deleted} jogo(s) excluído(s) com seus registros. Ranking recalculado.`) }
      catch (failure) { setError(failure.message); setAcknowledged(''); setReview(null) } finally { setBusy(false) }
    }}>{busy ? 'Excluindo…' : `Excluir ${selection.length} jogo(s)`}</button><button type="button" className="btn btn-outline" disabled={busy} onClick={onClose}>Cancelar</button></div>
  </dialog>
}
