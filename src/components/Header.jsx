import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { COPY } from '../content/copy.js'
import { useAuth } from '../context/useAuth.js'
import { PARTICIPANT_VIEWS } from '../utils/navigation.js'

export default function Header({ activeView, onNavigate, theme, onToggleTheme }) {
  const { user, profile, isMaster, logout } = useAuth()
  const participantAccount = Boolean(user && !isMaster)
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoLoaded, setLogoLoaded] = useState(true)
  const drawerRef = useRef(null)
  const headerRef = useRef(null)
  const avatarUrl = profile?.avatarUrl || user?.photoURL || ''
  const displayName = profile?.nome || user?.displayName || user?.email || 'Visitante'
  const avatarLabel = String(displayName).trim().charAt(0).toLocaleUpperCase('pt-BR')

  useEffect(() => {
    const measure = () => document.documentElement.style.setProperty('--site-header-height', `${headerRef.current.getBoundingClientRect().height}px`)
    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    observer?.observe(headerRef.current)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); document.documentElement.style.removeProperty('--site-header-height') }
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const drawer = drawerRef.current
    const previousOverflow = document.body.style.overflow
    drawer.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      drawer.close()
      document.body.style.overflow = previousOverflow
    }
  }, [menuOpen])

  const publicItems = [
    { id: 'home', label: COPY.nav.home },
    { id: 'calendario', label: COPY.nav.calendario },
    { id: 'chaveamento', label: 'Chaveamento' },
    { id: 'simulador', label: 'Simulador' },
    { id: 'regulamentos', label: 'Regulamentos' },
    { id: 'estatisticas', label: 'Estatísticas' },
    { id: 'tv', label: 'Modo TV' },
  ]
  const participantItems = participantAccount ? PARTICIPANT_VIEWS.map((id) => ({ id, label: COPY.nav[id] })) : []
  const adminItems = isMaster ? [{ id: 'admin', label: 'Painel master' }] : []
  const navItems = [
    ...(participantAccount ? [] : publicItems),
    ...(!user ? [{ id: 'classificacao', label: COPY.nav.classificacao }] : []),
    ...participantItems,
    ...adminItems,
  ]

  const handleNavigate = (view) => {
    onNavigate(view)
    setMenuOpen(false)
  }
  const handleLogout = async () => {
    await logout()
    handleNavigate('home')
  }
  const renderLinks = (items) => items.map((item) => (
    <button
      className={activeView === item.id ? 'drawer-link is-active' : 'drawer-link'}
      type="button" key={item.id}
      aria-current={activeView === item.id ? 'page' : undefined}
      onClick={() => handleNavigate(item.id)}
    >
      <span>{item.label}</span>
      <span className="navigation-chevron" aria-hidden="true">›</span>
    </button>
  ))

  return (
    <>
      <header ref={headerRef} className="site-header commerce-header">
        <div className="header-topbar">
          <button className="brand" type="button" onClick={() => handleNavigate(participantAccount ? 'dashboard' : 'home')}>
            {logoLoaded ? (
              <img className="brand-logo" src="/logo-interclasse.png" alt="Interclasse SESI Vinhedo" onError={() => setLogoLoaded(false)} />
            ) : (
              <><span className="brand-mark">{COPY.brand.shortMark}</span><strong>{COPY.brand.name}</strong></>
            )}
          </button>
          <div className="header-event-label">
            <strong>O seu palpite entra em jogo.</strong>
            <span>Jogos, resultados e classificação em um só lugar.</span>
          </div>
          <div className="header-quick-actions">
            <button className="theme-toggle desktop-theme-toggle" type="button" onClick={onToggleTheme}>
              {theme === 'dark' ? COPY.header.lightMode : COPY.header.darkMode}
            </button>
            <button className="header-account" type="button" onClick={() => handleNavigate(user ? (isMaster ? 'admin' : 'dashboard') : 'login')}>
              <span>{user ? `Olá, ${displayName}` : 'Olá, faça seu login'}</span>
              <strong>{user ? (isMaster ? 'Painel master' : 'Minha participação') : 'Entre no bolão'} <span aria-hidden="true">›</span></strong>
            </button>
          </div>
        </div>
        <div className="header-menubar">
          <button className="all-menu-button" type="button" aria-label={COPY.header.openMenu}
            aria-expanded={menuOpen} aria-controls="site-navigation-drawer" aria-haspopup="dialog"
            onClick={() => setMenuOpen(true)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            Todos
          </button>
          <nav className="header-shortcuts" aria-label={COPY.header.mainNavigation}>
            {navItems.map((item) => (
              <button className={activeView === item.id ? 'header-shortcut is-active' : 'header-shortcut'}
                type="button" key={item.id} aria-current={activeView === item.id ? 'page' : undefined}
                onClick={() => handleNavigate(item.id)}>{item.label}</button>
            ))}
          </nav>
        </div>
      </header>
      {createPortal(
        <dialog ref={drawerRef} className="navigation-drawer" id="site-navigation-drawer"
          aria-labelledby="drawer-greeting" onCancel={() => setMenuOpen(false)} onClose={() => setMenuOpen(false)}
          onKeyDown={(event) => {
            if (event.key !== 'Tab') return
            const buttons = event.currentTarget.querySelectorAll('button:not([disabled])')
            const first = buttons[0]
            const last = buttons[buttons.length - 1]
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault()
              last?.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first?.focus()
            }
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return
            const bounds = event.currentTarget.getBoundingClientRect()
            if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setMenuOpen(false)
          }}>
          <div className="drawer-heading">
            <span className="drawer-avatar" aria-hidden="true">{avatarUrl ? <img src={avatarUrl} alt="" /> : avatarLabel}</span>
            <div>
              <strong id="drawer-greeting">{user ? `Olá, ${displayName}` : 'Olá, boas-vindas!'}</strong>
              <span>{isMaster ? 'Administração do bolão' : COPY.brand.name}</span>
            </div>
            <button className="drawer-close" type="button" aria-label={COPY.header.closeMenu} onClick={() => setMenuOpen(false)}>×</button>
          </div>
          <div className="drawer-scroll">
            <nav aria-label="Menu lateral">
              {!participantAccount ? <section className="drawer-section">
                <h2>Explore o bolão</h2>
                {renderLinks(publicItems)}
                {!user ? renderLinks([{ id: 'classificacao', label: COPY.nav.classificacao }]) : null}
              </section> : null}
              {participantItems.length ? (
                <section className="drawer-section"><h2>Sua participação</h2>{renderLinks(participantItems)}</section>
              ) : null}
              {isMaster ? (
                <section className="drawer-section">
                  <h2>Administração</h2>
                  {renderLinks(adminItems)}
                  <p className="drawer-hint">Gerencie esportes, times, jogos e participantes.</p>
                </section>
              ) : null}
              <section className="drawer-section">
                <h2>Conta e preferências</h2>
                <button className="drawer-link" type="button" onClick={onToggleTheme}>
                  <span>{theme === 'dark' ? COPY.header.lightMode : COPY.header.darkMode}</span>
                  <span className="drawer-preference" aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
                </button>
                {user ? <button className="drawer-link" type="button" onClick={handleLogout}>Sair da conta</button> : (
                  renderLinks([{ id: 'login', label: COPY.actions.entrar }, { id: 'cadastro', label: 'Criar minha conta' }])
                )}
              </section>
            </nav>
            <div className="drawer-footer">SESI Vinhedo <span>Todo jogo começa com um palpite.</span></div>
          </div>
        </dialog>, document.body,
      )}
    </>
  )
}
