import { useState } from 'react'
import { COPY } from '../content/copy.js'
import { useAuth } from '../context/useAuth.js'

export default function Cadastro({ onNavigate, onSuccess }) {
  const { register } = useAuth()
  const [form, setForm] = useState({ nome: '', email: '', password: '', avatarUrl: '' })
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')

    if (!form.nome.trim() || !form.email || !form.password) {
      setMessage(COPY.auth.cadastro.missingFields)
      return
    }

    if (form.password.length < 6) {
      setMessage(COPY.auth.cadastro.shortPassword)
      return
    }

    try {
      setLoading(true)
      await register(form)
      onSuccess()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">{COPY.auth.cadastro.eyebrow}</span>
        <h1>{COPY.auth.cadastro.title}</h1>
        <p>{COPY.auth.cadastro.description}</p>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            {COPY.auth.cadastro.nameLabel}
            <input
              type="text"
              value={form.nome}
              onChange={(event) => updateField('nome', event.target.value)}
              placeholder={COPY.auth.cadastro.namePlaceholder}
              autoComplete="name"
              required
            />
          </label>
          <label>
            {COPY.auth.cadastro.emailLabel}
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              placeholder={COPY.auth.cadastro.emailPlaceholder}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Foto/avatar opcional
            <input
              type="url"
              value={form.avatarUrl}
              onChange={(event) => updateField('avatarUrl', event.target.value)}
              placeholder="https://exemplo.com/sua-foto.jpg"
              autoComplete="photo"
            />
          </label>
          <label>
            {COPY.auth.cadastro.passwordLabel}
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              placeholder={COPY.auth.cadastro.passwordPlaceholder}
              autoComplete="new-password"
              required
            />
          </label>

          {message ? <div className="alert alert-error">{message}</div> : null}

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? COPY.auth.cadastro.loading : COPY.actions.cadastrar}
          </button>
        </form>

        <p className="auth-switch">
          {COPY.auth.cadastro.switchText}
          <button type="button" onClick={() => onNavigate('login')}>
            {COPY.actions.entrar}
          </button>
        </p>
      </div>
    </section>
  )
}
