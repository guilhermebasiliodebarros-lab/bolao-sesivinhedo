import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { APP_ORIGIN, AUTH_ORIGIN, FIRESTORE_ORIGIN, PROJECT, REHEARSAL_PASSWORD, localRequest } from './rehearsal-data.mjs'
import { fields, record as decode } from './lib/firestore-rest.mjs'
import { predictionPlayerKey } from '../src/utils/predictionPlayers.js'

const output = 'artifacts/rehearsal/top-scorer'
mkdirSync(output, { recursive: true })
const base = `${FIRESTORE_ORIGIN}/v1/projects/${PROJECT}/databases/(default)/documents`
const results = [], errors = []
const record = (name) => { results.push(name); console.log('OK · ' + name) }
const put = (path, value) => localRequest(`${base}/${path}`, { method: 'PATCH', body: JSON.stringify({ fields: fields(value) }) })
const patch = (path, value) => localRequest(`${base}/${path}?${Object.keys(value).map((key) => 'updateMask.fieldPaths=' + encodeURIComponent(key)).join('&')}`, { method: 'PATCH', body: JSON.stringify({ fields: fields(value) }) })
const read = async (path) => { try { return decode(await localRequest(`${base}/${path}`)) } catch (error) { if (error.message.includes('404')) return null; throw error } }
const poll = async (action, check) => { for (let attempt = 0; attempt < 120; attempt++) { const value = await action(); if (check(value)) return value; await new Promise((done) => setTimeout(done, 250)) } throw new Error('A atualização esperada não chegou ao banco de ensaio.') }
const signIn = async (email) => {
  const response = await fetch(`${AUTH_ORIGIN}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-interclasse-key`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email,password:REHEARSAL_PASSWORD,returnSecureToken:true}) })
  assert.equal(response.status,200)
  return response.json()
}
const participant = await signIn('professor@ensaio.local')
const authed = (path, options = {}, token = participant.idToken) => fetch(`${base}/${path}`, { ...options, headers: { 'Content-Type':'application/json', ...(token ? {Authorization:'Bearer '+token} : {}) } })
const basketball = 'ensaio-basquete-1', volleyball = 'ensaio-volei-1'
const a = `${basketball}-a`, b = `${basketball}-b`, pa = `${a}-p1`, pb = `${b}-p1`
const chosen = predictionPlayerKey(b,pb)
const beforeBasket = await read(`games/${basketball}`)
assert.equal(beforeBasket.status,'aberto','Reinicie o ensaio antes de repetir esta validação.')
const roster = await poll(()=>read(`teams/${a}/public/predictionPlayers`),value=>value?.players?.length===2)
assert.equal(roster.players.length,2,'Sincronize os elencos existentes com sync-prediction-rosters.mjs antes de testar.')
assert.deepEqual(Object.keys(roster.players[0]).sort(),['id','nome'])
assert.equal((await authed(`teams/${a}/public/predictionPlayers`)).status,200)
assert.equal((await authed(`teams/${a}/players`)).status,403)
assert.equal((await authed(`teams/${a}/public/predictionPlayers`,{},'')).status,403)
const viewer=await signIn('sesivinhedo@interclasse-sesivinhedo.local')
assert.equal((await authed(`teams/${a}/public/predictionPlayers`,{},viewer.idToken)).status,403)
assert.equal((await authed(`teams/${a}/public/predictionPlayers`,{method:'PATCH',body:JSON.stringify({fields:fields({players:[]})})})).status,403)
record('Acesso: participantes veem somente nomes e IDs; elencos privados, visitantes, consulta e escritas continuam bloqueados')

const blank = { sportId:'esporte-basquete',esporteNome:'Basquete',scoringMode:'points',turno:'tarde',fase:'Fase de grupos',timeA:'6º A',timeB:'6º B',teamIdA:'qa-empty-a',teamIdB:'qa-empty-b',status:'aberto',dataHora:new Date(Date.now()+7200000),limitePalpites:new Date(Date.now()+6900000) }
for(const [id,nome] of [['qa-empty-a','6º A'],['qa-empty-b','6º B']]) await put(`teams/${id}`,{sportId:blank.sportId,esporteNome:blank.esporteNome,turno:'tarde',nome,turma:nome,playerCount:0,updatedAt:new Date()})
await put('games/qa-empty',blank)

