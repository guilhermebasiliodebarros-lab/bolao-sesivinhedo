import { useState } from 'react'
import { useAuth } from '../context/useAuth.js'

export default function Login({ onNavigate, onSuccess }) {
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')

    if (!form.email || !form.password) {
      setMessage('Informe e-mail ou login e senha para entrar.')
      return
    }

    try {
      setLoading(true)
      const result = await login(form)
      onSuccess(result.profile?.role === 'master' ? 'admin' : 'dashboard')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">Acesso seguro</span>
        <h1>Entrar no bolao</h1>
        <p>Participantes entram no painel do bolao. Usuarios master entram direto na administracao.</p>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            E-mail ou login
            <input
              type="text"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              placeholder="voce@email.com ou suporte"
              autoComplete="username"
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              placeholder="Sua senha"
              autoComplete="current-password"
              required
            />
          </label>

          {message ? <div className="alert alert-error">{message}</div> : null}

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="auth-switch">
          Ainda nao participa?
          <button type="button" onClick={() => onNavigate('cadastro')}>
            Criar cadastro
          </button>
        </p>
      </div>
    </section>
  )
}
