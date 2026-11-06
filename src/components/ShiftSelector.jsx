import { SCHOOL_SHIFTS } from '../utils/schoolShifts.js'

export function ShiftTabs({ value, onChange, counts = {} }) {
  return <section className="school-shift-switcher" aria-label="Turno do Interclasse"><div className="segmented-control school-shift-tabs" role="group" aria-label="Selecionar turno">{SCHOOL_SHIFTS.map((shift) => <button type="button" key={shift.id} className={value === shift.id ? 'is-active' : ''} aria-pressed={value === shift.id} onClick={() => { if (value !== shift.id) onChange(shift.id) }}>{shift.label}{counts[shift.id] != null ? <span> · {counts[shift.id]} equipe(s)</span> : null}</button>)}</div><p>{SCHOOL_SHIFTS.find((shift) => shift.id === value)?.description}</p></section>
}

export default function ShiftSelector({ value, onChange, label = 'Turno' }) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Manhã e tarde</option>{SCHOOL_SHIFTS.map((shift) => <option key={shift.id} value={shift.id}>{shift.label}</option>)}</select></label>
}
