import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const roots = ['README.md', 'index.html', 'src']
const allowedExtensions = new Set(['.js', '.jsx', '.md', '.html'])
const ignoredSnippets = [
  /voce@email\.com/gi,
  /onNavigate\('[^']+'\)/g,
  /id: '[^']+'/g,
  /COPY\.nav\.[A-Za-z]+/g,
]

const visibleTextMarkers = [
  '<h',
  '<p',
  '<span',
  '<strong',
  '<small',
  '<em',
  '<button',
  'aria-label',
  'alt=',
  'placeholder',
  'title=',
  'description',
  'label:',
  'setMessage',
  'Error(',
  'successMessage',
  'confirmLabel',
  'LoadingState',
  'eyebrow:',
  'intro:',
  'tagline:',
  'scoring:',
  'switchText:',
  'missingFields:',
  'shortPassword:',
  'Placeholder:',
  'passwordPlaceholder:',
  'namePlaceholder:',
]

const forbiddenTerms = [
  ['Bolao', 'Bolão'],
  ['bolao', 'bolão'],
  ['Calendario', 'Calendário'],
  ['calendario', 'calendário'],
  ['classificacao', 'classificação'],
  ['pontuacao', 'pontuação'],
  ['organizacao', 'organização'],
  ['usuario', 'usuário'],
  ['usuarios', 'usuários'],
  ['Usuario', 'Usuário'],
  ['Usuarios', 'Usuários'],
  ['Voce', 'Você'],
  ['voce', 'você'],
  ['Nao', 'Não'],
  ['nao', 'não'],
  ['area', 'área'],
  ['unica', 'única'],
  ['Proximos', 'Próximos'],
  ['proximos', 'próximos'],
  ['Ultimo', 'Último'],
  ['Historico', 'Histórico'],
  ['Podio', 'Pódio'],
  ['Posicao', 'Posição'],
  ['ate', 'até'],
  ['horario', 'horário'],
  ['pagina', 'página'],
  ['sera', 'será'],
  ['acao', 'ação'],
  ['administracao', 'administração'],
  ['Eliminatorias', 'Eliminatórias'],
  ['padrao', 'padrão'],
  ['alteracoes', 'alterações'],
  ['situacao', 'situação'],
  ['Confirmacao', 'Confirmação'],
  ['valida', 'válida'],
  ['validos', 'válidos'],
  ['indice', 'índice'],
  ['excluido', 'excluído'],
  ['autenticacao', 'autenticação'],
  ['permissao', 'permissão'],
  ['conexao', 'conexão'],
  ['seguranca', 'segurança'],
  ['lancado', 'lançado'],
  ['Minimo', 'Mínimo'],
  ['Ja', 'Já'],
]

function walk(entry) {
  if (!existsSync(entry)) {
    return []
  }

  const stats = statSync(entry)

  if (stats.isFile()) {
    return allowedExtensions.has(path.extname(entry)) ? [entry] : []
  }

  return readdirSync(entry).flatMap((child) => walk(path.join(entry, child)))
}

function isRelevantLine(file, line) {
  if (file.endsWith('.md') || file.endsWith('.html')) {
    return true
  }

  return visibleTextMarkers.some((marker) => line.includes(marker))
}

function stripIgnoredSnippets(line) {
  return ignoredSnippets.reduce((current, pattern) => current.replace(pattern, ''), line)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const files = roots.flatMap(walk)
const findings = []

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)

  lines.forEach((line, index) => {
    if (!isRelevantLine(file, line)) {
      return
    }

    const searchableLine = stripIgnoredSnippets(line)

    forbiddenTerms.forEach(([bad, good]) => {
      const pattern = new RegExp(`\\b${escapeRegExp(bad)}\\b`, 'g')

      if (pattern.test(searchableLine)) {
        findings.push({
          file,
          line: index + 1,
          bad,
          good,
          text: line.trim(),
        })
      }
    })
  })
}

if (findings.length) {
  console.error('Foram encontrados textos possivelmente sem acento:\n')

  findings.forEach((finding) => {
    console.error(`${finding.file}:${finding.line} "${finding.bad}" -> "${finding.good}"`)
    console.error(`  ${finding.text}`)
  })

  process.exit(1)
}

console.log('Copy check OK: nenhum texto comum sem acento encontrado.')
