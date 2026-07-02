import { useState } from 'react'
import { COPY } from '../content/copy.js'
import { useAuth } from '../context/useAuth.js'

export default function Header({ activeView, onNavigate, theme, onToggleTheme }) {
  const { user, profile, isMaster, isParticipant, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoLoaded, setLogoLoaded] = useState(true)

  let navItems = [
    { id: 'home', label: COPY.nav.home },
    { id: 'calendario', label: COPY.nav.calendario },
  ]

  if (!user) {
    navItems = [
      ...navItems,
      { id: 'classificacao', label: COPY.nav.classificacao },
    ]
  }

  if (isParticipant) {
    navItems = [
      ...navItems,
      { id: 'dashboard', label: COPY.nav.dashboard },
      { id: 'jogos', label: COPY.nav.jogos },
      { id: 'palpites', label: COPY.nav.palpites },
      { id: 'classificacao', label: COPY.nav.classificacao },
    ]
  }

  if (isMaster) {
    navItems = [...navItems, { id: 'admin', label: COPY.nav.admin }]
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
          <img className="brand-logo" src="/logo.png" alt={COPY.brand.name} onError={() => setLogoLoaded(false)} />
        ) : (
          <span className="brand-mark">{COPY.brand.shortMark}</span>
        )}
      </button>

      <button
        className="menu-toggle"
        type="button"
        aria-label={menuOpen ? COPY.header.closeMenu : COPY.header.openMenu}
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
          aria-label={COPY.header.closeMenu}
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className={menuOpen ? 'mobile-drawer is-open' : 'mobile-drawer'}>
        <nav className="main-nav" aria-label={COPY.header.mainNavigation}>
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
            {theme === 'dark' ? COPY.header.lightMode : COPY.header.darkMode}
          </button>
          {user ? (
            <>
              <button className="user-pill" type="button" onClick={() => handleNavigate(isMaster ? 'admin' : 'dashboard')}>
                {profile?.nome || user.displayName || user.email}
              </button>
              <button className="btn btn-outline" type="button" onClick={handleLogout}>
                {COPY.actions.sair}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" type="button" onClick={() => handleNavigate('login')}>
                {COPY.actions.entrar}
              </button>
              <button className="btn btn-primary" type="button" onClick={() => handleNavigate('cadastro')}>
                {COPY.actions.cadastrar}
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
