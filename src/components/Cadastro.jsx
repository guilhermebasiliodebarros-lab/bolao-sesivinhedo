import { useState } from 'react'
import { useAuth } from '../context/useAuth.js'

export default function Cadastro({ onNavigate, onSuccess }) {
  const { register } = useAuth()
  const [form, setForm] = useState({ nome: '', email: '', password: '' })
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')

    if (!form.nome.trim() || !form.email || !form.password) {
      setMessage('Preencha nome, e-mail e senha.')
      return
    }

    if (form.password.length < 6) {
      setMessage('A senha precisa ter pelo menos 6 caracteres.')
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
        <span className="eyebrow">Novo participante</span>
        <h1>Cadastrar conta</h1>
        <p>Crie seu acesso para participar do Bolao SESI Vinhedo e acompanhar sua pontuacao.</p>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            Nome
            <input
              type="text"
              value={form.nome}
              onChange={(event) => updateField('nome', event.target.value)}
              placeholder="Seu nome completo"
              autoComplete="name"
              required
            />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              placeholder="voce@email.com"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              placeholder="Minimo de 6 caracteres"
              autoComplete="new-password"
              required
            />
          </label>

          {message ? <div className="alert alert-error">{message}</div> : null}

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? 'Cadastrando...' : 'Cadastrar'}
          </button>
        </form>

        <p className="auth-switch">
          Ja tem conta?
          <button type="button" onClick={() => onNavigate('login')}>
            Entrar
          </button>
        </p>
      </div>
    </section>
  )
}
