export const PARTICIPANT_VIEWS = ['dashboard', 'jogos', 'palpites', 'classificacao']
export const PROTECTED_VIEWS = [...PARTICIPANT_VIEWS, 'admin']
export const APP_VIEWS = ['home', 'calendario', 'regulamentos', 'estatisticas', 'chaveamento', 'simulador', 'login', 'cadastro', 'tv', ...PROTECTED_VIEWS]

export function resolveAppView(requested, { signedIn, isMaster }) {
  const view = APP_VIEWS.includes(requested) ? requested : 'home'
  if (!signedIn) return PROTECTED_VIEWS.includes(view) ? 'login' : view
  if (!isMaster) return PARTICIPANT_VIEWS.includes(view) ? view : 'dashboard'
  return PARTICIPANT_VIEWS.includes(view) || ['login', 'cadastro'].includes(view) ? 'admin' : view
}
