import { useAuth } from '../context/useAuth.js'
import { APPROVAL_STATUS, registrationApprovalStatus } from '../utils/registrationApproval.js'

export default function RegistrationStatus() {
  const { user, profile, error, logout } = useAuth()
  const rejected = registrationApprovalStatus(profile) === APPROVAL_STATUS.REJECTED

  return <section className="auth-page">
    <div className="auth-card registration-status-card">
      <span className="eyebrow">Bolão dos professores</span>
      <h1>{rejected ? 'Cadastro recusado' : 'Aguardando aprovação'}</h1>
      <p>{rejected
        ? 'Sua participação não foi autorizada. O bolão é exclusivo para professores. Se você é professor e acredita que houve um engano, converse com Guilherme.'
        : 'Seu cadastro precisa ser aprovado por Guilherme antes de participar. O bolão é exclusivo para professores; alunos não podem participar.'}</p>
      <div className="registration-account"><strong>{profile?.nome || user?.displayName || 'Seu cadastro'}</strong><span>{user?.email}</span></div>
      {!rejected ? <p className="muted">Esta tela será atualizada automaticamente quando seu cadastro for analisado.</p> : null}
      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
      {error || !profile ? <button className="btn btn-outline btn-full" type="button" onClick={() => window.location.reload()}>Atualizar situação</button> : null}
      <button className="btn btn-outline btn-full" type="button" onClick={logout}>Sair da conta</button>
    </div>
  </section>
}
