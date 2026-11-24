import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const decodeField = (field) => field == null ? null : 'stringValue' in field ? field.stringValue : 'timestampValue' in field ? new Date(field.timestampValue) : 'integerValue' in field ? Number(field.integerValue) : 'doubleValue' in field ? field.doubleValue : 'booleanValue' in field ? field.booleanValue : field.arrayValue ? (field.arrayValue.values || []).map(decodeField) : field.mapValue ? Object.fromEntries(Object.entries(field.mapValue.fields || {}).map(([key, value]) => [key, decodeField(value)])) : null
export const record = (doc) => ({ ...Object.fromEntries(Object.entries(doc.fields || {}).map(([key, value]) => [key, decodeField(value)])), id: doc.name.split('/').at(-1) })
const encode = (value) => value === null ? { nullValue: null } : value instanceof Date ? { timestampValue: value.toISOString() } : Array.isArray(value) ? { arrayValue: { values: value.map(encode) } } : typeof value === 'object' ? { mapValue: { fields: fields(value) } } : typeof value === 'boolean' ? { booleanValue: value } : typeof value === 'number' ? Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value } : { stringValue: String(value) }
export const fields = (value) => Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]))

export async function createFirestoreClient({ project, emulator = false }) {
  const configured = JSON.parse(readFileSync(join(root, '.firebaserc'), 'utf8')).projects.default
  if (!project || (emulator ? !/^demo-[a-z0-9-]+$/.test(project) : project !== configured)) throw new Error('Informe o projeto configurado, ou um projeto demo com --emulator.')
  const base = `${emulator ? 'http://127.0.0.1:8180' : 'https://firestore.googleapis.com'}/v1/projects/${project}/databases/(default)/documents`
  let bearer = 'owner'
  if (!emulator) {
    const require = createRequire(import.meta.url)
    const caches = [join(root, 'node_modules', 'firebase-tools'), ...[join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), join(homedir(), '.npm', '_npx')].filter(existsSync).flatMap((cache) => readdirSync(cache).map((entry) => join(cache, entry, 'node_modules', 'firebase-tools')))]
    const installation = caches.find((path) => existsSync(join(path, 'lib', 'auth.js')))
    if (!installation) throw new Error('Entre na sua conta usando o Firebase CLI antes de sincronizar.')
    const auth = require(join(installation, 'lib', 'auth.js')), account = auth.getGlobalDefaultAccount()
    if (!account?.tokens?.refresh_token) throw new Error('Entre na sua conta usando o Firebase CLI antes de sincronizar.')
    bearer = (await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase'])).access_token
  }
  async function request(path, options = {}, allowMissing = false) {
    const response = await fetch(`${base}${path}`, { ...options, headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(60000) })
    if (allowMissing && response.status === 404) return null
    const data = await response.json()
    if (!response.ok) throw new Error(`Firestore ${response.status}: ${data.error?.message || 'A operação não foi concluída.'}`)
    return data
  }
  async function list(path) {
    const docs = []; let pageToken = ''
    do {
      const data = await request(`/${path}?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`)
      docs.push(...data.documents || []); pageToken = data.nextPageToken || ''
    } while (pageToken)
    return docs
  }
  return { project, request, list, documentName: (path) => `projects/${project}/databases/(default)/documents/${path}` }
}
