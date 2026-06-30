import { lazy, Suspense, useEffect, useState } from 'react'
import './App.css'
import Footer from './components/Footer.jsx'
import Header from './components/Header.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { useAuth } from './context/useAuth.js'
import { firebaseEnvNames, isFirebaseConfigured, missingFirebaseConfig } from './config/firebase.js'

const AdminPanel = lazy(() => import('./components/AdminPanel.jsx'))
const Cadastro = lazy(() => import('./components/Cadastro.jsx'))
const Calendario = lazy(() => import('./components/Calendario.jsx'))
const Classificacao = lazy(() => import('./components/Classificacao.jsx'))
const Dashboard = lazy(() => import('./components/Dashboard.jsx'))
const Home = lazy(() => import('./components/Home.jsx'))
const Jogos = lazy(() => import('./components/Jogos.jsx'))
const Login = lazy(() => import('./components/Login.jsx'))
const Palpites = lazy(() => import('./components/Palpites.jsx'))

const protectedViews = ['dashboard', 'jogos', 'palpites', 'classificacao', 'admin']

function ConfigNotice() {
  if (isFirebaseConfigured) {
    return null
  }

  return (
    <div className="config-notice" role="status">
      <strong>Firebase pendente:</strong> configure as variaveis{' '}
      {missingFirebaseConfig.map((item) => firebaseEnvNames[item]).join(', ')}{' '}
      no ambiente para liberar login, cadastro, Firestore e ranking em tempo real.
    </div>
  )
}

function AppShell() {
  const [view, setView] = useState('home')
  const [theme, setTheme] = useState(() => {
    const storedTheme = window.localStorage.getItem('theme')

    if (storedTheme) {
      return storedTheme
    }

    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const { user, isMaster, loading, profileLoading } = useAuth()
  let activeView = view
  const authLoading = loading || profileLoading

  if (!authLoading && !user && protectedViews.includes(view)) {
    activeView = 'login'
  }

  if (!authLoading && user && isMaster && ['dashboard', 'jogos', 'palpites', 'classificacao'].includes(view)) {
    activeView = 'admin'
  }

  if (!authLoading && user && view === 'admin' && !isMaster) {
    activeView = 'dashboard'
  }

  if (!authLoading && user && ['login', 'cadastro'].includes(view)) {
    activeView = isMaster ? 'admin' : 'dashboard'
  }

  const navigate = (nextView) => {
    setView(nextView)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('theme', theme)
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

  return (
    <div className="app">
      <Header activeView={activeView} onNavigate={navigate} theme={theme} onToggleTheme={toggleTheme} />
      <ConfigNotice />
      <main>
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
