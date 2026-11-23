import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import './App.css'
import './components/Experience.css'
import './components/QuickShell.css'
import './components/Interface.css'
import './components/SystemEnhancements.css'
import './components/DesignSystem.css'
import LoadingState from './components/LoadingState.jsx'
import Footer from './components/Footer.jsx'
import Header from './components/Header.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { useAuth } from './context/useAuth.js'
import { firebaseEnvNames, isFirebaseConfigured, missingFirebaseConfig } from './config/firebase.js'
import { readPreference, writePreference } from './utils/preferences.js'
import { APP_VIEW_LABELS, APP_VIEWS, resolveAppView } from './utils/navigation.js'
import MobileNavigation from './components/MobileNavigation.jsx'
import PredictionReminders from './components/PredictionReminders.jsx'
import ScheduleNotices from './components/ScheduleNotices.jsx'
import useAppUpdates from './hooks/useAppUpdates.js'
import { reloadAppVersion } from './services/appUpdates.js'
import ConnectionStatus from './components/ConnectionStatus.jsx'
import LiveScoresStrip from './components/LiveScoresStrip.jsx'
import useQuickPredictionMode from './hooks/useQuickPredictionMode.js'
import { isRehearsal } from './config/rehearsal.js'

const AdminPanel = lazy(() => import('./components/AdminPanel.jsx'))
const Cadastro = lazy(() => import('./components/Cadastro.jsx'))
const Calendario = lazy(() => import('./components/Calendario.jsx'))
const Classificacao = lazy(() => import('./components/Classificacao.jsx'))
const Dashboard = lazy(() => import('./components/Dashboard.jsx'))
const Home = lazy(() => import('./components/Home.jsx'))
const AccessHome = lazy(() => import('./components/AccessHome.jsx'))
const Jogos = lazy(() => import('./components/Jogos.jsx'))
const Login = lazy(() => import('./components/Login.jsx'))
const Palpites = lazy(() => import('./components/Palpites.jsx'))
const TVMode = lazy(() => import('./components/TVMode.jsx'))
const TVScoreboard = lazy(() => import('./components/TVScoreboard.jsx'))
const Regulations = lazy(() => import('./components/Regulations.jsx'))
const AthleteStatistics = lazy(() => import('./components/AthleteStatistics.jsx'))
const TournamentExplorer = lazy(() => import('./components/TournamentExplorer.jsx'))
const QuickPredictions = lazy(() => import('./components/QuickPredictions.jsx'))
const RegistrationStatus = lazy(() => import('./components/RegistrationStatus.jsx'))
const RegistrationApprovals = lazy(() => import('./components/RegistrationApprovals.jsx'))
const GlobalSearch = lazy(() => import('./components/GlobalSearch.jsx'))

const viewFromHash = () => {
  const requested = window.location.hash.slice(1)
  return APP_VIEWS.includes(requested) ? requested : 'home'
}

function ConfigNotice() {
  if (isFirebaseConfigured) {
    return null
  }

  return (
    <div className="config-notice" role="status">
      <strong>Firebase pendente:</strong> configure as variáveis{' '}
      {missingFirebaseConfig.map((item) => firebaseEnvNames[item]).join(', ')}{' '}
      no ambiente para liberar login, cadastro, Firestore e ranking em tempo real.
    </div>
  )
}

