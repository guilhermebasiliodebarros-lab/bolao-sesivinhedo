import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import { reviewRegistration, subscribeRegistrations, toFriendlyError } from '../services/bolaoService.js'
import { APPROVAL_LABELS, APPROVAL_STATUS } from '../utils/registrationApproval.js'
import { formatDateTime } from '../utils/format.js'
import ConfirmationDialog from './ConfirmationDialog.jsx'
import EmptyState from './EmptyState.jsx'
import LoadingState from './LoadingState.jsx'

export default function RegistrationApprovals({ embedded = false }) {
  const { canReviewRegistrations } = useAuth()
  const [registrations, setRegistrations] = useState([])
  const [filter, setFilter] = useState(APPROVAL_STATUS.PENDING)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [decision, setDecision] = useState(null)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!canReviewRegistrations) return
    return subscribeRegistrations((next) => { setRegistrations(next); setLoading(false) }, (message) => { setError(message); setLoading(false) })
  }, [canReviewRegistrations, attempt])

  if (!canReviewRegistrations) return <EmptyState title="Acesso restrito" description="Somente a conta de Guilherme pode aprovar ou recusar cadastros." />

  const counts = Object.fromEntries(Object.values(APPROVAL_STATUS).map((status) => [status, registrations.filter((item) => item.approvalStatus === status).length]))
  const term = search.trim().toLocaleLowerCase('pt-BR')
  const visible = registrations.filter((item) => (!filter || item.approvalStatus === filter) && `${item.nome} ${item.email}`.toLocaleLowerCase('pt-BR').includes(term))

  const confirmDecision = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await reviewRegistration({ userId: decision.registration.id, status: decision.status, expectedStatus: decision.registration.approvalStatus })
      setNotice(decision.status === APPROVAL_STATUS.APPROVED ? `${decision.registration.nome}: cadastro aprovado. Participação liberada.` : `${decision.registration.nome}: cadastro recusado. Participação bloqueada e removida da classificação.`)
    } catch (requestError) {
      setError(toFriendlyError(requestError))
    } finally {
      setBusy(false)
      setDecision(null)
    }
  }

  return <section className={embedded ? 'admin-tab-panel registration-approvals' : 'page-shell registration-approvals'}>
    <div className="page-heading"><span className="eyebrow">Bolão exclusivo para professores</span><h1>Aprovar cadastros</h1><p>Confira nome e e-mail antes de aprovar um professor. Recuse os cadastros de alunos.</p></div>
    <p className="alert">Cadastros anteriores sem aprovação também aguardam sua análise. Somente os aprovados podem enviar palpites e aparecer na classificação.</p>
    <div className="registration-filters" role="group" aria-label="Filtrar cadastros">
      {[[APPROVAL_STATUS.PENDING, 'Pendentes'], [APPROVAL_STATUS.APPROVED, 'Aprovados'], [APPROVAL_STATUS.REJECTED, 'Recusados'], ['', 'Todos']].map(([status, label]) => <button className={filter === status ? 'btn btn-primary' : 'btn btn-outline'} type="button" aria-pressed={filter === status} key={status} onClick={() => setFilter(status)}>{label} ({status ? counts[status] : registrations.length})</button>)}
    </div>
    <label className="registration-search">Buscar por nome ou e-mail<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou e-mail do cadastro" /></label>
    {notice ? <div className="alert alert-success" role="status">{notice}</div> : null}
    {error ? <div className="alert alert-error" role="alert">{error} <button className="btn btn-outline btn-small" type="button" onClick={() => { setError(''); setLoading(true); setAttempt((value) => value + 1) }}>Tentar novamente</button></div> : null}
    {loading ? <LoadingState label="Carregando cadastros…" variant="cards" /> : visible.length ? <div className="registration-list">
      {visible.map((registration) => <article className="registration-card" key={registration.id}>
        <div className="registration-card-details"><h2>{registration.nome}</h2><p className="registration-email">{registration.email}</p><span className={`registration-badge registration-badge-${registration.approvalStatus}`}>{APPROVAL_LABELS[registration.approvalStatus]}</span><p className="muted">{registration.createdAt ? `Cadastro: ${formatDateTime(registration.createdAt)}` : 'Cadastro anterior à revisão de participantes.'}{registration.approvalReviewedAt ? ` · Última análise: ${formatDateTime(registration.approvalReviewedAt)}` : ''}</p></div>
        <div className="registration-card-actions">
          {registration.approvalStatus !== APPROVAL_STATUS.APPROVED ? <button className="btn btn-primary" type="button" disabled={busy} onClick={() => { setError(''); setNotice(''); setDecision({ registration, status: APPROVAL_STATUS.APPROVED }) }}>Aprovar professor</button> : null}
          {registration.approvalStatus !== APPROVAL_STATUS.REJECTED ? <button className="btn btn-outline" type="button" disabled={busy} onClick={() => { setError(''); setNotice(''); setDecision({ registration, status: APPROVAL_STATUS.REJECTED }) }}>{registration.approvalStatus === APPROVAL_STATUS.APPROVED ? 'Recusar e bloquear' : 'Recusar cadastro'}</button> : null}
        </div>
      </article>)}
    </div> : !error ? <EmptyState title={search ? 'Nenhum cadastro encontrado' : filter === APPROVAL_STATUS.PENDING ? 'Nenhum cadastro pendente' : 'Nenhum cadastro nesta lista'} description={search ? 'Tente outro nome ou e-mail.' : 'Novos cadastros aparecerão automaticamente para sua análise.'} /> : null}
    {decision ? <ConfirmationDialog title={decision.status === APPROVAL_STATUS.APPROVED ? 'Aprovar este professor?' : 'Recusar este cadastro?'} description={`${decision.registration.nome} (${decision.registration.email}). ${decision.status === APPROVAL_STATUS.APPROVED ? 'Confirme que esta pessoa é professora. A aprovação libera os palpites e a classificação.' : 'A pessoa ficará sem acesso ao bolão e fora da classificação. Você poderá rever esta decisão depois.'}`} confirmLabel={decision.status === APPROVAL_STATUS.APPROVED ? 'Confirmar aprovação' : 'Confirmar recusa'} busy={busy} onClose={() => setDecision(null)} onConfirm={confirmDecision} /> : null}
  </section>
}
