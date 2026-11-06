const { chromium } = require(process.env.LOCALAPPDATA + '/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const fixture = `
export * from '/src/services/firestoreService.js';
import {applyLiveEvent} from '/src/utils/liveEvents.js';
const sports = ['Futebol','Vôlei','Basquete','Xadrez'].map((nome,i)=>({id:'s'+i,nome,regulation:{participation:'Regra salva da organização. Ação e classificação.',classification:'',tieBreak:'',walkover:'',notes:''},regulationRevision:1,regulationUpdatedAt:'2026-11-06T12:00:00Z'}));
let games = sports.map((s,i)=>({id:'g'+i,sportId:s.id,esporteNome:s.nome,turno:'manha',timeA:'9ºA',timeB:'9ºB',teamIdA:'a'+i,teamIdB:'b'+i,turmaA:'9ºA',turmaB:'9ºB',status:'encerrado',liveStatus:'live',liveScoreA:0,liveScoreB:0,scoreRevision:0,matchCondition:'normal',dataHora:'2026-11-06T10:00',startedAt:new Date().toISOString(),durationMinutes:30,venue:'Quadra',venueArea:s.nome,vestA:'Azul',vestB:'Vermelho',clock:{elapsedMs:0,runningSince:new Date().toISOString(),revision:0},currentSet:{a:0,b:0},setScores:[],liveEvents:[],scorerStats:[],fase:'Fase de grupos',tournamentName:'Interclasse'}));
const teams = games.flatMap((g,i)=>[{id:'a'+i,nome:g.timeA,turno:'manha',turma:'9ºA',sportId:g.sportId,playerCount:1},{id:'b'+i,nome:g.timeB,turno:'manha',turma:'9ºB',sportId:g.sportId,playerCount:1}]);
const sl = new Set(), gl = new Set();
const emitSports = () => sl.forEach(cb=>cb([...sports]));
const emitGames = () => gl.forEach(cb=>cb([...games]));
export function subscribeSports(cb){sl.add(cb);cb([...sports]);return ()=>sl.delete(cb)}
export function subscribeGames(cb){gl.add(cb);cb([...games]);return ()=>gl.delete(cb)}
export function subscribeTeams(cb){cb(teams);return ()=>{}}
export function subscribeParticipants(cb){cb([]);return ()=>{}}
export function subscribeAllPredictions(cb){cb([]);return ()=>{}}
export async function saveSportRegulation(id,value,revision){const s=sports.find(s=>s.id===id);if(revision!==s.regulationRevision)throw Error('Versão alterada');s.regulation=value;s.regulationRevision++;emitSports();return s.regulationRevision}
export async function loadMatchReport(){return {attendance:{A:{players:[{id:'pa',nome:'Ana Beatriz',status:'present'}]},B:{players:[{id:'pb',nome:'Bruno Silva',status:'present'}]}},report:{},playersA:[],playersB:[]}}
const undo = new Map();
export async function recordLiveEvent(input){const g=games.find(g=>g.id===input.gameId);if(g.scoreRevision!==input.expectedScoreRevision)throw Error('Versão alterada');const result=applyLiveEvent(g,input,{player:input.playerId?{id:input.playerId,nome:input.side==='A'?'Ana Beatriz':'Bruno Silva'}:null,now:new Date()});undo.set(g.id,result.before);Object.assign(g,result.after,{scoreRevision:g.scoreRevision+1});emitGames()}
export async function undoLiveEvent(input){const g=games.find(g=>g.id===input.gameId);Object.assign(g,undo.get(g.id),{scoreRevision:g.scoreRevision+1});emitGames()}
export async function controlMatchClock(input){const g=games.find(g=>g.id===input.gameId);g.clock={elapsedMs:3000,runningSince:input.action==='pause'?null:new Date().toISOString(),revision:g.clock.revision+1};emitGames()}
export async function finalizeGame(input){const g=games.find(g=>g.id===input.gameId);if(g.scoreRevision!==input.expectedScoreRevision)throw Error('Versão alterada');Object.assign(g,{status:'finalizado',liveStatus:'finished',placarA:Number(input.placarA),placarB:Number(input.placarB)});emitGames()}
window.__qa={sports,games,updateSport(){sports[0].regulationRevision++;sports[0].regulation={...sports[0].regulation,participation:'Versão nova em outro dispositivo'};emitSports()},finish(id){Object.assign(games.find(g=>g.id===id),{status:'finalizado',liveStatus:'finished',placarA:1,placarB:0});emitGames()}};
`
;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Sao_Paulo', acceptDownloads: true })
    await context.route('**/src/context/useAuth.js*', route => route.fulfill({ contentType:'application/javascript', body:"const value={user:{uid:'qa-master'},profile:{role:'master',nome:'QA'},isMaster:true,isParticipant:false,loading:false,profileLoading:false};export function useAuth(){return value}" }))
    await context.route('**/src/services/bolaoService.js*', route => route.fulfill({ contentType:'application/javascript', body:fixture }))
    await context.route('**/firestore.googleapis.com/**', route => route.abort())
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => console.log('browser:',message.type(),message.text().slice(0,220)))
    page.on('dialog', dialog => dialog.accept())
    await page.goto('http://127.0.0.1:5175/#admin')
    const nav = page.getByRole('navigation', {name:'Seções do painel master'})
    await nav.getByRole('button',{name:/^Regulamentos/}).click()
    const input = page.getByRole('textbox',{name:/Participação e organização/})
    await input.fill('Rascunho local ainda privado')
    await page.getByRole('combobox',{name:'Modalidade do regulamento'}).selectOption('s1')
    assert.equal(await page.getByRole('textbox',{name:/Participação e organização/}).inputValue(),'Regra salva da organização. Ação e classificação.')
    await page.getByRole('combobox',{name:'Modalidade do regulamento'}).selectOption('s0')
    assert.equal(await input.inputValue(),'Rascunho local ainda privado')
    await page.reload()
    await nav.getByRole('button',{name:/^Regulamentos/}).click()
    assert.equal(await input.inputValue(),'Rascunho local ainda privado')
    await page.evaluate(()=>window.__qa.updateSport())
    await page.getByText('Há uma versão salva mais recente.',{exact:false}).waitFor()
    assert.equal(await page.getByRole('button',{name:'Salvar regulamento',exact:true}).isDisabled(),true)
    await page.getByRole('button',{name:'Manter meu texto para revisar e salvar'}).click()
    await page.getByRole('button',{name:'Salvar regulamento',exact:true}).click()
    await page.getByText('Regulamento salvo. Alunos',{exact:false}).waitFor()
    assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes('regulation-draft')).length),0)
    await input.fill('Descartar este texto')
    await page.getByRole('button',{name:'Recarregar dados salvos'}).click()
    assert.equal(await input.inputValue(),'Descartar este texto')
    await page.getByRole('button',{name:'Descartar rascunho',exact:true}).click()
    assert.equal(await input.inputValue(),'Rascunho local ainda privado')
    const long = 'Texto longo com acentuação e organização. '.repeat(260).slice(0,9990)+'FIMSECAO'
    const boxes=page.locator('.regulation-editor textarea')
    for(let i=0;i<5;i++)await boxes.nth(i).fill(long)
    await nav.getByRole('button',{name:/^Esportes/}).click()
    await nav.getByRole('button',{name:/^Regulamentos/}).click()
    for(let i=0;i<5;i++)assert.equal(await boxes.nth(i).inputValue(),long)
    await page.getByRole('button',{name:'Salvar regulamento',exact:true}).click()
    await page.getByText('Regulamento salvo. Alunos',{exact:false}).waitFor()
    console.log('Draft recovery, isolation, stale revision, explicit discard and 50k text: OK')
    if (!process.env.QA_SKIP_PDF) {
    const pdfInfo = await page.evaluate(async()=>{
      console.log('PDF start')
      const {createRegulationsPDF}=await import('/src/services/regulationsPdf.js')
      const {pdf}=await createRegulationsPDF({sports:window.__qa.sports})
      console.log('PDF generated',pdf.getNumberOfPages())
      const pdfjs=await import('/node_modules/pdfjs-dist/build/pdf.mjs')
      pdfjs.GlobalWorkerOptions.workerSrc='/node_modules/pdfjs-dist/build/pdf.worker.mjs'
      const doc=await pdfjs.getDocument({data:new Uint8Array(pdf.output('arraybuffer'))}).promise
      console.log('PDF loaded for text extraction')
      let text='';for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i);const content=await page.getTextContent();text+=content.items.map(i=>i.str).join(' ')+'\n'}
      return {pages:doc.numPages,ends:(text.match(/FIMSECAO/g)||[]).length,hasAccents:text.includes('acentuação'),hasOther:text.includes('Xadrez')}
    })
    assert.ok(pdfInfo.pages>10);assert.equal(pdfInfo.ends,5);assert.ok(pdfInfo.hasAccents);assert.ok(pdfInfo.hasOther)
    await page.evaluate(()=>window.location.hash='regulamentos')
    const downloadPromise=page.waitForEvent('download')
    await page.locator('.regulations-page').getByRole('button',{name:'Baixar todos os regulamentos em PDF'}).click()
    const download=await downloadPromise
    assert.equal(download.suggestedFilename(),'regulamentos-interclasse.pdf')
    assert.ok(fs.statSync(await download.path()).size>10000)
    console.log('Long PDF, all five section endings, accents and actual public download: OK',pdfInfo)
    }
    await page.evaluate(()=>window.location.hash='admin')
    await nav.getByRole('button',{name:/Ao vivo \/ TV/}).click()
    const cards=page.locator('.live-control-card')
    await cards.filter({has:page.getByText('Futebol',{exact:true})}).getByRole('button',{name:'Abrir modo árbitro'}).click()
    const referee=page.getByRole('dialog')
    await referee.getByRole('region',{name:'Modo árbitro'}).waitFor()
    await referee.getByRole('button',{name:'Gol de Ana Beatriz · equipe A'}).click()
    await page.getByRole('region',{name:'Modo árbitro'}).getByLabel('Placar: 9ºA 1 a 0 9ºB',{exact:true}).waitFor()
    assert.equal(await page.evaluate(()=>window.__qa.games[0].liveEvents[0].playerName),'Ana')
    assert.equal(await page.evaluate(()=>window.__qa.games[1].liveScoreA),0)
    await referee.getByRole('button',{name:'Desfazer último lance'}).click()
    await page.getByLabel('Placar: 9ºA 0 a 0 9ºB',{exact:true}).waitFor()
    await referee.getByRole('button',{name:'Pausar cronômetro'}).click()
    await referee.getByRole('button',{name:'Retomar cronômetro'}).waitFor()
    await referee.getByRole('button',{name:'Retomar cronômetro'}).click()
    await page.evaluate(()=>window.dispatchEvent(new Event('offline')))
    // Simulate navigator as well, since events alone do not change the browser flag.
    await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});window.dispatchEvent(new Event('offline'))})
    assert.equal(await referee.getByRole('button',{name:'Gol de Ana Beatriz · equipe A'}).isEnabled(),false)
    await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});window.dispatchEvent(new Event('online'))})
    await referee.getByRole('button',{name:'Gol de Ana Beatriz · equipe A'}).click()
    await referee.getByRole('button',{name:'Encerrar partida',exact:true}).click()
    await referee.getByRole('button',{name:'Confirmar resultado',exact:true}).click()
    await referee.waitFor({state:'hidden'})
    assert.equal(await page.evaluate(()=>window.__qa.games[0].status),'finalizado')
    console.log('Referee goals, private attribution, undo, clock, offline block, final confirmation and match isolation: OK')
    await cards.filter({has:page.getByText('Basquete',{exact:true})}).getByRole('button',{name:'Abrir modo árbitro'}).click()
    await referee.getByRole('button',{name:'+3 ponto(s)',exact:true}).click()
    await referee.getByRole('button',{name:'Ponto de Ana Beatriz · equipe A'}).click()
    await page.getByLabel('Placar: 9ºA 3 a 0 9ºB',{exact:true}).waitFor()
    await referee.getByRole('button',{name:'Sair do modo árbitro'}).click()
    await cards.filter({has:page.getByText('Vôlei',{exact:true})}).getByRole('button',{name:'Abrir modo árbitro'}).click()
    await referee.getByRole('button',{name:'Ponto de Bruno Silva · equipe B'}).click()
    await page.getByLabel('Placar: 9ºA 0 a 1 9ºB',{exact:true}).waitFor()
    await referee.getByRole('button',{name:'Encerrar set',exact:true}).click()
    await referee.getByRole('button',{name:'Confirmar encerramento do set'}).click()
    await referee.getByText('2º set · pontos · sets 0 × 1',{exact:true}).waitFor()
    await page.getByLabel('Placar: 9ºA 0 a 0 9ºB',{exact:true}).waitFor()
    await page.setViewportSize({width:390,height:844})
    await page.screenshot({path:'.qa-referee-mobile.png',fullPage:true})
    const layout = await referee.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}))
    assert.ok(layout.scroll<=layout.width+1,JSON.stringify(layout))
    assert.ok(await referee.locator('.quick-score-button').first().evaluate(el=>el.getBoundingClientRect().height)>=96)
    await page.evaluate(()=>window.__qa.finish('g1'))
    await referee.getByText('Esta partida não está mais ao vivo.',{exact:false}).waitFor()
    assert.equal(await referee.locator('.quick-score-button').count(),0)
    await referee.getByRole('button',{name:'Sair do modo árbitro'}).click()
    await cards.filter({has:page.getByText('Xadrez',{exact:true})}).getByRole('button',{name:'Abrir modo árbitro'}).click()
    await referee.getByRole('combobox',{name:'Resultado do xadrez'}).waitFor()
    assert.equal(await referee.locator('.quick-score-button').count(),0)
    console.log('Referee basketball values, volleyball set/points, mobile layout, external finish and chess: OK')
    assert.deepEqual(errors,[])
    await context.close()
  } finally { await browser.close() }
})().catch(error=>{console.error(error);process.exitCode=1})
