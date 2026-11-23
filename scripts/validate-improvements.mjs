import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { APP_ORIGIN, FIRESTORE_ORIGIN, PROJECT, REHEARSAL_PASSWORD, localRequest, resetRehearsal } from './rehearsal-data.mjs'

const output = 'artifacts/rehearsal/improvements'
mkdirSync(output, { recursive: true })
const base = `${FIRESTORE_ORIGIN}/v1/projects/${PROJECT}/databases/(default)/documents`
const results = [], pageErrors = [], blockedRequests = []
const record = (name) => { results.push({ name, passed: true }); console.log(`OK · ${name}`) }
const field = (value) => value === null ? { nullValue: null } : value instanceof Date ? { timestampValue: value.toISOString() } : Array.isArray(value) ? { arrayValue: { values: value.map(field) } } : typeof value === 'object' ? { mapValue: { fields: fields(value) } } : typeof value === 'number' ? Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value } : typeof value === 'boolean' ? { booleanValue: value } : { stringValue: value }
const fields = (value) => Object.fromEntries(Object.entries(value).map(([name, item]) => [name, field(item)]))
const put = (path, value) => localRequest(`${base}/${path}`, { method: 'PATCH', body: JSON.stringify({ fields: fields(value) }) })
const patch = (path, value) => localRequest(`${base}/${path}?${Object.keys(value).map((name) => `updateMask.fieldPaths=${encodeURIComponent(name)}`).join('&')}`, { method: 'PATCH', body: JSON.stringify({ fields: fields(value) }) })
const read = (path) => localRequest(`${base}/${path}`)
const remove = (path) => localRequest(`${base}/${path}`, { method: 'DELETE' })
const poll = async (action, check) => { for (let attempt = 0; attempt < 60; attempt++) { const value = await action(); if (check(value)) return value; await new Promise((done) => setTimeout(done, 250)) } throw new Error('A atualização esperada não chegou ao emulador.') }
let browser, admin, professor

