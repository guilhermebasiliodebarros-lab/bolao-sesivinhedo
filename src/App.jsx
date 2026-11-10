import { lazy, Suspense, useEffect, useState } from 'react'
import './App.css'
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
const Regulations = lazy(() => import('./components/Regulations.jsx'))
const AthleteStatistics = lazy(() => import('./components/AthleteStatistics.jsx'))
const TournamentExplorer = lazy(() => import('./components/TournamentExplorer.jsx'))

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
  const { user, isMaster, isParticipant, loading, profileLoading } = useAuth()
  const activeView = resolveAppView(view, { signedIn: Boolean(user), isMaster })
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

  const renderView = () => {
    if (activeView === 'login') {
      return <Login onNavigate={navigate} onSuccess={(nextView) => navigate(nextView || 'dashboard')} />
    }

    if (activeView === 'cadastro') {
      return <Cadastro onNavigate={navigate} onSuccess={() => navigate('dashboard')} />
    }

    if (activeView === 'dashboard') {
      return <Dashboard onNavigate={navigate} />
    }

    if (activeView === 'jogos') {
      return <Jogos onNavigate={navigate} />
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
      <Footer />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App
