import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readRegulationDraft, writeRegulationDraft } from '../src/utils/regulationDrafts.js'
import { normalizeRegulation } from '../src/utils/regulations.js'

const memoryStorage = () => {
  const items = new Map()
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: (key) => items.delete(key) }
}

test('drafts survive reloads with all five long sections, whitespace and original revision; isolate accounts and sports', () => {
  const storage = memoryStorage()
  const draft = { revision: 4, updatedAt: 12345, value: Object.fromEntries(Object.keys(normalizeRegulation()).map((id) => [id, `  ${'á'.repeat(9995)} \n`])) }
  assert.equal(writeRegulationDraft('master-a', 'fut', draft, storage), '')
  assert.deepEqual(readRegulationDraft('master-a', 'fut', storage).draft, draft)
  assert.equal(readRegulationDraft('master-b', 'fut', storage).draft, null)
  assert.equal(readRegulationDraft('master-a', 'volei', storage).draft, null)
  writeRegulationDraft('master-a', 'volei', { ...draft, revision: 7 }, storage)
  writeRegulationDraft('master-a', 'fut', null, storage)
  assert.equal(readRegulationDraft('master-a', 'fut', storage).draft, null)
  assert.equal(readRegulationDraft('master-a', 'volei', storage).draft.revision, 7)
})

test('corrupt or overlong drafts and unavailable browser storage give recoverable errors', () => {
  const storage = memoryStorage()
  for (const draft of [{ revision: -1 }, { revision: 1, updatedAt: 1, value: { ...normalizeRegulation(), notes: 'a'.repeat(10001) } }]) {
    writeRegulationDraft('master', 'sport', draft, storage)
    const result = readRegulationDraft('master', 'sport', storage)
    assert.equal(result.draft, null)
    assert.match(result.error, /recuperar/)
  }
  const broken = { getItem() { throw Error('denied') }, setItem() { throw Error('quota') }, removeItem() { throw Error('denied') } }
  assert.match(readRegulationDraft('master', 'sport', broken).error, /recuperar/)
  assert.match(writeRegulationDraft('master', 'sport', {}, broken), /não conseguiu guardar/)
  assert.match(writeRegulationDraft('master', 'sport', null, broken), /não conseguiu guardar/)
  assert.match(writeRegulationDraft('', 'sport', {}, storage), /não conseguiu guardar/)
})
