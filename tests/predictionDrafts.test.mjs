import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clearPredictionDraft, parsePredictionDraft, predictionDraftKey, predictionDraftScope, readPredictionDraftRaw, writePredictionDraft } from '../src/utils/predictionDrafts.js'
const storage = () => { const data = new Map(); return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) } }
const game = { id: 'match', timeA: '6º A', timeB: '6º B' }

test('drafts recover exact text per participant and match without becoming submitted predictions', () => {
  const target = storage(), key = predictionDraftKey('alice', game.id), scope = predictionDraftScope('alice', game)
  assert.equal(writePredictionDraft(key, { palpiteA: '0.5', palpiteB: '' }, scope, target), '')
  assert.deepEqual(parsePredictionDraft(readPredictionDraftRaw(key, target), scope).draft.value, { palpiteA: '0.5', palpiteB: '' })
  assert.equal(readPredictionDraftRaw(predictionDraftKey('bob', game.id), target), null)
  assert.equal(readPredictionDraftRaw(predictionDraftKey('alice', 'other'), target), null)
  assert.equal(parsePredictionDraft(readPredictionDraftRaw(key, target), predictionDraftScope('alice', { ...game, timeB: '7º A' })).draft, null)
  assert.equal(parsePredictionDraft(readPredictionDraftRaw(key, target), predictionDraftScope('alice', game, { palpiteA: 1, palpiteB: 2 })).draft, null)
})
test('saving or discarding never erases a newer draft from another tab', () => {
  const target = storage(), key = predictionDraftKey('alice', 'match'), scope = predictionDraftScope('alice', game)
  writePredictionDraft(key, { palpiteA: '1', palpiteB: '2' }, scope, target)
  const old = target.getItem(key)
  writePredictionDraft(key, { palpiteA: '3', palpiteB: '2' }, scope, target)
  clearPredictionDraft(key, old, target)
  assert.equal(parsePredictionDraft(target.getItem(key), scope).draft.value.palpiteA, '3')
  clearPredictionDraft(key, target.getItem(key), target)
  assert.equal(target.getItem(key), null)
})
test('corrupt or inaccessible browser storage reports recovery limits without crashing', () => {
  assert.equal(parsePredictionDraft('{broken', 'scope').draft, null)
  assert.ok(parsePredictionDraft('{broken', 'scope').error)
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('quota') } }
  assert.equal(readPredictionDraftRaw('key', blocked), '!unavailable')
  assert.ok(writePredictionDraft('key', { palpiteA: '1', palpiteB: '' }, 'scope', blocked))
  assert.ok(parsePredictionDraft('!unavailable', 'scope').error)
})