const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true})
let active
const paidRequests = []
async function pageFor(viewport, mode, username = 'professor@ensaio.local') {
  const context=await browser.newContext({viewport,timezoneId:'America/Sao_Paulo'})
  await context.addInitScript((mode)=>localStorage.setItem('bolao:prediction-mode:guest',mode),mode)
  await context.route('**/*',route=>{ const url=new URL(route.request().url()); if(url.port==='5002'||url.hostname.endsWith('cloudfunctions.net')) paidRequests.push(url.pathname); return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.abort() })
  const page=await context.newPage();active=page
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto(APP_ORIGIN+'/#login')
  await page.locator('input[autocomplete="username"]').fill(username)
  await page.locator('input[autocomplete="current-password"]').fill(REHEARSAL_PASSWORD)
  await page.getByRole('button',{name:'Entrar',exact:true}).click()
  await page.locator('.header-shortcuts, .quick-app-header').first().waitFor({timeout:45000})
  return page
}
try {
  const operator=await pageFor({width:1440,height:1000},'full','suporte')
  await operator.getByRole('navigation',{name:'Seções do painel master'}).waitFor()
  await poll(()=>read('teams/qa-empty-a/public/predictionPlayers'),value=>Array.isArray(value?.players))
  const page=await pageFor({width:1440,height:1050},'full')
  await page.goto(APP_ORIGIN+'/#jogos')
  const card=page.locator('#game-'+basketball)
  const picker=card.locator('.prediction-player-picker select')
  await picker.locator('option').filter({hasText:'Carla Maria Ramos'}).waitFor({state:'attached'})
  assert.equal(await picker.locator('optgroup').count(),2)
  assert.equal(await picker.locator('option').count(),5)
  assert.equal(await page.locator('#game-ensaio-futebol .prediction-player-picker').count(),0)
  await card.locator('.guess-form input').nth(0).fill('3');await card.locator('.guess-form input').nth(1).fill('2')
  await picker.selectOption(chosen)
  await page.reload()
  await picker.locator('option').filter({hasText:'Carla Maria Ramos'}).waitFor({state:'attached'})
  assert.equal(await picker.inputValue(),chosen)
  assert.equal(await card.locator('.guess-form input').nth(0).inputValue(),'3')
  await card.getByRole('button',{name:'Enviar',exact:true}).click()
  await card.getByText('Palpite salvo com sucesso.',{exact:true}).waitFor()
  const path=`predictions/${participant.localId}_${basketball}`
  let saved=await read(path)
  assert.equal(saved.topScorerPlayerId,pb);assert.equal(saved.topScorerTeamId,b);assert.equal(saved.topScorerSide,'B');assert.equal(saved.topScorerName,'Carla Maria Ramos')
  await picker.selectOption(predictionPlayerKey(a,pa))
  await card.getByRole('button',{name:'Atualizar',exact:true}).click()
  await poll(()=>read(path),value=>value.topScorerPlayerId===pa)
  await picker.selectOption(chosen)
  await card.getByRole('button',{name:'Atualizar',exact:true}).click()
  await poll(()=>read(path),value=>value.topScorerPlayerId===pb)
  await card.locator('.prediction-player-summary').getByText('Carla Maria Ramos',{exact:true}).waitFor()
  await card.scrollIntoViewIfNeeded();await page.evaluate(()=>window.scrollBy(0,-160))
  await page.screenshot({path:output+'/desktop.png'})
  record('Lista completa: nomes por sala, rascunho recuperado após recarregar, envio e edição salvos com IDs estáveis')

  const forged=async(value)=>authed(path,{method:'PATCH',body:JSON.stringify({fields:fields(value)})})
  saved=await read(path);delete saved.id
  for(const mutation of [{topScorerPlayerId:'inexistente'},{topScorerSide:'A'},{topScorerName:'Nome inventado'},{topScorerTeamId:'ensaio-basquete-2-b',topScorerPlayerId:'ensaio-basquete-2-b-p1'},{acertoPontuador:true},{pontos:2}]) assert.equal((await forged({...saved,...mutation})).status,403)
  assert.equal((await authed(`users/${participant.localId}?updateMask.fieldPaths=acertosPontuador`,{method:'PATCH',body:JSON.stringify({fields:fields({acertosPontuador:90})})})).status,403)
  record('Regras: bloqueados aluno inexistente, outra equipe, lado incorreto, nome inventado e alteração dos pontos ou bônus pelo participante')

  const empty=page.locator('#game-qa-empty'),emptyPicker=empty.locator('.prediction-player-picker select')
  await empty.getByText(/A organização ainda não cadastrou jogadores/).waitFor()
  await empty.locator('.guess-form input').nth(0).fill('1');await empty.locator('.guess-form input').nth(1).fill('0')
  await empty.getByRole('button',{name:'Enviar',exact:true}).click()
  await empty.getByText('Palpite salvo com sucesso.',{exact:true}).waitFor()
  await operator.evaluate(async()=>{const {savePlayer}=await import('/src/services/firestoreService.js');await savePlayer('qa-empty-a',{nome:'Aluna Nova Cadastrada',posicao:'Titular'})})
  await emptyPicker.locator('option').filter({hasText:'Aluna Nova Cadastrada'}).waitFor({state:'attached',timeout:45000})
  const newStudent=(await read('teams/qa-empty-a/public/predictionPlayers')).players[0]
  assert.equal(newStudent.privateNotes,undefined)
  await emptyPicker.selectOption(predictionPlayerKey('qa-empty-a',newStudent.id))
  await operator.evaluate(async(id)=>{const {savePlayer}=await import('/src/services/firestoreService.js');await savePlayer('qa-empty-a',{id,nome:'Aluna Renomeada',posicao:'Titular'})},newStudent.id)
  await emptyPicker.locator('option').filter({hasText:'Aluna Renomeada'}).waitFor({state:'attached',timeout:45000})
  await operator.evaluate(async(id)=>{const {deletePlayer}=await import('/src/services/firestoreService.js');await deletePlayer('qa-empty-a',id)},newStudent.id)
  await empty.getByText('O aluno escolhido não está mais neste elenco.',{exact:false}).waitFor({timeout:45000})
  await empty.getByRole('button',{name:'Retirar escolha do aluno',exact:true}).click()
  await empty.getByRole('button',{name:'Atualizar',exact:true}).click()
  record('Sem elenco: placar pode ser enviado; cadastrar, renomear e excluir aluno atualiza a lista em tempo real sem publicar dados privados')

  const mobile=await pageFor({width:390,height:1000},'quick')
  await mobile.goto(APP_ORIGIN+'/?modo=palpite#jogos')
  const filter=async()=>{await mobile.getByText('Escolher jogo ou filtrar',{exact:true}).click();await mobile.locator('.quick-filters select').nth(0).selectOption('esporte-volei')}
  await filter()
  const mobileCard=mobile.locator('.quick-prediction-card[aria-label="1º A contra 1º B"]')
  await mobileCard.waitFor()
  await mobileCard.getByRole('button',{name:/0 × 2/}).click()
  const mobilePicker=mobileCard.locator('.prediction-player-picker select')
  const volleyPlayer=predictionPlayerKey(volleyball+'-b',volleyball+'-b-p1')
  await mobilePicker.selectOption(volleyPlayer)
  await mobile.reload();await mobile.locator('.quick-prediction-card').waitFor();await filter()
  await mobilePicker.locator('option').filter({hasText:'Carla Maria Ramos'}).waitFor({state:'attached'})
  assert.equal(await mobilePicker.inputValue(),volleyPlayer)
  assert.equal(await mobile.locator('.quick-prediction-card').count(),1)
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true)
  await mobile.screenshot({path:output+'/mobile.png',fullPage:true})
  await mobileCard.getByRole('button',{name:'Enviar palpite',exact:true}).click()
  await poll(()=>read(`predictions/${participant.localId}_${volleyball}`),value=>value?.topScorerPlayerId===volleyball+'-b-p1')
  await mobile.getByRole('button',{name:/Enviados/}).click()
  await mobile.getByRole('button',{name:'Editar palpite',exact:true}).click()
  assert.equal(await mobilePicker.inputValue(),volleyPlayer)
  await mobileCard.getByRole('button',{name:'Atualizar palpite',exact:true}).click()
  record('Celular: vôlei mantém um jogo por vez, recupera escolha e sets, envia e permite editar o aluno escolhido')

  for(const [index,email] of ['parcial@ensaio.local','vencedor@ensaio.local','erro@ensaio.local'].entries()){
    const account=await signIn(email),correctStudent=index===0
    const value={userId:account.localId,gameId:basketball,nomeUsuario:'Participante de ensaio',palpiteA:index===2?3:2,palpiteB:index===2?2:3,pontos:0,acertoExato:false,acertoResultado:false,acertoPontuador:false,topScorerTeamId:correctStudent?b:a,topScorerPlayerId:correctStudent?pb:pa,topScorerSide:correctStudent?'B':'A',topScorerName:correctStudent?'Carla Maria Ramos':'Ana Beatriz Silva',createdAt:new Date(),updatedAt:new Date()}
    assert.equal((await authed(`predictions/${account.localId}_${basketball}`,{method:'PATCH',body:JSON.stringify({fields:fields(value)})},account.idToken)).status,200)
  }
  await patch(`games/${basketball}`,{status:'encerrado',liveStatus:'live',liveScoreA:3,liveScoreB:7,eventsAdjusted:false,scorerStats:[{side:'A',playerId:pa,playerName:'Ana',total:3},{side:'B',playerId:pb,playerName:'Carla',total:7}],updatedAt:new Date()})
  await operator.evaluate(async(gameId)=>{const {finalizeGame}=await import('/src/services/firestoreService.js');const {auth}=await import('/src/services/firebase.js');await finalizeGame({gameId,placarA:3,placarB:7,user:auth.currentUser})},basketball)
  await poll(()=>read(path),value=>value.pontos===1&&value.acertoPontuador===true&&value.acertoResultado===false)
  await poll(async()=>{const items=(await localRequest(base+'/predictions?pageSize=1000')).documents.map(decode).filter(value=>value.gameId===basketball);return items.map(value=>value.pontos).sort()},value=>JSON.stringify(value)==='[0,1,1,2]')
  assert.equal((await read(`users/${participant.localId}`)).acertosPontuador,1)
  await patch(`games/${volleyball}`,{status:'encerrado',liveStatus:'live',liveScoreA:2,liveScoreB:0,setScores:[{a:25,b:17},{a:25,b:20}],currentSet:{a:0,b:0},eventsAdjusted:false,scorerStats:[{side:'A',playerId:volleyball+'-a-p1',playerName:'Ana',total:9},{side:'B',playerId:volleyball+'-b-p1',playerName:'Carla',total:11}],updatedAt:new Date()})
  await operator.evaluate(async(gameId)=>{const {finalizeGame}=await import('/src/services/firestoreService.js');const {auth}=await import('/src/services/firebase.js');await finalizeGame({gameId,placarA:2,placarB:0,user:auth.currentUser})},volleyball)
  await poll(()=>read(`predictions/${participant.localId}_${volleyball}`),value=>value.pontos===1&&value.acertoPontuador===true&&value.acertoResultado===false)
  record('Plano gratuito: finalizar pelo site apura 0, 1 ou 2 pontos e atualiza o ranking, inclusive aluno da sala perdedora no vôlei')
  await patch(`games/${basketball}`,{scorerStats:[{side:'A',playerId:pa,playerName:'Ana',total:9},{side:'B',playerId:pb,playerName:'Carla',total:7}],updatedAt:new Date()})
  await poll(()=>read(path),value=>value.pontos===0&&value.acertoPontuador===false)
  assert.equal((await forged({...saved,topScorerTeamId:a,topScorerPlayerId:pa,topScorerSide:'A',topScorerName:'Ana Beatriz Silva'})).status,403)
  record('Correção dos pontos por aluno recalcula o bônus; partida encerrada recusa edição do palpite')
  await operator.close()
  await patch(`games/${basketball}`,{scorerStats:[{side:'A',playerId:pa,playerName:'Ana',total:3},{side:'B',playerId:pb,playerName:'Carla',total:7}],updatedAt:new Date()})
  assert.equal((await read(path)).pontos,0)
  const resumed=await pageFor({width:1200,height:900},'full','suporte')
  await poll(()=>read(path),value=>value.pontos===1&&value.acertoPontuador===true)
  record('Retomar a conta da organização recupera apuração pendente sem servidor de funções')
  const otherOperator=await pageFor({width:1200,height:900},'full','suporte')
  const run=page=>page.evaluate(async()=>{const {recalculateScores}=await import('/src/services/firestoreService.js');return recalculateScores()})
  const parallel=await Promise.all([run(resumed),run(otherOperator)])
  assert(parallel.every(result=>result.complete))
  assert.equal((await read(path)).pontos,1)
  assert.equal((await read('system/scoring')).status,'complete')
  record('Dois operadores simultâneos concluem a apuração sem somar pontos em duplicidade')
  assert.deepEqual(paidRequests,[])
  record('Nenhuma chamada a Cloud Functions; validação executada somente com autenticação e banco gratuitos')
  assert.deepEqual(errors,[])
  writeFileSync(output+'/report.json',JSON.stringify({results,errors},null,2))
}catch(error){await active?.screenshot({path:output+'/failure.png',fullPage:true}).catch(()=>{});writeFileSync(output+'/report.json',JSON.stringify({results,errors,failure:error.stack},null,2));throw error}finally{await browser.close()}
