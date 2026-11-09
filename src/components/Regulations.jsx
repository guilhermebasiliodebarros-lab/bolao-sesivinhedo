import { useEffect, useState } from 'react'
import { subscribeSports, saveSportRegulation } from '../services/bolaoService.js'
import { normalizeRegulation, REGULATION_SECTIONS, REGULATION_MAX_LENGTH } from '../utils/regulations.js'
import { formatDateTime } from '../utils/format.js'
import { useAuth } from '../context/useAuth.js'
import { readRegulationDraft, writeRegulationDraft } from '../utils/regulationDrafts.js'
import EmptyState from './EmptyState.jsx'
import LoadingState from './LoadingState.jsx'

function RegulationPDFButton({ sports, label = 'Baixar regulamento em PDF' }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const available = sports.some((sport) => Object.values(normalizeRegulation(sport.regulation)).some(Boolean))
  return <div className="regulation-pdf"><button type="button" className="btn btn-outline btn-small" disabled={busy || !available} onClick={async () => {
    setBusy(true); setMessage('')
    try {
      const { createRegulationsPDF } = await import('../services/regulationsPdf.js')
      const { pdf, filename } = await createRegulationsPDF({ sports })
      pdf.save(filename)
      setMessage('PDF gerado. Confira os downloads do navegador. Você pode abrir o arquivo e imprimir.')
    } catch (error) { setMessage(error.message) } finally { setBusy(false) }
  }}>{busy ? 'Gerando PDF…' : label}</button>{message ? <p role="status">{message}</p> : null}</div>
}

export function SportRegulationView({ sport }) {
  const regulation = normalizeRegulation(sport.regulation)
  const written = REGULATION_SECTIONS.filter(({ id }) => regulation[id])
  return <div className="sport-regulation"><div className="section-heading"><h3>{sport.nome}</h3>{written.length ? <RegulationPDFButton sports={[sport]} /> : null}</div>
    <section className="regulation-guidance" aria-label={`Regulamento de ${sport.nome}`}>{written.length ? written.map(({ id, label }) => <div key={id}><h4>{label}</h4><p>{regulation[id]}</p></div>) : <p>Regulamento ainda não cadastrado pela organização.</p>}{written.length && sport.regulationUpdatedAt ? <small>Atualizado em {formatDateTime(sport.regulationUpdatedAt)} · versão {sport.regulationRevision || 1}</small> : null}</section>
  </div>
}

