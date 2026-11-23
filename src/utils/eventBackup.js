export const BACKUP_FORMAT = 'interclasse-event-backup'
export const BACKUP_VERSION = 1
export const BACKUP_MAX_BYTES = 50 * 1024 * 1024
export const BACKUP_MAX_DOCUMENTS = 20000
export const BACKUP_COLLECTIONS = ['sports', 'teams', 'games', 'predictions', 'announcements', 'broadcastSettings', 'operations', 'scheduleNotices']
export const BACKUP_LABELS = { sports: 'Modalidades e regulamentos', teams: 'Equipes e atletas', games: 'Partidas, súmulas e lances', predictions: 'Palpites', announcements: 'Avisos da TV', broadcastSettings: 'Configurações da TV', operations: 'Disciplina e operações', scheduleNotices: 'Novidades da programação' }
const plainObject = (value) => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))

export function validBackupPath(path) {
  if (typeof path !== 'string') return false
  const parts = path.split('/')
  if (parts.some((part) => !part || part.length > 256 || ['.', '..'].includes(part))) return false
  if (parts.length === 2) return BACKUP_COLLECTIONS.includes(parts[0])
  return parts.length === 4 && ((parts[0] === 'teams' && parts[2] === 'players') || (parts[0] === 'games' && ['events', 'documents'].includes(parts[2])))
}

export function encodeBackupValue(value, depth = 0) {
  if (depth > 30) throw new Error('O arquivo contém dados com profundidade excessiva.')
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error('Foi encontrada uma data inválida.')
    const seconds = Math.floor(value.getTime() / 1000)
    return { $type: 'timestamp', seconds, nanoseconds: (value.getTime() - seconds * 1000) * 1000000 }
  }
  if (value && typeof value.toDate === 'function' && Number.isInteger(value.seconds) && Number.isInteger(value.nanoseconds)) return { $type: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds }
  if (Array.isArray(value)) return value.map((item) => encodeBackupValue(item, depth + 1))
  if (!plainObject(value)) throw new Error('O backup encontrou um tipo de dado não suportado.')
  if (Object.keys(value).some((key) => ['$type', '__proto__', 'constructor', 'prototype'].includes(key))) throw new Error('O arquivo contém um campo reservado.')
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeBackupValue(item, depth + 1)]))
}

export function decodeBackupValue(value, timestamp, depth = 0) {
  if (depth > 30) throw new Error('O arquivo contém dados com profundidade excessiva.')
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map((item) => decodeBackupValue(item, timestamp, depth + 1))
  if (!plainObject(value)) throw new Error('O arquivo contém um valor inválido.')
  if (value.$type === 'timestamp') {
    if (Object.keys(value).length !== 3 || !Number.isInteger(value.seconds) || value.seconds < -62135596800 || value.seconds > 253402300799 || !Number.isInteger(value.nanoseconds) || value.nanoseconds < 0 || value.nanoseconds >= 1000000000) throw new Error('O arquivo contém uma data inválida.')
    return timestamp(value.seconds, value.nanoseconds)
  }
  if (Object.keys(value).some((key) => ['$type', '__proto__', 'constructor', 'prototype'].includes(key))) throw new Error('O arquivo contém um campo reservado.')
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeBackupValue(item, timestamp, depth + 1)]))
}

