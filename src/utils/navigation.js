export const PARTICIPANT_VIEWS = ['dashboard', 'jogos', 'palpites', 'classificacao']
export const CONSULTATION_VIEWS = ['calendario', 'chaveamento', 'simulador', 'regulamentos', 'estatisticas']
export const PUBLIC_VIEWS = ['home', 'login', 'cadastro']
export const REHEARSAL_TV_VIEW = 'tv-ensaio'
export const PROTECTED_VIEWS = [...CONSULTATION_VIEWS, 'tv', 'placar', REHEARSAL_TV_VIEW, ...PARTICIPANT_VIEWS, 'admin', 'cadastros', 'aprovacao']
export const APP_VIEWS = [...PUBLIC_VIEWS, ...PROTECTED_VIEWS]

export const APP_VIEW_LABELS = {
  home: 'Início', calendario: 'Calendário', regulamentos: 'Regulamentos', estatisticas: 'Estatísticas',
  chaveamento: 'Chaveamento', simulador: 'Simulador', login: 'Entrar', cadastro: 'Criar conta',
  tv: 'Modo TV', placar: 'Placar ao vivo', dashboard: 'Meu painel', jogos: 'Jogos',
  [REHEARSAL_TV_VIEW]: 'TV de ensaio',
  palpites: 'Meus palpites', classificacao: 'Classificação', admin: 'Painel master',
  cadastros: 'Aprovar cadastros', aprovacao: 'Situação do cadastro',
}

export function resolveAppView(requested, { signedIn, isMaster, isViewer = false, isParticipant = false, canReviewRegistrations = false, participantHome = 'dashboard' }) {
  const view = APP_VIEWS.includes(requested) ? requested : 'home'
  if (!signedIn) return PUBLIC_VIEWS.includes(view) ? view : 'login'
  if (view === 'cadastros' && canReviewRegistrations) return 'cadastros'
  if (isViewer) return CONSULTATION_VIEWS.includes(view) ? view : 'calendario'
  if (!isMaster && !isParticipant) return canReviewRegistrations ? 'cadastros' : 'aprovacao'
  if (!isMaster) return PARTICIPANT_VIEWS.includes(view) ? view : participantHome === 'jogos' ? 'jogos' : 'dashboard'
  if (['cadastros', 'aprovacao'].includes(view)) return 'admin'
  return PARTICIPANT_VIEWS.includes(view) || ['login', 'cadastro'].includes(view) ? 'admin' : view
}