function RegulationEditor({ sport, userId }) {
  const [initial] = useState(() => readRegulationDraft(userId, sport.id))
  const [value, setValue] = useState(() => initial.draft?.value || normalizeRegulation(sport.regulation))
  const [revision, setRevision] = useState(initial.draft?.revision ?? (sport.regulationRevision || 0))
  const [draftTime, setDraftTime] = useState(initial.draft?.updatedAt || null)
  const [draftError, setDraftError] = useState(initial.error)
  const [discardReview, setDiscardReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const changedElsewhere = (sport.regulationRevision || 0) !== revision
  const dirty = JSON.stringify(value) !== JSON.stringify(normalizeRegulation(sport.regulation))
  const keepDraft = (next, baseRevision, updatedAt) => {
    setDraftError(writeRegulationDraft(userId, sport.id, { value: next, revision: baseRevision, updatedAt }))
    setDraftTime(updatedAt)
  }
  const reload = () => {
    setValue(normalizeRegulation(sport.regulation)); setRevision(sport.regulationRevision || 0)
    setDraftError(writeRegulationDraft(userId, sport.id, null)); setDraftTime(null)
    setDiscardReview(false); setMessage('Dados recarregados.'); setFailed(false)
  }
  useEffect(() => {
    if (!dirty || !draftError) return
    const prevent = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', prevent)
    return () => window.removeEventListener('beforeunload', prevent)
  }, [dirty, draftError])
  return <><form className="regulation-editor" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setMessage(''); setFailed(false)
    try {
      const saved = normalizeRegulation(value)
      const nextRevision = await saveSportRegulation(sport.id, saved, revision)
      setRevision(nextRevision); setValue(saved)
      setDraftError(writeRegulationDraft(userId, sport.id, null)); setDraftTime(null)
      setMessage(Object.values(saved).some(Boolean) ? 'Regulamento salvo. Alunos e professores já podem consultar em Regulamentos.' : 'Cadastro salvo com os campos do regulamento em branco.')
    }
    catch (error) { setMessage(error.message); setFailed(true) } finally { setBusy(false) }
  }}><fieldset disabled={busy}><legend>Cadastrar regulamento · {sport.nome}</legend><p>Preencha o regulamento definido pela organização. Os campos começam em branco e são opcionais. O conteúdo cadastrado fica disponível para consulta após salvar.</p>
    <p className="regulation-draft-status" role="status">{draftError || (draftTime ? `Rascunho ${initial.draft ? 'recuperado e ' : ''}guardado neste navegador às ${new Date(draftTime).toLocaleTimeString('pt-BR')}. Clique em Salvar regulamento para publicar.` : 'Seu rascunho é guardado automaticamente neste navegador, por usuário e modalidade. Ele ainda não fica público.')}</p>
    {REGULATION_SECTIONS.map(({ id, label }) => <label key={id}>{label}<textarea rows="4" maxLength={REGULATION_MAX_LENGTH} value={value[id]} onChange={(event) => { const next = { ...value, [id]: event.target.value }; setValue(next); keepDraft(next, revision, Date.now()); setDiscardReview(false) }} /><small>{value[id].length.toLocaleString('pt-BR')}/{REGULATION_MAX_LENGTH.toLocaleString('pt-BR')} caracteres</small></label>)}
    <div className="form-actions"><button className="btn btn-primary" type="submit" disabled={changedElsewhere}>{busy ? 'Salvando…' : 'Salvar regulamento'}</button><button type="button" className="btn btn-outline" onClick={() => dirty ? setDiscardReview(true) : reload()}>Recarregar dados salvos</button></div>
    {discardReview ? <div className="schedule-warning"><p>Descartar o rascunho e carregar o regulamento publicado?</p><div className="form-actions"><button type="button" className="btn btn-outline" onClick={reload}>Descartar rascunho</button><button type="button" className="btn btn-outline" onClick={() => setDiscardReview(false)}>Continuar editando</button></div></div> : null}
    {changedElsewhere ? <div className="schedule-warning" role="status"><p>Há uma versão salva mais recente. Seu texto foi preservado. Consulte o regulamento salvo abaixo antes de escolher qual versão manter.</p><button type="button" className="btn btn-outline" onClick={() => { const nextRevision = sport.regulationRevision || 0; setRevision(nextRevision); keepDraft(value, nextRevision, Date.now()) }}>Manter meu texto para revisar e salvar</button></div> : null}</fieldset>{message ? <div className={failed ? 'alert alert-error' : 'alert alert-success'} role={failed ? 'alert' : 'status'}>{message}</div> : null}</form><details className="regulation-preview"><summary>Consultar regulamento salvo / PDF</summary><SportRegulationView sport={sport} /></details></>
}

export function RegulationsAdmin({ sports, onNavigate }) {
  const { user } = useAuth()
  const [sportId, setSportId] = useState('')
  const selected = sports.find((sport) => sport.id === sportId) || sports[0]
  return <section className="regulations-admin" aria-label="Gerenciar regulamentos"><div className="section-heading"><div><span className="eyebrow">Organização do Interclasse</span><h2>Regulamentos por modalidade</h2><p>Cadastre o regulamento de cada modalidade para consulta dos alunos e professores.</p></div><button className="btn btn-outline btn-small" type="button" onClick={() => onNavigate('regulamentos')}>Abrir consulta pública</button></div>{selected ? <><label>Modalidade do regulamento<select value={selected.id} onChange={(event) => setSportId(event.target.value)}>{sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.nome}</option>)}</select></label><RegulationPDFButton sports={sports} label="Baixar todos os regulamentos salvos em PDF" /><RegulationEditor key={`${user?.uid}:${selected.id}`} userId={user?.uid} sport={selected} /></> : <EmptyState title="Cadastre uma modalidade" description="Depois de cadastrar um esporte, você poderá cadastrar seu regulamento aqui." />}</section>
}

export default function Regulations() {
  const [sports, setSports] = useState([])
  const [sportId, setSportId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => subscribeSports((items) => { setSports(items); setLoading(false) }, (message) => { setError(message); setLoading(false) }), [])
  const selected = sports.filter((sport) => !sportId || sport.id === sportId)
  return <section className="page-shell regulations-page"><div className="page-heading"><span className="eyebrow">Interclasse SESI Vinhedo</span><h1>Regulamentos por modalidade</h1><p>Consulte os regulamentos cadastrados pela organização.</p></div>{error ? <div className="alert alert-error" role="alert">{error}</div> : null}<label>Consultar modalidade<select value={sportId} onChange={(event) => setSportId(event.target.value)}><option value="">Todas as modalidades</option>{sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.nome}</option>)}</select></label>{!loading && !sportId ? <RegulationPDFButton sports={sports} label="Baixar todos os regulamentos em PDF" /> : null}{loading ? <LoadingState label="Carregando regulamentos…" /> : selected.length ? selected.map((sport) => <SportRegulationView key={sport.id} sport={sport} />) : <EmptyState title="Nenhuma modalidade disponível" description="As modalidades aparecerão aqui quando forem cadastradas." />}</section>
}