function AppShell() {
  const [view, setView] = useState(viewFromHash)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTarget, setSearchTarget] = useState(null)
  const [theme, setTheme] = useState(() => {
    const storedTheme = readPreference('theme')

    if (['light', 'dark'].includes(storedTheme)) {
      return storedTheme
    }

    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const { user, profile, isMaster, isViewer, isParticipant, canReviewRegistrations, hasEventAccess, loading, profileLoading, logout } = useAuth()
  const { quick, setQuick } = useQuickPredictionMode(user?.uid)
  const activeView = resolveAppView(view, { signedIn: Boolean(user), isMaster, isViewer, isParticipant, canReviewRegistrations, participantHome: quick ? 'jogos' : 'dashboard' })
  const loadingVariant = { admin: 'admin', classificacao: 'ranking', calendario: 'calendar', dashboard: 'dashboard', login: 'form', cadastro: 'form' }[activeView] || 'cards'
  const focusTarget = searchTarget?.userId === user?.uid && searchTarget?.view === activeView ? searchTarget : null
  const quickShell = quick && !focusTarget && ((isParticipant && activeView === 'jogos') || (!user && ['home', 'login', 'cadastro'].includes(activeView)))
  const authLoading = loading || profileLoading
  const previousView = useRef(activeView)
  const appUpdate = useAppUpdates({ enabled: !authLoading })
  const updateNotice = appUpdate ? <div className="app-update-notice" role="status"><span>Nova versão pronta. A atualização será automática quando não houver edição em andamento. Salve seus dados antes de atualizar agora.</span><button type="button" className="btn btn-secondary" onClick={() => reloadAppVersion(appUpdate)}>Atualizar site</button></div> : null

  const navigate = (nextView) => {
    setSearchOpen(false); setSearchTarget(null)
    setView(nextView)
    window.location.hash = nextView
    window.scrollTo({ top: 0, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  const selectSearchResult = (entry) => {
    navigate(entry.view)
    setSearchTarget({ ...entry, userId: user.uid, token: Date.now() })
  }
  useEffect(() => {
    if (!hasEventAccess) return
    const key = (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen((value) => !value) } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [hasEventAccess])
  const searchDialog = searchOpen && hasEventAccess ? <Suspense fallback={null}><GlobalSearch key={user.uid} onClose={() => setSearchOpen(false)} onSelect={selectSearchResult} /></Suspense> : null

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (!authLoading && activeView !== view) window.location.replace(`#${activeView}`)
  }, [activeView, authLoading, view])

  useEffect(() => {
    if (authLoading) return
    document.title = `${APP_VIEW_LABELS[activeView] || 'Início'} · Interclasse SESI Vinhedo`
    if (previousView.current !== activeView) document.getElementById('main-content')?.focus({ preventScroll: true })
    previousView.current = activeView
  }, [activeView, authLoading])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    writePreference('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  const afterLogin = (nextView) => navigate(['admin', 'calendario'].includes(nextView) ? nextView : quick ? 'jogos' : nextView || 'dashboard')
  const openQuickMode = () => { setQuick(true); navigate('jogos') }
  const leaveQuickMode = () => { setQuick(false); navigate(user ? 'jogos' : 'home') }

  const renderView = () => {
    if (activeView === 'aprovacao') return <RegistrationStatus />
    if (activeView === 'cadastros') return <RegistrationApprovals />
    if (activeView === 'login') {
      return <Login onNavigate={navigate} onSuccess={afterLogin} />
    }

    if (activeView === 'cadastro') {
      return <Cadastro onNavigate={navigate} onSuccess={() => afterLogin('dashboard')} />
    }

    if (activeView === 'dashboard') {
      return <Dashboard onNavigate={navigate} />
    }

    if (activeView === 'jogos') {
      return <Jogos key={focusTarget?.token || 'games'} focusTarget={focusTarget} onNavigate={navigate} onQuickMode={openQuickMode} />
    }

    if (activeView === 'calendario') {
      return <Calendario key={focusTarget?.token || 'calendar'} focusTarget={focusTarget} onNavigate={navigate} />
    }
    if (activeView === 'regulamentos') return <Regulations />
    if (activeView === 'estatisticas') return <AthleteStatistics key={focusTarget?.token || 'stats'} focusTarget={focusTarget} />
    if (activeView === 'chaveamento' || activeView === 'simulador') return <TournamentExplorer mode={activeView === 'simulador' ? 'simulator' : 'bracket'} onNavigate={navigate} />

    if (activeView === 'palpites') {
      return <Palpites onNavigate={navigate} />
    }

    if (activeView === 'classificacao') {
      return <Classificacao onNavigate={navigate} />
    }

    if (activeView === 'admin') {
      return <AdminPanel key={focusTarget?.token || 'admin'} focusTarget={focusTarget} onNavigate={navigate} />
    }

    return user ? <Home onNavigate={navigate} /> : <AccessHome onNavigate={navigate} />
  }

  if (authLoading) return <LoadingState label="Carregando sua conta…" variant="form" />

  if (quickShell) return <div className="app quick-app">
    <header className="quick-app-header"><img src="/logo-interclasse.webp" alt="Interclasse SESI Vinhedo" /><div><strong>{user ? 'Palpite rápido' : 'Acesso ao Interclasse'}</strong><span>{user ? `Olá, ${profile?.nome || user.displayName || 'participante'}` : 'Entre com o login fornecido pela organização'}</span></div><button type="button" className="btn btn-outline" onClick={leaveQuickMode}>Site completo</button>{user ? <button type="button" className="quick-logout" onClick={async () => { await logout(); navigate('login') }}>Sair</button> : null}</header>
    {user ? <><ConnectionStatus /><button type="button" className="quick-search-trigger" onClick={() => setSearchOpen(true)}>Buscar jogos e equipes</button></> : null}<ConfigNotice />
    <main>{updateNotice}{isParticipant ? <><ScheduleNotices key={`notices-${user.uid}`} userId={user.uid} onNavigate={navigate} /><PredictionReminders key={user.uid} userId={user.uid} showSettings={false} onNavigate={navigate} /></> : null}<Suspense fallback={<LoadingState label={user ? 'Abrindo palpites…' : 'Abrindo acesso…'} variant={user ? 'cards' : 'form'} />}>{user ? <QuickPredictions key={user.uid} /> : activeView === 'cadastro' ? <Cadastro onNavigate={navigate} onSuccess={() => afterLogin('dashboard')} /> : <Login onNavigate={navigate} onSuccess={afterLogin} />}</Suspense></main>
    <footer className="quick-app-footer">{user ? 'Interclasse SESI Vinhedo · confira o placar antes de enviar.' : 'Interclasse SESI Vinhedo · jogos, resultados e informações do evento.'}</footer>
    {searchDialog}
  </div>

  if (activeView === 'placar') {
    return <>{updateNotice}<Suspense fallback={<LoadingState label="Preparando o placar ao vivo…" variant="screen" count={2} />}><TVScoreboard onNavigate={navigate} /></Suspense></>
  }

  if (activeView === 'tv') {
    return <>{updateNotice}<Suspense fallback={<LoadingState label="Abrindo modo TV…" variant="screen" count={2} />}><TVMode onNavigate={navigate} /></Suspense></>
  }

  return (
    <div className={hasEventAccess && !isMaster ? 'app app-with-mobile-navigation' : 'app'}>
      <button className="skip-link" type="button" onClick={() => document.getElementById('main-content')?.focus()}>Pular para o conteúdo</button>
      <Header key={user?.uid || 'guest'} activeView={activeView} onNavigate={navigate} theme={theme} onToggleTheme={toggleTheme} onSearch={() => setSearchOpen(true)} />
      {user ? <ConnectionStatus /> : null}
      <ConfigNotice />
      <main id="main-content" tabIndex={-1}>
        {updateNotice}
        {hasEventAccess ? <LiveScoresStrip /> : null}
        {isParticipant ? <ScheduleNotices key={`notices-${user.uid}`} userId={user.uid} onNavigate={navigate} /> : null}
        {isParticipant ? <PredictionReminders key={user.uid} userId={user.uid} showSettings={activeView === 'dashboard'} onNavigate={navigate} /> : null}
        <Suspense fallback={<LoadingState label="Preparando a tela…" variant={loadingVariant} />}>{renderView()}</Suspense>
      </main>
      <Footer accessOnly={!hasEventAccess} />
      <MobileNavigation activeView={activeView} onNavigate={navigate} />
      {searchDialog}
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      {isRehearsal ? <div className="rehearsal-ribbon" role="status">ENSAIO LOCAL · DADOS FICTÍCIOS · O SITE OFICIAL NÃO É ALTERADO</div> : null}
      <AppShell />
    </AuthProvider>
  )
}

export default App
