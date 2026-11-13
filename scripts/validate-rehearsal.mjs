import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { APP_ORIGIN, AUTH_ORIGIN, FIRESTORE_ORIGIN, PROJECT, REHEARSAL_PASSWORD, localRequest, resetRehearsal } from './rehearsal-data.mjs'

const output = 'artifacts/rehearsal'
mkdirSync(output, { recursive: true })
const results = []
const pageErrors = []
const blockedRequests = []
const base = `${FIRESTORE_ORIGIN}/v1/projects/${PROJECT}/databases/(default)/documents`
const record = (name, details = {}) => { results.push({ name, passed: true, ...details }); console.log(`OK · ${name}`) }
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const read = (path) => localRequest(`${base}/${path}`)
const number = (document, field) => Number(document.fields[field]?.integerValue ?? document.fields[field]?.doubleValue ?? 0)
const decode = (field) => field?.integerValue !== undefined ? Number(field.integerValue) : field?.stringValue ?? field?.doubleValue ?? field?.booleanValue ?? field?.timestampValue ?? (field?.arrayValue ? (field.arrayValue.values || []).map(decode) : field?.mapValue ? Object.fromEntries(Object.entries(field.mapValue.fields || {}).map(([key, value]) => [key, decode(value)])) : null)

let browser
let admin
try {
  console.log('Validação integrada: somente projeto demo e emuladores locais. Reiniciando os dados fictícios…')
  const seeded = await resetRehearsal()
  browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true })
  async function context(viewport = { width: 1440, height: 1000 }) {
    const value = await browser.newContext({ viewport, timezoneId: 'America/Sao_Paulo' })
    await value.route('**/*', (route) => {
      const url = new URL(route.request().url())
      if (['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol)) return route.continue()
      blockedRequests.push(`${url.protocol}//${url.hostname}${url.pathname}`)
      return route.abort()
    })
    value.on('page', (page) => page.on('pageerror', (error) => pageErrors.push(error.message)))
    return value
  }
  async function login(page, username) {
    await page.goto(`${APP_ORIGIN}/#login`)
    await page.locator('input[autocomplete="username"]').fill(username)
    await page.locator('input[autocomplete="current-password"]').fill(REHEARSAL_PASSWORD)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await page.locator('.header-shortcuts').waitFor({ timeout: 45000 })
    await page.getByText(/ENSAIO LOCAL · DADOS FICTÍCIOS/).waitFor()
  }
  const adminContext = await context()
  const professorContext = await context()
  const tvContext = await context({ width: 1920, height: 1080 })
  const viewerContext = await context({ width: 390, height: 844 })
  admin = await adminContext.newPage()
  const professor = await professorContext.newPage()
  const tv = await tvContext.newPage()
  const viewer = await viewerContext.newPage()
  await login(admin, 'suporte')
  const nav = admin.getByRole('navigation', { name: 'Seções do painel master' })
  await nav.waitFor({ timeout: 45000 })
  await login(professor, 'professor@ensaio.local')
  await professor.locator('.header-shortcuts').getByRole('button', { name: 'Jogos', exact: true }).click()
  const footballGuess = professor.locator('.game-card').filter({ hasText: 'Futebol' })
  await footballGuess.getByRole('spinbutton', { name: '9º A', exact: true }).fill('2')
  await footballGuess.getByRole('spinbutton', { name: '9º B', exact: true }).fill('1')
  await footballGuess.getByRole('button', { name: 'Enviar', exact: true }).click()
  await footballGuess.getByText('Palpite salvo com sucesso.', { exact: true }).waitFor()
  const volleyGuess = professor.locator('.game-card').filter({ hasText: 'Vôlei' }).filter({ hasText: '1º A' })
  await volleyGuess.getByRole('spinbutton', { name: '1º A', exact: true }).fill('2')
  await volleyGuess.getByRole('spinbutton', { name: '1º B', exact: true }).fill('0')
  await volleyGuess.getByRole('button', { name: 'Enviar', exact: true }).click()
  await volleyGuess.getByText('Palpite salvo com sucesso.', { exact: true }).waitFor()
  record('Professor envia palpites de futebol e de vôlei em sets')

  await nav.getByRole('button', { name: /^Jogadores/ }).click()
  await admin.locator('.roster-team-select select').selectOption('ensaio-futebol-a')
  await admin.getByRole('textbox', { name: 'Nome do jogador', exact: true }).fill('Eduardo de Ensaio')
  await admin.getByRole('button', { name: 'Cadastrar jogador', exact: true }).click()
  await admin.getByText('Jogador salvo na equipe com sucesso.', { exact: true }).waitFor()
  record('Cadastro real de atleta pelo formulário da organização')

  await nav.getByRole('button', { name: /^Ao vivo/ }).click()
  await tv.goto(`${APP_ORIGIN}/#placar`)
  await tv.getByRole('heading', { name: 'Aguardando os jogos.', exact: true }).waitFor({ timeout: 45000 })

  async function shift(turno) {
    const current = admin.locator('.shift-tabs').first()
    if (await current.count()) await current.getByRole('button', { name: new RegExp(turno === 'manha' ? 'Manhã' : 'Tarde') }).click()
    else {
      const buttons = admin.getByRole('button', { name: new RegExp(`^${turno === 'manha' ? 'Manhã' : 'Tarde'}`) })
      if (await buttons.count()) await buttons.first().click()
    }
  }
  async function start(gameId, turno) {
    await shift(turno)
    await admin.getByRole('combobox', { name: 'Partida para iniciar', exact: true }).selectOption(gameId)
    await admin.getByRole('button', { name: 'Preparar partida', exact: true }).click()
    const dialog = admin.locator('.match-start-dialog')
    await dialog.waitFor()
    await dialog.getByRole('button', { name: /^Todos presentes.*equipe A$/ }).click()
    await dialog.getByRole('button', { name: /^Todos presentes.*equipe B$/ }).click()
    await dialog.getByRole('button', { name: 'Salvar e iniciar agora', exact: true }).click()
    await dialog.waitFor({ state: 'hidden', timeout: 30000 })
    const game = await read(`games/${gameId}`)
    assert.equal(game.fields.liveStatus.stringValue, 'live')
    assert.equal(game.fields.status.stringValue, 'encerrado')
  }
  const liveCard = (sport, a) => admin.locator('.live-control-grid > article').filter({ has: admin.getByRole('heading', { name: new RegExp(`^${a} ×`) }) }).filter({ hasText: sport })
  async function transmit(names) {
    const selector = admin.getByRole('region', { name: 'Escolher jogos do placar da TV', exact: true })
    const clear = selector.getByRole('button', { name: 'Limpar seleção', exact: true })
    if (await clear.isEnabled()) await clear.click()
    for (const name of names) await selector.getByRole('checkbox', { name, exact: true }).check()
    await selector.getByRole('button', { name: 'Transmitir seleção', exact: true }).click()
    await selector.getByText('Seleção publicada. A TV mostra somente estes jogos.', { exact: true }).waitFor()
  }
  async function waitScores(gameId, a, b) {
    await tv.waitForFunction(({ id, a, b }) => {
      const scores = [...(document.querySelector(`[data-game-id="${id}"]`)?.querySelectorAll('.sb-score') || [])].map((item) => item.textContent)
      return scores[0] === String(a) && scores[1] === String(b)
    }, { id: gameId, a, b }, { timeout: 20000 })
  }
  async function finish(card) {
    await card.getByRole('button', { name: 'Encerrar partida', exact: true }).click()
    await admin.getByRole('button', { name: 'Encerrar e publicar resultado', exact: true }).click()
    await admin.getByText('Jogo finalizado e pontuação recalculada.', { exact: true }).waitFor({ timeout: 45000 })
  }

  await start('ensaio-futebol', 'manha')
  await footballGuess.locator('.guess-form').waitFor({ state: 'hidden' })
  await transmit(['Transmitir Futebol: 9º A contra 9º B'])
  await waitScores('ensaio-futebol', 0, 0)
  record('Conferência de presença, início, bloqueio de palpites e seleção de um jogo para a TV')
  const football = liveCard('Futebol', '9º A')
  await football.getByRole('combobox', { name: 'Quem marcou para 9º A?', exact: true }).selectOption({ label: 'Ana Beatriz Silva' })
  await football.getByRole('button', { name: 'Adicionar gol para 9º A', exact: true }).click()
  await waitScores('ensaio-futebol', 1, 0)
  await tv.locator('.sb-incidents-team.is-A').getByText('Ana', { exact: true }).waitFor()
  await football.getByRole('button', { name: 'Adicionar gol para 9º A', exact: true }).click()
  await waitScores('ensaio-futebol', 2, 0)
  await football.getByRole('combobox', { name: 'Quem marcou para 9º B?', exact: true }).selectOption({ label: 'Carla Maria Ramos' })
  await football.getByRole('button', { name: 'Adicionar gol para 9º B', exact: true }).click()
  await waitScores('ensaio-futebol', 2, 1)
  await football.getByRole('button', { name: 'Adicionar gol para 9º A', exact: true }).click()
  await waitScores('ensaio-futebol', 3, 1)
  await football.getByRole('button', { name: 'Desfazer último lance', exact: true }).click()
  await waitScores('ensaio-futebol', 2, 1)
  record('Gols com autoria, primeiro nome na TV e desfazer gol')
  await football.getByRole('button', { name: 'Adicionar gol para 9º A', exact: true }).click()
  await waitScores('ensaio-futebol', 3, 1)
  await football.getByRole('button', { name: 'Equipe errada? Corrigir', exact: true }).click()
  await football.getByRole('combobox', { name: 'Autor na equipe 9º B', exact: true }).selectOption({ label: 'Diego Augusto Santos' })
  await football.getByRole('button', { name: 'Confirmar equipe correta', exact: true }).click()
  await waitScores('ensaio-futebol', 2, 2)
  await football.getByRole('button', { name: 'Excluir último gol de 9º B', exact: true }).click()
  await waitScores('ensaio-futebol', 2, 1)
  await football.getByRole('button', { name: 'Pausar cronômetro', exact: true }).click()
  await tv.locator('.sb-match-clock.is-paused').waitFor()
  const paused = await tv.locator('.sb-match-clock').innerText()
  await sleep(1200)
  assert.equal(await tv.locator('.sb-match-clock').innerText(), paused)
  await football.getByRole('button', { name: 'Retomar cronômetro', exact: true }).click()
  await tv.locator('.sb-match-clock.is-paused').waitFor({ state: 'hidden' })
  record('Correção de equipe e autor, exclusão de lance e pausa/retomada do cronômetro')
  await finish(football)
  await tv.locator('[data-game-id="ensaio-futebol"]').getByText('Resultado final', { exact: true }).waitFor()
  const professorUser = seeded.users.find((user) => user.email === 'professor@ensaio.local')
  for (const [email, points] of [['professor@ensaio.local', 4.2], ['parcial@ensaio.local', 3.6], ['vencedor@ensaio.local', 3], ['erro@ensaio.local', 0]]) {
    const user = seeded.users.find((item) => item.email === email)
    assert.equal(number(await read(`users/${user.uid}`), 'pontos'), points, email)
  }
  await professor.locator('.header-shortcuts').getByRole('button', { name: 'Classificação', exact: true }).click()
  await professor.getByRole('heading', { name: 'Classificação', exact: true }).waitFor()
  assert.match(await professor.locator('main').innerText(), /4,2/)
  record('Resultado final 2 × 1: ranking real com 4,2 / 3,6 / 3 / 0 pontos')

  await start('ensaio-handebol', 'tarde')
  const handball = liveCard('Handebol', '8º A')
  await transmit(['Transmitir Handebol: 8º A contra 8º B'])
  await handball.getByRole('button', { name: 'Abrir modo árbitro', exact: true }).click()
  const referee = admin.getByRole('dialog')
  await referee.getByRole('button', { name: 'Gol de Ana Beatriz Silva · equipe A', exact: true }).click()
  await waitScores('ensaio-handebol', 1, 0)
  await referee.getByRole('button', { name: 'Sair do modo árbitro', exact: true }).click()
  await adminContext.setOffline(true)
  await handball.getByText('Sem internet. Aguarde a conexão voltar antes de lançar ou corrigir pontos.', { exact: true }).waitFor()
  assert.equal(await handball.getByRole('button', { name: 'Gol de Ana Beatriz Silva · equipe A', exact: true }).isDisabled(), true)
  await adminContext.setOffline(false)
  record('Modo árbitro com autoria no handebol e bloqueio de lançamentos sem internet')
  await start('ensaio-basquete-1', 'tarde')
  await start('ensaio-basquete-2', 'tarde')
  await transmit(['Transmitir Basquete: 7º A contra 7º B', 'Transmitir Basquete: 6º A contra 6º B'])
  const basketball = liveCard('Basquete', '7º A')
  for (const points of [3, 2, 1]) {
    await basketball.getByRole('button', { name: `+${points} ${points === 1 ? 'ponto' : 'pontos'}`, exact: true }).click()
    await basketball.getByRole('button', { name: 'Ponto de Ana Beatriz Silva · equipe A', exact: true }).click()
  }
  await waitScores('ensaio-basquete-1', 6, 0)
  await liveCard('Basquete', '6º A').getByRole('button', { name: 'Ponto de Carla Maria Ramos · equipe B', exact: true }).click()
  await waitScores('ensaio-basquete-2', 0, 2)
  assert.equal(await tv.locator('.sb-match').count(), 2)
  assert.equal(await tv.locator('[data-game-id="ensaio-handebol"]').count(), 0)
  record('Dois jogos de basquete simultâneos; cestas de 1, 2 e 3 com autoria, sem mistura de placares')

  await start('ensaio-volei-1', 'manha')
  await start('ensaio-volei-2', 'manha')
  await transmit(['Transmitir Vôlei: 1º A contra 1º B', 'Transmitir Vôlei: 2º A contra 2º B'])
  const volleyball = liveCard('Vôlei', '1º A')
  for (const pointsB of [23, 19]) {
    for (let point = 0; point < 25; point += 1) {
      await volleyball.getByRole('button', { name: 'Ponto de Ana Beatriz Silva · equipe A', exact: true }).click()
      await volleyball.locator('.quick-team-A .quick-team-score strong').filter({ hasText: new RegExp(`^${point + 1}$`) }).waitFor()
    }
    for (let point = 0; point < pointsB; point += 1) {
      await volleyball.getByRole('button', { name: 'Ponto de Carla Maria Ramos · equipe B', exact: true }).click()
      await volleyball.locator('.quick-team-B .quick-team-score strong').filter({ hasText: new RegExp(`^${point + 1}$`) }).waitFor()
    }
    await waitScores('ensaio-volei-1', 25, pointsB)
    await volleyball.getByRole('button', { name: 'Encerrar set', exact: true }).click()
    await volleyball.getByRole('button', { name: 'Confirmar encerramento do set', exact: true }).click()
    console.log(`Conferido set de vôlei: 25 × ${pointsB}`)
  }
  await waitScores('ensaio-volei-1', 2, 0)
  assert.doesNotMatch(await tv.locator('[data-game-id="ensaio-volei-1"]').innerText(), /3º SET/)
  await finish(volleyball)
  assert.equal(number(await read(`users/${professorUser.uid}`), 'pontos'), 8.4)
  assert.equal(number(await read(`users/${professorUser.uid}`), 'acertosExatos'), 2)
  record('Dois jogos de vôlei; sets 25–23 e 25–19; resultado 2–0 e palpite pontuado em sets')

  const statistics = await tvContext.newPage()
  await statistics.goto(`${APP_ORIGIN}/#estatisticas`)
  await statistics.getByRole('heading', { name: 'Estatísticas individuais', exact: true }).waitFor()
  await statistics.getByRole('region', { name: 'Estatísticas individuais', exact: true }).getByText('Ana', { exact: true }).first().waitFor()
  const statsText = await statistics.locator('main').innerText()
  assert.doesNotMatch(statsText, /Beatriz Silva|Maria Ramos/)
  const finalFootball = await read('games/ensaio-futebol')
  const scorers = decode(finalFootball.fields.scorerStats)
  assert.equal(scorers.find((item) => item.side === 'A' && item.playerName === 'Ana').total, 2)
  assert.equal(scorers.find((item) => item.side === 'B' && item.playerName === 'Carla').total, 1)
  assert(!scorers.some((item) => item.playerName === 'Diego' && item.total > 0))
  record('Artilharia e estatísticas públicas corretas, sem sobrenomes ou lances removidos')

  await login(viewer, 'sesivinhedo')
  await viewer.getByRole('heading', { name: 'Jogos do Interclasse', exact: true }).waitFor()
  assert.deepEqual(await viewer.locator('.header-shortcuts button').allTextContents(), ['Calendário', 'Chaveamento', 'Simulador', 'Regulamentos', 'Estatísticas'])
  await viewer.goto(`${APP_ORIGIN}/#jogos`)
  await viewer.waitForFunction(() => location.hash === '#calendario')
  const loginToken = async (email) => {
    const response = await fetch(`${AUTH_ORIGIN}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-interclasse-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: REHEARSAL_PASSWORD, returnSecureToken: true }) })
    assert.equal(response.status, 200)
    const credential = await response.json()
    assert.equal(JSON.parse(Buffer.from(credential.idToken.split('.')[1], 'base64url')).aud, PROJECT)
    return credential.idToken
  }
  const viewerToken = await loginToken('sesivinhedo@interclasse-sesivinhedo.local')
  const denied = await fetch(`${base}/broadcastSettings/scoreboard?updateMask.fieldPaths=gameIds`, { method: 'PATCH', headers: { Authorization: `Bearer ${viewerToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { gameIds: { arrayValue: { values: [] } } } }) })
  assert.equal(denied.status, 403)
  const privateRoster = await fetch(`${base}/teams/ensaio-futebol-a/players`, { headers: { Authorization: `Bearer ${viewerToken}` } })
  assert.equal(privateRoster.status, 403)
  record('Conta de consulta restrita aos cinco menus e impedida de alterar o placar ou ler elencos privados')
  const professorToken = await loginToken('professor@ensaio.local')
  const cutoffId = 'ensaio-prazo'
  const cutoffUrl = `${base}/games/${cutoffId}`
  const cutoffFields = {
    sportId: { stringValue: 'esporte-futebol' }, esporteNome: { stringValue: 'Futebol' }, scoringMode: { stringValue: 'goals' },
    timeA: { stringValue: 'Prazo A' }, timeB: { stringValue: 'Prazo B' }, status: { stringValue: 'aberto' }, liveStatus: { stringValue: 'scheduled' }, matchCondition: { stringValue: 'normal' },
    dataHora: { timestampValue: new Date(Date.now() + 2 * 60000).toISOString() }, limitePalpites: { timestampValue: new Date(Date.now() - 3 * 60000).toISOString() },
  }
  await localRequest(cutoffUrl, { method: 'PATCH', body: JSON.stringify({ fields: cutoffFields }) })
  const predictionFields = {
    userId: { stringValue: professorUser.uid }, gameId: { stringValue: cutoffId }, nomeUsuario: { stringValue: professorUser.nome },
    palpiteA: { integerValue: '1' }, palpiteB: { integerValue: '0' }, pontos: { integerValue: '0' }, acertoExato: { booleanValue: false }, acertoResultado: { booleanValue: false },
    createdAt: { timestampValue: new Date().toISOString() }, updatedAt: { timestampValue: new Date().toISOString() },
  }
  const predictionUrl = `${base}/predictions/${professorUser.uid}_${cutoffId}`
  const sendPrediction = () => fetch(predictionUrl, { method: 'PATCH', headers: { Authorization: `Bearer ${professorToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: predictionFields }) })
  assert.equal((await sendPrediction()).status, 403, 'Server must deny guesses after the five-minute deadline')
  cutoffFields.dataHora.timestampValue = new Date(Date.now() + 35 * 60000).toISOString()
  cutoffFields.limitePalpites.timestampValue = new Date(Date.now() + 30 * 60000).toISOString()
  await localRequest(cutoffUrl, { method: 'PATCH', body: JSON.stringify({ fields: cutoffFields }) })
  assert.equal((await sendPrediction()).status, 200, 'Participant must be able to submit before the deadline')
  cutoffFields.status.stringValue = 'encerrado'
  cutoffFields.liveStatus.stringValue = 'live'
  await localRequest(cutoffUrl, { method: 'PATCH', body: JSON.stringify({ fields: cutoffFields }) })
  assert.equal((await sendPrediction()).status, 403, 'Server must deny guesses after kickoff even with a future deadline')
  const escalation = await fetch(`${base}/users/${professorUser.uid}?updateMask.fieldPaths=role`, { method: 'PATCH', headers: { Authorization: `Bearer ${professorToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { role: { stringValue: 'master' } } }) })
  assert.equal(escalation.status, 403)
  await localRequest(predictionUrl, { method: 'DELETE' })
  await localRequest(cutoffUrl, { method: 'DELETE' })
  record('Servidor bloqueia palpites após o prazo ou início, aceita antes do prazo e impede promoção indevida a master')
  assert.deepEqual(pageErrors, [])
  await admin.screenshot({ path: `${output}/operacao.png`, fullPage: true })
  await tv.screenshot({ path: `${output}/tv.png`, fullPage: true })
  record('Fluxo concluído com SDK e regras reais dos emuladores e acesso externo bloqueado')
  writeFileSync(`${output}/last-result.json`, JSON.stringify({ project: PROJECT, productionDataUntouched: true, executedAt: new Date().toISOString(), passed: results.length, results, blockedExternalRequests: [...new Set(blockedRequests)] }, null, 2))
  console.log(`\n${results.length} etapas integradas concluídas. Relatório: ${output}/last-result.json`)
} catch (error) {
  if (admin) await admin.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {})
  writeFileSync(`${output}/last-result.json`, JSON.stringify({ project: PROJECT, productionUntouched: true, executedAt: new Date().toISOString(), results, error: error.stack, pageErrors, blockedRequests }, null, 2))
  console.error(error.stack)
  process.exitCode = 1
} finally { await browser?.close() }
