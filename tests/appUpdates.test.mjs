import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reloadAppVersion, startAppUpdates } from '../src/services/appUpdates.js'
import { trackWrite } from '../src/services/pendingWrites.js'

const flush = () => new Promise((resolve) => setImmediate(resolve))

function setup({ href = 'https://example.test/?turno=manha#placar', blockedStorage = false, fetch, autoReload = true } = {}) {
  const win = new EventTarget(), doc = new EventTarget(), browser = { onLine: true }
  const timers = new Map(), storage = new Map(), navigations = [], requests = [], available = []
  let serial = 0, version = 'current'
  win.location = { href, replace: (url) => navigations.push(url) }
  win.sessionStorage = {
    getItem: (key) => { if (blockedStorage) throw new Error('Blocked'); return storage.get(key) },
    setItem: (key, value) => { if (blockedStorage) throw new Error('Blocked'); storage.set(key, value) },
  }
  win.setTimeout = (fn, delay) => { const id = ++serial; timers.set(id, { fn, delay }); return id }
  win.setInterval = win.setTimeout
  win.clearTimeout = (id) => timers.delete(id)
  win.clearInterval = win.clearTimeout
  doc.querySelector = () => doc.dialog ? {} : null
  const stop = startAppUpdates({
    buildId: 'current', autoReload, onAvailable: (id) => available.push(id),
    environment: { window: win, document: doc, navigator: browser, fetch: async (url, options) => {
      requests.push({ url, options })
      return fetch ? fetch(url, options) : { ok: true, json: async () => ({ id: version }) }
    } },
  })
  const run = (delay) => {
    const timer = [...timers.values()].find((entry) => entry.delay === delay)
    assert.ok(timer, `Expected timer ${delay}`)
    timer.fn()
  }
  return { win, doc, browser, timers, navigations, requests, available, stop, run, version: (id) => { version = id } }
}

test('only a new build reloads the page, preserving its route and query parameters', async () => {
  const env = setup()
  await flush()
  assert.equal(env.navigations.length, 0)
  assert.equal(env.requests[0].options.cache, 'no-store')
  assert.ok(new URL(env.requests[0].url).searchParams.has('_check'))
  env.version('next-build')
  env.run(15000); await flush()
  const target = new URL(env.navigations[0])
  assert.equal(target.searchParams.get('app-version'), 'next-build')
  assert.equal(target.searchParams.get('turno'), 'manha')
  assert.equal(target.hash, '#placar')
  env.run(5000)
  assert.equal(env.navigations.length, 1)
  env.stop()
  assert.equal(env.timers.size, 0)
})

test('blocked session storage still permits updates and the version URL prevents stale HTML reload loops', async () => {
  const env = setup({ blockedStorage: true })
  await flush()
  env.version('new'); env.run(15000); await flush()
  assert.equal(env.navigations.length, 1)
  const restored = setup({ href: env.navigations[0], blockedStorage: true })
  await flush()
  restored.version('new'); restored.run(15000); await flush()
  assert.deepEqual(restored.available, ['', 'new'])
  assert.equal(restored.navigations.length, 0)
  restored.version('newer'); restored.run(15000); await flush()
  assert.equal(restored.navigations.length, 1)
  env.stop(); restored.stop()
})

test('unsaved edits, open dialogs and in-flight writes defer updates until the page is safe', async (t) => {
  let now = 10000
  t.mock.method(Date, 'now', () => now)
  const env = setup()
  await flush()
  const field = { value: 'old', defaultValue: 'old', type: 'text', isConnected: true, matches: () => true, closest: (selector) => selector === '[data-update-safe]' ? null : {} }
  const send = (name) => { const event = new Event(name); Object.defineProperty(event, 'target', { value: field }); env.doc.dispatchEvent(event) }
  send('focusin'); field.value = 'unsaved'; send('input')
  env.version('new'); env.run(15000); await flush()
  now += 6000; env.run(5000)
  assert.equal(env.navigations.length, 0)
  field.isConnected = false
  env.doc.dialog = true; env.run(5000)
  assert.equal(env.navigations.length, 0)
  env.doc.dialog = false
  let finish
  const saving = trackWrite(() => new Promise((resolve) => { finish = resolve }))
  env.run(5000); assert.equal(env.navigations.length, 0)
  finish(); await saving
  env.run(5000); assert.equal(env.navigations.length, 1)
  env.stop()
})

test('hidden and offline tabs skip checks; focus, pageshow, visibility and connection recovery check immediately', async () => {
  const env = setup()
  await flush()
  env.doc.hidden = true; env.run(15000)
  env.win.dispatchEvent(new Event('focus')); await flush()
  assert.equal(env.requests.length, 1)
  env.doc.hidden = false; env.doc.dispatchEvent(new Event('visibilitychange')); await flush()
  env.win.dispatchEvent(new Event('focus')); await flush()
  env.win.dispatchEvent(new Event('pageshow')); await flush()
  assert.equal(env.requests.length, 4)
  env.browser.onLine = false; env.run(15000); await flush()
  assert.equal(env.requests.length, 4)
  env.browser.onLine = true; env.win.dispatchEvent(new Event('online')); await flush()
  assert.equal(env.requests.length, 5)
  env.stop()
  env.win.dispatchEvent(new Event('focus')); env.doc.dispatchEvent(new Event('visibilitychange')); await flush()
  assert.equal(env.requests.length, 5)
})

test('overlapping checks are skipped and stopping aborts a request without publishing late results', async () => {
  let resolve
  const env = setup({ fetch: () => new Promise((done) => { resolve = done }) })
  env.run(15000); env.win.dispatchEvent(new Event('focus'))
  assert.equal(env.requests.length, 1)
  env.stop()
  assert.equal(env.requests[0].options.signal.aborted, true)
  resolve({ ok: true, json: async () => ({ id: 'new' }) }); await flush()
  assert.equal(env.available.length, 0)
  assert.equal(env.navigations.length, 0)
  assert.equal(env.timers.size, 0)
})

test('timeouts recover on the next check; malformed manifests and server errors leave the current page intact', async () => {
  let attempt = 0
  const env = setup({ fetch: (_url, { signal }) => {
    attempt++
    if (attempt === 1) return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('timeout'))))
    if (attempt === 2) return { ok: false }
    if (attempt === 3) return { ok: true, json: async () => ({ id: '../invalid' }) }
    return { ok: true, json: async () => ({ id: 'new' }) }
  } })
  env.run(10000); await flush()
  env.run(15000); await flush()
  env.run(15000); await flush()
  assert.equal(env.navigations.length, 0)
  env.run(15000); await flush()
  assert.equal(env.navigations.length, 1)
  env.stop()
})

test('manual updates use the fresh version URL when automatic reload is disabled', async () => {
  const env = setup({ autoReload: false })
  await flush()
  env.version('new'); env.run(15000); await flush()
  assert.equal(env.available.at(-1), 'new')
  assert.equal(env.navigations.length, 0)
  reloadAppVersion(env.available.at(-1), env.win)
  assert.equal(new URL(env.navigations[0]).searchParams.get('app-version'), 'new')
  env.stop()
})
