import { test } from 'node:test'
import assert from 'node:assert/strict'
import { APP_VIEWS, PARTICIPANT_VIEWS, resolveAppView } from '../src/utils/navigation.js'

test('a signed-in participant can only navigate to their four betting screens, including through direct links', () => {
  for (const view of APP_VIEWS) {
    assert.equal(resolveAppView(view, { signedIn: true, isMaster: false }), PARTICIPANT_VIEWS.includes(view) ? view : 'dashboard')
  }
  assert.equal(resolveAppView('unknown', { signedIn: true, isMaster: false }), 'dashboard')
})

test('master navigation and guest public pages keep their distinct routes', () => {
  for (const view of ['home', 'calendario', 'regulamentos', 'estatisticas', 'chaveamento', 'simulador', 'tv']) {
    assert.equal(resolveAppView(view, { signedIn: false, isMaster: false }), view)
    assert.equal(resolveAppView(view, { signedIn: true, isMaster: true }), view)
  }
  for (const view of [...PARTICIPANT_VIEWS, 'admin']) assert.equal(resolveAppView(view, { signedIn: false, isMaster: false }), 'login')
  for (const view of [...PARTICIPANT_VIEWS, 'login', 'cadastro', 'admin']) assert.equal(resolveAppView(view, { signedIn: true, isMaster: true }), 'admin')
})
