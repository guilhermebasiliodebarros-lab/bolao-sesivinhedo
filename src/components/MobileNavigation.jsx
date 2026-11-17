import { useAuth } from '../context/useAuth.js'
import { APP_VIEW_LABELS, CONSULTATION_VIEWS, PARTICIPANT_VIEWS } from '../utils/navigation.js'

const iconPaths = {
  home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  calendario: 'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M8 14h2M14 14h2M8 17h2',
  jogos: 'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M8 15l3 3 5-5',
  chaveamento: 'M3 4h5v5H3zM3 15h5v5H3zM8 6h5v12H8M13 12h8M18 9l3 3-3 3',
  simulador: 'M4 7h16M4 17h16M8 4v6M16 14v6',
  regulamentos: 'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5',
  estatisticas: 'M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7',
  palpites: 'M5 3h14v18H5zM8 8l2 2 4-4M8 15h8',
  classificacao: 'M8 3h8v6a4 4 0 0 1-8 0zM8 5H4v3a4 4 0 0 0 4 4M16 5h4v3a4 4 0 0 1-4 4M12 13v5M8 21v-3h8v3',
  login: 'M14 3h6v18h-6M3 12h12M10 7l5 5-5 5',
}

export default function MobileNavigation({ activeView, onNavigate }) {
  const { user, isMaster, isViewer } = useAuth()
  if (isMaster) return null
  const views = isViewer ? CONSULTATION_VIEWS : user ? PARTICIPANT_VIEWS : ['home', 'calendario', 'chaveamento', 'login']
  const shortLabels = { dashboard: 'Painel', palpites: 'Palpites', classificacao: 'Ranking', calendario: 'Jogos', chaveamento: 'Chaves' }

  return <nav className="mobile-navigation" aria-label="Atalhos no celular">
    {views.map((view) => <button type="button" key={view} className={activeView === view ? 'is-active' : ''} aria-label={APP_VIEW_LABELS[view]} aria-current={activeView === view ? 'page' : undefined} onClick={() => onNavigate(view)}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[view]} /></svg><span>{shortLabels[view] || APP_VIEW_LABELS[view]}</span></button>)}
  </nav>
}
