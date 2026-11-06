import { canUseTieBreak, TIE_BREAK_METHODS } from '../utils/tieBreak.js'
import { getSportProfile } from '../utils/sportRules.js'

export default function TieBreakInputs({ game, value, onChange, disabled }) {
  if (!canUseTieBreak(game) || value.placarA === '' || value.placarB === '' || Number(value.placarA) !== Number(value.placarB)) return null
  const tie = value.tieBreak || { method: 'none', scoreA: '', scoreB: '' }
  const change = (fields) => onChange({ ...tie, ...fields })
  return <fieldset className="tie-break-inputs" disabled={disabled}><legend>Desempate do mata-mata</legend>
    <p>O placar acima é do tempo normal. Registre o desempate separado para definir quem avança.</p>
    <label>Método de desempate<select value={tie.method} onChange={(event) => change({ method: event.target.value })}><option value="none">Ainda sem desempate</option>{Object.entries(TIE_BREAK_METHODS).filter(([method]) => method !== 'penalties' || getSportProfile(game).scoringMode === 'goals').map(([method, label]) => <option key={method} value={method}>{label}</option>)}</select></label>
    {tie.method !== 'none' ? <div className="form-grid">{['A', 'B'].map((side) => <label key={side}>{game[`time${side}`]} · {tie.method === 'penalties' ? 'pênaltis' : 'somente prorrogação'}<input type="number" min="0" max="10000" step="1" required value={tie[`score${side}`]} onChange={(event) => change({ [`score${side}`]: event.target.value })} /></label>)}</div> : null}
    <small>Os palpites continuam valendo apenas para o placar do tempo normal.</small>
  </fieldset>
}
