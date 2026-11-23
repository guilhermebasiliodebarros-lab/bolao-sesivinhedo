import { test } from 'node:test'
import assert from 'node:assert/strict'
import { APP_VIEWS, CONSULTATION_VIEWS, PARTICIPANT_VIEWS, PUBLIC_VIEWS, resolveAppView } from '../src/utils/navigation.js'

test('the shared consultation account only opens the five read-only screens, including direct and quick-mode links', () => {
  assert.deepEqual(CONSULTATION_VIEWS, ['calendario', 'chaveamento', 'simulador', 'regulamentos', 'estatisticas'])
  for (const participantHome of ['dashboard', 'jogos']) {
    for (const requested of [...APP_VIEWS, 'unknown']) {
      assert.equal(resolveAppView(requested, { signedIn: true, isMaster: false, isViewer: true, participantHome }), CONSULTATION_VIEWS.includes(requested) ? requested : 'calendario')
    }
  }
})

test('a signed-in participant can only navigate to their four betting screens, including through direct links', () => {
  for (const view of APP_VIEWS) {
    assert.equal(resolveAppView(view, { signedIn: true, isMaster: false, isParticipant: true }), PARTICIPANT_VIEWS.includes(view) ? view : 'dashboard')
  }
  assert.equal(resolveAppView('unknown', { signedIn: true, isMaster: false, isParticipant: true }), 'dashboard')
})

test('guests can only open the welcome, sign-in and registration screens, including through direct links', () => {
  assert.deepEqual(PUBLIC_VIEWS, ['home', 'login', 'cadastro'])
  for (const view of APP_VIEWS) {
    for (const participantHome of ['dashboard', 'jogos']) {
      assert.equal(resolveAppView(view, { signedIn: false, isMaster: false, isViewer: false, participantHome }), PUBLIC_VIEWS.includes(view) ? view : 'login')
    }
  }
  assert.equal(resolveAppView('unknown', { signedIn: false, isMaster: false }), 'home')
})

test('signing out immediately blocks the previously open screen for every account type', () => {
  for (const view of APP_VIEWS.filter((item) => !PUBLIC_VIEWS.includes(item))) {
    assert.equal(resolveAppView(view, { signedIn: false, isMaster: true }), 'login')
    assert.equal(resolveAppView(view, { signedIn: false, isMaster: false, isViewer: true }), 'login')
  }
})

test('master navigation keeps access to event and administration screens', () => {
  for (const view of ['home', 'calendario', 'regulamentos', 'estatisticas', 'chaveamento', 'simulador', 'tv', 'placar']) {
    assert.equal(resolveAppView(view, { signedIn: true, isMaster: true }), view)
  }
  for (const view of [...PARTICIPANT_VIEWS, 'login', 'cadastro', 'admin']) assert.equal(resolveAppView(view, { signedIn: true, isMaster: true }), 'admin')
})
