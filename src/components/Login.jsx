import { useState } from 'react'
import { COPY } from '../content/copy.js'
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
      setMessage(COPY.auth.login.missingFields)
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
        <span className="eyebrow">{COPY.auth.login.eyebrow}</span>
        <h1>{COPY.auth.login.title}</h1>
        <p>{COPY.auth.login.description}</p>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            {COPY.auth.login.emailLabel}
            <input
              type="text"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              placeholder={COPY.auth.login.emailPlaceholder}
              autoComplete="username"
              required
            />
          </label>
          <label>
            {COPY.auth.login.passwordLabel}
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              placeholder={COPY.auth.login.passwordPlaceholder}
              autoComplete="current-password"
              required
            />
          </label>

          {message ? <div className="alert alert-error">{message}</div> : null}

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? COPY.auth.login.loading : COPY.actions.entrar}
          </button>
        </form>

        <p className="auth-switch">
          {COPY.auth.login.switchText}
          <button type="button" onClick={() => onNavigate('cadastro')}>
            {COPY.actions.criarCadastro}
          </button>
        </p>
      </div>
    </section>
  )
}