try {
  const seeded = await resetRehearsal()
  const teacher = seeded.users.find((user) => user.email === 'professor@ensaio.local')
  const shared = seeded.users.find((user) => user.email === 'parcial@ensaio.local')
  const third = seeded.users.find((user) => user.email === 'vencedor@ensaio.local')
  for (let index = 0; index < 5; index++) {
    const gameId = `qa-ranking-${index}`
    await put(`games/${gameId}`, { esporteNome: 'Futebol', sportId: 'esporte-futebol', scoringMode: 'goals', tournamentId: 'qa-ranking', tournamentName: 'Ranking de conferência', stageType: 'league', turno: 'manha', timeA: '9º A', timeB: '9º B', status: 'finalizado', liveStatus: 'finished', placarA: 2, placarB: 1, dataHora: new Date(Date.now() - 3600000) })
    for (const user of [teacher, shared, third]) {
      const exact = index < (user === third ? 2 : 3)
      const wrong = user === third && index === 4
      await put(`predictions/${user.uid}_${gameId}`, { userId: user.uid, gameId, nomeUsuario: user.nome, palpiteA: wrong ? 0 : exact ? 2 : 3, palpiteB: 1, pontos: 0, acertoExato: false, acertoResultado: false, createdAt: new Date(), updatedAt: new Date() })
    }
  }
  for (const user of [teacher, shared, third]) await poll(() => read(`users/${user.uid}`), (value) => Number(value.fields.pontos?.integerValue) === (user === third ? 6 : 8))
  browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true })
  const context = async (viewport = { width: 1440, height: 1000 }) => {
    const value = await browser.newContext({ viewport, timezoneId: 'America/Sao_Paulo', acceptDownloads: true })
    await value.route('**/*', (route) => {
      const url = new URL(route.request().url())
      if (['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol)) return route.continue()
      blockedRequests.push(`${url.protocol}//${url.hostname}${url.pathname}`)
      return route.abort()
    })
    value.on('page', (page) => page.on('pageerror', (error) => pageErrors.push(error.message)))
    return value
  }
  const adminContext = await context(), teacherContext = await context(), mobileContext = await context({ width: 320, height: 900 })
  admin = await adminContext.newPage()
  professor = await teacherContext.newPage()
  const login = async (page, username) => {
    await page.goto(`${APP_ORIGIN}/#login`)
    await page.locator('input[autocomplete="username"]').fill(username)
    await page.locator('input[autocomplete="current-password"]').fill(REHEARSAL_PASSWORD)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await page.locator('.header-shortcuts, .quick-app-header .quick-logout').first().waitFor({ timeout: 45000 })
  }
  await login(admin, 'suporte')
  await admin.getByRole('navigation', { name: 'Seções do painel master' }).waitFor({ timeout: 45000 })
  await login(professor, teacher.email)
  await professor.locator('.header-shortcuts').getByRole('button', { name: 'Classificação', exact: true }).click()
  const rows = professor.locator('.ranking-row')
  await rows.filter({ hasText: teacher.nome }).locator('.ranking-position').getByText('1º', { exact: true }).waitFor()
  await rows.filter({ hasText: shared.nome }).locator('.ranking-position').getByText('1º', { exact: true }).waitFor()
  await rows.filter({ hasText: third.nome }).locator('.ranking-position').getByText('3º', { exact: true }).waitFor()
  await professor.getByText('2 participantes empatados', { exact: true }).waitFor()
  await professor.getByLabel('Buscar participante').fill(shared.nome)
  assert.equal(await professor.locator('.ranking-row').count(), 1)
  assert.equal(await professor.locator('.ranking-row .ranking-position').innerText(), '1º')
  await professor.getByLabel('Buscar participante').fill('')
  await professor.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0) })
  await professor.screenshot({ path: `${output}/ranking-desktop.png`, fullPage: true })
  await professor.getByRole('button', { name: 'Futebol', exact: true }).click()
  await professor.locator('.ranking-personal-summary').getByText('Você está em 1º lugar · posição compartilhada', { exact: true }).waitFor()
  record('Empates 1º, 1º e 3º no ranking geral, busca, pódio, resumo pessoal e ranking por esporte')

  await admin.evaluate(async () => {
    const api = await import('/src/services/bolaoService.js')
    const { calendarFingerprint } = await import('/src/utils/visualSchedule.js')
    const { toDateTimeLocalValue } = await import('/src/utils/format.js')
    const game = await new Promise((resolve, reject) => {
      let stop
      stop = api.subscribeGames((items) => { const found = items.find((item) => item.id === 'ensaio-futebol'); if (found) queueMicrotask(() => { stop?.(); resolve(found) }) }, reject)
    })
    await api.saveCalendarGame({ gameId: game.id, expectedFingerprint: calendarFingerprint(game), change: { dataHora: toDateTimeLocalValue(new Date(Date.now() + 3 * 3600000)), venue: 'Quadra de conferência', venueArea: 'Área nova', durationMinutes: 30 } })
  })
  const notices = professor.getByRole('complementary', { name: 'Novidades da programação' })
  await notices.getByText('1 não lida(s)', { exact: true }).waitFor({ timeout: 30000 })
  await notices.getByRole('button', { name: /Novidades do evento/ }).click()
  await notices.locator('.schedule-notice-change').getByText('Quadra de conferência · Área nova', { exact: true }).waitFor()
  assert.match(await notices.innerText(), /Horário/)
  assert.match(await notices.innerText(), /Local/)
  await notices.getByRole('button', { name: 'Marcar todas como lidas', exact: true }).click()
  await notices.getByText('Tudo em dia', { exact: true }).waitFor()
  const mobile = await mobileContext.newPage()
  await login(mobile, teacher.email)
  const mobileNotices = mobile.getByRole('complementary', { name: 'Novidades da programação' })
  await mobileNotices.getByText('Tudo em dia', { exact: true }).waitFor()
  await mobileNotices.getByRole('button', { name: /Novidades do evento/ }).click()
  await mobileNotices.getByText('Quadra de conferência · Área nova', { exact: true }).waitFor()
  await mobile.locator('.quick-prediction-card').waitFor({ timeout: 45000 })
  await mobile.screenshot({ path: `${output}/notices-mobile.png`, fullPage: true })
  assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
  record('Avisos de horário e quadra em tempo real, com leitura sincronizada em dois dispositivos e layout de 320 px')

  const token = await professor.evaluate(async () => (await import('/src/services/firebase.js')).auth.currentUser.getIdToken())
  const denied = async (path, method = 'GET', value) => fetch(`${base}/${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(value ? { body: JSON.stringify({ fields: fields(value) }) } : {}) })
  assert.equal((await denied(`users/${shared.uid}/preferences/scheduleNotices`)).status, 403)
  assert.equal((await denied('scheduleNotices/forged', 'PATCH', { changes: [], createdAt: new Date() })).status, 403)
  assert.equal((await denied('teams/ensaio-futebol-a/players/ana')).status, 403)
  record('Servidor protege as leituras pessoais e impede professores de publicar avisos ou ler elencos privados')

  await put(`predictions/${teacher.uid}_qa-backup`, { userId: teacher.uid, gameId: 'ensaio-futebol', nomeUsuario: teacher.nome, palpiteA: 2, palpiteB: 1, pontos: 0, acertoExato: false, acertoResultado: false, createdAt: new Date(), updatedAt: new Date() })
  await put('games/ensaio-futebol/documents/matchReport', { notes: 'Registro particular da organização', referee: 'Professor', createdAt: new Date() })
  await put('games/ensaio-futebol/events/qa-backup', { event: { kind: 'goal', side: 'A', playerName: 'Ana' }, createdAt: new Date() })
  for (let index = 0; index < 10; index++) {
    await put(`games/qa-private-${index}`, { esporteNome: 'Futebol', sportId: 'esporte-futebol', status: 'encerrado', liveStatus: 'scheduled', timeA: 'Equipe de conferência A', timeB: 'Equipe de conferência B' })
    await put(`games/qa-private-${index}/documents/matchReport`, { notes: `Súmula particular ${index}` })
  }
  await admin.getByRole('navigation', { name: 'Seções do painel master' }).getByRole('button', { name: 'Backup e recuperação', exact: true }).click()
  const panel = admin.getByRole('region', { name: 'Backup e recuperação', exact: true })
  const download = admin.waitForEvent('download')
  await panel.getByRole('button', { name: 'Baixar backup completo', exact: true }).click()
  await (await download).saveAs(`${output}/backup.json`)
  const backup = JSON.parse(readFileSync(`${output}/backup.json`, 'utf8'))
  assert.equal(backup.projectId, PROJECT)
  assert(backup.documents.some((item) => item.path.includes('/players/')))
  assert(backup.documents.some((item) => item.path.endsWith('/documents/matchReport')))
  assert(backup.documents.some((item) => item.path.endsWith('/events/qa-backup')))
  assert(!backup.documents.some((item) => item.path.startsWith('users/')))
  const player = backup.documents.find((item) => item.path.includes('/players/'))
  const sport = backup.documents.find((item) => item.path === 'sports/esporte-futebol')
  for (const path of ['games/ensaio-futebol', 'games/ensaio-futebol/documents/matchReport', 'games/ensaio-futebol/events/qa-backup', player.path, `predictions/${teacher.uid}_qa-backup`]) await remove(path)
  for (let index = 0; index < 10; index++) { await remove(`games/qa-private-${index}/documents/matchReport`); await remove(`games/qa-private-${index}`) }
  await patch(sport.path, { nome: 'Nome alterado para conferência' })
  await put('teams/qa-criada-depois', { nome: 'Equipe criada depois do backup', sportId: 'esporte-futebol', turno: 'manha', playerCount: 0 })
  await panel.getByLabel('Arquivo de backup (.json)').setInputFiles(`${output}/backup.json`)
  await panel.getByRole('heading', { name: 'Confira o que será recuperado', exact: true }).waitFor({ timeout: 45000 })
  await admin.screenshot({ path: `${output}/backup-desktop.png`, fullPage: true })
  await panel.getByLabel('Como recuperar').selectOption('replace')
  await panel.getByRole('heading', { name: 'Confira o que será recuperado', exact: true }).waitFor({ timeout: 45000 })
  const safetyDownload = admin.waitForEvent('download')
  await panel.getByRole('button', { name: /^Recuperar \d+ registro\(s\)$/ }).click()
  await admin.getByRole('button', { name: 'Baixar cópia atual e recuperar', exact: true }).click()
  await (await safetyDownload).saveAs(`${output}/before-recovery.json`)
  await panel.getByText(/^Recuperação concluída:/).waitFor({ timeout: 60000 })
  assert.equal((await read(sport.path)).fields.nome.stringValue, sport.data.nome)
  assert.equal((await read('games/ensaio-futebol')).fields.timeA.stringValue, '9º A')
  assert.equal((await read('games/ensaio-futebol/documents/matchReport')).fields.notes.stringValue, 'Registro particular da organização')
  assert.equal((await read('games/ensaio-futebol/events/qa-backup')).fields.event.mapValue.fields.kind.stringValue, 'goal')
  assert.equal((await read(player.path)).fields.nome.stringValue, player.data.nome)
  for (let index = 0; index < 10; index++) assert.equal((await read(`games/qa-private-${index}/documents/matchReport`)).fields.notes.stringValue, `Súmula particular ${index}`)
  assert.equal((await read('teams/qa-criada-depois')).fields.nome.stringValue, 'Equipe criada depois do backup')
  await poll(() => read(`users/${teacher.uid}`), (value) => Number(value.fields.pontos?.integerValue || 0) === 8)
  assert.equal((await read(`users/${teacher.uid}`)).fields.approvalStatus.stringValue, 'approved')
  record('Backup e recuperação pela interface: partida, súmula, lance, atleta e palpite recriados; nome corrigido; dados posteriores e aprovação preservados')
  assert(JSON.parse(readFileSync(`${output}/before-recovery.json`, 'utf8')).documents.length > 0)
  record('Cópia anterior baixada automaticamente e ranking recalculado após a recuperação')

  await admin.setViewportSize({ width: 320, height: 900 })
  await panel.screenshot({ path: `${output}/backup-mobile.png` })
  assert(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1))
  await professor.setViewportSize({ width: 390, height: 900 })
  await professor.getByRole('button', { name: 'Geral', exact: true }).click()
  await professor.getByText(/participantes empatados/).waitFor()
  await professor.screenshot({ path: `${output}/ranking-mobile.png`, fullPage: true })
  assert(await professor.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
  record('Ranking e backup conferidos em celular, sem largura excedente')
  const corrupted = structuredClone(backup)
  corrupted.documents[0].data.qaChanged = true
  writeFileSync(`${output}/corrupted.json`, JSON.stringify(corrupted))
  await panel.getByLabel('Arquivo de backup (.json)').setInputFiles(`${output}/corrupted.json`)
  await panel.getByRole('alert').getByText(/alterado ou está corrompido/).waitFor({ timeout: 45000 })
  assert.equal(await panel.getByRole('button', { name: /^Recuperar \d/ }).count(), 0)
  record('Arquivo alterado é recusado antes de oferecer a recuperação')
  assert.deepEqual(pageErrors, [])
  writeFileSync(`${output}/result.json`, JSON.stringify({ project: PROJECT, productionDataUntouched: true, passed: results.length, results, pageErrors, blockedRequests }, null, 2))
  console.log(`${results.length} etapas concluídas. Relatório: ${output}/result.json`)
} catch (error) {
  if (admin) await admin.screenshot({ path: `${output}/failure-admin.png`, fullPage: true }).catch(() => {})
  if (professor) await professor.screenshot({ path: `${output}/failure-professor.png`, fullPage: true }).catch(() => {})
  writeFileSync(`${output}/result.json`, JSON.stringify({ project: PROJECT, productionDataUntouched: true, results, error: error.stack, pageErrors }, null, 2))
  console.error(error.stack)
  process.exitCode = 1
} finally { await browser?.close() }
