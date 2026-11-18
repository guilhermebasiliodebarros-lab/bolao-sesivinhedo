export const PARTICIPANT_VIEWS = ['dashboard', 'jogos', 'palpites', 'classificacao']
export const CONSULTATION_VIEWS = ['calendario', 'chaveamento', 'simulador', 'regulamentos', 'estatisticas']
export const PUBLIC_VIEWS = ['home', 'login', 'cadastro']
export const PROTECTED_VIEWS = [...CONSULTATION_VIEWS, 'tv', 'placar', ...PARTICIPANT_VIEWS, 'admin']
export const APP_VIEWS = [...PUBLIC_VIEWS, ...PROTECTED_VIEWS]

export const APP_VIEW_LABELS = {
  home: 'Início', calendario: 'Calendário', regulamentos: 'Regulamentos', estatisticas: 'Estatísticas',
  chaveamento: 'Chaveamento', simulador: 'Simulador', login: 'Entrar', cadastro: 'Criar conta',
  tv: 'Modo TV', placar: 'Placar ao vivo', dashboard: 'Meu painel', jogos: 'Jogos',
  palpites: 'Meus palpites', classificacao: 'Classificação', admin: 'Painel master',
}

export function resolveAppView(requested, { signedIn, isMaster, isViewer = false, participantHome = 'dashboard' }) {
  const view = APP_VIEWS.includes(requested) ? requested : 'home'
  if (!signedIn) return PUBLIC_VIEWS.includes(view) ? view : 'login'
  if (isViewer) return CONSULTATION_VIEWS.includes(view) ? view : 'calendario'
  if (!isMaster) return PARTICIPANT_VIEWS.includes(view) ? view : participantHome === 'jogos' ? 'jogos' : 'dashboard'
  return PARTICIPANT_VIEWS.includes(view) || ['login', 'cadastro'].includes(view) ? 'admin' : view
}