export function canonicalBackupValue(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalBackupValue).join(',')}]`
  if (plainObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalBackupValue(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

const checksum = async (value) => {
  const bytes = new TextEncoder().encode(canonicalBackupValue(value))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function createEventBackup(projectId, records, now = new Date()) {
  if (!projectId) throw new Error('Não foi possível identificar o projeto do backup.')
  if (records.length > BACKUP_MAX_DOCUMENTS) throw new Error('O backup excede o limite de 20.000 registros.')
  const payload = {
    format: BACKUP_FORMAT, version: BACKUP_VERSION, projectId, createdAt: now.toISOString(),
    excluded: ['Contas e senhas de acesso', 'Aprovações de professores', 'Preferências pessoais'],
    documents: records.map(({ path, data }) => {
      if (!validBackupPath(path)) throw new Error('O backup contém um caminho não permitido.')
      const encoded = encodeBackupValue(data)
      if (new TextEncoder().encode(JSON.stringify(encoded)).length > 850 * 1024) throw new Error('Um registro excede o tamanho permitido para recuperação. Reduza esse registro antes de exportar.')
      return { path, data: encoded }
    }).sort((a, b) => a.path.localeCompare(b.path)),
  }
  const backup = { ...payload, checksum: await checksum(payload) }
  if (new TextEncoder().encode(JSON.stringify(backup)).length > BACKUP_MAX_BYTES) throw new Error('O backup excede o limite de 50 MB.')
  return backup
}

export async function validateEventBackup(input, projectId) {
  if (!plainObject(input) || input.format !== BACKUP_FORMAT || input.version !== BACKUP_VERSION) throw new Error('Este arquivo não é um backup compatível do Interclasse.')
  if (input.projectId !== projectId) throw new Error('Este backup pertence a outro projeto. Use um arquivo deste mesmo ambiente.')
  if (!Number.isFinite(new Date(input.createdAt).getTime()) || typeof input.checksum !== 'string' || !Array.isArray(input.documents) || input.documents.length > BACKUP_MAX_DOCUMENTS) throw new Error('O arquivo de backup está incompleto ou inválido.')
  const seen = new Set()
  for (const record of input.documents) {
    if (!plainObject(record) || !validBackupPath(record.path) || seen.has(record.path) || !plainObject(record.data)) throw new Error('O arquivo contém caminhos inválidos, duplicados ou dados fora do campeonato.')
    seen.add(record.path)
    if (new TextEncoder().encode(JSON.stringify(record.data)).length > 850 * 1024) throw new Error('Um registro do arquivo excede o tamanho permitido para recuperação.')
    decodeBackupValue(record.data, (seconds, nanoseconds) => ({ seconds, nanoseconds }))
    if (record.path.startsWith('games/') && record.path.split('/').length === 2 && record.data.deletionPending) throw new Error('O arquivo contém uma exclusão de partidas ainda em andamento. Use uma cópia concluída.')
  }
  if (input.documents.some(({ path }) => path.split('/').length === 4 && !seen.has(path.split('/').slice(0, 2).join('/')))) throw new Error('O arquivo não contém a equipe ou partida dos registros privados. Escolha um backup completo.')
  if (new TextEncoder().encode(JSON.stringify(input)).length > BACKUP_MAX_BYTES) throw new Error('O backup excede o limite de 50 MB.')
  const { checksum: supplied, ...payload } = input
  if (await checksum(payload) !== supplied) throw new Error('O arquivo foi alterado ou está corrompido. Escolha outra cópia de segurança.')
  return input
}

export function backupCounts(documents) {
  const counts = Object.fromEntries(BACKUP_COLLECTIONS.map((name) => [name, 0]))
  for (const { path } of documents) counts[path.split('/')[0]] += 1
  return counts
}

export function planEventRestore(backup, currentRecords, mode = 'missing') {
  if (!['missing', 'replace'].includes(mode)) throw new Error('Escolha uma forma válida de recuperação.')
  const current = new Map(currentRecords.map((record) => [record.path, record]))
  const changes = [], counts = { created: 0, replaced: 0, preserved: 0 }
  for (const record of backup.documents) {
    const previous = current.get(record.path)
    const before = previous ? canonicalBackupValue(encodeBackupValue(previous.data)) : null
    if (record.path === 'operations/liveMatches' || before === canonicalBackupValue(record.data) || (previous && mode === 'missing')) { counts.preserved++; continue }
    changes.push({ path: record.path, data: record.data, before })
    counts[previous ? 'replaced' : 'created']++
  }
  return { changes, counts, mode, projectId: backup.projectId, backupCreatedAt: backup.createdAt, backupChecksum: backup.checksum }
}

export function eventRestoreChunks(records) {
  const chunks = []
  let chunk = [], gameParents = new Set()
  for (const record of records) {
    const parts = record.path.split('/')
    const parent = parts[0] === 'games' && parts.length === 4 ? parts.slice(0, 2).join('/') : null
    // Keep private-game writes within the access-call limits of the existing server rules.
    if (chunk.length >= 100 || (parent && !gameParents.has(parent) && gameParents.size >= 8)) { chunks.push(chunk); chunk = []; gameParents = new Set() }
    chunk.push(record)
    if (parent) gameParents.add(parent)
  }
  if (chunk.length) chunks.push(chunk)
  return chunks
}
