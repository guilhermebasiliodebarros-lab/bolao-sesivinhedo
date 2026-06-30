import { useState } from 'react'
import { useAuth } from '../context/useAuth.js'

export default function Header({ activeView, onNavigate, theme, onToggleTheme }) {
  const { user, profile, isMaster, isParticipant, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoLoaded, setLogoLoaded] = useState(true)

  let navItems = [
    { id: 'home', label: 'Inicio' },
    { id: 'calendario', label: 'Calendario' },
  ]

  if (!user) {
    navItems = [
      ...navItems,
      { id: 'classificacao', label: 'Classificacao' },
    ]
  }

  if (isParticipant) {
    navItems = [
      ...navItems,
      { id: 'dashboard', label: 'Painel' },
      { id: 'jogos', label: 'Jogos' },
      { id: 'palpites', label: 'Meus palpites' },
      { id: 'classificacao', label: 'Classificacao' },
    ]
  }

  if (isMaster) {
    navItems = [...navItems, { id: 'admin', label: 'Admin' }]
  }

  const handleNavigate = (view) => {
    onNavigate(view)
    setMenuOpen(false)
  }

  const handleLogout = async () => {
    await logout()
    handleNavigate('home')
  }

  return (
    <header className="site-header">
      <button className="brand" type="button" onClick={() => handleNavigate('home')}>
        {logoLoaded ? (
          <img className="brand-logo" src="/logo.png" alt="Bolao SESI Vinhedo" onError={() => setLogoLoaded(false)} />
        ) : (
          <span className="brand-mark">BV</span>
        )}
      </button>

      <button
        className="menu-toggle"
        type="button"
        aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((current) => !current)}
      >
        <span />
        <span />
        <span />
      </button>

      {menuOpen ? (
        <button
          className="mobile-menu-backdrop"
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className={menuOpen ? 'mobile-drawer is-open' : 'mobile-drawer'}>
        <nav className="main-nav" aria-label="Navegacao principal">
          {navItems.map((item) => (
            <button
              className={activeView === item.id ? 'nav-link is-active' : 'nav-link'}
              type="button"
              key={item.id}
              onClick={() => handleNavigate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <button className="theme-toggle" type="button" onClick={onToggleTheme}>
            {theme === 'dark' ? 'Modo claro' : 'Modo noturno'}
          </button>
          {user ? (
            <>
              <button className="user-pill" type="button" onClick={() => handleNavigate(isMaster ? 'admin' : 'dashboard')}>
                {profile?.nome || user.displayName || user.email}
              </button>
              <button className="btn btn-outline" type="button" onClick={handleLogout}>
                Sair
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" type="button" onClick={() => handleNavigate('login')}>
                Entrar
              </button>
              <button className="btn btn-primary" type="button" onClick={() => handleNavigate('cadastro')}>
                Cadastrar
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
