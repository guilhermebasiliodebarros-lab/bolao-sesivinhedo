import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRealtimeChannel, recoverCollection } from '../src/utils/realtimeChannel.js'

function setup(read) {
  const timers = new Map(), win = new EventTarget(), doc = new EventTarget(), streams = []
  let serial = 0, stopped = 0, online = true
  const channel = createRealtimeChannel({ read, listen: (next, error) => { streams.push({ next, error }); return () => stopped++ }, environment: { window: win, document: doc, isOnline: () => online, setTimeout: (fn, delay) => { const id = ++serial; timers.set(id, { fn, delay }); return id }, clearTimeout: (id) => timers.delete(id) } })
  return { channel, streams, win, doc, timers, stopped: () => stopped, online: (value) => { online = value; win.dispatchEvent(new Event(value ? 'online' : 'offline')) }, run: (delay) => { const [id, task] = [...timers].find(([, task]) => task.delay === delay) || []; assert.ok(task, `expected timer ${delay}`); timers.delete(id); task.fn() } }
}
const snap = (score, fromCache = false) => ({ score, metadata: { fromCache, hasPendingWrites: false } })
const flush = () => new Promise((resolve) => setImmediate(resolve))

test('manual TV verification refreshes the existing subscriptions and does not send reads while offline', async () => {
  let reads = 0
  const env = setup(async () => { reads++; return snap(2) })
  const received = []
  const stop = env.channel.subscribe((value) => received.push(value.score))
  env.streams[0].next(snap(1))
  env.channel.refresh(); await flush()
  assert.equal(env.streams.length, 2)
  assert.equal(reads, 1)
  assert.deepEqual(received, [1, 2])
  env.online(false); env.channel.refresh(); await flush()
  assert.equal(reads, 1)
  stop(); assert.equal(env.timers.size, 0)
})

test('shared listeners reconnect after terminal errors, preserve cached scores and release timers', () => {
  const env = setup(), first = [], second = [], errors = [], sync = []
  const offA = env.channel.subscribe((value) => first.push(value.score), (error) => errors.push(error), (value) => sync.push(value))
  env.streams[0].next(snap(1))
  const offB = env.channel.subscribe((value) => second.push(value.score))
  assert.equal(env.streams.length, 1)
  assert.deepEqual(second, [1])
  env.streams[0].error(new Error('disconnected'))
  assert.equal(sync.at(-1), false)
  env.run(1000)
  assert.equal(env.streams.length, 2)
  env.streams[0].next(snap(99)) // late callback from a dead connection
  env.streams[1].next(snap(2))
  assert.deepEqual(first, [1, 2])
  assert.deepEqual(second, [1, 2])
  assert.equal(sync.at(-1), true)
  assert.equal(errors.length, 2)
  assert.equal(errors[0].message, 'disconnected')
  assert.equal(errors[1], null) // recovering also clears the consumer's old error message
  offA(); assert.equal(env.stopped(), 1)
  offB(); assert.equal(env.stopped(), 2)
  assert.equal(env.timers.size, 0)
})
test('a slow recovery read never overwrites a more recent live score or revives an unmounted feed', async () => {
  let complete
  const env = setup(() => new Promise((resolve) => { complete = resolve })), scores = []
  const off = env.channel.subscribe((value) => scores.push(value.score))
  env.streams[0].next(snap(1))
  env.run(30000)
  env.streams[0].next(snap(3))
  complete(snap(2)); await flush()
  assert.deepEqual(scores, [1, 3])
  env.run(30000)
  off(); complete(snap(4)); await flush()
  assert.deepEqual(scores, [1, 3])
  assert.equal(env.timers.size, 0)
})
test('a silent stream is repaired without reload, and network or visibility recovery restarts it', async () => {
  let reads = 0
  const env = setup(async () => { reads++; return snap(2) }), scores = [], sync = []
  const off = env.channel.subscribe((value) => scores.push(value.score), null, (value) => sync.push(value))
  env.streams[0].next(snap(1))
  env.run(30000); await flush()
  assert.deepEqual(scores, [1, 2])
  env.online(false); assert.equal(sync.at(-1), false)
  env.run(30000); await flush(); assert.equal(reads, 1)
  env.online(true); await flush(); assert.equal(env.streams.length, 2)
  docVisible(env, true); env.run(30000); await flush(); assert.equal(reads, 2)
  docVisible(env, false); await flush(); assert.equal(env.streams.length, 3)
  off()
})
function docVisible(env, hidden) { env.doc.hidden = hidden; env.doc.dispatchEvent(new Event('visibilitychange')) }
const document = (id, updated, score) => ({ id, data: () => ({ updatedAt: updated === null ? null : { toMillis: () => updated }, score }) })
test('incremental recovery merges updates and falls back to a full read for deletions or no timestamp', async () => {
  const old = { docs: [document('one', 10, 1), document('legacy', null, 0)], metadata: { fromCache: false } }
  let fullReads = 0, count = 2, changed = [document('one', 11, 2)]
  const options = { readAll: async () => { fullReads++; return 'full' }, readChanged: async (cursor) => { assert.equal(cursor.toMillis(), 10); return { docs: changed } }, readCount: async () => count }
  const result = await recoverCollection(old, options)
  assert.equal(result.docs.find((item) => item.id === 'one').data().score, 2)
  assert.equal(result.docs.length, 2)
  assert.equal(fullReads, 0)
  count = 1; assert.equal(await recoverCollection(old, options), 'full')
  count = 2; changed = [document('replacement', 12, 0)]; assert.equal(await recoverCollection(old, options), 'full')
  assert.equal(await recoverCollection(undefined, options), 'full')
  assert.equal(await recoverCollection({ docs: [document('legacy', null, 0)] }, options), 'full')
})
