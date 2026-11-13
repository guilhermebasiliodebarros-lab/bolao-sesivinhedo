import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APP_ORIGIN, PROJECT, resetRehearsal } from './rehearsal-data.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const children = []
const wait = (ms) => new Promise((done) => setTimeout(done, ms))

async function javaEnvironment() {
  const installed = spawnSync('java', ['-version'], { encoding: 'utf8', windowsHide: true })
  if (!installed.error && Number((installed.stderr || installed.stdout).match(/version "(\d+)/)?.[1]) >= 21) return { ...process.env }
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Instale Java 21 ou superior para iniciar o emulador do ensaio.')
  const cache = join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'interclasse-qa-tools', 'java21')
  mkdirSync(cache, { recursive: true })
  const findJava = () => readdirSync(cache, { withFileTypes: true }).filter((item) => item.isDirectory()).map((item) => join(cache, item.name)).find((dir) => existsSync(join(dir, 'bin', 'java.exe')))
  let javaDir = findJava()
  if (!javaDir) {
    console.log('Preparando Java portátil para o ensaio. Ele fica no cache local, sem alterar a instalação do Windows…')
    const metadata = await fetch('https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jre&os=windows&vendor=eclipse', { signal: AbortSignal.timeout(120000) })
    if (!metadata.ok) throw new Error('Não foi possível consultar o Java portátil.')
    const asset = (await metadata.json())[0].binary.package
    const archive = join(cache, 'temurin21-jre.zip')
    if (!existsSync(archive) || createHash('sha256').update(readFileSync(archive)).digest('hex') !== asset.checksum) {
      const response = await fetch(asset.link, { signal: AbortSignal.timeout(120000) })
      if (!response.ok) throw new Error('Não foi possível baixar o Java portátil.')
      const bytes = Buffer.from(await response.arrayBuffer())
      if (createHash('sha256').update(bytes).digest('hex') !== asset.checksum) throw new Error('O arquivo Java não passou na verificação de integridade.')
      writeFileSync(archive, bytes)
    }
    const quote = (value) => `'${value.replaceAll("'", "''")}'`
    const extracted = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(cache)} -Force`], { windowsHide: true, stdio: 'inherit' })
    if (extracted.status !== 0 || !(javaDir = findJava())) throw new Error('Não foi possível preparar o Java portátil.')
  }
  return { ...process.env, JAVA_HOME: javaDir, PATH: `${join(javaDir, 'bin')};${process.env.PATH}` }
}

async function checkPort(port) {
  await new Promise((done, failed) => {
    const server = createServer()
    server.once('error', () => failed(new Error(`A porta ${port} já está ocupada. Feche o ensaio anterior antes de iniciar outro.`)))
    server.listen(port, '127.0.0.1', () => server.close(done))
  })
}

let stopping = false
function stop() {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    else child.kill('SIGTERM')
  }
}
process.on('SIGINT', () => { stop(); process.exit(0) })
process.on('SIGTERM', () => { stop(); process.exit(0) })
process.on('exit', stop)

try {
  for (const port of [9909, 8180, 4001, 4401, 4501, 5179]) await checkPort(port)
  const env = await javaEnvironment()
  console.log('Iniciando ensaio local: autenticação e banco de teste. Os dados oficiais não serão utilizados.')
  const args = ['--yes', 'firebase-tools@15.36.0', 'emulators:start', '--project', PROJECT, '--only', 'auth,firestore', '--config', 'firebase.rehearsal.json', '--non-interactive']
  const emulators = process.platform === 'win32'
    ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npx ${args.join(' ')}`], { cwd: root, env, windowsHide: true, stdio: 'inherit' })
    : spawn('npx', args, { cwd: root, env, stdio: 'inherit' })
  children.push(emulators)
  emulators.once('exit', (code) => { if (!stopping) { console.error(`O emulador encerrou (${code}).`); stop(); process.exitCode = 1 } })
  let ready = false
  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (emulators.exitCode !== null) throw new Error('Os emuladores não iniciaram. Confira a mensagem acima.')
    try {
      const response = await fetch('http://127.0.0.1:4401/emulators', { signal: AbortSignal.timeout(1000) })
      const endpoints = await response.json()
      if (endpoints.auth && endpoints.firestore) {
        const database = await fetch(`http://127.0.0.1:8180/v1/projects/${PROJECT}/databases/(default)/documents/games?pageSize=1`, { headers: { Authorization: 'Bearer owner' }, signal: AbortSignal.timeout(2000) })
        if (database.ok) { ready = true; break }
      }
    } catch { /* Initial download and startup can take a little longer on the first run. */ }
    await wait(1000)
  }
  if (!ready) throw new Error('Os emuladores demoraram a iniciar. Execute npm run ensaio novamente após o download terminar.')
  await resetRehearsal()
  const vite = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '5179', '--strictPort', '--mode', 'rehearsal'], { cwd: root, env, windowsHide: true, stdio: 'inherit' })
  children.push(vite)
  vite.once('exit', () => { if (!stopping) { stop(); process.exitCode = 1 } })
  console.log(`\nENSAIO LOCAL: ${APP_ORIGIN}/#login\nTV DE TESTE: ${APP_ORIGIN}/#placar\nOrganizador: suporte | Professor: professor@ensaio.local | Consulta: sesivinhedo\nSenha dessas contas fictícias: Ensaio2026!\nReiniciar os testes: npm run ensaio:reiniciar\nEncerrar: Ctrl+C\n`)
} catch (error) { console.error(error.message); stop(); process.exitCode = 1 }
