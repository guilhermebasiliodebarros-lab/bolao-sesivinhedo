import { lazy, Suspense, useEffect, useState } from 'react'
import './App.css'
import './components/QuickPredictions.css'
import Footer from './components/Footer.jsx'
import Header from './components/Header.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { useAuth } from './context/useAuth.js'
import { firebaseEnvNames, isFirebaseConfigured, missingFirebaseConfig } from './config/firebase.js'
import { readPreference, writePreference } from './utils/preferences.js'
import { APP_VIEWS, resolveAppView } from './utils/navigation.js'
import PredictionReminders from './components/PredictionReminders.jsx'
import useAppUpdates from './hooks/useAppUpdates.js'
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
const Jogos = lazy(() => import('./components/Jogos.jsx'))
const Login = lazy(() => import('./components/Login.jsx'))
const Palpites = lazy(() => import('./components/Palpites.jsx'))
const TVMode = lazy(() => import('./components/TVMode.jsx'))
const TVScoreboard = lazy(() => import('./components/TVScoreboard.jsx'))
const Regulations = lazy(() => import('./components/Regulations.jsx'))
const AthleteStatistics = lazy(() => import('./components/AthleteStatistics.jsx'))
const TournamentExplorer = lazy(() => import('./components/TournamentExplorer.jsx'))
const QuickPredictions = lazy(() => import('./components/QuickPredictions.jsx'))

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
  const [theme, setTheme] = useState(() => {
    const storedTheme = readPreference('theme')

    if (['light', 'dark'].includes(storedTheme)) {
      return storedTheme
    }

    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const { user, profile, isMaster, isViewer, isParticipant, loading, profileLoading, logout } = useAuth()
  const { quick, setQuick } = useQuickPredictionMode(user?.uid)
  const activeView = resolveAppView(view, { signedIn: Boolean(user), isMaster, isViewer, participantHome: quick ? 'jogos' : 'dashboard' })
  const quickShell = quick && ((isParticipant && activeView === 'jogos') || (!user && ['home', 'login', 'cadastro'].includes(activeView)))
  const authLoading = loading || profileLoading
  const appUpdate = useAppUpdates({ enabled: !authLoading })
  const updateNotice = appUpdate ? <div className="app-update-notice" role="status"><span>Nova versão pronta. A atualização será automática quando não houver edição em andamento. Salve seus dados antes de atualizar agora.</span><button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>Atualizar site</button></div> : null

  const navigate = (nextView) => {
    setView(nextView)
    window.location.hash = nextView
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (!authLoading && activeView !== view) window.location.replace(`#${activeView}`)
  }, [activeView, authLoading, view])

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
      return <Jogos onNavigate={navigate} onQuickMode={openQuickMode} />
    }

    if (activeView === 'calendario') {
      return <Calendario onNavigate={navigate} />
    }
    if (activeView === 'regulamentos') return <Regulations />
    if (activeView === 'estatisticas') return <AthleteStatistics />
    if (activeView === 'chaveamento' || activeView === 'simulador') return <TournamentExplorer mode={activeView === 'simulador' ? 'simulator' : 'bracket'} onNavigate={navigate} />

    if (activeView === 'palpites') {
      return <Palpites onNavigate={navigate} />
    }

    if (activeView === 'classificacao') {
      return <Classificacao onNavigate={navigate} />
    }

    if (activeView === 'admin') {
      return <AdminPanel onNavigate={navigate} />
    }

    return <Home onNavigate={navigate} />
  }

  if (authLoading) return <div className="route-loading" role="status">Carregando sua conta…</div>

  if (quickShell) return <div className="app quick-app">
    <header className="quick-app-header"><img src="/logo-interclasse.png" alt="Interclasse SESI Vinhedo" /><div><strong>{user ? 'Palpite rápido' : 'Acesso ao Interclasse'}</strong><span>{user ? `Olá, ${profile?.nome || user.displayName || 'participante'}` : 'Entre com o login fornecido pela organização'}</span></div><button type="button" className="btn btn-outline" onClick={leaveQuickMode}>Site completo</button>{user ? <button type="button" className="quick-logout" onClick={async () => { await logout(); navigate('login') }}>Sair</button> : null}</header>
    <ConnectionStatus /><ConfigNotice />
    <main>{updateNotice}{isParticipant ? <PredictionReminders key={user.uid} userId={user.uid} showSettings={false} onNavigate={navigate} /> : null}<Suspense fallback={<div className="route-loading">{user ? 'Abrindo palpites…' : 'Abrindo acesso…'}</div>}>{user ? <QuickPredictions key={user.uid} /> : activeView === 'cadastro' ? <Cadastro onNavigate={navigate} onSuccess={() => afterLogin('dashboard')} /> : <Login onNavigate={navigate} onSuccess={afterLogin} />}</Suspense></main>
    <footer className="quick-app-footer">{user ? 'Interclasse SESI Vinhedo · confira o placar antes de enviar.' : 'Interclasse SESI Vinhedo · jogos, resultados e informações do evento.'}</footer>
  </div>

  if (activeView === 'placar') {
    return <>{updateNotice}<Suspense fallback={<div className="route-loading">Preparando o placar ao vivo…</div>}><TVScoreboard onNavigate={navigate} /></Suspense></>
  }

  if (activeView === 'tv') {
    return <>{updateNotice}<Suspense fallback={<div className="route-loading">Abrindo modo TV…</div>}><TVMode onNavigate={navigate} /></Suspense></>
  }

  return (
    <div className="app">
      <Header activeView={activeView} onNavigate={navigate} theme={theme} onToggleTheme={toggleTheme} />
      <ConnectionStatus />
      <ConfigNotice />
      <main>
        {updateNotice}
        <LiveScoresStrip />
        {isParticipant ? <PredictionReminders key={user.uid} userId={user.uid} showSettings={activeView === 'dashboard'} onNavigate={navigate} /> : null}
        <Suspense fallback={<div className="route-loading">Carregando tela...</div>}>{renderView()}</Suspense>
      </main>
      <Footer accessOnly={!user && activeView === 'login'} />
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
