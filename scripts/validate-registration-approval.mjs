import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { APP_ORIGIN, AUTH_ORIGIN, FIRESTORE_ORIGIN, PROJECT, REHEARSAL_PASSWORD, localRequest } from './rehearsal-data.mjs'
import { REGISTRATION_REVIEWER_EMAIL } from '../src/utils/registrationApproval.js'

// All accounts, writes and browser sessions in this validation belong to the local demo project.
assert.equal(PROJECT, 'demo-interclasse-ensaio')
const base = `${FIRESTORE_ORIGIN}/v1/projects/${PROJECT}/databases/(default)/documents`
const output = 'artifacts/rehearsal/registration-approval'
mkdirSync(output, { recursive: true })
const cases = []
const record = (name) => { cases.push(name); console.log(`OK · ${name}`) }
const fields = (values) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === 'boolean' ? { booleanValue: value } : typeof value === 'number' ? { integerValue: String(value) } : { stringValue: value }]))

async function request(path, token, options = {}, expected = 200) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal: AbortSignal.timeout(10000) })
  assert.equal(response.status, expected, `${path}: esperado ${expected}, recebido ${response.status}: ${response.status === expected ? '' : (await response.text()).slice(0, 300)}`)
  return response
}

async function authenticate(email, create = false) {
  const response = await fetch(`${AUTH_ORIGIN}/identitytoolkit.googleapis.com/v1/accounts:${create ? 'signUp' : 'signInWithPassword'}?key=demo-interclasse-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: REHEARSAL_PASSWORD, returnSecureToken: true }), signal: AbortSignal.timeout(10000),
  })
  const body = await response.json()
  if (create && body.error?.message === 'EMAIL_EXISTS') return authenticate(email)
  assert.equal(response.status, 200, `Conta local indisponível: ${email}`)
  assert.equal(JSON.parse(Buffer.from(body.idToken.split('.')[1], 'base64url')).aud, PROJECT)
  return { uid: body.localId, token: body.idToken, email }
}

const profile = (account, extra = {}) => ({ uid: account.uid, nome: 'Professor de validação', email: account.email, role: 'user', approvalStatus: 'pending', participaRanking: false, pontos: 0, acertosExatos: 0, acertosResultado: 0, ...extra })
const patch = (values) => ({ method: 'PATCH', body: JSON.stringify({ fields: fields(values) }) })
const writePrediction = (account) => request(`/predictions/${account.uid}_ensaio-futebol`, account.token, patch({ userId: account.uid, gameId: 'ensaio-futebol', nomeUsuario: 'Professor de validação', palpiteA: 2, palpiteB: 1, pontos: 0, acertoExato: false, acertoResultado: false }), 403)
const commitReview = (account, userId, extra = {}) => request(':commit', account.token, {
  method: 'POST', body: JSON.stringify({ writes: [{
    update: { name: `projects/${PROJECT}/databases/(default)/documents/users/${userId}`, fields: fields({ approvalStatus: 'approved', participaRanking: true, approvalReviewedBy: account.uid, ...extra }) },
    updateMask: { fieldPaths: ['approvalStatus', 'participaRanking', 'approvalReviewedBy', ...Object.keys(extra)] },
    updateTransforms: ['approvalReviewedAt', 'updatedAt'].map((fieldPath) => ({ fieldPath, setToServerValue: 'REQUEST_TIME' })),
  }] }),
}, 403)

const reviewer = await authenticate(REGISTRATION_REVIEWER_EMAIL, true)
const pending = await authenticate(`pendente-${Date.now()}@ensaio.local`, true)
const legacy = await authenticate(`anterior-${Date.now()}@ensaio.local`, true)
const master = await authenticate('suporte@bolao-sesivinhedo.local')
const teacher = await authenticate('professor@ensaio.local')
const viewer = await authenticate('sesivinhedo@interclasse-sesivinhedo.local')
await localRequest(`${base}/users/${reviewer.uid}`, patch(profile(reviewer, { nome: 'Guilherme · análise de cadastros' })))
const legacyProfile = profile(legacy, { nome: 'Cadastro anterior', participaRanking: true })
delete legacyProfile.approvalStatus
await localRequest(`${base}/users/${legacy.uid}`, patch(legacyProfile))

await request(`/users/${pending.uid}`, pending.token, patch(profile(pending, { approvalStatus: 'approved', participaRanking: true })), 403)
await request(`/users/${pending.uid}`, pending.token, patch(profile(pending, { email: REGISTRATION_REVIEWER_EMAIL })), 403)
await request(`/users/${pending.uid}`, pending.token, patch(profile(pending, { approvalReviewedBy: reviewer.uid })), 403)
await request(`/users/${pending.uid}`, pending.token, patch(profile(pending)))
record('Cadastro só pode nascer pendente, sem aprovação própria, identidade forjada ou campos de análise')

for (const account of [pending, legacy]) {
  await request(`/users/${account.uid}`, account.token)
  for (const path of ['/games/ensaio-futebol', '/games', '/sports', '/teams', '/broadcastSettings', '/users', '/predictions']) await request(path, account.token, {}, 403)
  await writePrediction(account)
  await request(`/users/${account.uid}?updateMask.fieldPaths=approvalStatus&updateMask.fieldPaths=participaRanking`, account.token, patch({ approvalStatus: 'approved', participaRanking: true }), 403)
}
record('Pendentes e cadastros anteriores sem análise só leem o próprio perfil e não conseguem enviar palpites')

for (const account of [pending, master, teacher, viewer]) await commitReview(account, pending.uid)
await commitReview(reviewer, pending.uid, { role: 'master' })
await commitReview(reviewer, pending.uid, { pontos: 999 })
await commitReview(reviewer, pending.uid, { approvalReviewedBy: master.uid })
await request(`/users/${pending.uid}?updateMask.fieldPaths=approvalStatus&updateMask.fieldPaths=participaRanking`, reviewer.token, patch({ approvalStatus: 'approved', participaRanking: true }), 403)
await request('/games/ensaio-futebol?updateMask.fieldPaths=status', reviewer.token, patch({ status: 'finalizado' }), 403)
await request('/users', reviewer.token)
record('Apenas Guilherme analisa cadastros, com data e autoria obrigatórias, sem ganhar acesso à administração ou alterar pontuações')

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const pageErrors = []
try {
  const managerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Sao_Paulo', colorScheme: 'light' })
  const participantContext = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Sao_Paulo', colorScheme: 'light' })
  for (const context of [managerContext, participantContext]) {
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url())
      return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort()
    })
    context.on('page', (page) => page.on('pageerror', (error) => pageErrors.push(error.message)))
  }
  const managerPage = await managerContext.newPage()
  await managerPage.goto(`${APP_ORIGIN}/#login`)
  await managerPage.getByLabel('E-mail ou login').fill(reviewer.email)
  await managerPage.getByLabel('Senha', { exact: true }).fill(REHEARSAL_PASSWORD)
  await managerPage.getByRole('button', { name: 'Entrar', exact: true }).click()
  await managerPage.getByRole('heading', { name: 'Aprovar cadastros', exact: true }).waitFor()
  await managerPage.getByText(legacy.email, { exact: true }).waitFor()
  await managerPage.screenshot({ path: `${output}/cadastros-desktop.png`, fullPage: true })
  record('Guilherme acessa a tela de análise sem ser master e encontra os cadastros novos e anteriores')

  const participantPage = await participantContext.newPage()
  const email = `professora-interface-${Date.now()}@ensaio.local`
  await participantPage.goto(`${APP_ORIGIN}/#cadastro`)
  await participantPage.getByLabel('Nome', { exact: true }).fill('Professora da interface')
  await participantPage.getByLabel('E-mail', { exact: true }).fill(email)
  await participantPage.getByLabel('Senha', { exact: true }).fill(REHEARSAL_PASSWORD)
  await participantPage.getByRole('button', { name: 'Cadastrar', exact: true }).click()
  await participantPage.getByRole('heading', { name: 'Aguardando aprovação', exact: true }).waitFor()
  const applicant = await authenticate(email)
  const stored = await (await request(`/users/${applicant.uid}`, applicant.token)).json()
  assert.equal(stored.fields.approvalStatus.stringValue, 'pending')
  assert.equal(stored.fields.participaRanking.booleanValue, false)
  await participantPage.screenshot({ path: `${output}/cadastro-pendente-celular.png`, fullPage: true })
  for (const view of ['jogos', 'palpites', 'classificacao', 'tv', 'placar', 'cadastros']) {
    await participantPage.goto(`${APP_ORIGIN}/?modo=palpite#${view}`)
    await participantPage.getByRole('heading', { name: 'Aguardando aprovação', exact: true }).waitFor()
    assert.equal(await participantPage.getByRole('button', { name: 'Enviar palpite', exact: true }).count(), 0)
  }
  record('Cadastro real pela interface fica pendente e não abre jogos, ranking, TV ou aprovação por links diretos e modo rápido')

  await managerPage.getByLabel('Buscar por nome ou e-mail').fill(email)
  const card = managerPage.locator('.registration-card').filter({ hasText: email })
  await card.getByRole('button', { name: 'Aprovar professor', exact: true }).click()
  await managerPage.getByRole('dialog').getByRole('button', { name: 'Confirmar aprovação', exact: true }).click()
  await managerPage.getByRole('status').filter({ hasText: 'cadastro aprovado' }).waitFor()
  await participantPage.getByRole('heading', { name: 'Faça seu palpite', exact: true }).waitFor()
  await request('/games/ensaio-futebol', applicant.token)
  await request(`/predictions/${applicant.uid}_ensaio-futebol`, applicant.token, patch({ userId: applicant.uid, gameId: 'ensaio-futebol', nomeUsuario: 'Professora da interface', palpiteA: 2, palpiteB: 1, pontos: 0, acertoExato: false, acertoResultado: false }))
  const approved = await (await request(`/users/${applicant.uid}`, applicant.token)).json()
  assert.equal(approved.fields.approvalReviewedBy.stringValue, reviewer.uid)
  assert(approved.fields.approvalReviewedAt.timestampValue)
  const ranking = { structuredQuery: { from: [{ collectionId: 'users' }], where: { compositeFilter: { op: 'AND', filters: [['role', { stringValue: 'user' }], ['approvalStatus', { stringValue: 'approved' }], ['participaRanking', { booleanValue: true }]].map(([fieldPath, value]) => ({ fieldFilter: { field: { fieldPath }, op: 'EQUAL', value } })) } } } }
  const ranked = await (await request(':runQuery', applicant.token, { method: 'POST', body: JSON.stringify(ranking) })).json()
  assert(ranked.some((item) => item.document?.fields?.uid?.stringValue === applicant.uid))
  assert(!ranked.some((item) => item.document?.fields?.uid?.stringValue === legacy.uid))
  record('Aprovar libera a sessão aberta automaticamente, registra a análise e permite palpites e ranking no servidor')

  await managerPage.getByRole('button', { name: /^Aprovados/ }).click()
  await card.getByRole('button', { name: 'Recusar e bloquear', exact: true }).click()
  await managerPage.getByRole('dialog').getByRole('button', { name: 'Confirmar recusa', exact: true }).click()
  await participantPage.getByRole('heading', { name: 'Cadastro recusado', exact: true }).waitFor()
  await participantPage.screenshot({ path: `${output}/cadastro-recusado-celular.png`, fullPage: true })
  await writePrediction(applicant)
  await request(`/predictions/${applicant.uid}_ensaio-futebol`, applicant.token, {}, 403)
  await request('/games', applicant.token, {}, 403)
  const rankedAfter = await (await request(':runQuery', teacher.token, { method: 'POST', body: JSON.stringify(ranking) })).json()
  assert(!rankedAfter.some((item) => item.document?.fields?.uid?.stringValue === applicant.uid))
  record('Recusar uma aprovação bloqueia imediatamente a sessão e o banco, e remove a pessoa do ranking')

  await managerPage.getByRole('button', { name: /^Recusados/ }).click()
  await managerPage.setViewportSize({ width: 390, height: 844 })
  await managerPage.screenshot({ path: `${output}/cadastros-celular.png`, fullPage: true })
  assert.equal(await managerPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
  await card.getByRole('button', { name: 'Aprovar professor', exact: true }).click()
  await managerPage.getByRole('dialog').getByRole('button', { name: 'Confirmar aprovação', exact: true }).click()
  await participantPage.getByRole('heading', { name: 'Faça seu palpite', exact: true }).waitFor()
  await request(`/predictions/${applicant.uid}_ensaio-futebol`, applicant.token)
  record('É possível rever uma recusa pelo celular, liberando novamente a participação e preservando o palpite anterior')

  await localRequest(`${base}/users/${reviewer.uid}?updateMask.fieldPaths=role`, patch({ role: 'master' }))
  await managerPage.setViewportSize({ width: 1440, height: 1000 })
  await managerPage.locator('.header-shortcuts').getByRole('button', { name: 'Painel master', exact: true }).click()
  await managerPage.getByRole('heading', { name: 'Painel master', exact: true }).waitFor()
  await managerPage.getByRole('navigation', { name: 'Seções do painel master' }).getByRole('button', { name: /^Cadastros \/ professores/ }).click()
  await managerPage.getByRole('heading', { name: 'Aprovar cadastros', exact: true }).waitFor()
  record('A mesma análise também está disponível em Painel master → Cadastros / professores')
  assert.deepEqual(pageErrors, [])
  writeFileSync(`${output}/result.json`, JSON.stringify({ project: PROJECT, executedAt: new Date().toISOString(), passed: cases.length, productionDataUntouched: true, cases }, null, 2))
  console.log(`${cases.length} etapas aprovadas com autenticação, regras reais e interface no ambiente local.`)
} finally {
  await browser.close()
}
