import { useEffect, useState } from 'react'
import { subscribeSports, saveSportRegulation } from '../services/bolaoService.js'
import { normalizeRegulation, REGULATION_SECTIONS } from '../utils/regulations.js'
import { formatDateTime } from '../utils/format.js'
import EmptyState from './EmptyState.jsx'
import LoadingState from './LoadingState.jsx'

export function SportRegulationView({ sport }) {
  const regulation = normalizeRegulation(sport.regulation)
  const written = REGULATION_SECTIONS.filter(({ id }) => regulation[id])
  return <div className="sport-regulation"><h3>{sport.nome}</h3>
    <section className="regulation-guidance" aria-label={`Regulamento de ${sport.nome}`}>{written.length ? written.map(({ id, label }) => <div key={id}><h4>{label}</h4><p>{regulation[id]}</p></div>) : <p>Regulamento ainda não cadastrado pela organização.</p>}{written.length && sport.regulationUpdatedAt ? <small>Atualizado em {formatDateTime(sport.regulationUpdatedAt)} · versão {sport.regulationRevision || 1}</small> : null}</section>
  </div>
}

function RegulationEditor({ sport }) {
  const [value, setValue] = useState(() => normalizeRegulation(sport.regulation))
  const [revision, setRevision] = useState(sport.regulationRevision || 0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const changedElsewhere = (sport.regulationRevision || 0) !== revision
  return <><form className="regulation-editor" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setMessage(''); setFailed(false)
    try { const nextRevision = await saveSportRegulation(sport.id, value, revision); setRevision(nextRevision); setMessage(Object.values(normalizeRegulation(value)).some(Boolean) ? 'Regulamento salvo. Alunos e professores já podem consultar em Regulamentos.' : 'Cadastro salvo com os campos do regulamento em branco.') }
    catch (error) { setMessage(error.message); setFailed(true) } finally { setBusy(false) }
  }}><fieldset disabled={busy}><legend>Cadastrar regulamento · {sport.nome}</legend><p>Preencha o regulamento definido pela organização. Os campos começam em branco e são opcionais. O conteúdo cadastrado fica disponível para consulta após salvar.</p>
    {REGULATION_SECTIONS.map(({ id, label }) => <label key={id}>{label}<textarea rows="4" maxLength="3000" value={value[id]} onChange={(event) => setValue((current) => ({ ...current, [id]: event.target.value }))} /><small>{value[id].length}/3000 caracteres</small></label>)}
    <div className="form-actions"><button className="btn btn-primary" type="submit" disabled={changedElsewhere}>{busy ? 'Salvando…' : 'Salvar regulamento'}</button><button type="button" className="btn btn-outline" onClick={() => { setValue(normalizeRegulation(sport.regulation)); setRevision(sport.regulationRevision || 0); setMessage('Dados recarregados.'); setFailed(false) }}>Recarregar dados salvos</button></div>
    {changedElsewhere ? <p className="schedule-warning" role="status">Há uma versão mais recente. Recarregue os dados salvos antes de editar.</p> : null}</fieldset>{message ? <div className={failed ? 'alert alert-error' : 'alert alert-success'} role={failed ? 'alert' : 'status'}>{message}</div> : null}</form><details className="regulation-preview"><summary>Consultar regulamento salvo</summary><SportRegulationView sport={sport} /></details></>
}

export function RegulationsAdmin({ sports, onNavigate }) {
  const [sportId, setSportId] = useState('')
  const selected = sports.find((sport) => sport.id === sportId) || sports[0]
  return <section className="regulations-admin" aria-label="Gerenciar regulamentos"><div className="section-heading"><div><span className="eyebrow">Organização do Interclasse</span><h2>Regulamentos por modalidade</h2><p>Cadastre o regulamento de cada modalidade para consulta dos alunos e professores.</p></div><button className="btn btn-outline btn-small" type="button" onClick={() => onNavigate('regulamentos')}>Abrir consulta pública</button></div>{selected ? <><label>Modalidade do regulamento<select value={selected.id} onChange={(event) => setSportId(event.target.value)}>{sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.nome}</option>)}</select></label><RegulationEditor key={selected.id} sport={selected} /></> : <EmptyState title="Cadastre uma modalidade" description="Depois de cadastrar um esporte, você poderá cadastrar seu regulamento aqui." />}</section>
}

export default function Regulations() {
  const [sports, setSports] = useState([])
  const [sportId, setSportId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => subscribeSports((items) => { setSports(items); setLoading(false) }, (message) => { setError(message); setLoading(false) }), [])
  const selected = sports.filter((sport) => !sportId || sport.id === sportId)
  return <section className="page-shell regulations-page"><div className="page-heading"><span className="eyebrow">Interclasse SESI Vinhedo</span><h1>Regulamentos por modalidade</h1><p>Consulte os regulamentos cadastrados pela organização.</p></div>{error ? <div className="alert alert-error">{error}</div> : null}<label>Consultar modalidade<select value={sportId} onChange={(event) => setSportId(event.target.value)}><option value="">Todas as modalidades</option>{sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.nome}</option>)}</select></label>{loading ? <LoadingState label="Carregando regulamentos…" /> : selected.length ? selected.map((sport) => <SportRegulationView key={sport.id} sport={sport} />) : <EmptyState title="Nenhuma modalidade disponível" description="As modalidades aparecerão aqui quando forem cadastradas." />}</section>
}
